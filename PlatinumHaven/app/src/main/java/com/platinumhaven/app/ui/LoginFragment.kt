package com.platinumhaven.app.ui

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.text.method.PasswordTransformationMethod
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.ImageButton
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.navigation.fragment.findNavController
import com.platinumhaven.app.R
import com.platinumhaven.app.databinding.FragmentLoginBinding
import com.platinumhaven.app.viewmodel.AuthViewModel

class LoginFragment : Fragment() {

    private var _binding: FragmentLoginBinding? = null
    private val binding get() = _binding!!
    private val viewModel: AuthViewModel by viewModels()
    private var passwordVisible = false
    private var forgotPasswordDialog: AlertDialog? = null
    private var resetEmailField: EditText? = null
    private var resetCodeField: EditText? = null
    private var resetPasswordField: EditText? = null
    private var resetConfirmField: EditText? = null
    private var resetPasswordToggle: ImageButton? = null
    private var resetConfirmToggle: ImageButton? = null
    private var resetStatusText: TextView? = null
    private var resetVerificationSection: View? = null
    private var resetPasswordFieldsSection: View? = null
    private var resetSendCodeButton: Button? = null
    private var verificationCodeSent = false
    private var verificationCodeValidated = false
    private var isVerifyingResetCode = false
    private var resetPasswordVisible = false
    private var resetConfirmVisible = false
    private var resetCodeWatcher: TextWatcher? = null
    private var lastVerificationAttempt = ""

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentLoginBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Tab buttons
        binding.btnTabLogin.setOnClickListener { /* already on login */ }
        binding.btnTabRegister.setOnClickListener {
            findNavController().navigate(R.id.action_login_to_register)
        }
        binding.tvSignUp.setOnClickListener {
            findNavController().navigate(R.id.action_login_to_register)
        }
        binding.tvForgotPassword.setOnClickListener {
            showForgotPasswordDialog()
        }

        updatePasswordVisibilityIcon()

        // Toggle password
        binding.btnTogglePassword.setOnClickListener {
            passwordVisible = !passwordVisible
            binding.etPassword.transformationMethod =
                if (passwordVisible) null
                else PasswordTransformationMethod.getInstance()
            binding.etPassword.setSelection(binding.etPassword.text.length)
            updatePasswordVisibilityIcon()
        }

        // Sign In
        binding.btnSignIn.setOnClickListener {
            val email    = binding.etEmail.text.toString().trim()
            val password = binding.etPassword.text.toString().trim()
            if (email.isEmpty() || password.isEmpty()) {
                showError("Please fill in all fields")
                return@setOnClickListener
            }
            setLoading(true)
            viewModel.login(requireContext(), email, password)
        }

        // Observe login result
        viewModel.loginResult.observe(viewLifecycleOwner) { result ->
            setLoading(false)
            result.onSuccess {
                findNavController().navigate(R.id.action_login_to_home)
            }
            result.onFailure { e ->
                showError(e.message ?: "Login failed")
            }
        }

        viewModel.forgotPasswordCodeResult.observe(viewLifecycleOwner) { result ->
            result.onSuccess { message ->
                verificationCodeSent = true
                verificationCodeValidated = false
                isVerifyingResetCode = false
                lastVerificationAttempt = ""
                resetVerificationSection?.visibility = View.VISIBLE
                resetEmailField?.isEnabled = false
                resetCodeField?.requestFocus()
                resetStatusText?.text = "Step 1 complete: A verification code has been sent to your email. Continue with Step 2 below."
                resetSendCodeButton?.isEnabled = true
                resetSendCodeButton?.text = "Resend Verification Code"
                forgotPasswordDialog?.getButton(AlertDialog.BUTTON_POSITIVE)?.isEnabled = false
                Toast.makeText(requireContext(), message, Toast.LENGTH_LONG).show()
            }
            result.onFailure { error ->
                resetSendCodeButton?.isEnabled = true
                resetSendCodeButton?.text = "Send Verification Code"
                Toast.makeText(
                    requireContext(),
                    error.message ?: "Unable to send the verification code.",
                    Toast.LENGTH_LONG
                ).show()
            }
        }

