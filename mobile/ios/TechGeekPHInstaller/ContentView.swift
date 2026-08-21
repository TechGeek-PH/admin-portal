import SwiftUI
import WebKit

struct ContentView: View {
    var body: some View {
        TechnicianWebView(url: URL(string: "https://techgeek-ph.github.io/admin-portal/technician-checklist.html?source=ios-app")!)
            .ignoresSafeArea()
            .statusBarHidden(true)
    }
}

struct TechnicianWebView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.allowsInlineMediaPlayback = true
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = true
        webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }
            if url.host == "techgeek-ph.github.io" {
                decisionHandler(.allow)
            } else {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
            }
        }
    }
}
