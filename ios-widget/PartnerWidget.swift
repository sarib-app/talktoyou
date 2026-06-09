// PartnerWidget.swift
// Add this file to a new Widget Extension target in Xcode.
//
// Setup steps:
// 1. File → New → Target → Widget Extension → Name it "PartnerWidget"
// 2. Add App Group capability: group.com.drivenano.app (both app + widget targets)
// 3. Replace the widget files with this code.
// 4. In your Firebase console, set Firestore rule to allow public read on widgetMessages.

import WidgetKit
import SwiftUI

// MARK: – Config
private let projectId   = "YOUR_PROJECT_ID"          // ← replace
private let apiKey      = "YOUR_API_KEY"              // ← replace
private let appGroupId  = "group.com.drivenano.app"
private let userDefaultsKey = "partnerWidgetUserId"

// MARK: – Data model
struct WidgetData: Codable {
    let message: String
    let fromName: String
    let sentAt: Double
}

struct FirestoreResponse: Codable {
    struct Fields: Codable {
        struct StringValue: Codable { let stringValue: String }
        struct IntValue: Codable { let integerValue: String }
        let message: StringValue
        let fromName: StringValue
        let sentAt: IntValue
    }
    let fields: Fields
}

// MARK: – Timeline Entry
struct PartnerEntry: TimelineEntry {
    let date: Date
    let data: WidgetData?
}

// MARK: – Provider
struct PartnerProvider: TimelineProvider {
    func placeholder(in context: Context) -> PartnerEntry {
        PartnerEntry(date: Date(), data: WidgetData(message: "Thinking of you 💜", fromName: "Partner", sentAt: 0))
    }

    func getSnapshot(in context: Context, completion: @escaping (PartnerEntry) -> Void) {
        fetchMessage { data in
            completion(PartnerEntry(date: Date(), data: data))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PartnerEntry>) -> Void) {
        fetchMessage { data in
            let entry = PartnerEntry(date: Date(), data: data)
            // Refresh every 15 minutes
            let next = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
            let timeline = Timeline(entries: [entry], policy: .after(next))
            completion(timeline)
        }
    }

    private func fetchMessage(completion: @escaping (WidgetData?) -> Void) {
        // Read the logged-in user's UID from the shared App Group UserDefaults
        let defaults = UserDefaults(suiteName: appGroupId)
        guard let uid = defaults?.string(forKey: userDefaultsKey), !uid.isEmpty else {
            completion(nil)
            return
        }

        let urlStr = "https://firestore.googleapis.com/v1/projects/\(projectId)/databases/(default)/documents/widgetMessages/\(uid)?key=\(apiKey)"
        guard let url = URL(string: urlStr) else { completion(nil); return }

        URLSession.shared.dataTask(with: url) { data, _, _ in
            guard let data = data,
                  let resp = try? JSONDecoder().decode(FirestoreResponse.self, from: data) else {
                completion(nil)
                return
            }
            let sentAt = Double(resp.fields.sentAt.integerValue) ?? 0
            completion(WidgetData(
                message: resp.fields.message.stringValue,
                fromName: resp.fields.fromName.stringValue,
                sentAt: sentAt / 1000
            ))
        }.resume()
    }
}

// MARK: – Widget View
struct PartnerWidgetView: View {
    var entry: PartnerEntry

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(hex: "#1a1a2e"), Color(hex: "#4f46e5")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            if let data = entry.data {
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("💜")
                        Text(data.fromName)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(.white.opacity(0.7))
                    }
                    Text(data.message)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.white)
                        .lineLimit(4)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer()
                    Text(formattedDate(data.sentAt))
                        .font(.system(size: 10))
                        .foregroundColor(.white.opacity(0.5))
                }
                .padding(14)
            } else {
                VStack(spacing: 8) {
                    Text("💜")
                        .font(.system(size: 28))
                    Text("No messages yet")
                        .font(.system(size: 12))
                        .foregroundColor(.white.opacity(0.6))
                }
            }
        }
    }

    func formattedDate(_ timestamp: Double) -> String {
        guard timestamp > 0 else { return "" }
        let date = Date(timeIntervalSince1970: timestamp)
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .abbreviated
        return f.localizedString(for: date, relativeTo: Date())
    }
}

// MARK: – Widget Declaration
@main
struct PartnerWidget: Widget {
    let kind = "PartnerWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PartnerProvider()) { entry in
            PartnerWidgetView(entry: entry)
        }
        .configurationDisplayName("Partner Message")
        .description("See the latest message from your partner.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: – Color Helper
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r = Double((int >> 16) & 0xFF) / 255
        let g = Double((int >> 8) & 0xFF) / 255
        let b = Double(int & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
