import Wallet from "../../models/user/Wallet.js";
import User from "../../models/user/User.js";
import razorpay from "../../config/razorpay.js";
import crypto from "crypto";

export const getWallet = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId).lean();
        
        // Find wallet or create a default one if it doesn't exist
        let wallet = await Wallet.findOne({ user: userId }).lean();
        
        if (!wallet) {
            wallet = { balance: 0, transactions: [] };
        } else {
            // Sort transactions by date descending
            wallet.transactions.sort((a, b) => b.timestamp - a.timestamp);
        }

        res.render("user/wallet", {
            title: "My Wallet",
            user,
            wallet,
            activeTab: 'wallet',
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
        if (!amount || amount < 100) {
            return res.status(400).json({ success: false, message: "Minimum top-up amount is ₹100" });
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
