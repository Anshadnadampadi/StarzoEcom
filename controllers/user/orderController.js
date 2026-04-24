import Order from '../../models/order/order.js';
import PDFDocument from 'pdfkit';
import { 
    getUserOrdersService, 
    cancelOrderService, 
    cancelOrderItemService, 
    requestReturnService, 
    returnOrderItemService 
} from '../../services/user/orderService.js';

export const getUserOrders = async (req, res) => {
    try {
        const userId = req.session.user;
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const search = req.query.search || '';
        const status = req.query.status || '';

        const { orders, totalPages } = await getUserOrdersService(userId, search, status, page, limit);

        // Build query string for pagination
        let queryString = '';
        if (search) queryString += `search=${search}&`;
        if (status) queryString += `status=${status}&`;

        res.render('user/account/orders', {
            title: 'My Orders',
            orders,
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page + 1,
            prevPage: page - 1,
            lastPage: totalPages,
            search,
            status,
            query: queryString,
            breadcrumbs: [
                { label: 'Profile', url: '/profile' },
                { label: 'Orders', url: '/account/orders' }
            ]
        });
    } catch (error) {
        console.error('Error fetching user orders:', error);
        res.status(500).render('errors/error', { message: 'Internal Server Error' });
    }
};

export const getUserOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.session.user;

        const order = await Order.findOne({ _id: orderId, user: userId })
            .populate('items.product')
            .lean();

        if (!order) {
            return res.status(404).render('errors/error', { message: 'Order not found' });
        }

        res.render('user/account/order-details', {
            title: `Order Details #${order.orderId}`,
            order,
            breadcrumbs: [
                { label: 'Profile', url: '/profile' },
                { label: 'Orders', url: '/account/orders' },
                { label: `Order #${order.orderId}`, url: `/account/orders/${order._id}` }
            ]
        });
    } catch (error) {
        console.error('Error fetching user order details:', error);
        res.status(500).render('errors/error', { message: 'Internal Server Error' });
    }
};

