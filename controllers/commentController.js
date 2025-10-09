import Comment from "../models/Comment.js";
import Event from "../models/Event.js";
import User from "../models/User.js";
import fs from 'fs';
import path from 'path';

export const getAllComments = async (req, res) => {
    try {
        const { eventId } = req.params;
        
        console.log('Fetching comments for event:', eventId);

        // Validate event exists
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ 
                success: false,
                message: "Event not found" 
            });
        }

        // Get all comments for the event (including nested)
        const allComments = await Comment.find({ 
            event: eventId,
            isDeleted: { $ne: true }
        })
        .populate("user", "username firstName lastName email avatar")
        .sort({ createdAt: 1 }); // Sort by creation time for proper nesting

        // Organize comments into thread structure
        const commentMap = {};
        const rootComments = [];

        // First pass: create map and identify root comments
        allComments.forEach(comment => {
            commentMap[comment._id] = {
                ...comment.toObject(),
                replies: []
            };
            
            if (!comment.parentComment) {
                rootComments.push(commentMap[comment._id]);
            }
        });

        // Second pass: build nested structure
        allComments.forEach(comment => {
            if (comment.parentComment && commentMap[comment.parentComment]) {
                commentMap[comment.parentComment].replies.push(commentMap[comment._id]);
            }
        });

        console.log(`Found ${allComments.length} total comments (${rootComments.length} root) for event ${eventId}`);

        res.status(200).json({
            success: true,
            comments: rootComments,
            total: allComments.length
        });

    } catch (err) {
        console.error("Error fetching comments:", err);
        res.status(500).json({ 
            success: false,
            message: "Failed to fetch comments",
            error: err.message 
        });
    }
};

export const createComment = async (req, res) => {
    try {
        const { text, parentCommentId } = req.body;
        const { eventId } = req.params;
        const files = req.files || [];

        console.log('Creating comment:', { eventId, text, parentCommentId, userId: req.userId, filesCount: files.length });

        // Validate input - either text or attachments required
        if (!text?.trim() && files.length === 0) {
            return res.status(400).json({ 
                success: false,
                message: "Comment must have either text or image attachments" 
            });
        }

        if (!req.userId) {
            return res.status(401).json({ 
                success: false,
                message: "Please login to post comments" 
            });
        }

        // Validate event exists
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ 
                success: false,
                message: "Event not found" 
            });
        }

        let depth = 0;
        let rootCommentId = null;
        let parentComment = null;

        // If this is a reply
        if (parentCommentId) {
            parentComment = await Comment.findById(parentCommentId);
            if (!parentComment) {
                return res.status(404).json({ 
                    success: false,
                    message: "Parent comment not found" 
                });
            }

            // Check depth limit
            depth = parentComment.depth + 1;
            if (depth > 3) {
                return res.status(400).json({ 
                    success: false,
                    message: "Maximum reply depth exceeded" 
                });
            }

            // Set root comment
            rootCommentId = parentComment.rootComment || parentComment._id;
        }

        // Process attachments
        const attachments = [];
        if (files && files.length > 0) {
            for (const file of files) {
                attachments.push({
                    type: 'image',
                    url: `/uploads/comments/${file.filename}`,
                    filename: file.originalname,
                    size: file.size,
                    mimetype: file.mimetype
                });
            }
        }

        // Create new comment
        const newComment = await Comment.create({
            event: eventId,
            user: req.userId,
            text: text?.trim() || '',
            parentComment: parentCommentId || null,
            rootComment: rootCommentId,
            depth: depth,
            attachments: attachments
        });

        const populatedComment = await Comment.findById(newComment._id)
            .populate("user", "username firstName lastName email avatar");

        console.log(`New comment created: ${newComment._id} at depth ${depth} with ${attachments.length} attachments`);

        res.status(201).json({
            success: true,
            message: "Comment posted successfully",
            comment: populatedComment
        });

    } catch (err) {
        console.error("Error creating comment:", err);
        
        // Clean up uploaded files if comment creation failed
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                try {
                    fs.unlinkSync(file.path);
                } catch (unlinkError) {
                    console.error('Error deleting file:', unlinkError);
                }
            });
        }
        
        res.status(500).json({ 
            success: false,
            message: "Failed to create comment",
            error: err.message 
        });
    }
};

