import express from 'express';
import dotenv from 'dotenv';
import connectDb from './config/db.js';
import cors from 'cors';
import authRoute from './routes/authRoute.js';
import commentRoute from './routes/commentRoute.js';
import userRoute from './routes/userRoute.js';
import eventRoute from './routes/eventRoute.js';
import adminRoute from './routes/adminRoute.js';
import settingsRoute from './routes/settingsRoute.js';
import testEmailRoute from './routes/testEmailRoute.js';

import cookieParser from 'cookie-parser';
import notificationRoute from './routes/notificationRoute.js';
import eventStatusUpdater from './middleware/eventStatusUpdater.js';

// Log that we're starting
console.log('Starting API server...');

// Load environment variables
dotenv.config();

// Connect to the database
connectDb();

const app = express();

app.use(cors({
    origin: [
        'http://localhost:5173',  // For local development
        'https://eventmangementapp.netlify.app'  // Your Netlify URL
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));
app.use(express.json());
app.use(cookieParser());


app.get('/', (req, res) => {
    res.status(200).json({ 
        message: 'Event Management API is operational',
        status: 'running',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
            auth: '/api/auth',
            events: '/api/events',
            users: '/api/users',
            health: '/health'
        }
    });
});

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});
// ===========================

// API Routes
app.use('/api/auth', authRoute);
app.use('/api/settings', settingsRoute);
app.use('/api/comments', commentRoute);
app.use('/api/users', userRoute);
app.use('/api/events', eventRoute);
app.use('/api/notifications', notificationRoute);
app.use('/api/admin', adminRoute);
app.use('/api/test-email', testEmailRoute);

app.listen(8800, '0.0.0.0', () => {
    console.log('Server is running on port 8800');
    console.log(`CORS enabled for origin: ${process.env.CLIENT_URL}`);
    eventStatusUpdater();
});

export default app;

