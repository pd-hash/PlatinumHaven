package com.platinumhaven.app.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.CheckBox
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.content.res.AppCompatResources
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.navigation.fragment.findNavController
import com.platinumhaven.app.R
import com.platinumhaven.app.databinding.FragmentBookingStep2Binding
import com.platinumhaven.app.viewmodel.RoomsViewModel

class BookingStep2Fragment : Fragment() {

    private var _binding: FragmentBookingStep2Binding? = null
    private val binding get() = _binding!!
    private val roomsViewModel: RoomsViewModel by viewModels()

    private val selectedAddonIds = mutableListOf<String>()
    private val selectedAddonPrices = mutableMapOf<String, Double>()

    private var roomId = ""
    private var roomName = ""
    private var roomImage = ""
    private var checkIn = ""
    private var checkOut = ""
    private var guests = 1
    private var adults = 1
    private var children = 0
    private var specialRequests = ""
    private var baseTotal = 0f

    private fun addonPriceForGuests(basePrice: Double): Double {
        return basePrice * guests.coerceAtLeast(1)
    }

    private fun formatPeso(amount: Double): String =
        "P${String.format("%,.0f", amount)}"

    private fun updateExpandedState(
        breakdownLayout: LinearLayout,
        expandIcon: TextView,
        checked: Boolean
    ) {
        expandIcon.animate().rotation(if (checked) 180f else 0f).setDuration(180).start()

        if (checked) {
            breakdownLayout.alpha = 0f
            breakdownLayout.visibility = View.VISIBLE
            breakdownLayout.animate().alpha(1f).setDuration(180).start()
        } else {
            breakdownLayout.animate()
                .alpha(0f)
                .setDuration(160)
                .withEndAction {
                    breakdownLayout.visibility = View.GONE
                }
                .start()
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentBookingStep2Binding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        roomId = arguments?.getString("roomId") ?: ""
        roomName = arguments?.getString("roomName") ?: ""
        roomImage = arguments?.getString("roomImage") ?: ""
        checkIn = arguments?.getString("checkIn") ?: ""
        checkOut = arguments?.getString("checkOut") ?: ""
        guests = arguments?.getInt("guests") ?: 1
        adults = arguments?.getInt("adults") ?: 1
        children = arguments?.getInt("children") ?: 0
        specialRequests = arguments?.getString("specialRequests") ?: ""
        baseTotal = arguments?.getFloat("totalPrice") ?: 0f

        binding.tvTotal.text = "P${String.format("%,.0f", baseTotal)}"
        styleBackButton()
        binding.btnBack.setOnClickListener { findNavController().popBackStack() }
        binding.btnSkip.setOnClickListener { proceedToPayment(emptyList(), emptyMap()) }

        roomsViewModel.addons.observe(viewLifecycleOwner) { addons ->
            binding.llAddons.removeAllViews()
            addons.forEach { addon ->
                val item = layoutInflater.inflate(R.layout.item_addon_step2, binding.llAddons, false)
                val guestAdjustedPrice = addonPriceForGuests(addon.price)

                item.findViewById<TextView>(R.id.tvAddonIcon).text = addon.icon ?: "*"
                item.findViewById<TextView>(R.id.tvAddonName).text = addon.name
                item.findViewById<TextView>(R.id.tvAddonPrice).text = "+${formatPeso(guestAdjustedPrice)}"
                item.findViewById<TextView>(R.id.tvAddonCategory).text = addon.category
                item.findViewById<TextView>(R.id.tvAddonComputation).text =
                    "${formatPeso(addon.price)} x $guests guest${if (guests > 1) "s" else ""} = ${formatPeso(guestAdjustedPrice)}"
                item.findViewById<TextView>(R.id.tvAddonGuestsSummary).text =
                    "$adults adult${if (adults > 1) "s" else ""} + $children child${if (children != 1) "ren" else ""}"

                val checkbox = item.findViewById<CheckBox>(R.id.cbAddon)
                val expandIcon = item.findViewById<TextView>(R.id.tvAddonExpand)
                val breakdownLayout = item.findViewById<LinearLayout>(R.id.layoutAddonBreakdown)
                checkbox.isChecked = false
                updateExpandedState(breakdownLayout, expandIcon, checked = false)

                checkbox.setOnCheckedChangeListener { _, checked ->
                    if (checked) {
                        if (!selectedAddonIds.contains(addon.id)) {
                            selectedAddonIds.add(addon.id)
                            selectedAddonPrices[addon.id] = guestAdjustedPrice
                        }
                    } else {
                        selectedAddonIds.remove(addon.id)
                        selectedAddonPrices.remove(addon.id)
                    }
                    checkbox.animate().scaleX(if (checked) 1.08f else 1f).scaleY(if (checked) 1.08f else 1f).setDuration(140).withEndAction {
                        checkbox.animate().scaleX(1f).scaleY(1f).setDuration(100).start()
                    }.start()
                    updateExpandedState(breakdownLayout, expandIcon, checked)
                    updateTotal()
                }

                item.setOnClickListener { checkbox.isChecked = !checkbox.isChecked }
                binding.llAddons.addView(item)
            }
        }
        roomsViewModel.loadAddons(requireContext())

        binding.btnContinue.setOnClickListener {
            proceedToPayment(selectedAddonIds, selectedAddonPrices)
        }
    }

    private fun styleBackButton() {
        binding.btnBack.apply {
            background = AppCompatResources.getDrawable(context, R.drawable.bg_back_button)
            setImageDrawable(AppCompatResources.getDrawable(context, R.drawable.ic_back_chevron))
            imageTintList = null
        }
    }

    private fun updateTotal() {
        val total = baseTotal + selectedAddonPrices.values.sum()
        binding.tvTotal.text = "P${String.format("%,.0f", total)}"
    }

    private fun proceedToPayment(
        addonIds: List<String>,
        addonPrices: Map<String, Double>
    ) {
        val bundle = Bundle().apply {
            putString("roomId", roomId)
            putString("roomName", roomName)
            putString("roomImage", roomImage)
            putString("checkIn", checkIn)
            putString("checkOut", checkOut)
            putInt("guests", guests)
            putInt("adults", adults)
            putInt("children", children)
            putString("specialRequests", specialRequests)
            putFloat("totalPrice", (baseTotal + addonPrices.values.sum()).toFloat())
            putString("addonIds", addonIds.joinToString(","))
        }
        findNavController().navigate(R.id.action_step2_to_step3, bundle)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
