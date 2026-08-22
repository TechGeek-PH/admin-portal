package ph.techgeek.installer;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
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
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://techgeek-ph.github.io/admin-portal/app.html?source=android-app&v=1.2.0";
    private static final int FILE_CHOOSER_REQUEST = 101;
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private View loadingView;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        enterImmersiveMode();
        try { buildWebApp(savedInstanceState); } catch (Throwable error) { showStartupError(error); }
    }

    private void buildWebApp(Bundle savedInstanceState) {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.WHITE);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.WHITE);
        root.addView(webView,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));

        loadingView = buildLoadingView();
        root.addView(loadingView,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        WebSettings s=webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadsImagesAutomatically(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setUserAgentString(s.getUserAgentString()+" TechGeekPHApp/1.2.0");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) s.setOffscreenPreRaster(true);

        CookieManager cm=CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(webView,true);

        webView.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request){
                Uri uri=request.getUrl();
                String host=uri.getHost();
                if(host!=null && (
                    host.equals("techgeek-ph.github.io") ||
                    host.endsWith(".techgeek-ph.github.io") ||
                    host.endsWith(".supabase.co") ||
                    host.equals("cdn.jsdelivr.net")
                )) return false;
                try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(ActivityNotFoundException ignored){}
                return true;
            }
            @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap favicon){
                super.onPageStarted(view,url);
                showLoading();
            }
            @Override public void onPageFinished(WebView view,String url){
                super.onPageFinished(view,url);
                hideLoading();
            }
            @Override public void onReceivedError(WebView view,int errorCode,String description,String failingUrl){
                super.onReceivedError(view,errorCode,description,failingUrl);
                if(failingUrl!=null && failingUrl.startsWith("https://techgeek-ph.github.io/admin-portal/")){
                    hideLoading();
                    showLoadError(description);
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView w,ValueCallback<Uri[]> cb,FileChooserParams p){
                if(filePathCallback!=null)filePathCallback.onReceiveValue(null);
                filePathCallback=cb;
                try{startActivityForResult(p.createIntent(),FILE_CHOOSER_REQUEST);return true;}
                catch(ActivityNotFoundException e){filePathCallback=null;return false;}
            }
        });

        if(savedInstanceState!=null && webView.restoreState(savedInstanceState)!=null) return;
        webView.loadUrl(APP_URL + "&t=" + System.currentTimeMillis());
    }

    private View buildLoadingView(){
        LinearLayout box=new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setPadding(40,40,40,40);
        box.setBackgroundColor(Color.WHITE);

        ImageView logo=new ImageView(this);
        logo.setImageResource(ph.techgeek.installer.R.drawable.ic_launcher);
        LinearLayout.LayoutParams lpLogo=new LinearLayout.LayoutParams(150,150);
        box.addView(logo,lpLogo);

        TextView name=new TextView(this);
        name.setText("TechGeekPH");
        name.setTextSize(24);
        name.setTextColor(Color.rgb(6,79,131));
        name.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams lpName=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,ViewGroup.LayoutParams.WRAP_CONTENT);
        lpName.topMargin=18;
        box.addView(name,lpName);

        TextView sub=new TextView(this);
        sub.setText("Solutions & Services Inc.");
        sub.setTextSize(13);
        sub.setTextColor(Color.rgb(95,106,120));
        sub.setGravity(Gravity.CENTER);
        box.addView(sub,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,ViewGroup.LayoutParams.WRAP_CONTENT));

        ProgressBar progress=new ProgressBar(this);
        LinearLayout.LayoutParams lpProgress=new LinearLayout.LayoutParams(54,54);
        lpProgress.topMargin=24;
        box.addView(progress,lpProgress);
        return box;
    }

    private void showLoading(){if(loadingView!=null)loadingView.setVisibility(View.VISIBLE);}
    private void hideLoading(){if(loadingView!=null)loadingView.setVisibility(View.GONE);}

    private void showLoadError(String detail){
        if(webView==null)return;
        String safe=(detail==null?"Network error":detail).replace("&","&amp;").replace("<","&lt;").replace(">","&gt;");
        String html="<html><meta name='viewport' content='width=device-width,initial-scale=1'><body style='font-family:sans-serif;text-align:center;padding:70px 22px;color:#064f83;background:#f7fafc'><h2>TechGeekPH</h2><p>Unable to load the app.</p><p style='color:#64748b'>"+safe+"</p><button style='padding:12px 22px;border:0;border-radius:10px;background:#064f83;color:white' onclick=\"location.href='"+APP_URL+"&t='+Date.now()\">Retry</button></body></html>";
        webView.loadDataWithBaseURL("https://techgeek-ph.github.io/",html,"text/html","UTF-8",null);
    }

    @SuppressWarnings("deprecation") private void enterImmersiveMode(){
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY|
            View.SYSTEM_UI_FLAG_FULLSCREEN|
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION|
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }

    private void showStartupError(Throwable e){
        TextView m=new TextView(this);
        m.setText("TechGeekPH\n\nUnable to start the app.\nPlease check your internet connection and install the latest version.\n\n"+e.getClass().getSimpleName());
        m.setTextSize(18);m.setTextColor(Color.rgb(6,79,131));m.setGravity(Gravity.CENTER);m.setPadding(32,32,32,32);setContentView(m);
    }

    @Override public void onWindowFocusChanged(boolean f){super.onWindowFocusChanged(f);if(f)enterImmersiveMode();}
    @Override protected void onSaveInstanceState(Bundle o){if(webView!=null)webView.saveState(o);super.onSaveInstanceState(o);}
    @Override protected void onActivityResult(int r,int c,Intent d){super.onActivityResult(r,c,d);if(r==FILE_CHOOSER_REQUEST&&filePathCallback!=null){filePathCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(c,d));filePathCallback=null;}}
    @Override public void onBackPressed(){if(webView!=null&&webView.canGoBack())webView.goBack();else super.onBackPressed();}
}