export const updateComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        const { text } = req.body;
        const files = req.files || [];

        // Validate input - either text or existing attachments required
        const existingComment = await Comment.findById(commentId);
        if (!existingComment) {
            return res.status(404).json({ 
                success: false,
                message: "Comment not found" 
            });
        }

        // Check ownership
        if (existingComment.user.toString() !== req.userId) {
            return res.status(403).json({ 
                success: false,
                message: "You can only edit your own comments" 
            });
        }

        // Check if comment is deleted
        if (existingComment.isDeleted) {
            return res.status(400).json({ 
                success: false,
                message: "Cannot edit deleted comment" 
            });
        }

        // Validate that comment will have content after update
        const hasExistingAttachments = existingComment.attachments && existingComment.attachments.length > 0;
        const hasNewAttachments = files.length > 0;
        const hasText = text && text.trim();

        if (!hasText && !hasExistingAttachments && !hasNewAttachments) {
            return res.status(400).json({ 
                success: false,
                message: "Comment must have either text or attachments" 
            });
        }

        // Process new attachments
        const newAttachments = [];
        if (files && files.length > 0) {
            for (const file of files) {
                newAttachments.push({
                    type: 'image',
                    url: `/uploads/comments/${file.filename}`,
                    filename: file.originalname,
                    size: file.size,
                    mimetype: file.mimetype
                });
            }
        }

        // Update comment
        existingComment.text = text?.trim() || existingComment.text;
        if (newAttachments.length > 0) {
            existingComment.attachments.push(...newAttachments);
        }
        existingComment.editedAt = new Date();
        
        await existingComment.save();

        const populatedComment = await Comment.findById(commentId)
            .populate("user", "username firstName lastName email avatar");

        res.status(200).json({
            success: true,
            message: "Comment updated successfully",
            comment: populatedComment
        });

    } catch (err) {
        console.error("Error updating comment:", err);
        
        // Clean up uploaded files if update failed
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                try {
                    fs.unlinkSync(file.path);
                } catch (unlinkError) {
                    console.error('Error deleting file:', unlinkError);
                }
            });
        }
        
        res.status(500).json({ 
            success: false,
            message: "Failed to update comment",
            error: err.message 
        });
    }
};

export const deleteComment = async (req, res) => {
    try {
        const { commentId } = req.params;

        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.status(404).json({ 
                success: false,
                message: "Comment not found" 
            });
        }

        // Check ownership
        if (comment.user.toString() !== req.userId) {
            return res.status(403).json({ 
                success: false,
                message: "You can only delete your own comments" 
            });
        }

        // Clean up attachments
        if (comment.attachments && comment.attachments.length > 0) {
            comment.attachments.forEach(attachment => {
                const filePath = path.join('./tmp', attachment.url);
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                } catch (error) {
                    console.error('Error deleting attachment file:', error);
                }
            });
        }

        // Soft delete to preserve thread structure
        comment.isDeleted = true;
        comment.text = "[This comment has been deleted]";
        comment.attachments = []; // Clear attachments
        await comment.save();

        res.status(200).json({ 
            success: true,
            message: "Comment deleted successfully" 
        });

    } catch (err) {
        console.error("Error deleting comment:", err);
        res.status(500).json({ 
            success: false,
            message: "Failed to delete comment",
            error: err.message 
        });
    }
};

// Remove attachment from comment
export const removeAttachment = async (req, res) => {
    try {
        const { commentId, attachmentId } = req.params;

        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.status(404).json({ 
                success: false,
                message: "Comment not found" 
            });
        }

        // Check ownership
        if (comment.user.toString() !== req.userId) {
            return res.status(403).json({ 
                success: false,
                message: "You can only modify your own comments" 
            });
        }

        // Find attachment
        const attachmentIndex = comment.attachments.findIndex(
            att => att._id.toString() === attachmentId
        );

        if (attachmentIndex === -1) {
            return res.status(404).json({ 
                success: false,
                message: "Attachment not found" 
            });
        }

        const attachment = comment.attachments[attachmentIndex];

        // Delete file from filesystem
        const filePath = path.join('./tmp', attachment.url);
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (error) {
            console.error('Error deleting attachment file:', error);
        }

        // Remove attachment from comment
        comment.attachments.splice(attachmentIndex, 1);

        // Check if comment still has content
        if (!comment.text?.trim() && comment.attachments.length === 0) {
            return res.status(400).json({ 
                success: false,
                message: "Cannot remove attachment. Comment must have either text or attachments." 
            });
        }

        comment.editedAt = new Date();
        await comment.save();

        const populatedComment = await Comment.findById(commentId)
            .populate("user", "username firstName lastName email avatar");

        res.status(200).json({
            success: true,
            message: "Attachment removed successfully",
            comment: populatedComment
        });

    } catch (err) {
        console.error("Error removing attachment:", err);
        res.status(500).json({ 
            success: false,
            message: "Failed to remove attachment",
            error: err.message 
        });
    }
};

// Helper function to get comment thread
export const getCommentThread = async (req, res) => {
    try {
        const { commentId } = req.params;

        const rootComment = await Comment.findById(commentId)
            .populate("user", "username firstName lastName email avatar");

        if (!rootComment) {
            return res.status(404).json({ 
                success: false,
                message: "Comment not found" 
            });
        }

        // Get all replies in this thread
        const threadComments = await Comment.find({
            $or: [
                { _id: commentId },
                { rootComment: commentId }
            ],
            isDeleted: { $ne: true }
        })
        .populate("user", "username firstName lastName email avatar")
        .sort({ createdAt: 1 });

        // Build nested structure
        const commentMap = {};
        let rootResult = null;

        threadComments.forEach(comment => {
            commentMap[comment._id] = {
                ...comment.toObject(),
                replies: []
            };
            
            if (comment._id.toString() === commentId) {
                rootResult = commentMap[comment._id];
            }
        });

        threadComments.forEach(comment => {
            if (comment.parentComment && commentMap[comment.parentComment]) {
                commentMap[comment.parentComment].replies.push(commentMap[comment._id]);
            }
        });

        res.status(200).json({
            success: true,
            comment: rootResult,
            total: threadComments.length
        });

    } catch (err) {
        console.error("Error fetching comment thread:", err);
        res.status(500).json({ 
            success: false,
            message: "Failed to fetch comment thread",
            error: err.message 
        });
    }
};