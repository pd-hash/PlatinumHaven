package com.platinumhaven.app

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.NavHostFragment
import androidx.navigation.ui.setupWithNavController
import com.platinumhaven.app.data.TokenStore
import com.platinumhaven.app.databinding.ActivityMainBinding
import com.platinumhaven.app.network.RetrofitClient
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val navHostFragment = supportFragmentManager
            .findFragmentById(R.id.nav_host_fragment) as NavHostFragment
        val navController = navHostFragment.navController

        binding.bottomNav.setupWithNavController(navController)

        // Hide bottom nav on login/register screens
        navController.addOnDestinationChangedListener { _, destination, _ ->
            when (destination.id) {
                R.id.loginFragment,
                R.id.registerFragment -> binding.bottomNav.visibility = View.GONE
                else -> binding.bottomNav.visibility = View.VISIBLE
            }
        }

        // Only reuse a saved session if the backend still accepts the token.
        if (TokenStore.isLoggedIn(this)) {
            lifecycleScope.launch {
                try {
                    val response = RetrofitClient.api.getMe(TokenStore.getBearerToken(this@MainActivity))
                    if (response.isSuccessful) {
                        response.body()?.let { TokenStore.saveUser(this@MainActivity, it) }
                        if (navController.currentDestination?.id == R.id.loginFragment) {
                            navController.navigate(R.id.homeFragment)
                        }
                    } else {
                        TokenStore.clear(this@MainActivity)
                    }
                } catch (_: Exception) {
                    // Keep the saved token on transient connection issues.
                }
            }
        }

        handlePayPalIntent(intent)
    }

    override fun onSupportNavigateUp(): Boolean {
        val navHostFragment = supportFragmentManager
            .findFragmentById(R.id.nav_host_fragment) as NavHostFragment
        return navHostFragment.navController.navigateUp() || super.onSupportNavigateUp()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handlePayPalIntent(intent)
    }

    private fun handlePayPalIntent(intent: Intent?) {
        val data = intent?.data ?: return
        if (data.scheme == "platinumhavenpay" && data.host == "checkout") {
            TokenStore.savePayPalCallback(this, data.toString())
        }
    }
}
