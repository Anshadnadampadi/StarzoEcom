import express from "express"
import  {getAddress,
    postAddress,
    putAddress, deleteAddress,
    patchDefaultAddress,
    } from "../../controllers/user/userController.js"

import { ensureLoggedIn } from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.get('/address', getAddress);
router.post('/address', postAddress);
router.put('/address/:id', putAddress);
router.delete('/address/:id', deleteAddress);
router.patch('/address/default/:id', patchDefaultAddress);


export default router;