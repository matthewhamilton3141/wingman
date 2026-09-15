// Native half of the Hinge sidecar: finds the iPhone Mirroring window and
// synthesizes input into it. Built on demand by phone.ts with `swiftc`.
//
//   native window                 -> {"id":..,"x":..,"y":..,"w":..,"h":..} or exit 1
//   native focus                  -> bring iPhone Mirroring to the front
//   native click X Y              -> tap at screen point (top-left origin)
//   native swipe X1 Y1 X2 Y2 [ms] -> touch drag
//   native scroll X Y DY          -> scroll wheel at point, DY in pixels (+ = content moves up)
//   native type TEXT              -> type unicode text into the focused app
//   native key NAME               -> return | delete | escape | tab
//
// Needs Accessibility permission (for CGEvent) on the terminal running it.

import AppKit
import CoreGraphics
import Foundation

let args = Array(CommandLine.arguments.dropFirst())
func fail(_ msg: String) -> Never {
  FileHandle.standardError.write((msg + "\n").data(using: .utf8)!)
  exit(1)
}
func num(_ i: Int) -> Double {
  guard i < args.count, let v = Double(args[i]) else { fail("expected number at arg \(i)") }
  return v
}
func sleepMs(_ ms: Double) { usleep(useconds_t(ms * 1000)) }

func mirroringWindow() -> (id: CGWindowID, rect: CGRect)? {
  let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
  for w in list {
    let owner = w[kCGWindowOwnerName as String] as? String ?? ""
    let layer = w[kCGWindowLayer as String] as? Int ?? 0
    guard owner == "iPhone Mirroring", layer == 0 else { continue }
    guard let b = w[kCGWindowBounds as String] as? [String: Double] else { continue }
    let r = CGRect(x: b["X"] ?? 0, y: b["Y"] ?? 0, width: b["Width"] ?? 0, height: b["Height"] ?? 0)
    // Skip tiny helper windows; the phone window is at least a few hundred points tall.
    if r.height < 200 { continue }
    return (CGWindowID(w[kCGWindowNumber as String] as? Int ?? 0), r)
  }
  return nil
}

func focus() {
  let apps = NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.ScreenContinuity")
  if let app = apps.first {
    app.activate()
  } else {
    let url = URL(fileURLWithPath: "/System/Applications/iPhone Mirroring.app")
    NSWorkspace.shared.openApplication(at: url, configuration: NSWorkspace.OpenConfiguration()) { _, _ in }
    sleepMs(800)
  }
  sleepMs(150)
}

func post(_ e: CGEvent?) { e?.post(tap: .cghidEventTap) }

func click(_ p: CGPoint) {
  post(CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: p, mouseButton: .left))
  sleepMs(40)
  post(CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: p, mouseButton: .left))
  sleepMs(60)
  post(CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: p, mouseButton: .left))
}

func swipe(from a: CGPoint, to b: CGPoint, ms: Double) {
  post(CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: a, mouseButton: .left))
  sleepMs(30)
  post(CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: a, mouseButton: .left))
  let steps = max(8, Int(ms / 12))
  for i in 1...steps {
    let t = Double(i) / Double(steps)
    let p = CGPoint(x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t)
    post(CGEvent(mouseEventSource: nil, mouseType: .leftMouseDragged, mouseCursorPosition: p, mouseButton: .left))
    sleepMs(ms / Double(steps))
  }
  // Hold still before release so iOS doesn't add fling momentum.
  sleepMs(120)
  post(CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: b, mouseButton: .left))
}

func scroll(at p: CGPoint, dy: Double) {
  post(CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: p, mouseButton: .left))
  sleepMs(30)
  // Chunk it so the mirroring app treats it as a real trackpad gesture.
  var remaining = dy
  while abs(remaining) > 0.5 {
    let step = max(-40, min(40, remaining))
    remaining -= step
    let e = CGEvent(scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 1, wheel1: Int32(-step), wheel2: 0, wheel3: 0)
    e?.location = p
    post(e)
    sleepMs(8)
  }
}

func typeText(_ s: String) {
  for ch in s.unicodeScalars {
    var u = [UniChar](String(ch).utf16)
    let down = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: true)
    down?.keyboardSetUnicodeString(stringLength: u.count, unicodeString: &u)
    post(down)
    let up = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: false)
    up?.keyboardSetUnicodeString(stringLength: u.count, unicodeString: &u)
    post(up)
    sleepMs(18)
  }
}

func key(_ name: String) {
  let codes: [String: CGKeyCode] = ["return": 36, "delete": 51, "escape": 53, "tab": 48]
  guard let code = codes[name] else { fail("unknown key \(name)") }
  post(CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: true))
  sleepMs(30)
  post(CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: false))
}

guard let cmd = args.first else { fail("usage: native <window|focus|click|swipe|scroll|type|key> ...") }
switch cmd {
case "window":
  guard let w = mirroringWindow() else { fail("iPhone Mirroring window not found") }
  print("{\"id\":\(w.id),\"x\":\(w.rect.origin.x),\"y\":\(w.rect.origin.y),\"w\":\(w.rect.width),\"h\":\(w.rect.height)}")
case "focus":
  focus()
case "click":
  focus()
  click(CGPoint(x: num(1), y: num(2)))
case "swipe":
  focus()
  swipe(from: CGPoint(x: num(1), y: num(2)), to: CGPoint(x: num(3), y: num(4)), ms: args.count > 5 ? num(5) : 350)
case "scroll":
  focus()
  scroll(at: CGPoint(x: num(1), y: num(2)), dy: num(3))
case "type":
  focus()
  typeText(args.dropFirst().joined(separator: " "))
case "key":
  focus()
  key(args.count > 1 ? args[1] : "")
default:
  fail("unknown command \(cmd)")
}
