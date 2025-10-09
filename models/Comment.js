import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    text: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },
    // Reference-based approach for nested comments
    parentComment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment',
        default: null
    },
    // Thread root - always points to the top-level comment
    rootComment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment',
        default: null
    },
    depth: {
        type: Number,
        default: 0,
        max: 3 
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    editedAt: {
        type: Date,
        default: null
    },
    
}, {
    timestamps: true
});

// Indexes for better query performance
commentSchema.index({ event: 1, parentComment: 1, createdAt: 1 });
commentSchema.index({ rootComment: 1, createdAt: 1 });
commentSchema.index({ user: 1 });

export default mongoose.model('Comment', commentSchema);