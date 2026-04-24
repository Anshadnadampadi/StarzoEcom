import express from 'express';
import { 
    getOfferPage, 
    createOffer, 
    updateOffer, 
    toggleOfferStatus, 
    deleteOffer 
} from '../../controllers/admin/offerController.js';

const router = express.Router();

router.get('/', getOfferPage);
router.post('/create', createOffer);
router.put('/update/:id', updateOffer);
router.patch('/toggle/:id', toggleOfferStatus);
router.delete('/delete/:id', deleteOffer);

export default router;
