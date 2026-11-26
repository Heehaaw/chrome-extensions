// Sends Cmd+T to one process without focusing it. Needs Accessibility permission for the app
// running the tests; without it, macOS drops the events silently.
import ApplicationServices
import Foundation

guard CommandLine.arguments.count == 2, let pid = pid_t(CommandLine.arguments[1]) else {
  fputs("usage: send-cmd-t.swift <pid>\n", stderr)
  exit(2)
}
guard AXIsProcessTrusted() else {
  fputs("Accessibility permission is required to send key events\n", stderr)
  exit(1)
}

let source = CGEventSource(stateID: .hidSystemState)
for keyDown in [true, false] {
  let event = CGEvent(keyboardEventSource: source, virtualKey: 0x11, keyDown: keyDown)! // kVK_ANSI_T
  event.flags = .maskCommand
  event.postToPid(pid)
  usleep(50_000)
}
