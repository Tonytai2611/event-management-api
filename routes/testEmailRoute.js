import express from 'express';
import nodemailerService from '../utils/nodemailerService.js';
import User from '../models/User.js';
import { verifyToken } from '../middleware/verifyToken.js';

const router = express.Router();

// Test route to send verification email
router.post('/test-verification', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const verificationCode = '123456'; // Test code
    const result = await nodemailerService.sendVerificationCode(user, verificationCode);
    
    if (result.success) {
      res.status(200).json({ message: 'Verification email sent successfully', messageId: result.messageId });
    } else {
      res.status(500).json({ error: 'Failed to send verification email', details: result.error });
    }
  } catch (err) {
    console.error('Error in test-verification route:', err);
    res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// Test route to send event reminder email
router.post('/test-event-reminder', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const testEvent = {
      _id: '123456789',
      title: 'Test Event',
      startDate: '2023-12-31',
      startTime: '10:00 AM',
      endTime: '12:00 PM',
      location: 'Test Location'
    };
    
    const testOrganizer = {
      firstName: 'Test',
      lastName: 'Organizer',
      email: 'organizer@example.com'
    };
    
    const result = await nodemailerService.sendEventReminderEmail(user, testEvent, testOrganizer);
    
    if (result.success) {
      res.status(200).json({ message: 'Event reminder email sent successfully', messageId: result.messageId });
    } else {
      res.status(500).json({ error: 'Failed to send event reminder email', details: result.error });
    }
  } catch (err) {
    console.error('Error in test-event-reminder route:', err);
    res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// Test route to send join request email
router.post('/test-join-request', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const testEvent = {
      _id: '123456789',
      title: 'Test Event',
      startDate: '2023-12-31',
      startTime: '10:00 AM',
      endTime: '12:00 PM'
    };
    
    const testRequester = {
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email
    };
    
    const result = await nodemailerService.sendJoinRequestEmail(user, testEvent, testRequester);
    
    if (result.success) {
      res.status(200).json({ message: 'Join request email sent successfully', messageId: result.messageId });
    } else {
      res.status(500).json({ error: 'Failed to send join request email', details: result.error });
    }
  } catch (err) {
    console.error('Error in test-join-request route:', err);
    res.status(500).json({ error: 'Server error', message: err.message });
  }
});

export default router;
