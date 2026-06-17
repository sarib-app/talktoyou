import Foundation
import WidgetKit
import AVFoundation

@objc(PookieModule)
class PookieModule: NSObject {

  @objc
  func saveMessage(_ text: String, fromName: String, sentAt: Double) {
    let defaults = UserDefaults(suiteName: "group.com.drivenano.app")
    defaults?.set(text, forKey: "pookie_message")
    defaults?.set(fromName, forKey: "pookie_from")
    defaults?.set(sentAt, forKey: "pookie_sent_at")
    defaults?.synchronize()
    WidgetCenter.shared.reloadAllTimelines()
  }

  @objc
  func silenceCamera() {
    try? AVAudioSession.sharedInstance().setCategory(.playback, options: .mixWithOthers)
    try? AVAudioSession.sharedInstance().setActive(true)
  }

  @objc static func requiresMainQueueSetup() -> Bool { return false }
}
