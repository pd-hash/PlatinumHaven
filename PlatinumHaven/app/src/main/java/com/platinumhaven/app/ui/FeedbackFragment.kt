package com.platinumhaven.app.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.navigation.fragment.findNavController
import com.platinumhaven.app.R
import com.platinumhaven.app.databinding.FragmentFeedbackBinding
import com.platinumhaven.app.viewmodel.ReservationsViewModel

class FeedbackFragment : Fragment() {

    private var _binding: FragmentFeedbackBinding? = null
    private val binding get() = _binding!!
    private val viewModel: ReservationsViewModel by viewModels()
    private var selectedRating = 0
    private var reservationId = ""
    private var isSubmitting = false

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentFeedbackBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        reservationId = arguments?.getString("reservationId") ?: ""
        viewModel.clearFeedbackResult()

        if (reservationId.isBlank()) {
            showError("Missing reservation details. Please try again from your bookings list.")
            binding.btnSubmit.isEnabled = false
            return
        }

        val stars = listOf(
            binding.btnStar1,
            binding.btnStar2,
            binding.btnStar3,
            binding.btnStar4,
            binding.btnStar5
        )

        val labels = listOf(
            "Poor",
            "Fair",
            "Good",
            "Great",
            "Excellent!"
        )

        stars.forEachIndexed { index, star ->
            star.setOnClickListener {
                selectedRating = index + 1
                updateStars(stars, selectedRating)
                binding.tvRatingLabel.text = labels[index]
                binding.tvRatingLabel.setTextColor(0xFF2D6A4F.toInt())
                binding.tvError.visibility = View.GONE
            }
        }

        binding.btnSubmit.setOnClickListener {
            if (isSubmitting) return@setOnClickListener

            val comment = binding.etComment.text.toString().trim()
            when {
                selectedRating == 0 -> showError("Please select a star rating")
                comment.isEmpty() -> showError("Please write a comment")
                else -> {
                    isSubmitting = true
                    setLoading(true)
                    viewModel.submitFeedback(
                        requireContext(),
                        reservationId,
                        selectedRating,
                        comment
                    )
                }
            }
        }

        viewModel.feedbackResult.observe(viewLifecycleOwner) { result ->
            result ?: return@observe

            isSubmitting = false
            setLoading(false)

            result.onSuccess {
                Toast.makeText(
                    requireContext(),
                    "Thank you for your feedback!",
                    Toast.LENGTH_LONG
                ).show()
                viewModel.clearFeedbackResult()
                findNavController().navigate(R.id.action_feedback_to_bookings)
            }

            result.onFailure { e ->
                showError(e.message ?: "Failed to submit feedback")
                viewModel.clearFeedbackResult()
            }
        }
    }

    private fun updateStars(stars: List<TextView>, rating: Int) {
        stars.forEachIndexed { i, star ->
            star.setTextColor(
                if (i < rating) 0xFFF59E0B.toInt() else 0xFFE5E7EB.toInt()
            )
        }
    }

    private fun showError(msg: String) {
        binding.tvError.text = msg
        binding.tvError.visibility = View.VISIBLE
    }

    private fun setLoading(loading: Boolean) {
        binding.btnSubmit.isEnabled = !loading
        binding.btnSubmit.text = if (loading) "Submitting..." else "Submit Feedback"
        binding.tvError.visibility = View.GONE
    }

    override fun onDestroyView() {
        viewModel.clearFeedbackResult()
        super.onDestroyView()
        _binding = null
    }
}
