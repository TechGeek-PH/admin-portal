import SwiftUI
import WebKit

struct ContentView: View {
    var body: some View {
        TechGeekPHWebView(url: URL(string: "https://techgeek-ph.github.io/admin-portal/app.html?source=ios-app&build=20260830-network-pppoe-mobile151&v=1.5.1")!)
            .ignoresSafeArea()
            .statusBarHidden(true)
    }
}

struct TechGeekPHWebView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.allowsInlineMediaPlayback = true
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = true

        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        var items = components.queryItems ?? []
        items.append(URLQueryItem(name: "t", value: String(Int(Date().timeIntervalSince1970))))
        components.queryItems = items
        let freshURL = components.url ?? url
        let request = URLRequest(url: freshURL, cachePolicy: .reloadIgnoringLocalAndRemoteCacheData, timeoutInterval: 25)
        webView.load(request)
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator: NSObject, WKNavigationDelegate {
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }
            let host = url.host ?? ""
            if host == "techgeek-ph.github.io" || host.hasSuffix(".supabase.co") || host == "cdn.jsdelivr.net" || host == "unpkg.com" {
                decisionHandler(.allow)
            } else {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            guard let url = webView.url, url.path.hasSuffix("/admin-portal/app.html") else { return }
            let js = """
            (function(){
              function add(src,id){
                if(document.querySelector('script[data-native-module="'+id+'"]')) return;
                var s=document.createElement('script');
                s.src=src;
                s.async=false;
                s.setAttribute('data-native-module',id);
                document.head.appendChild(s);
              }
              add('https://techgeek-ph.github.io/admin-portal/assets/client-proof-entry.js?v=20260830-mobile151','proof');
              add('https://techgeek-ph.github.io/admin-portal/assets/network-monitor-entry.js?v=20260830-mobile151','network');
            })();
            """
            webView.evaluateJavaScript(js, completionHandler: nil)
        }
    }
}