        viewModel.forgotPasswordVerifyResult.observe(viewLifecycleOwner) { result ->
            isVerifyingResetCode = false
            result.onSuccess { message ->
                verificationCodeValidated = true
                resetPasswordFieldsSection?.visibility = View.VISIBLE
                forgotPasswordDialog?.getButton(AlertDialog.BUTTON_POSITIVE)?.isEnabled = true
                resetStatusText?.text = "Step 2 complete: Verification code confirmed. You may now enter a new password."
                Toast.makeText(requireContext(), message, Toast.LENGTH_LONG).show()
            }
            result.onFailure { error ->
                verificationCodeValidated = false
                resetPasswordFieldsSection?.visibility = View.GONE
                forgotPasswordDialog?.getButton(AlertDialog.BUTTON_POSITIVE)?.isEnabled = false
                resetStatusText?.text = "Step 2: Enter the correct 6-digit verification code from your email to continue."
                Toast.makeText(
                    requireContext(),
                    error.message ?: "Unable to verify the code.",
                    Toast.LENGTH_LONG
                ).show()
            }
        }

        viewModel.forgotPasswordConfirmResult.observe(viewLifecycleOwner) { result ->
            result.onSuccess { message ->
                forgotPasswordDialog?.dismiss()
                clearForgotPasswordDialogState()
                Toast.makeText(requireContext(), message, Toast.LENGTH_LONG).show()
            }
            result.onFailure { error ->
                Toast.makeText(
                    requireContext(),
                    error.message ?: "Unable to reset password.",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    private fun showForgotPasswordDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_forgot_password, null)
        resetEmailField = dialogView.findViewById(R.id.etResetEmail)
        resetPasswordField = dialogView.findViewById(R.id.etResetPassword)
        resetPasswordToggle = dialogView.findViewById(R.id.btnToggleResetPassword)
        resetSendCodeButton = dialogView.findViewById(R.id.btnSendResetCode)
        resetCodeField = dialogView.findViewById(R.id.etResetCode)
        resetConfirmField = dialogView.findViewById(R.id.etResetConfirmPassword)
        resetConfirmToggle = dialogView.findViewById(R.id.btnToggleResetConfirmPassword)
        resetStatusText = dialogView.findViewById(R.id.tvResetEmailStatus)
        resetVerificationSection = dialogView.findViewById(R.id.layoutResetVerification)
        resetPasswordFieldsSection = dialogView.findViewById(R.id.layoutResetPasswordFields)
        verificationCodeSent = false
        verificationCodeValidated = false
        isVerifyingResetCode = false
        resetPasswordVisible = false
        resetConfirmVisible = false
        lastVerificationAttempt = ""

        resetEmailField?.setText(binding.etEmail.text?.toString()?.trim().orEmpty())
        resetVerificationSection?.visibility = View.GONE
        resetPasswordFieldsSection?.visibility = View.GONE
        updateDialogPasswordToggleIcon(resetPasswordToggle, resetPasswordVisible)
        updateDialogPasswordToggleIcon(resetConfirmToggle, resetConfirmVisible)

        forgotPasswordDialog = AlertDialog.Builder(requireContext())
            .setTitle("Forgot Password")
            .setView(dialogView)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Reset Password", null)
            .create()

        forgotPasswordDialog?.setOnShowListener {
            forgotPasswordDialog?.getButton(AlertDialog.BUTTON_POSITIVE)?.isEnabled = false

            resetPasswordToggle?.setOnClickListener {
                resetPasswordVisible = !resetPasswordVisible
                resetPasswordField?.transformationMethod =
                    if (resetPasswordVisible) null else PasswordTransformationMethod.getInstance()
                resetPasswordField?.setSelection(resetPasswordField?.text?.length ?: 0)
                updateDialogPasswordToggleIcon(resetPasswordToggle, resetPasswordVisible)
            }

            resetConfirmToggle?.setOnClickListener {
                resetConfirmVisible = !resetConfirmVisible
                resetConfirmField?.transformationMethod =
                    if (resetConfirmVisible) null else PasswordTransformationMethod.getInstance()
                resetConfirmField?.setSelection(resetConfirmField?.text?.length ?: 0)
                updateDialogPasswordToggleIcon(resetConfirmToggle, resetConfirmVisible)
            }

            resetCodeWatcher = object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                    val code = s?.toString()?.trim().orEmpty()
                    if (code.length < 6) {
                        verificationCodeValidated = false
                        isVerifyingResetCode = false
                        lastVerificationAttempt = ""
                        resetPasswordFieldsSection?.visibility = View.GONE
                        forgotPasswordDialog?.getButton(AlertDialog.BUTTON_POSITIVE)?.isEnabled = false
                        if (verificationCodeSent) {
                            resetStatusText?.text = "Step 2: Enter the correct 6-digit verification code from your email to continue."
                        }
                        return
                    }

                    if (
                        verificationCodeSent &&
                        code.length == 6 &&
                        !verificationCodeValidated &&
                        !isVerifyingResetCode &&
                        code != lastVerificationAttempt
                    ) {
                        isVerifyingResetCode = true
                        lastVerificationAttempt = code
                        resetStatusText?.text = "Checking your verification code..."
                        viewModel.verifyPasswordResetCode(
                            resetEmailField?.text?.toString()?.trim().orEmpty(),
                            code
                        )
                    }
                }
                override fun afterTextChanged(s: Editable?) = Unit
            }
            resetCodeField?.addTextChangedListener(resetCodeWatcher)

            resetSendCodeButton?.setOnClickListener {
                val email = resetEmailField?.text?.toString()?.trim().orEmpty()

                if (email.isEmpty()) {
                    Toast.makeText(requireContext(), "Please enter your email first.", Toast.LENGTH_SHORT).show()
                } else {
                    verificationCodeSent = false
                    verificationCodeValidated = false
                    isVerifyingResetCode = false
                    lastVerificationAttempt = ""
                    resetPasswordFieldsSection?.visibility = View.GONE
                    forgotPasswordDialog?.getButton(AlertDialog.BUTTON_POSITIVE)?.isEnabled = false
                    resetSendCodeButton?.isEnabled = false
                    resetSendCodeButton?.text = "Sending..."
                    viewModel.requestPasswordResetCode(email)
                }
            }

            forgotPasswordDialog?.getButton(AlertDialog.BUTTON_POSITIVE)?.setOnClickListener {
                val email = resetEmailField?.text?.toString()?.trim().orEmpty()
                val code = resetCodeField?.text?.toString()?.trim().orEmpty()
                val newPassword = resetPasswordField?.text?.toString()?.trim().orEmpty()
                val confirmPassword = resetConfirmField?.text?.toString()?.trim().orEmpty()

                when {
                    !verificationCodeSent -> {
                        Toast.makeText(requireContext(), "Please verify your email first.", Toast.LENGTH_SHORT).show()
                    }
                    !verificationCodeValidated -> {
                        Toast.makeText(requireContext(), "Please enter the correct verification code first.", Toast.LENGTH_SHORT).show()
                    }
                    email.isEmpty() || code.isEmpty() || newPassword.isEmpty() || confirmPassword.isEmpty() -> {
                        Toast.makeText(requireContext(), "Please complete all fields.", Toast.LENGTH_SHORT).show()
                    }
                    code.length != 6 -> {
                        Toast.makeText(requireContext(), "Enter the 6-digit code sent to your email.", Toast.LENGTH_SHORT).show()
                    }
                    newPassword.length < 8 -> {
                        Toast.makeText(requireContext(), "Password must be at least 8 characters.", Toast.LENGTH_SHORT).show()
                    }
                    newPassword != confirmPassword -> {
                        Toast.makeText(requireContext(), "Passwords do not match.", Toast.LENGTH_SHORT).show()
                    }
                    else -> {
                        viewModel.confirmPasswordReset(email, code, newPassword)
                    }
                }
            }
        }

