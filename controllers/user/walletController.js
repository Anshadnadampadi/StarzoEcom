import Wallet from "../../models/user/Wallet.js";
import User from "../../models/user/User.js";
import razorpay from "../../config/razorpay.js";
import crypto from "crypto";

export const getWallet = async (req, res) => {
    try {
        const userId = req.session.user;
        const page = parseInt(req.query.page) || 1;
        const limit = 5; // Transactions per page
        const skip = (page - 1) * limit;

        const user = await User.findById(userId).lean();

        // Find wallet or create a default one if it doesn't exist
        let wallet = await Wallet.findOne({ user: userId }).lean();

        let totalTransactions = 0;
        let totalPages = 0;

        if (!wallet) {
            wallet = { balance: 0, transactions: [] };
        } else {
            // Sort transactions by date descending
            wallet.transactions.sort((a, b) => b.timestamp - a.timestamp);
            
            totalTransactions = wallet.transactions.length;
            totalPages = Math.ceil(totalTransactions / limit);
            
            // Slice for pagination
            wallet.transactions = wallet.transactions.slice(skip, skip + limit);
        }

        res.render("user/wallet", {
            title: "My Wallet",
            user,
            wallet,
            activeTab: 'wallet',
            currentPage: page,
            totalPages,
            totalTransactions,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID,
            breadcrumbs: [
                { label: 'Account', url: '/profile' },
                { label: 'Wallet', url: '/account/wallet' }
            ]
        });
    } catch (error) {
        console.error("Wallet Error:", error);
        res.status(500).render("errors/error", { message: "Failed to load wallet" });
    }
};

export const createTopupOrder = async (req, res) => {
    try {
        const { amount } = req.body;
        const numAmount = parseFloat(amount);
        
        if (!numAmount || numAmount < 100) {
            return res.status(400).json({ success: false, message: "Minimum top-up amount is ₹100" });
        }
        if (numAmount > 50000) {
            return res.status(400).json({ success: false, message: "Maximum top-up amount allowed is ₹50,000" });
        }

        const options = {
            amount: Math.round(amount * 100), // in paise
            currency: "INR",
            receipt: `topup_${Date.now()}`
        };

        const razorpayOrder = await razorpay.orders.create(options);
        res.status(200).json({
            success: true,
            razorpayOrder
        });
    } catch (error) {
        console.error("Top-up Order Error:", error);
        res.status(500).json({ success: false, message: "Failed to initiate top-up" });
    }
};

export const verifyTopupPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;
        const userId = req.session.user;

        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature === expectedSign) {
            let wallet = await Wallet.findOne({ user: userId });
            if (!wallet) {
                wallet = new Wallet({ user: userId, balance: 0, transactions: [] });
            }

            const topupAmount = parseFloat(amount);
            wallet.balance += topupAmount;
            wallet.transactions.push({
                amount: topupAmount,
                type: 'credit',
                description: "Wallet Top-up via Razorpay",
                txnId: `TXN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
                status: 'Success',
                timestamp: new Date()
            });

            await wallet.save();
            return res.status(200).json({ success: true, message: "Wallet topped up successfully" });
        } else {
            return res.status(400).json({ success: false, message: "Payment verification failed" });
        }
    } catch (error) {
        console.error("Verify Top-up Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
