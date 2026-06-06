package com.platinumhaven.app.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.platinumhaven.app.data.TokenStore
import com.platinumhaven.app.databinding.FragmentPersonalInfoBinding

class PersonalInfoFragment : Fragment() {

    private var _binding: FragmentPersonalInfoBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentPersonalInfoBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val context = requireContext()
        binding.btnBack.setOnClickListener { findNavController().navigateUp() }
        binding.tvFullNameValue.text = valueOrDash(TokenStore.getUserName(context))
        binding.tvFirstNameValue.text = valueOrDash(TokenStore.getUserFirstName(context))
        binding.tvMiddleNameValue.text = valueOrDash(TokenStore.getUserMiddleName(context))
        binding.tvLastNameValue.text = valueOrDash(TokenStore.getUserLastName(context))
        binding.tvEmailValue.text = valueOrDash(TokenStore.getUserEmail(context))
        binding.tvPhoneValue.text = valueOrDash(TokenStore.getUserPhone(context))
        binding.tvSexValue.text = valueOrDash(TokenStore.getUserSex(context))
        binding.tvApprovalValue.text = valueOrDash(TokenStore.getApprovalStatus(context))
    }

    private fun valueOrDash(value: String?): String =
        value?.takeIf { it.isNotBlank() } ?: "—"

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