export const cancelOrder = async (req, res) => {
    try {
        const { orderId, reason } = req.body;
        const userId = req.session.user;
        const result = await cancelOrderService(userId, orderId, reason);

        if (!result.success) {
            return res.status(result.status || 400).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

export const cancelOrderItem = async (req, res) => {
    try {
        const { orderId, itemId } = req.body;
        const userId = req.session.user;
        const result = await cancelOrderItemService(userId, orderId, itemId);

        if (!result.success) {
            return res.status(result.status || 400).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Error cancelling order item:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

export const requestReturn = async (req, res) => {
    try {
        const { orderId, reason } = req.body;
        const userId = req.session.user;

        if (!reason || reason.trim().length < 10) {
            return res.status(400).json({ success: false, message: 'Please provide a detailed reason (min 10 characters).' });
        }

        const result = await requestReturnService(userId, orderId, reason);

        if (!result.success) {
            return res.status(result.status || 400).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Error requesting return:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

export const returnOrderItem = async (req, res) => {
    try {
        const { orderId, itemId, reason } = req.body;
        const userId = req.session.user;

        if (!reason || reason.trim().length < 10) {
            return res.status(400).json({ success: false, message: 'Please provide a detailed reason (min 10 characters).' });
        }

        const result = await returnOrderItemService(userId, orderId, itemId, reason);

        if (!result.success) {
            return res.status(result.status || 400).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Error returning order item:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

export const downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.session.user;

        const order = await Order.findOne({ _id: orderId, user: userId }).populate('items.product');

        if (!order) return res.status(404).send('Order not found');

        // Invoice is available for any order that has reached at least confirmed status
        const allowedInvoiceStatuses = ['Confirmed', 'Processing', 'Shipped', 'Delivered', 'Partially Returned', 'Return Requested', 'Return Approved', 'Return Picked', 'Returned'];
        if (!allowedInvoiceStatuses.includes(order.orderStatus)) {
            return res.redirect(`/account/orders/${order._id}?msg=Invoice is available only once the order is confirmed.&icon=error`);
        }

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Invoice-${order.orderId}.pdf"`);

        doc.pipe(res);

        // --- Original Invoice Logic (Immutable) ---
        // We use all items to represent the purchase at the time it was made
        const originalItems = order.items; 
        const originalSubtotal = originalItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const originalTax = Math.floor(originalSubtotal * 0.18);
        
        // Calculate original discount (proportionally if needed, but here we just take the stored discount if the subtotal matches)
        // Since we want the "Original" invoice, we should ideally show what was actually paid at checkout.
        // If the order has a discount, we show it.
        const originalDiscount = order.discount || 0;
        const originalShipping = order.shippingFee || 0;
        const originalTotal = originalSubtotal + originalTax + originalShipping - originalDiscount;

        // --- Colors & Branding ---
        const accentColor = '#ff6a00';
        const darkColor = '#111111';
        const lightGray = '#f9f9f9';
        const borderColor = '#eeeeee';
        const textColor = '#333333';
        const secondaryTextColor = '#666666';

        // --- Header / Logo ---
        doc.rect(50, 45, 25, 25).fill(accentColor);
        doc.fillColor('#FFFFFF').fontSize(16).font('Helvetica-Bold').text('S', 56, 52);
        
        doc.fillColor(darkColor).fontSize(22).font('Helvetica-Bold').text('STARZO', 85, 48);
        doc.fontSize(8).font('Helvetica').fillColor(secondaryTextColor).text('PREMIUM MOBILE EXPERIENCE', 85, 70);

        // --- Invoice Label & Meta ---
        doc.fillColor(darkColor).fontSize(20).font('Helvetica-Bold').text('TAX INVOICE', 400, 48, { align: 'right' });
        doc.fontSize(9).font('Helvetica').fillColor(secondaryTextColor)
           .text(`Order ID: #${order.orderId}`, 400, 70, { align: 'right' })
           .text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, 400, 82, { align: 'right' });

        doc.moveDown(3);
        doc.strokeColor(borderColor).lineWidth(1).moveTo(50, 110).lineTo(550, 110).stroke();

        // --- Addresses ---
        const addressY = 135;
        doc.fillColor(darkColor).fontSize(11).font('Helvetica-Bold').text('BILLED TO', 50, addressY);
        doc.fontSize(10).font('Helvetica').fillColor(textColor)
           .text(order.shippingAddress.fullName, 50, addressY + 18)
           .fillColor(secondaryTextColor)
           .text(order.shippingAddress.streetAddress, 50, addressY + 32, { width: 200 })
           .text(`${order.shippingAddress.city}, ${order.shippingAddress.state}`, 50, addressY + 46)
           .text(`PIN: ${order.shippingAddress.pinCode}`, 50, addressY + 58)
           .text(`Phone: ${order.shippingAddress.phone}`, 50, addressY + 70);

        doc.fillColor(darkColor).fontSize(11).font('Helvetica-Bold').text('SOLD BY', 350, addressY);
        doc.fontSize(10).font('Helvetica').fillColor(textColor)
           .text('Starzo Mobiles Pvt Ltd.', 350, addressY + 18)
           .fillColor(secondaryTextColor)
           .text('123 Tech Avenue, Electronic City', 350, addressY + 32)
           .text('Bangalore, Karnataka - 560100', 350, addressY + 46)
           .text('GSTIN: 29AAAAA0000A1Z5', 350, addressY + 58)
           .text('Contact: support@starzo.com', 350, addressY + 70);

        doc.moveDown(5);

        // --- Items Table ---
        const tableTop = 270;
        doc.rect(50, tableTop, 500, 22).fill(darkColor);
        doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold');
        doc.text('ITEM DESCRIPTION', 60, tableTop + 7);
        doc.text('UNIT PRICE', 300, tableTop + 7, { width: 80, align: 'right' });
        doc.text('QTY', 390, tableTop + 7, { width: 40, align: 'center' });
        doc.text('TOTAL', 450, tableTop + 7, { width: 90, align: 'right' });

        let currentY = tableTop + 22;
        doc.font('Helvetica').fontSize(9).fillColor(textColor);

        originalItems.forEach((item, index) => {
            const isEven = index % 2 === 0;
            if (!isEven) doc.rect(50, currentY, 500, 25).fill(lightGray);
            
            doc.fillColor(textColor);
            const description = `${item.product ? item.product.name : 'Product'} ${(typeof item.variant === 'object' && item.variant !== null) ? '(' + [item.variant.storage, item.variant.color].filter(Boolean).join(' ') + ')' : ''}`;
            
            doc.text(description, 60, currentY + 8, { width: 230 });
            doc.text(`₹${item.price.toLocaleString()}`, 300, currentY + 8, { width: 80, align: 'right' });
            doc.text(item.qty.toString(), 390, currentY + 8, { width: 40, align: 'center' });
            doc.text(`₹${(item.price * item.qty).toLocaleString()}`, 450, currentY + 8, { width: 90, align: 'right' });
            
            currentY += 25;
            doc.strokeColor(borderColor).lineWidth(0.5).moveTo(50, currentY).lineTo(550, currentY).stroke();
        });

        // --- Summary Section ---
        currentY += 20;
        const summaryX = 350;
        const valueX = 450;
        const rowHeight = 18;

        doc.fontSize(9).font('Helvetica').fillColor(secondaryTextColor);
        
        doc.text('Original Subtotal:', summaryX, currentY);
        doc.fillColor(textColor).text(`₹${originalSubtotal.toLocaleString()}`, valueX, currentY, { width: 90, align: 'right' });
        currentY += rowHeight;

        if (originalDiscount > 0) {
            doc.fillColor(secondaryTextColor).text('Discount Applied:', summaryX, currentY);
            doc.fillColor('#22c55e').text(`-₹${originalDiscount.toLocaleString()}`, valueX, currentY, { width: 90, align: 'right' });
            currentY += rowHeight;
        }

        doc.fillColor(secondaryTextColor).text('Tax (GST 18%):', summaryX, currentY);
        doc.fillColor(textColor).text(`₹${originalTax.toLocaleString()}`, valueX, currentY, { width: 90, align: 'right' });
        currentY += rowHeight;

        doc.fillColor(secondaryTextColor).text('Shipping Fee:', summaryX, currentY);
        doc.fillColor(textColor).text(originalShipping > 0 ? `₹${originalShipping.toLocaleString()}` : 'FREE', valueX, currentY, { width: 90, align: 'right' });
        currentY += rowHeight + 5;

        doc.rect(summaryX - 10, currentY - 5, 210, 30).fill(lightGray);
        doc.fillColor(darkColor).fontSize(12).font('Helvetica-Bold').text('TOTAL PAID:', summaryX, currentY + 8);
        doc.fillColor(accentColor).text(`₹${originalTotal.toLocaleString()}`, valueX, currentY + 8, { width: 90, align: 'right' });

        // --- Footer ---
        const footerY = 750;
        doc.strokeColor(borderColor).lineWidth(1).moveTo(50, footerY).lineTo(550, footerY).stroke();
        doc.fontSize(8).font('Helvetica').fillColor(secondaryTextColor)
           .text('This is a computer-generated tax invoice and does not require a physical signature.', 50, footerY + 15, { align: 'center' })
           .font('Helvetica-Bold').fillColor(darkColor).text('IMMUTABLE PURCHASE RECORD - STARZO MOBILES', 50, footerY + 30, { align: 'center' });

        doc.end();
    } catch (error) {
        console.error('Invoice Generation Error:', error);
        res.status(500).send('Internal Server Error');
    }
};

export const downloadCreditNote = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.session.user;

        const order = await Order.findOne({ _id: orderId, user: userId }).populate('items.product');

        if (!order) return res.status(404).send('Order not found');

        const returnedItems = order.items.filter(item => item.status === 'Returned');
        if (returnedItems.length === 0) {
            return res.redirect(`/account/orders/${order._id}?msg=No returned items found for this order.&icon=error`);
        }

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="CreditNote-${order.orderId}.pdf"`);

        doc.pipe(res);

        // --- Colors & Branding ---
        const refundAccent = '#22c55e'; // Green for refunds
        const darkColor = '#111111';
        const lightGray = '#f9f9f9';
        const borderColor = '#eeeeee';
        const textColor = '#333333';
        const secondaryTextColor = '#666666';

        // --- Header / Logo ---
        doc.rect(50, 45, 25, 25).fill(refundAccent);
        doc.fillColor('#FFFFFF').fontSize(16).font('Helvetica-Bold').text('R', 56, 52);
        
        doc.fillColor(darkColor).fontSize(22).font('Helvetica-Bold').text('STARZO', 85, 48);
        doc.fontSize(8).font('Helvetica').fillColor(secondaryTextColor).text('RETURNS & REFUNDS PROTOCOL', 85, 70);

        // --- Credit Note Label & Meta ---
        doc.fillColor(darkColor).fontSize(20).font('Helvetica-Bold').text('CREDIT NOTE', 400, 48, { align: 'right' });
        doc.fontSize(9).font('Helvetica').fillColor(secondaryTextColor)
           .text(`Reference Order: #${order.orderId}`, 400, 70, { align: 'right' })
           .text(`Note Date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, 400, 82, { align: 'right' });

        doc.moveDown(3);
        doc.strokeColor(borderColor).lineWidth(1).moveTo(50, 110).lineTo(550, 110).stroke();

        // --- Addresses ---
        const addressY = 135;
        doc.fillColor(darkColor).fontSize(11).font('Helvetica-Bold').text('REFUNDED TO', 50, addressY);
        doc.fontSize(10).font('Helvetica').fillColor(textColor).text(order.shippingAddress.fullName, 50, addressY + 18);

        doc.fillColor(darkColor).fontSize(11).font('Helvetica-Bold').text('ISSUED BY', 350, addressY);
        doc.fontSize(10).font('Helvetica').fillColor(textColor).text('Starzo Mobiles Pvt Ltd.', 350, addressY + 18);

        doc.moveDown(5);

        // --- Table ---
        const tableTop = 240;
        doc.rect(50, tableTop, 500, 22).fill(darkColor);
        doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold');
        doc.text('RETURNED ITEM', 60, tableTop + 7);
        doc.text('REFUND PER UNIT', 300, tableTop + 7, { width: 100, align: 'right' });
        doc.text('QTY', 410, tableTop + 7, { width: 30, align: 'center' });
        doc.text('SUBTOTAL', 450, tableTop + 7, { width: 90, align: 'right' });

        let currentY = tableTop + 22;
        doc.font('Helvetica').fontSize(9).fillColor(textColor);

        let totalRefunded = 0;
        // Helper calculation similar to orderService.js
        const orderSubtotalAtPurchase = order.items.reduce((sum, i) => sum + (i.price * i.qty), 0);
        const totalDiscountAtPurchase = order.discount || 0;

        returnedItems.forEach((item, index) => {
            const isEven = index % 2 === 0;
            if (!isEven) doc.rect(50, currentY, 500, 25).fill(lightGray);
            
            doc.fillColor(textColor);
            const description = `${item.product ? item.product.name : 'Product'} ${(typeof item.variant === 'object' && item.variant !== null) ? '(' + [item.variant.storage, item.variant.color].filter(Boolean).join(' ') + ')' : ''}`;
            
            // Refund calculation including proportional discount
            const itemSubtotal = item.price * item.qty;
            const itemTax = Math.floor(itemSubtotal * 0.18);
            const itemDiscount = Math.floor((itemSubtotal / orderSubtotalAtPurchase) * totalDiscountAtPurchase);
            const itemRefund = (itemSubtotal + itemTax) - itemDiscount;
            
            totalRefunded += itemRefund;

            doc.text(description, 60, currentY + 8, { width: 230 });
            doc.text(`₹${Math.floor(itemRefund/item.qty).toLocaleString()}`, 300, currentY + 8, { width: 100, align: 'right' });
            doc.text(item.qty.toString(), 410, currentY + 8, { width: 30, align: 'center' });
            doc.text(`₹${itemRefund.toLocaleString()}`, 450, currentY + 8, { width: 90, align: 'right' });
            
            currentY += 25;
        });

        // --- Summary ---
        currentY += 30;
        doc.rect(50, currentY, 500, 40).fill(lightGray);
        doc.fillColor(darkColor).fontSize(14).font('Helvetica-Bold').text('TOTAL REFUND ISSUED:', 70, currentY + 12);
        doc.fillColor(refundAccent).fontSize(16).text(`₹${totalRefunded.toLocaleString()}`, 350, currentY + 12, { width: 180, align: 'right' });

        // --- Footer ---
        doc.fontSize(8).font('Helvetica').fillColor(secondaryTextColor)
           .text('The refund has been credited to your original payment source or wallet as per the return policy.', 50, 750, { align: 'center' })
           .font('Helvetica-Bold').fillColor(darkColor).text('THANK YOU FOR YOUR PATIENCE - STARZO MOBILES', 50, 765, { align: 'center' });

        doc.end();
    } catch (error) {
        console.error('Credit Note Generation Error:', error);
        res.status(500).send('Internal Server Error');
    }
};
