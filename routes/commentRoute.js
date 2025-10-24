import express from 'express';
import { 
    getAllComments, 
    createComment, 
    updateComment, 
    deleteComment,
    getCommentThread
} from '../controllers/commentController.js';
import { verifyToken } from '../middleware/verifyToken.js';

const router = express.Router();

// Event-specific comment routes
router.get('/event/:eventId', getAllComments);                    // GET /comments/event/:eventId
router.post('/event/:eventId', verifyToken, createComment);       // POST /comments/event/:eventId

// Comment management routes
router.get('/:commentId/thread', getCommentThread);               // GET /comments/:commentId/thread
router.put('/:commentId', verifyToken, updateComment);            // PUT /comments/:commentId
router.delete('/:commentId', verifyToken, deleteComment);         // DELETE /comments/:commentId

export default router;