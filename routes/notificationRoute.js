import express from "express";
import {getNotifications, markAsRead, createNotification, deleteNotification, getNewCount} from "../controllers/notificationController.js";
import { verifyToken } from '../middleware/verifyToken.js';

const router = express.Router();


// @route   GET /notifications/:userId
// @desc    Get all notifications for a user
// @access  Private
router.get("/", verifyToken, getNotifications);


// @route   PATCH /notifications/:id/read
// @desc    Mark a notification as read
// @access  Private
router.patch("/:notificationId/read", verifyToken,markAsRead);

// @route   POST /notifications
// @desc    Create a new notification
// @access  Private
router.post("/",verifyToken, createNotification);

// @route   DELETE /notifications/:id
// @desc    Delete a notification
// @access  Private
router.delete("/:notificationId",verifyToken, deleteNotification);

// @route   GET /notifications/new
// @desc    Get the count of new notifications since a given date
// @access  Private
router.get("/new", verifyToken, getNewCount);



export default router;