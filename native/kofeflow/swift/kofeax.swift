import Cocoa
// kofeax read            → JSON {"texts":[…],"buttons":[{"help":"","desc":"button","w":542,"x":438}]} of Kofe Flow's first window
// kofeax click <index>   → clicks the <index>-th (1-based) button of that list, then prints the same JSON
// Milliseconds instead of the 2–3 s an AppleScript `entire contents` walk costs on this window.
let args = CommandLine.arguments
guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: "com.rahulmfg.kofeflow").first else { fputs("Kofe Flow is not running\n", stderr); exit(2) }
let ax = AXUIElementCreateApplication(app.processIdentifier)
func attr(_ e: AXUIElement, _ name: String) -> CFTypeRef? { var v: CFTypeRef?; return AXUIElementCopyAttributeValue(e, name as CFString, &v) == .success ? v : nil }
func str(_ e: AXUIElement, _ name: String) -> String { (attr(e, name) as? String) ?? "" }
var texts: [String] = []
var buttons: [AXUIElement] = []
var rows: [[String: Any]] = []
func walk(_ e: AXUIElement, _ depth: Int) {
  if depth > 40 { return }
  let role = str(e, kAXRoleAttribute)
  if role == kAXStaticTextRole { let v = (attr(e, kAXValueAttribute) as? String) ?? ""; if !v.isEmpty { texts.append(v) } }
  if role == kAXButtonRole {
    var pt = CGPoint.zero, sz = CGSize.zero
    if let p = attr(e, kAXPositionAttribute), CFGetTypeID(p) == AXValueGetTypeID() { AXValueGetValue(p as! AXValue, .cgPoint, &pt) }
    if let s = attr(e, kAXSizeAttribute), CFGetTypeID(s) == AXValueGetTypeID() { AXValueGetValue(s as! AXValue, .cgSize, &sz) }
    buttons.append(e)
    rows.append(["help": str(e, kAXHelpAttribute), "desc": str(e, kAXRoleDescriptionAttribute), "w": Int(sz.width), "x": Int(pt.x)])
  }
  if let kids = attr(e, kAXChildrenAttribute) as? [AXUIElement] { for k in kids { walk(k, depth + 1) } }
}
func snapshot() -> [AXUIElement] {
  texts = []; buttons = []; rows = []
  guard let windows = attr(ax, kAXWindowsAttribute) as? [AXUIElement], let w = windows.first else { return [] }
  walk(w, 0)
  return buttons
}
var found = snapshot()
if found.isEmpty && texts.isEmpty { fputs("no window\n", stderr); exit(3) }
if args.count >= 3, args[1] == "click", let i = Int(args[2]) {
  guard i >= 1, i <= found.count else { fputs("no button \(i) (have \(found.count))\n", stderr); exit(4) }
  let before = texts
  let r = AXUIElementPerformAction(found[i - 1], kAXPressAction as CFString)
  if r != .success { fputs("press failed: \(r.rawValue)\n", stderr); exit(5) }
  // The dashboard redraws lazily; wait until the texts actually change (≤ 2 s) so the caller's HUD is fresh.
  for _ in 0..<20 { usleep(100_000); _ = snapshot(); if texts != before { break } }
}
let out: [String: Any] = ["texts": texts, "buttons": rows]
let data = try! JSONSerialization.data(withJSONObject: out)
print(String(data: data, encoding: .utf8)!)
