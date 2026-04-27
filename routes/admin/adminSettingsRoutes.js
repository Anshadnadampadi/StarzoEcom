import express from 'express';
import { getSettings, updateProfile, changePassword } from '../../controllers/admin/settingsController.js';

const router = express.Router();

router.get('/settings/general', getSettings);
router.put('/settings/profile', updateProfile);
router.put('/settings/password', changePassword);

export default router;
