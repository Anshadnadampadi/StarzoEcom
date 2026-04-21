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

        const { orders, totalPages } = await getUserOrdersService(userId, page, limit);

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

        if (order.orderStatus !== 'Delivered') {
            return res.redirect(`/account/orders/${order._id}?msg=Invoice is only available for delivered orders.&icon=error`);
        }

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Invoice-${order.orderId}.pdf"`);

        doc.pipe(res);
        // Header
        doc.fillColor('#000000').fontSize(25).font('Helvetica-Bold').text('STARZO MOBILES', { align: 'left' });
        doc.fontSize(10).font('Helvetica').text('Premium Mobile Experience', { align: 'left' }).moveDown();

        // Invoice Info
        doc.fontSize(20).text('INVOICE', { align: 'right' });
        doc.fontSize(10).text(`Order ID: #${order.orderId}`, { align: 'right' });
        doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, { align: 'right' }).moveDown();

        // Addresses
        const addressTop = 160;
        doc.fontSize(12).font('Helvetica-Bold').text('Billed To:', 50, addressTop);
        doc.fontSize(10).font('Helvetica')
           .text(order.shippingAddress.fullName, 50, addressTop + 20)
           .text(order.shippingAddress.streetAddress, 50, addressTop + 35)
           .text(`${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pinCode}`, 50, addressTop + 50);

        doc.fontSize(12).font('Helvetica-Bold').text('Sold By:', 300, addressTop);
        doc.fontSize(10).font('Helvetica').text('Starzo Mobiles Ltd.', 300, addressTop + 20).text('123 Tech Avenue, Bangalore', 300, addressTop + 35).moveDown(4);

        // Table Header
        const tableTop = 270;
        doc.rect(50, tableTop, 500, 25).fill('#f9f9f9').stroke('#eeeeee');
        doc.fillColor('#333333').fontSize(10).font('Helvetica-Bold');
        doc.text('Item Description', 60, tableTop + 8);
        doc.text('Qty', 350, tableTop + 8, { width: 30, align: 'center' });
        doc.text('Price', 400, tableTop + 8, { width: 60, align: 'right' });
        doc.text('Total', 480, tableTop + 8, { width: 60, align: 'right' });

        // Content
        doc.font('Helvetica');
        let currentY = tableTop + 35;
        order.items.forEach(item => {
            const description = `${item.product ? item.product.name : 'Unknown Product'} (${(typeof item.variant === 'object' && item.variant !== null) ? [item.variant.storage, item.variant.color].filter(Boolean).join(' ') : 'Standard'})`;
            doc.text(description, 60, currentY);
            doc.text(item.qty.toString(), 350, currentY, { width: 30, align: 'center' });
            doc.text(`INR ${item.price.toLocaleString()}`, 400, currentY, { width: 60, align: 'right' });
            doc.text(`INR ${(item.price * item.qty).toLocaleString()}`, 480, currentY, { width: 60, align: 'right' });
            currentY += 25;
        });

        // Totals
        currentY += 10;
        doc.text('Subtotal:', 350, currentY);
        doc.text(`INR ${order.subtotal.toLocaleString()}`, 480, currentY, { width: 60, align: 'right' });
        currentY += 20;
        doc.text('Grand Total:', 350, currentY);
        doc.fontSize(14).font('Helvetica-Bold').text(`INR ${order.totalAmount.toLocaleString()}`, 480, currentY, { width: 60, align: 'right' });

        doc.end();
    } catch (error) {
        console.error('Invoice Generation Error:', error);
        res.status(500).send('Internal Server Error');
    }
};
