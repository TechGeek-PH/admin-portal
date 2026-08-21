package ph.techgeek.installer;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://techgeek-ph.github.io/admin-portal/technician-checklist.html?v=20260821-native5";
    private static final int FILE_CHOOSER_REQUEST = 101;
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private ProgressBar progressBar;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        enterImmersiveMode();
        try { buildWebApp(savedInstanceState); } catch (Throwable error) { showStartupError(error); }
    }

    private void buildWebApp(Bundle savedInstanceState) {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.WHITE);
        webView = new WebView(this);
        root.addView(webView,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));
        progressBar = new ProgressBar(this);
        FrameLayout.LayoutParams pp = new FrameLayout.LayoutParams(64,64); pp.gravity=Gravity.CENTER; root.addView(progressBar,pp);
        setContentView(root);

        WebSettings s=webView.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setDatabaseEnabled(true); s.setLoadsImagesAutomatically(true);
        s.setAllowFileAccess(true); s.setAllowContentAccess(true); s.setBuiltInZoomControls(false); s.setDisplayZoomControls(false);
        s.setUseWideViewPort(true); s.setLoadWithOverviewMode(true); s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setUserAgentString(s.getUserAgentString()+" TechGeekPHApp/1.0.3");
        CookieManager cm=CookieManager.getInstance(); cm.setAcceptCookie(true); cm.setAcceptThirdPartyCookies(webView,true);

        webView.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request){
                Uri uri=request.getUrl(); String host=uri.getHost();
                if(host!=null&&(host.equals("techgeek-ph.github.io")||host.endsWith(".techgeek-ph.github.io")||host.contains("supabase")||host.equals("cdn.jsdelivr.net"))) return false;
                try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(ActivityNotFoundException ignored){} return true;
            }
            @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap favicon){super.onPageStarted(view,url);if(progressBar!=null)progressBar.setVisibility(View.VISIBLE);}
            @Override public void onPageFinished(WebView view,String url){super.onPageFinished(view,url);if(progressBar!=null)progressBar.setVisibility(View.GONE);}
            @Override public void onReceivedError(WebView view,int errorCode,String description,String failingUrl){
                if(progressBar!=null)progressBar.setVisibility(View.GONE);
                if(failingUrl!=null && failingUrl.startsWith("https://techgeek-ph.github.io/admin-portal/")) showLoadError(description);
            }
        });
        webView.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView w,ValueCallback<Uri[]> cb,FileChooserParams p){
                if(filePathCallback!=null)filePathCallback.onReceiveValue(null); filePathCallback=cb;
                try{startActivityForResult(p.createIntent(),FILE_CHOOSER_REQUEST);return true;}catch(ActivityNotFoundException e){filePathCallback=null;return false;}
            }
        });
        if(savedInstanceState!=null&&webView.restoreState(savedInstanceState)!=null)return;
        webView.clearCache(true);
        webView.loadUrl(APP_URL);
    }

    private void showLoadError(String detail){
        if(webView==null)return;
        String safe=(detail==null?"Network error":detail).replace("'","\\'");
        webView.loadDataWithBaseURL("https://techgeek-ph.github.io/","<html><body style='font-family:sans-serif;text-align:center;padding:60px 20px;color:#073b78'><h2>TechGeekPH</h2><p>Unable to load the technician checklist.</p><p style='color:#64748b'>"+safe+"</p><button style='padding:12px 20px' onclick=\"location.href='"+APP_URL+"'\">Retry</button></body></html>","text/html","UTF-8",null);
    }
    @SuppressWarnings("deprecation") private void enterImmersiveMode(){getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY|View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LAYOUT_STABLE);}
    private void showStartupError(Throwable e){TextView m=new TextView(this);m.setText("TechGeekPH\n\nUnable to start the app.\nPlease check your internet connection and reinstall the latest version.\n\n"+e.getClass().getSimpleName());m.setTextSize(18);m.setTextColor(Color.rgb(7,59,120));m.setGravity(Gravity.CENTER);m.setPadding(32,32,32,32);setContentView(m);}
    @Override public void onWindowFocusChanged(boolean f){super.onWindowFocusChanged(f);if(f)enterImmersiveMode();}
    @Override protected void onSaveInstanceState(Bundle o){if(webView!=null)webView.saveState(o);super.onSaveInstanceState(o);}
    @Override protected void onActivityResult(int r,int c,Intent d){super.onActivityResult(r,c,d);if(r==FILE_CHOOSER_REQUEST&&filePathCallback!=null){filePathCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(c,d));filePathCallback=null;}}
    @Override public void onBackPressed(){if(webView!=null&&webView.canGoBack())webView.goBack();else super.onBackPressed();}
}