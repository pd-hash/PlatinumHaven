package com.platinumhaven.app.ui

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import com.platinumhaven.app.databinding.ActivityLiveSupportBinding

class LiveSupportActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLiveSupportBinding

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLiveSupportBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnClose.setOnClickListener { finish() }

        binding.webViewLiveSupport.settings.javaScriptEnabled = true
        binding.webViewLiveSupport.settings.domStorageEnabled = true
        binding.webViewLiveSupport.settings.loadsImagesAutomatically = true
        binding.webViewLiveSupport.settings.builtInZoomControls = false
        binding.webViewLiveSupport.settings.displayZoomControls = false

        binding.webViewLiveSupport.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                binding.progressLiveSupport.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                binding.progressLiveSupport.visibility = View.GONE
            }
        }

        binding.webViewLiveSupport.webChromeClient = WebChromeClient()
        binding.webViewLiveSupport.loadUrl(
            intent.getStringExtra(EXTRA_URL)
                ?: "https://tawk.to/chat/69e19b572293ae1c33360960/1jmcke13m"
        )
    }

    override fun onBackPressed() {
        if (binding.webViewLiveSupport.canGoBack()) {
            binding.webViewLiveSupport.goBack()
        } else {
            super.onBackPressed()
        }
    }

    companion object {
        const val EXTRA_URL = "extra_url"
    }
}
