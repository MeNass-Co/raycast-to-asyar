import Cocoa
// axwin get | set x y w h | fullscreen  — on the app owning the topmost normal window (asyar excluded)
let args = CommandLine.arguments
let l = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as! [[String: Any]]
var lastAXErr: [Int32] = []
func bounds(_ w: AXUIElement) -> (CGFloat, CGFloat, CGFloat, CGFloat) {
  var p: CFTypeRef?, s: CFTypeRef?
  var e1 = AXUIElementCopyAttributeValue(w, kAXPositionAttribute as CFString, &p); var e2 = AXUIElementCopyAttributeValue(w, kAXSizeAttribute as CFString, &s)
  var tries = 0
  while (e1 != .success || e2 != .success) && tries < 4 { usleep(150_000); tries += 1; e1 = AXUIElementCopyAttributeValue(w, kAXPositionAttribute as CFString, &p); e2 = AXUIElementCopyAttributeValue(w, kAXSizeAttribute as CFString, &s) }
  if e1 != .success || e2 != .success { lastAXErr.append(e1.rawValue); lastAXErr.append(e2.rawValue) }
  var pt = CGPoint.zero, sz = CGSize.zero
  if let pv = p, CFGetTypeID(pv) == AXValueGetTypeID() { AXValueGetValue(pv as! AXValue, .cgPoint, &pt) }
  if let sv = s, CFGetTypeID(sv) == AXValueGetTypeID() { AXValueGetValue(sv as! AXValue, .cgSize, &sz) }
  return (pt.x, pt.y, sz.width, sz.height) }
// Walk normal on-screen windows in z-order (asyar's panel excluded). For each, find its AX twin (by window
// id, else by bounds) and keep the first that has a real size: an inactive app can list a hidden helper
// window first (Safari does), whose AX twin reports 0×0.
var target: AXUIElement? = nil; var app: AXUIElement? = nil; var axWindowsCache: [pid_t: [AXUIElement]] = [:]
for w in l {
  let o = (w["kCGWindowOwnerName"] as? String) ?? ""; let b = (w["kCGWindowBounds"] as? [String: Any]) ?? [:]
  let layer = (w["kCGWindowLayer"] as? Int) ?? -1, alpha = (w["kCGWindowAlpha"] as? Double) ?? 1
  let cx = (b["X"] as? Double) ?? -1, cy = (b["Y"] as? Double) ?? -1, cw = (b["Width"] as? Double) ?? 0, ch = (b["Height"] as? Double) ?? 0
  guard layer == 0, o != "asyar", o != "WindowManager", alpha > 0, ch > 50, cw > 50, let pid = w["kCGWindowOwnerPID"] as? pid_t else { continue }
  let wid = (w["kCGWindowNumber"] as? Int) ?? 0
  let a = AXUIElementCreateApplication(pid)
  if axWindowsCache[pid] == nil { var ws: CFTypeRef?; AXUIElementCopyAttributeValue(a, kAXWindowsAttribute as CFString, &ws); axWindowsCache[pid] = (ws as? [AXUIElement]) ?? [] }
  let windows = axWindowsCache[pid]!
  var cand: AXUIElement? = nil
  for x in windows { var n: CGWindowID = 0; if _AXUIElementGetWindow(x, &n) == .success && Int(n) == wid { cand = x; break } }
  if cand == nil { for x in windows { let (x0, y0, w0, h0) = bounds(x); if abs(x0 - cx) < 2 && abs(y0 - cy) < 2 && abs(w0 - cw) < 2 && abs(h0 - ch) < 2 { cand = x; break } } }
  if let c = cand { let (_, _, w0, h0) = bounds(c); if w0 > 0 && h0 > 0 { target = c; app = a; break } }
}
guard let target, let app else { fputs("no target window; AX errors: \(lastAXErr) (accessibility granted?)\n", stderr); exit(3) }
func get() -> (CGFloat, CGFloat, CGFloat, CGFloat) { bounds(target) }
var name: CFTypeRef?; AXUIElementCopyAttributeValue(app, kAXTitleAttribute as CFString, &name)
switch args.count > 1 ? args[1] : "get" {
case "set":
  guard args.count >= 6, let x = Double(args[2]), let y = Double(args[3]), let ww = Double(args[4]), let hh = Double(args[5]) else { fputs("usage: set x y w h\n", stderr); exit(4) }
  var pt = CGPoint(x: x, y: y); var sz = CGSize(width: ww, height: hh)
  let pv = AXValueCreate(.cgPoint, &pt)!, sv = AXValueCreate(.cgSize, &sz)!
  let r1 = AXUIElementSetAttributeValue(target, kAXPositionAttribute as CFString, pv); let r2 = AXUIElementSetAttributeValue(target, kAXSizeAttribute as CFString, sv); _ = AXUIElementSetAttributeValue(target, kAXPositionAttribute as CFString, pv)
  if r1 != .success || r2 != .success { fputs("set failed: \(r1.rawValue) \(r2.rawValue)\n", stderr); exit(6) }
case "fullscreen":
  // Pressing the green button works without activating the app; setting AXFullScreen fails (-25205) when inactive.
  var btn: CFTypeRef?; AXUIElementCopyAttributeValue(target, "AXFullScreenButton" as CFString, &btn)
  var r = AXError.cannotComplete
  if let b = btn { r = AXUIElementPerformAction(b as! AXUIElement, kAXPressAction as CFString) }
  if r != .success { var v: CFTypeRef?; AXUIElementCopyAttributeValue(target, "AXFullScreen" as CFString, &v); let cur = (v as? Bool) ?? false; r = AXUIElementSetAttributeValue(target, "AXFullScreen" as CFString, (cur ? kCFBooleanFalse : kCFBooleanTrue)) }
  if r != .success { fputs("fullscreen toggle failed: \(r.rawValue)\n", stderr); exit(5) }
default: break }
let (x, y, w, h) = get(); print("\((name as? String) ?? "?")|\(Int(x))|\(Int(y))|\(Int(w))|\(Int(h))")
