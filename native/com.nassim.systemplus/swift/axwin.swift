import Cocoa
// axwin get | set x y w h | fullscreen  — on the app owning the topmost normal window (asyar excluded)
let args = CommandLine.arguments
let l = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as! [[String: Any]]
var pid: pid_t = 0; var wid: Int = 0
for w in l { let o = (w["kCGWindowOwnerName"] as? String) ?? ""; let b = w["kCGWindowBounds"] as! [String: Any]
  if (w["kCGWindowLayer"] as! Int) == 0 && o != "asyar" && o != "WindowManager" && ((w["kCGWindowAlpha"] as? Double) ?? 1) > 0 && (b["Height"] as! Double) > 50 { pid = w["kCGWindowOwnerPID"] as! pid_t; wid = w["kCGWindowNumber"] as! Int; break } }
if pid == 0 { fputs("no target window\n", stderr); exit(2) }
let app = AXUIElementCreateApplication(pid)
var wins: CFTypeRef?; AXUIElementCopyAttributeValue(app, kAXWindowsAttribute as CFString, &wins)
guard let windows = wins as? [AXUIElement], !windows.isEmpty else { fputs("no AX windows (accessibility?)\n", stderr); exit(3) }
// match the CG window by id when possible, else first window
var target = windows[0]
for w in windows { var n: CGWindowID = 0; if _AXUIElementGetWindow(w, &n) == .success && Int(n) == wid { target = w; break } }
func get() -> (CGFloat, CGFloat, CGFloat, CGFloat) {
  var p: CFTypeRef?, s: CFTypeRef?; AXUIElementCopyAttributeValue(target, kAXPositionAttribute as CFString, &p); AXUIElementCopyAttributeValue(target, kAXSizeAttribute as CFString, &s)
  var pt = CGPoint.zero, sz = CGSize.zero; AXValueGetValue(p as! AXValue, .cgPoint, &pt); AXValueGetValue(s as! AXValue, .cgSize, &sz); return (pt.x, pt.y, sz.width, sz.height) }
var name: CFTypeRef?; AXUIElementCopyAttributeValue(app, kAXTitleAttribute as CFString, &name)
switch args.count > 1 ? args[1] : "get" {
case "set":
  var pt = CGPoint(x: Double(args[2])!, y: Double(args[3])!); var sz = CGSize(width: Double(args[4])!, height: Double(args[5])!)
  let pv = AXValueCreate(.cgPoint, &pt)!, sv = AXValueCreate(.cgSize, &sz)!
  AXUIElementSetAttributeValue(target, kAXPositionAttribute as CFString, pv); AXUIElementSetAttributeValue(target, kAXSizeAttribute as CFString, sv); AXUIElementSetAttributeValue(target, kAXPositionAttribute as CFString, pv)
case "fullscreen":
  var v: CFTypeRef?; AXUIElementCopyAttributeValue(target, "AXFullScreen" as CFString, &v); let cur = (v as? Bool) ?? false
  AXUIElementSetAttributeValue(target, "AXFullScreen" as CFString, (!cur) as CFTypeRef)
default: break }
let (x, y, w, h) = get(); print("\((name as? String) ?? "?")|\(Int(x))|\(Int(y))|\(Int(w))|\(Int(h))")
