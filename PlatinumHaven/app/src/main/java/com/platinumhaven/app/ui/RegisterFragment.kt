package com.platinumhaven.app.ui

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.text.method.PasswordTransformationMethod
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.navigation.fragment.findNavController
import com.platinumhaven.app.R
import com.platinumhaven.app.databinding.FragmentRegisterBinding
import com.platinumhaven.app.viewmodel.AuthViewModel

class RegisterFragment : Fragment() {

    private var _binding: FragmentRegisterBinding? = null
    private val binding get() = _binding!!
    private val viewModel: AuthViewModel by viewModels()
    private var passwordVisible = false
    private var confirmVisible = false
    private var selectedIdUri: Uri? = null
    private var uploadedIdUrl: String? = null
    private var isUploadingId = false
    private val PICK_ID_REQUEST = 101

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentRegisterBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Tab buttons
        binding.btnTabLogin.setOnClickListener {
            findNavController().navigate(R.id.action_register_to_login)
        }
        binding.btnTabRegister.setOnClickListener { /* already here */ }

        updatePasswordToggleIcon(binding.btnTogglePassword, passwordVisible)
        updatePasswordToggleIcon(binding.btnToggleConfirm, confirmVisible)

        // Toggle password
        binding.btnTogglePassword.setOnClickListener {
            passwordVisible = !passwordVisible
            binding.etPassword.transformationMethod =
                if (passwordVisible) null
                else PasswordTransformationMethod.getInstance()
            binding.etPassword.setSelection(binding.etPassword.text.length)
            updatePasswordToggleIcon(binding.btnTogglePassword, passwordVisible)
        }

        binding.btnToggleConfirm.setOnClickListener {
            confirmVisible = !confirmVisible
            binding.etConfirmPassword.transformationMethod =
                if (confirmVisible) null
                else PasswordTransformationMethod.getInstance()
            binding.etConfirmPassword.setSelection(binding.etConfirmPassword.text.length)
            updatePasswordToggleIcon(binding.btnToggleConfirm, confirmVisible)
        }

        // Upload ID
        binding.btnUploadId.setOnClickListener {
            val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                type = "image/*"
            }
            startActivityForResult(intent, PICK_ID_REQUEST)
        }

        // Register button
        binding.btnRegister.setOnClickListener {
            val firstName = binding.etFirstName.text.toString().trim()
            val middleName = binding.etMiddleName.text.toString().trim()
            val lastName = binding.etLastName.text.toString().trim()
            val email = binding.etEmail.text.toString().trim()
            val phone = binding.etPhone.text.toString().trim()
            val password = binding.etPassword.text.toString().trim()
            val confirmPassword = binding.etConfirmPassword.text.toString().trim()
            val sex = when (binding.rgSex.checkedRadioButtonId) {
                R.id.rbMale -> "Male"
                R.id.rbFemale -> "Female"
                else -> ""
            }

            when {
                firstName.isEmpty() -> showError("Please enter your first name")
                lastName.isEmpty() -> showError("Please enter your last name")
                email.isEmpty() -> showError("Please enter your email")
                phone.isEmpty() -> showError("Please enter your phone number")
                sex.isEmpty() -> showError("Please select your sex")
                password.length < 6 -> showError("Password must be at least 6 characters")
                password != confirmPassword -> showError("Passwords do not match")
                selectedIdUri == null -> showError("Please upload a valid government ID")
                isUploadingId -> showError("Please wait for the valid ID upload to finish")
                uploadedIdUrl.isNullOrBlank() -> showError("Please upload a valid government ID to the server first")
                else -> {
                    setLoading(true)
                    viewModel.register(
                        firstName, lastName, middleName,
                        email, password, phone, sex, uploadedIdUrl!!
                    )
                }
            }
        }

        viewModel.validIdUploadResult.observe(viewLifecycleOwner) { result ->
            result ?: return@observe
            isUploadingId = false
            result.onSuccess { url ->
                uploadedIdUrl = url
                binding.tvError.text = ""
                binding.tvError.visibility = View.GONE
                binding.tvIdFileName.text = "ID uploaded and attached"
                binding.tvIdFileName.setTextColor(0xFF2D6A4F.toInt())
                binding.tvIdFileName.visibility = View.VISIBLE
                binding.btnUploadId.text = "Change ID"
            }
            result.onFailure { error ->
                selectedIdUri = null
                uploadedIdUrl = null
                binding.ivIdPreview.setImageDrawable(null)
                binding.ivIdPreview.visibility = View.GONE
                binding.tvIdFileName.text = error.message ?: "Unable to upload ID"
                binding.tvIdFileName.setTextColor(0xFFEF4444.toInt())
                binding.tvIdFileName.visibility = View.VISIBLE
                binding.btnUploadId.text = "Upload Valid ID"
                showError(error.message ?: "Unable to upload ID")
            }
            setIdUploadLoading(false)
            viewModel.clearValidIdUploadResult()
        }

        // Observe register result
        viewModel.registerResult.observe(viewLifecycleOwner) { result ->
            setLoading(false)
            result.onSuccess { message ->
                Toast.makeText(requireContext(), message, Toast.LENGTH_LONG).show()
                findNavController().navigate(R.id.action_register_success)
            }
            result.onFailure { e ->
                showError(e.message ?: "Registration failed")
            }
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == PICK_ID_REQUEST && resultCode == Activity.RESULT_OK) {
            selectedIdUri = data?.data
            val fileName = selectedIdUri?.lastPathSegment ?: "ID uploaded"
            uploadedIdUrl = null
            binding.tvError.text = ""
            binding.tvError.visibility = View.GONE
            binding.ivIdPreview.setImageURI(selectedIdUri)
            binding.ivIdPreview.visibility = View.VISIBLE
            binding.tvIdFileName.text = "Selected: $fileName"
            binding.tvIdFileName.setTextColor(0xFF2D6A4F.toInt())
            binding.tvIdFileName.visibility = View.VISIBLE
            setIdUploadLoading(true)
            selectedIdUri?.let { viewModel.uploadValidId(requireContext(), it) }
        }
    }

    private fun showError(msg: String) {
        binding.tvError.text = msg
        binding.tvError.visibility = View.VISIBLE
    }

    private fun updatePasswordToggleIcon(button: ImageButton, visible: Boolean) {
        button.setImageResource(
            if (visible) R.drawable.ic_eye_open else R.drawable.ic_eye_closed
        )
    }

    private fun setLoading(loading: Boolean) {
        binding.btnRegister.isEnabled = !loading
        binding.btnRegister.text = if (loading) "Creating account..." else "Create Account"
        binding.tvError.visibility = View.GONE
    }

    private fun setIdUploadLoading(loading: Boolean) {
        isUploadingId = loading
        binding.btnUploadId.isEnabled = !loading
        binding.btnUploadId.text = if (loading) "Uploading ID..." else if (uploadedIdUrl.isNullOrBlank()) "Upload Valid ID" else "Change ID"
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
