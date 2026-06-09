import WidgetKit
import SwiftUI

struct PookieEntry: TimelineEntry {
  let date: Date
  let message: String
  let fromName: String
  let sentAt: Double
}

struct PookieProvider: TimelineProvider {
  func placeholder(in context: Context) -> PookieEntry {
    PookieEntry(date: Date(), message: "thinking of you ✨", fromName: "your pookie", sentAt: 0)
  }

  func getSnapshot(in context: Context, completion: @escaping (PookieEntry) -> Void) {
    completion(loadEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<PookieEntry>) -> Void) {
    completion(Timeline(entries: [loadEntry()], policy: .never))
  }

  private func loadEntry() -> PookieEntry {
    let d = UserDefaults(suiteName: "group.com.drivenano.app")
    return PookieEntry(
      date: Date(),
      message: d?.string(forKey: "pookie_message") ?? "no messages yet 🥺",
      fromName: d?.string(forKey: "pookie_from") ?? "your person",
      sentAt: d?.double(forKey: "pookie_sent_at") ?? 0
    )
  }
}

struct PookieWidgetView: View {
  var entry: PookieEntry
  @Environment(\.widgetFamily) var family

  var timeAgo: String {
    guard entry.sentAt > 0 else { return "" }
    let diff = Date().timeIntervalSince1970 - entry.sentAt / 1000
    if diff < 60 { return "just now" }
    if diff < 3600 { return "\(Int(diff / 60))m ago" }
    if diff < 86400 { return "\(Int(diff / 3600))h ago" }
    return "\(Int(diff / 86400))d ago"
  }

  var body: some View {
    ZStack {
      LinearGradient(
        colors: [Color(hex: "ff6b9d"), Color(hex: "c44dff")],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )

      VStack(alignment: .leading, spacing: 0) {
        HStack {
          Text("💕 pookie")
            .font(.system(size: 10, weight: .bold))
            .foregroundColor(.white.opacity(0.85))
          Spacer()
          if !timeAgo.isEmpty {
            Text(timeAgo)
              .font(.system(size: 9, weight: .medium))
              .foregroundColor(.white.opacity(0.65))
          }
        }
        .padding(.bottom, 8)

        Text("\u{201C}\(entry.message)\u{201D}")
          .font(.system(size: family == .systemSmall ? 13 : 15, weight: .semibold))
          .foregroundColor(.white)
          .lineLimit(family == .systemSmall ? 4 : 3)
          .fixedSize(horizontal: false, vertical: true)

        Spacer()

        Text("— \(entry.fromName)")
          .font(.system(size: 10, weight: .medium))
          .foregroundColor(.white.opacity(0.75))
          .italic()
      }
      .padding(14)
    }
  }
}

struct DriveNanoWidget: Widget {
  let kind = "DriveNanoWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: PookieProvider()) { entry in
      PookieWidgetView(entry: entry)
        .containerBackground(for: .widget) {
          LinearGradient(
            colors: [Color(hex: "ff6b9d"), Color(hex: "c44dff")],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
          )
        }
    }
    .configurationDisplayName("pookie 💕")
    .description("messages from your person")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

extension Color {
  init(hex: String) {
    var int: UInt64 = 0
    Scanner(string: hex).scanHexInt64(&int)
    self.init(
      .sRGB,
      red: Double((int >> 16) & 0xFF) / 255,
      green: Double((int >> 8) & 0xFF) / 255,
      blue: Double(int & 0xFF) / 255
    )
  }
}
