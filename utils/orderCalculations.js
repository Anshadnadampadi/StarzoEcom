import Coupon from '../models/coupon/coupon.js';

/**
 * Recalculates order subtotal, tax, discount, and total amount.
 * Handles coupon validation checks and proportional discount re-distribution for remaining active items.
 * 
 * @param {Object} order - The mongoose order document
 */
export const recalculateOrderTotals = async (order) => {
    // Only count items that are NOT Cancelled or Returned (nor in the process of being returned)
    // Wait, terminal status is Cancelled or Returned. 
    // What about Return Requested? A requested return hasn't been refunded yet! 
    // If it's just requested, it shouldn't affect the totals until it's actually Approved or Returned.
    // However, the previous logic excluded 'Return Requested', 'Return Approved', 'Return Picked'.
    // Let's stick to the existing filter to be safe, assuming the system considers them "gone" from totals.
    const activeItems = order.items.filter(item => !['Cancelled', 'Returned', 'Return Requested', 'Return Approved', 'Return Picked'].includes(item.status));
    
    const subtotal = activeItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
    order.subtotal = subtotal;
    
    // Recalculate discount if a coupon was used
    let discount = 0;
    if (order.couponCode) {
        try {
            const coupon = await Coupon.findOne({ code: order.couponCode.trim().toUpperCase() });
            if (coupon && subtotal >= coupon.minAmount) {
                if (coupon.discountType === 'percentage') {
                    discount = Math.floor(subtotal * (coupon.discountValue / 100));
                    if (coupon.maxDiscount && discount > coupon.maxDiscount) {
                        discount = coupon.maxDiscount;
                    }
                } else {
                    discount = Math.min(coupon.discountValue, subtotal);
                }
            } else {
                // If subtotal is now less than minAmount, the coupon is no longer valid
                order.couponCode = null;
                // Zero out couponDiscount on remaining active items
                activeItems.forEach(item => {
                    item.couponDiscount = 0;
                    item.finalPaidAmount = item.price * item.qty;
                });
            }
        } catch (error) {
            console.error('Error fetching coupon during recalculation:', error);
        }
    }
    
    order.discount = discount;

    // Re-distribute the new valid discount proportionately
    if (discount > 0 && activeItems.length > 0) {
        let remainingDiscount = discount;
        activeItems.forEach((item, index) => {
            const itemTotal = item.price * item.qty;
            const itemRatio = subtotal > 0 ? itemTotal / subtotal : 0;
            let itemDiscount = Math.floor(discount * itemRatio);

            if (index === activeItems.length - 1) {
                itemDiscount = remainingDiscount; // Ensure all discount is applied
            }
            remainingDiscount -= itemDiscount;

            item.couponDiscount = itemDiscount;
            item.finalPaidAmount = Math.max(0, itemTotal - itemDiscount);
        });
    }

    // Tax is 18% of active subtotal AFTER discount (Net Taxable Value)
    const taxableAmount = Math.max(0, subtotal - discount);
    const tax = Math.floor(taxableAmount * 0.18);
    order.tax = tax;
    
    // Shipping remains fixed once order is placed, unless all items are gone
    if (subtotal === 0) {
        order.shippingFee = 0;
    }
    
    order.totalAmount = Math.max(0, subtotal + order.tax + (order.shippingFee || 0) - discount);
};
