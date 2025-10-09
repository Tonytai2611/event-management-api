import express from 'express';

import { signup, login, logout, verifyEmail, resendVerification } from '../controllers/authController.js';
import { verifyToken } from '../middleware/verifyToken.js';

const router = express.Router();

// Register route user
router.post('/signup', signup);
// Login route user
router.post('/login', login);
router.post('/logout',verifyToken, logout);
// Email verification routes
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);

export default router;