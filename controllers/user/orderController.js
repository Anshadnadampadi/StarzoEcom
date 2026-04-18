import Order from '../../models/order/order.js';
import Product from '../../models/product/product.js';
import Wallet from '../../models/user/Wallet.js';
import PDFDocument from 'pdfkit';
import { isSameVariant } from '../../utils/productHelpers.js';

export const getUserOrders = async (req, res) => {
    try {
        const userId = req.session.user;
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        const totalOrders = await Order.countDocuments({ user: userId });
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Order.find({ user: userId })
            .populate('items.product')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

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
            breadcrumbs: [
                { label: 'Home', url: '/' },
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
                { label: 'Home', url: '/' },
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

        const order = await Order.findOne({ _id: orderId, user: userId });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (['Shipped', 'Delivered', 'Cancelled', 'Returned'].includes(order.orderStatus)) {
            return res.status(400).json({ success: false, message: `Order cannot be cancelled. Current status: ${order.orderStatus}` });
        }

        order.orderStatus = 'Cancelled';
        order.cancellationReason = reason || 'Cancelled by user';
        
        // Also update all items to Cancelled
        order.items.forEach(item => {
            if (item.status !== 'Cancelled') item.status = 'Cancelled';
        });

        // Handle refund if payment was made online
        if (order.paymentStatus === 'Paid') {
            // Refund full amount to Wallet
            let wallet = await Wallet.findOne({ user: userId });
            if (!wallet) {
                wallet = new Wallet({ user: userId, balance: 0, transactions: [] });
            }
            wallet.balance += order.totalAmount;
            wallet.transactions.push({
                amount: order.totalAmount,
                type: 'credit',
                description: `Refund for Cancelled Order #${order.orderId}`
            });
            await wallet.save();
            order.paymentStatus = 'Refunded';
        }

        await order.save();

        // Restore stock
        for (const item of order.items) {
            const product = await Product.findById(item.product);
            if (product) {
                product.stock += item.qty;
                if (item.variant && product.variants && product.variants.length > 0) {
                    const variantIndex = product.variants.findIndex(v => isSameVariant(v, item.variant));
                    if (variantIndex > -1) {
                        product.variants[variantIndex].stock += item.qty;
                    }
                }
                await product.save();
            }
        }

        res.json({ success: true, message: 'Order cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

export const cancelOrderItem = async (req, res) => {
    try {
        const { orderId, itemId, reason } = req.body;
        const userId = req.session.user;

        const order = await Order.findOne({ _id: orderId, user: userId });
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        // Global check: if order is already shipped/delivered or cancelled
        if (['Shipped', 'Delivered', 'Cancelled', 'Returned'].includes(order.orderStatus)) {
            return res.status(400).json({ success: false, message: `Cannot cancel item. Order status: ${order.orderStatus}` });
        }

        const itemIndex = order.items.findIndex(item => item._id.toString() === itemId);
        if (itemIndex === -1) return res.status(404).json({ success: false, message: 'Item not found in order' });

        const item = order.items[itemIndex];
        if (item.status === 'Cancelled') return res.status(400).json({ success: false, message: 'Item already cancelled' });

        // Update item status
        item.status = 'Cancelled';

        // Calculate refund for this item
        // Note: Simple logic uses item.price * qty. 
        // In a real app, you'd account for proportional coupon discounts.
        const refundAmount = item.price * item.qty;

        // Process refund to Wallet if paid
        if (order.paymentStatus === 'Paid') {
            let wallet = await Wallet.findOne({ user: userId });
            if (!wallet) {
                wallet = new Wallet({ user: userId, balance: 0, transactions: [] });
            }
            wallet.balance += refundAmount;
            wallet.transactions.push({
                amount: refundAmount,
                type: 'credit',
                description: `Refund for Cancelled Item in Order #${order.orderId}`
            });
            await wallet.save();
        }

        // Restore Stock
        const product = await Product.findById(item.product);
        if (product) {
            product.stock += item.qty;
            if (item.variant && product.variants && product.variants.length > 0) {
                const variantIndex = product.variants.findIndex(v => isSameVariant(v, item.variant));
                if (variantIndex > -1) {
                    product.variants[variantIndex].stock += item.qty;
                }
            }
            await product.save();
        }

        // Check if all items are now cancelled
        const allCancelled = order.items.every(item => item.status === 'Cancelled');
        if (allCancelled) {
            order.orderStatus = 'Cancelled';
            order.cancellationReason = 'All items cancelled individually';
            if (order.paymentStatus === 'Paid') order.paymentStatus = 'Refunded';
        }

        await order.save();
        res.json({ success: true, message: 'Item cancelled successfully and refund processed to wallet.' });

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
            return res.status(400).json({ success: false, message: 'Please provide a detailed reason for the return (min 10 characters).' });
        }

        const order = await Order.findOne({ _id: orderId, user: userId });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.orderStatus !== 'Delivered') {
            return res.status(400).json({ success: false, message: 'Only delivered orders can be returned.' });
        }

        order.orderStatus = 'Return Requested';
        order.returnReason = reason;

        // Update all delivered items to Return Requested
        order.items.forEach(item => {
            if (item.status === 'Delivered') {
                item.status = 'Return Requested';
                item.returnReason = reason;
            }
        });

        await order.save();

        res.json({ success: true, message: 'Return request submitted successfully. We will review it shortly.' });
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

        const order = await Order.findOne({ _id: orderId, user: userId });
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        if (order.orderStatus !== 'Delivered' && order.orderStatus !== 'Partially Returned') {
            return res.status(400).json({ success: false, message: 'Returns can only be requested for delivered orders.' });
        }

        const item = order.items.find(i => i._id.toString() === itemId);
        if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

        if (item.status !== 'Delivered') {
            return res.status(400).json({ success: false, message: `Item cannot be returned. Status: ${item.status}` });
        }

        item.status = 'Return Requested';
        item.returnReason = reason;

        // If order was 'Delivered', update to 'Return Requested' globally too if needed
        // or keep it 'Delivered' and just show item status. 
        // Better to update global status to 'Return Requested' to alert admin.
        if (order.orderStatus === 'Delivered') {
            order.orderStatus = 'Return Requested';
        }

        await order.save();
        res.json({ success: true, message: 'Return request for the item submitted successfully.' });

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

        if (!order) {
            return res.status(404).send('Order not found');
        }

        // Security check: allow invoice download if order is Paid OR Delivered
        if (order.paymentStatus !== 'Paid' && order.orderStatus !== 'Delivered') {
            return res.status(400).send('Invoice is only available for paid or delivered orders.');
        }

        const doc = new PDFDocument({ margin: 50 });
        const filename = `Invoice-${order.orderId}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        doc.pipe(res);

        // Header
        doc.fillColor('#000000').fontSize(25).font('Helvetica-Bold').text('STARZO MOBILES', { align: 'left' });
        doc.fontSize(10).font('Helvetica').text('Premium Mobile Experience', { align: 'left' });
        doc.moveDown();

        // Invoice Info
        doc.fontSize(20).text('INVOICE', { align: 'right' });
        doc.fontSize(10).text(`Order ID: #${order.orderId}`, { align: 'right' });
        doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, { align: 'right' });
        doc.moveDown();

        // Addresses
        const addressTop = 160;
        doc.fontSize(12).font('Helvetica-Bold').text('Billed To:', 50, addressTop);
        doc.fontSize(10).font('Helvetica')
           .text(order.shippingAddress.fullName, 50, addressTop + 20)
           .text(order.shippingAddress.streetAddress, 50, addressTop + 35)
           .text(`${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pinCode}`, 50, addressTop + 50)
           .text(`Phone: ${order.shippingAddress.phone}`, 50, addressTop + 65);

        doc.fontSize(12).font('Helvetica-Bold').text('Sold By:', 300, addressTop);
        doc.fontSize(10).font('Helvetica')
           .text('Starzo Mobiles Ltd.', 300, addressTop + 20)
           .text('123 Tech Avenue, Cyber City', 300, addressTop + 35)
           .text('Bangalore, Karnataka - 560001', 300, addressTop + 50)
           .text('GSTIN: 29AAAAA0000A1Z5', 300, addressTop + 65);

        doc.moveDown(4);

        // Table Header
        const tableTop = 270;
        doc.rect(50, tableTop, 500, 25).fill('#f9f9f9').stroke('#eeeeee');
        doc.fillColor('#333333').fontSize(10).font('Helvetica-Bold');
        doc.text('Item Description', 60, tableTop + 8);
        doc.text('Qty', 350, tableTop + 8, { width: 30, align: 'center' });
        doc.text('Price', 400, tableTop + 8, { width: 60, align: 'right' });
        doc.text('Total', 480, tableTop + 8, { width: 60, align: 'right' });

        // Table Content
        doc.font('Helvetica');
        let currentY = tableTop + 35;
        order.items.forEach(item => {
            const description = `${item.product ? item.product.name : 'Unknown Product'} (${(typeof item.variant === 'object' && item.variant !== null) ? [item.variant.storage, item.variant.color].filter(Boolean).join(' ') : 'Standard'})`;
            
            doc.text(description, 60, currentY);
            doc.text(item.qty.toString(), 350, currentY, { width: 30, align: 'center' });
            doc.text(`INR ${item.price.toLocaleString()}`, 400, currentY, { width: 60, align: 'right' });
            doc.text(`INR ${(item.price * item.qty).toLocaleString()}`, 480, currentY, { width: 60, align: 'right' });
            
            currentY += 25;
            doc.moveTo(50, currentY - 10).lineTo(550, currentY - 10).stroke('#eeeeee');
        });

        // Totals
        currentY += 10;
        const totalX = 350;
        
        doc.fillColor('#333333');
        doc.text('Subtotal:', totalX, currentY);
        doc.text(`INR ${order.subtotal.toLocaleString()}`, 480, currentY, { width: 60, align: 'right' });
        
        currentY += 20;
        doc.text('Shipping:', totalX, currentY);
        doc.text(order.shippingFee === 0 ? 'FREE' : `INR ${order.shippingFee.toLocaleString()}`, 480, currentY, { width: 60, align: 'right' });

        if (order.discount > 0) {
            currentY += 20;
            doc.fillColor('#22c55e').text('Discount:', totalX, currentY);
            doc.text(`- INR ${order.discount.toLocaleString()}`, 480, currentY, { width: 60, align: 'right' });
            doc.fillColor('#333333');
        }

        currentY += 30;
        doc.fontSize(14).font('Helvetica-Bold').text('Grand Total:', totalX, currentY);
        doc.text(`INR ${order.totalAmount.toLocaleString()}`, 480, currentY, { width: 60, align: 'right' });

        // Footer
        const bottomY = doc.page.height - 100;
        doc.moveTo(50, bottomY).lineTo(550, bottomY).stroke('#eeeeee');
        doc.fontSize(10).font('Helvetica').fillColor('#999999').text('Thank you for choosing Starzo Mobiles.', 50, bottomY + 20, { align: 'center' });
        doc.text('This is a computer-generated invoice and does not require a signature.', 50, bottomY + 35, { align: 'center' });

        doc.end();
    } catch (error) {
        console.error('Invoice Generation Error:', error);
        res.status(500).send('Internal Server Error');
    }
};
