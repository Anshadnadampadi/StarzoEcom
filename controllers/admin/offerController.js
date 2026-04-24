import { 
    createOfferService, 
    getOffersService, 
    updateOfferService, 
    toggleOfferStatusService, 
    deleteOfferService 
} from "../../services/admin/offerService.js";
import Product from "../../models/product/product.js";
import Category from "../../models/category/category.js";

export const getOfferPage = async (req, res) => {
    try {
        const offers = await getOffersService(req.query);
        const products = await Product.find({ isListed: true }).select('name');
        const categories = await Category.find({ isUnlisted: false }).select('name');

        res.render("admin/marketing/offers", {
            title: 'Offer Management',
            offers,
            products,
            categories
        });

    } catch (err) {
        res.status(500).send(err.message);
        
    }
};

export const createOffer = async (req, res) => {
    try {
        const offer = await createOfferService(req.body);
        res.json({ success: true, data: offer });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

export const getOffers = async (req, res) => {
    try {
        const offers = await getOffersService(req.query);
        res.json({ success: true, data: offers });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

export const updateOffer = async (req, res) => {
    try {
        const updated = await updateOfferService(req.params.id, req.body);
        res.json({ success: true, data: updated });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

export const toggleOfferStatus = async (req, res) => {
    try {
        const updated = await toggleOfferStatusService(req.params.id);
        res.json({ success: true, data: updated });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

export const deleteOffer = async (req, res) => {
    try {
        await deleteOfferService(req.params.id);
        res.json({ success: true, message: 'Offer deleted successfully' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
