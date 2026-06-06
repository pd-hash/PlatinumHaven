package com.platinumhaven.app.ui

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ImageButton
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.platinumhaven.app.R
import com.platinumhaven.app.data.TokenStore

class PayPalCheckoutActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_APPROVE_URL = "approve_url"
    }

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var titleView: TextView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_paypal_checkout)

        val approveUrl = intent.getStringExtra(EXTRA_APPROVE_URL)
        if (approveUrl.isNullOrBlank()) {
            finish()
            return
        }

        webView = findViewById(R.id.webViewPayPal)
        progressBar = findViewById(R.id.progressPayPal)
        titleView = findViewById(R.id.tvPayPalTitle)

        findViewById<ImageButton>(R.id.btnBackPayPal).setOnClickListener {
            if (webView.canGoBack()) {
                webView.goBack()
            } else {
                finish()
            }
        }

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            loadsImagesAutomatically = true
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            javaScriptCanOpenWindowsAutomatically = true
            setSupportMultipleWindows(true)
            userAgentString = "$userAgentString PlatinumHavenAppWebView"
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progressBar.progress = newProgress
                progressBar.visibility = if (newProgress >= 100) View.GONE else View.VISIBLE
            }

            override fun onCreateWindow(
                view: WebView?,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: android.os.Message?
            ): Boolean {
                val transport = resultMsg?.obj as? WebView.WebViewTransport ?: return false
                val popupWebView = WebView(this@PayPalCheckoutActivity)
                popupWebView.settings.javaScriptEnabled = true
                popupWebView.settings.domStorageEnabled = true
                popupWebView.settings.javaScriptCanOpenWindowsAutomatically = true
                popupWebView.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(
                        view: WebView?,
                        request: WebResourceRequest?
                    ): Boolean = routeUrl(request?.url?.toString())

                    override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean =
                        routeUrl(url)

                    override fun onPageFinished(view: WebView?, url: String?) {
                        url?.let { routeUrl(it) }
                    }
                }
                transport.webView = popupWebView
                resultMsg.sendToTarget()
                return true
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                return routeUrl(request?.url?.toString())
            }

            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean =
                routeUrl(url)

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                titleView.text = view?.title?.takeIf { it.isNotBlank() } ?: getString(R.string.paypal_checkout_title)
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    titleView.text = getString(R.string.paypal_checkout_title)
                }
            }
        }

        webView.loadUrl(approveUrl)
    }

    private fun routeUrl(url: String?): Boolean {
        if (url.isNullOrBlank()) return false
        if (url.startsWith("platinumhavenpay://checkout")) {
            TokenStore.savePayPalCallback(this, url)
            finish()
            return true
        }
        if (url.startsWith("http://") || url.startsWith("https://")) {
            if (::webView.isInitialized && webView.url != url) {
                webView.loadUrl(url)
            }
            return true
        }
        return false
    }

    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.stopLoading()
            webView.destroy()
        }
        super.onDestroy()
    }
}