        forgotPasswordDialog?.setOnDismissListener {
            clearForgotPasswordDialogState()
        }

        forgotPasswordDialog?.show()
    }

    private fun clearForgotPasswordDialogState() {
        resetCodeWatcher?.let { watcher ->
            resetCodeField?.removeTextChangedListener(watcher)
        }
        verificationCodeSent = false
        verificationCodeValidated = false
        isVerifyingResetCode = false
        lastVerificationAttempt = ""
        resetEmailField = null
        resetCodeField = null
        resetPasswordField = null
        resetConfirmField = null
        resetPasswordToggle = null
        resetConfirmToggle = null
        resetStatusText = null
        resetVerificationSection = null
        resetPasswordFieldsSection = null
        resetSendCodeButton = null
        resetPasswordVisible = false
        resetConfirmVisible = false
        resetCodeWatcher = null
    }

    private fun showError(msg: String) {
        binding.tvError.text = msg
        binding.tvError.visibility = View.VISIBLE
    }

    private fun updatePasswordVisibilityIcon() {
        binding.btnTogglePassword.setImageResource(
            if (passwordVisible) R.drawable.ic_eye_open else R.drawable.ic_eye_closed
        )
    }

    private fun updateDialogPasswordToggleIcon(button: ImageButton?, visible: Boolean) {
        button?.setImageResource(
            if (visible) R.drawable.ic_eye_open else R.drawable.ic_eye_closed
        )
    }

    private fun setLoading(loading: Boolean) {
        binding.btnSignIn.isEnabled = !loading
        binding.btnSignIn.text = if (loading) "Signing in…" else "Sign In →"
        binding.tvError.visibility = View.GONE
    }

    override fun onDestroyView() {
        forgotPasswordDialog?.dismiss()
        forgotPasswordDialog = null
        clearForgotPasswordDialogState()
        super.onDestroyView()
        _binding = null
    }
}
