import Cocoa
// protonax status                  → {"header":"Japan JP#161","ip":"37.19.205.232","protocol":"WireGuard","load":"17% Load","connected":true}
// protonax connect <Country> [City] → searches the Countries list, presses the country (or expands it and presses the city), waits for the header
// protonax profile <Name>          → Profiles tab, presses "<Name>, Connect"
// protonax disconnect | quick      → presses Disconnect / Quick Connect
// All through the Accessibility tree of the Proton VPN main window (works while the app is hidden). Proton VPN 6.5.1.
let a = CommandLine.arguments
func fail(_ m: String, _ c: Int32) -> Never { fputs(m + "\n", stderr); exit(c) }
let bundle = "ch.protonvpn.mac"
if NSRunningApplication.runningApplications(withBundleIdentifier: bundle).isEmpty {
  NSWorkspace.shared.launchApplication(withBundleIdentifier: bundle, options: [.withoutActivation], additionalEventParamDescriptor: nil, launchIdentifier: nil)
  for _ in 0..<40 { usleep(250_000); if !NSRunningApplication.runningApplications(withBundleIdentifier: bundle).isEmpty { break } }
}
guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: bundle).first else { fail("Proton VPN is not installed", 2) }
let ax = AXUIElementCreateApplication(app.processIdentifier)
func attr(_ e: AXUIElement, _ n: String) -> CFTypeRef? { var v: CFTypeRef?; return AXUIElementCopyAttributeValue(e, n as CFString, &v) == .success ? v : nil }
func s(_ e: AXUIElement, _ n: String) -> String { (attr(e, n) as? String) ?? "" }
func windows() -> [AXUIElement] { (attr(ax, kAXWindowsAttribute) as? [AXUIElement]) ?? [] }
func find(_ pred: (AXUIElement) -> Bool) -> AXUIElement? {
  var hit: AXUIElement? = nil
  func walk(_ e: AXUIElement, _ d: Int) { if hit != nil || d > 40 { return }; if pred(e) { hit = e; return }; if let kids = attr(e, kAXChildrenAttribute) as? [AXUIElement] { for k in kids { walk(k, d + 1) } } }
  for w in windows() { walk(w, 0) }
  return hit
}
func byId(_ id: String) -> AXUIElement? { find { s($0, "AXIdentifier") == id } }
func byDesc(_ d: String) -> AXUIElement? { find { s($0, kAXRoleAttribute) == kAXButtonRole && s($0, kAXDescriptionAttribute) == d } }
func byTitle(_ t: String) -> AXUIElement? { find { s($0, kAXRoleAttribute) == kAXButtonRole && s($0, kAXTitleAttribute) == t } }
func byValue(_ v: String) -> AXUIElement? { find { s($0, kAXRoleAttribute) == kAXButtonRole && s($0, kAXValueAttribute) == v } }
func press(_ e: AXUIElement?, _ what: String) { guard let e else { fail("not found: \(what)", 4) }; if AXUIElementPerformAction(e, kAXPressAction as CFString) != .success { fail("press failed: \(what)", 5) } }
/// The country list is a lazy AX provider: only ~10 rows exist at a time, and the search field (SwiftUI)
/// ignores AXValue writes, so we scroll instead. Rows are alphabetical; the scrollbar's AXValue (0…1) is
/// settable and the provider re-materialises rows for the visible range. Binary-search the scroll position.
func scrollBar() -> AXUIElement? { find { s($0, kAXRoleAttribute) == "AXScrollBar" } }
struct RowInfo { let name: String; let el: AXUIElement; let y: CGFloat; let isCity: Bool }
/// Country and city rows = buttons inside the AXOpaqueProviderList. Cities are *siblings* of their country in the
/// AX tree (same depth); what tells them apart is the icon button sharing their y: "ic-chevron-down-filled" for a
/// country, "ic-three-dots-vertical" for a city.
func listRows() -> [RowInfo] {
  var named: [(String, AXUIElement, CGFloat)] = []
  var icons: [(String, CGFloat)] = []
  var inList = false
  func walk(_ e: AXUIElement, _ d: Int) {
    if d > 40 { return }
    let was = inList
    if s(e, kAXSubroleAttribute) == "AXOpaqueProviderList" { inList = true }
    if inList, s(e, kAXRoleAttribute) == kAXButtonRole {
      let dsc = s(e, kAXDescriptionAttribute)
      var pt = CGPoint.zero; if let p = attr(e, kAXPositionAttribute), CFGetTypeID(p) == AXValueGetTypeID() { AXValueGetValue(p as! AXValue, .cgPoint, &pt) }
      // The hovered/selected row reports "<Name>, Connect"; normalise so matching never depends on the mouse.
      let clean = dsc.hasSuffix(", Connect") ? String(dsc.dropLast(9)) : dsc
      if dsc.hasPrefix("ic-") { icons.append((dsc, pt.y)) } else if let f = clean.first, f.isUppercase { named.append((clean, e, pt.y)) }
    }
    if let k = attr(e, kAXChildrenAttribute) as? [AXUIElement] { for c in k { walk(c, d + 1) } }
    inList = was
  }
  for w in windows() { walk(w, 0) }
  return named.map { n in RowInfo(name: n.0, el: n.1, y: n.2, isCity: icons.contains { $0.0 == "ic-three-dots-vertical" && abs($0.1 - n.2) < 2 }) }
}
func visibleRows() -> [(String, AXUIElement)] { listRows().filter { !$0.isCity }.map { ($0.name, $0.el) } }
var scrollPos = 0.0   // the scrollbar's AXValue is write-only from our side (reads back empty), so we track it
func setScroll(_ v: Double) { scrollPos = max(0, min(1, v)); if let sb = scrollBar() { AXUIElementSetAttributeValue(sb, kAXValueAttribute as CFString, NSNumber(value: scrollPos)); usleep(180_000) } }
func rowNamed(_ name: String) -> AXUIElement? {
  for (d, e) in visibleRows() where d.compare(name, options: .caseInsensitive) == .orderedSame { return e }
  return nil
}
func findCountry(_ name: String) -> AXUIElement? {
  if let e = rowNamed(name) { return e }
  // Rows are alphabetical and the provider only materialises ~10–16 rows around the visible range; page through.
  setScroll(0)
  var pos = 0.0
  while pos <= 1.0 {
    if let e = rowNamed(name) { return e }
    let rows = visibleRows().map { $0.0 }
    if let first = rows.first, name.compare(first, options: .caseInsensitive) == .orderedAscending { return nil }
    pos += 0.05; setScroll(pos)
  }
  return rowNamed(name)
}
/// Cities of a country = the city rows that follow its row (until the next country row). Empty when collapsed.
func childrenOf(_ countryName: String) -> [RowInfo] {
  let rows = listRows()
  guard let i = rows.firstIndex(where: { !$0.isCity && $0.name.compare(countryName, options: .caseInsensitive) == .orderedSame }) else { return [] }
  var kids: [RowInfo] = []
  for r in rows[(i + 1)...] { if !r.isCity { break }; kids.append(r) }
  return kids
}
/// Expanding scrolls the list; re-find the row after each press. If nothing appears the first press collapsed an
/// already-open group, so press once more.
func expand(_ countryName: String) -> Bool {
  guard findCountry(countryName) != nil else { return false }
  for _ in 0..<2 {
    if !childrenOf(countryName).isEmpty { return true }
    guard let row = findCountry(countryName), let chev = chevronFor(row) else { return false }
    AXUIElementPerformAction(chev, kAXPressAction as CFString)
    var t = 0.0
    while t < 2.0 {
      usleep(150_000); t += 0.15
      if !childrenOf(countryName).isEmpty { return true }
      // Children are materialised only when their slots are near the viewport: scroll the country row into view.
      if let r = findCountry(countryName) { AXUIElementPerformAction(r, "AXScrollToVisible" as CFString) }
    }
  }
  return !childrenOf(countryName).isEmpty
}
func collapse(_ countryName: String) {
  guard findCountry(countryName) != nil, !childrenOf(countryName).isEmpty else { return }
  if let row = findCountry(countryName), let chev = chevronFor(row) { AXUIElementPerformAction(chev, kAXPressAction as CFString); usleep(200_000) }
}
/// Chevron of a given country = the "ic-chevron-down-filled" button whose y equals the country row's y.
func chevronFor(_ row: AXUIElement) -> AXUIElement? {
  var pt = CGPoint.zero
  if let p = attr(row, kAXPositionAttribute), CFGetTypeID(p) == AXValueGetTypeID() { AXValueGetValue(p as! AXValue, .cgPoint, &pt) }
  return find { e in
    guard s(e, kAXRoleAttribute) == kAXButtonRole, s(e, kAXDescriptionAttribute) == "ic-chevron-down-filled" else { return false }
    var q = CGPoint.zero; if let p = attr(e, kAXPositionAttribute), CFGetTypeID(p) == AXValueGetTypeID() { AXValueGetValue(p as! AXValue, .cgPoint, &q) }
    return abs(q.y - pt.y) < 2
  }
}
func ensureWindow() {
  if windows().isEmpty { NSWorkspace.shared.launchApplication(withBundleIdentifier: bundle, options: [.withoutActivation], additionalEventParamDescriptor: nil, launchIdentifier: nil) }
  for _ in 0..<40 {
    if byId("headerLabel") != nil { return }
    if byId("UsernameTextField") != nil || byId("PasswordTextField") != nil { fail("Proton VPN is signed out — open the app and sign in first", 6) }
    usleep(250_000)
  }
  fail("Proton VPN window did not appear (is Accessibility granted to Asyar?)", 3)
}
func status() -> [String: Any] {
  let header = byId("headerLabel").map { s($0, kAXValueAttribute) } ?? ""
  let ip = byId("ipLabel").map { s($0, kAXValueAttribute) } ?? ""
  let proto = byId("protocolLabel").map { s($0, kAXValueAttribute) } ?? ""
  let load = find { s($0, kAXRoleAttribute) == kAXStaticTextRole && s($0, kAXValueAttribute).hasSuffix("% Load") }.map { s($0, kAXValueAttribute) } ?? ""
  let connected = byTitle("Disconnect") != nil
  return ["header": header, "ip": ip.replacingOccurrences(of: "IP: ", with: ""), "protocol": proto, "load": load, "connected": connected]
}
func emit(_ d: [String: Any]) { print(String(data: try! JSONSerialization.data(withJSONObject: d), encoding: .utf8)!) }
func waitHeader(_ pred: (String) -> Bool, _ seconds: Double) -> Bool {
  var t = 0.0; while t < seconds { if let h = byId("headerLabel"), pred(s(h, kAXValueAttribute)) { return true }; usleep(300_000); t += 0.3 }; return false
}
ensureWindow()
let cmd = a.count > 1 ? a[1] : "status"
switch cmd {
case "status": emit(status())
case "disconnect": press(byTitle("Disconnect"), "Disconnect"); _ = waitHeader({ !$0.contains("#") }, 8); emit(status())
case "quick": press(byTitle("Quick Connect"), "Quick Connect"); _ = waitHeader({ $0.contains("#") }, 20); emit(status())
case "rows":
  if byId("SearchTextField") == nil { press(byId("CountriesButton"), "Countries tab"); usleep(400_000) }
  if a.count > 2, let v = Double(a[2]) { setScroll(v) }
  print(listRows().map { ($0.isCity ? "  " : "") + $0.name })
case "profiles":
  press(byId("ProfilesButton"), "Profiles tab")
  var names: [String] = []; var t = 0.0
  while t < 4 {
    names = []
    func walk(_ e: AXUIElement, _ d: Int) { if d > 40 { return }; if s(e, "AXIdentifier") == "ProfileItemView" { let v = s(e, kAXValueAttribute); if v.hasSuffix(", Connect") { names.append(String(v.dropLast(9))) } }; if let k = attr(e, kAXChildrenAttribute) as? [AXUIElement] { for c in k { walk(c, d + 1) } } }
    for w in windows() { walk(w, 0) }
    if !names.isEmpty { break }; usleep(200_000); t += 0.2
  }
  press(byId("CountriesButton"), "Countries tab")
  print(String(data: try! JSONSerialization.data(withJSONObject: names), encoding: .utf8)!)
case "profile":
  guard a.count > 2 else { fail("usage: profile <name>", 1) }
  press(byId("ProfilesButton"), "Profiles tab")
  var prof: AXUIElement? = nil; var t = 0.0
  while t < 4 { if let e = byValue("\(a[2]), Connect") { prof = e; break }; usleep(200_000); t += 0.2 }
  press(prof, "profile \(a[2])")
  _ = waitHeader({ $0.contains("#") }, 25)
  press(byId("CountriesButton"), "Countries tab"); emit(status())
case "expand":
  if byId("SearchTextField") == nil { press(byId("CountriesButton"), "Countries tab"); usleep(400_000) }
  print(expand(a[2]))
case "cities":
  guard a.count > 2 else { fail("usage: cities <country>", 1) }
  if byId("SearchTextField") == nil { press(byId("CountriesButton"), "Countries tab"); usleep(400_000) }
  guard expand(a[2]) else { fail("country not listed: \(a[2])", 4) }
  var kids: [String] = []
  var pos = scrollPos
  for _ in 0..<60 {
    let rows = listRows()
    let now = childrenOf(a[2])
    for r in now where !kids.contains(r.name) { kids.append(r.name) }
    if now.isEmpty { break }
    // A country row *after* the last city means the whole group is on screen.
    if let li = rows.lastIndex(where: { $0.isCity }), li < rows.count - 1 { break }
    pos += 0.01; if pos > 1.0 { break }; setScroll(pos)
  }
  _ = findCountry(a[2]); collapse(a[2]); setScroll(0)
  print(String(data: try! JSONSerialization.data(withJSONObject: kids), encoding: .utf8)!)
case "connect":
  guard a.count > 2 else { fail("usage: connect <country> [city]", 1) }
  // The search field only exists on the Countries tab.
  if byId("SearchTextField") == nil { press(byId("CountriesButton"), "Countries tab"); var t = 0.0; while byId("SearchTextField") == nil && t < 3 { usleep(150_000); t += 0.15 } }
  if a.count > 3 {
    guard expand(a[2]) else { fail("country not listed: \(a[2])", 4) }
    // City rows below the viewport are not materialised: scroll down page by page while the group stays open.
    // City rows below the viewport are not materialised: page down in small steps. While the group is on
    // screen the country row stays pinned as the first materialised row and its cities follow it.
    var city: RowInfo? = nil
    var pos = scrollPos
    for _ in 0..<60 {
      let kids = childrenOf(a[2])
      city = kids.first { $0.name.compare(a[3], options: .caseInsensitive) == .orderedSame }
      if city != nil { break }
      if kids.isEmpty { break }                                                                     // group no longer on screen
      if let last = kids.last, last.name.compare(a[3], options: .caseInsensitive) == .orderedDescending { break }  // alphabetical: passed it
      pos += 0.01; if pos > 1.0 { break }; setScroll(pos)
    }
    guard let city else { collapse(a[2]); fail("city not listed under \(a[2]): \(a[3])", 4) }
    AXUIElementPerformAction(city.el, "AXScrollToVisible" as CFString); usleep(100_000)
    press(city.el, "city \(a[3])")
  } else {
    guard let country = findCountry(a[2]) else { fail("country not listed: \(a[2])", 4) }
    press(country, "country \(a[2])")
  }
  let ok = waitHeader({ $0.lowercased().hasPrefix(a[2].lowercased()) && $0.contains("#") }, 30)
  if a.count > 3 { collapse(a[2]) }
  setScroll(0)
  var d = status(); d["ok"] = ok; emit(d)
default: fail("unknown command \(cmd)", 1)
}
