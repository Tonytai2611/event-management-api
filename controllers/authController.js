import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Admin from '../models/Admin.js';
import { logActivity } from '../middleware/logActivity.js';
import nodemailerService from '../utils/nodemailerService.js';

export const signup = async (req, res) => {
    try {
        
        const { firstName, lastName, username, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const defaultAvatar = "https://img.freepik.com/premium-vector/cute-boy-smiling-cartoon-kawaii-boy-illustration-boy-avatar-happy-kid_1001605-3447.jpg";
        
        // Create a random verification code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        // Set expiration time for verification code (24 hours from now)
        const verificationExpires = new Date();
        verificationExpires.setHours(verificationExpires.getHours() + 24);
        
        const newUser = await User.create({
            firstName,
            lastName,
            username,
            email,
            password: hashedPassword,
            avatar: defaultAvatar,
            isEmailVerified: false,
            emailVerificationCode: verificationCode,
            emailVerificationExpires: verificationExpires
        });
        
        const userObject = newUser.toObject();
        delete userObject.password;
        delete userObject.emailVerificationCode;

        await logActivity(
            newUser._id,
            'created',
            'user',
            newUser._id,
            { username: newUser.username }
        );

        // Gửi email xác nhận
        try {
            console.log(`Starting email verification process for ${newUser.email} with code ${verificationCode}`);
            const emailResult = await nodemailerService.sendVerificationCode(newUser, verificationCode);
            
            if (emailResult.success) {
                console.log(`Email verification sent successfully to ${newUser.email} - MessageID: ${emailResult.messageId}`);
            } else {
                console.error('Failed to send verification email:', emailResult.error);
                // Even if email sending fails, we continue with the registration process
                console.error('User created but verification email failed to send');
            }
        } catch (emailError) {
            console.error('Error during email verification process:', emailError);
            console.error('Error details:', JSON.stringify(emailError, null, 2));
        }

        res.status(201).json({ 
            message: 'User registered successfully. Please check your email for verification code.', 
            user: userObject,
            requireVerification: true,
            email: newUser.email
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Check if user exists
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        // Email verification check has been removed - now users can log in without verifying email
        // We'll leave a note in their user object that email is not verified

        // Update user status to online
        user.status = 'online';
        await user.save();

        //30 days
        const age = 1000 * 60 * 60 * 24 * 30;

        
        // Generate JWT token
        const token = jwt.sign({ 
            id: user._id 
        },
            process.env.JWT_SECRET, { 
                expiresIn: age 
            });

        // Convert Mongoose document to plain object and remove password
        const userObject = user.toObject();
        delete userObject.password;

        res.cookie('token', token, {
                    httpOnly: true, 
                    secure: true,
                    sameSite: 'none',
                    maxAge: age
                }).status(200).json({
                    message: 'Login successful',
                    user: userObject
                });
                    
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const logout = async (req, res) => {
    try {
        // Extract user ID from token
        const token = req.cookies.token;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id;
            
            // Update user status to offline
            await User.findByIdAndUpdate(userId, { status: 'offline' });
        }
        
        // Clear the cookie and respond
        res.clearCookie("token").status(200).json({
            message: "User logged out successfully",
        });
    } catch (error) {
        console.error("Logout error:", error);
        // Still clear the cookie even if there's an error
        res.clearCookie("token").status(200).json({
            message: "User logged out successfully",
        });
    }
};

// Verify Email
export const verifyEmail = async (req, res) => {
    try {
        const { email, verificationCode } = req.body;

        // Find the user with the provided email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if user is already verified
        if (user.isEmailVerified) {
            return res.status(400).json({ message: 'Email already verified' });
        }

        // Check if verification code is correct
        if (user.emailVerificationCode !== verificationCode) {
            return res.status(400).json({ message: 'Invalid verification code' });
        }

        // Check if verification code has expired
        if (new Date() > user.emailVerificationExpires) {
            return res.status(400).json({ 
                message: 'Verification code has expired. Please request a new one.',
                expired: true
            });
        }

        // Update user as verified
        user.isEmailVerified = true;
        user.emailVerifiedAt = new Date();
        user.emailVerificationCode = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();

        // Send welcome email
        try {
            await nodemailerService.sendWelcomeEmail(user);
        } catch (emailError) {
            console.error('Error sending welcome email:', emailError);
            // We continue even if welcome email fails
        }

        // Log the activity
        await logActivity(
            user._id,
            'verified',
            'email',
            user._id,
            { username: user.username }
        );

        res.status(200).json({ 
            message: 'Email verified successfully. You can now log in to your account.',
            success: true
        });
    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({ message: 'An error occurred during email verification' });
    }
};

// Resend verification code
export const resendVerification = async (req, res) => {
    try {
        const { email } = req.body;

        // Find the user with the provided email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if user is already verified
        if (user.isEmailVerified) {
            return res.status(400).json({ message: 'Email already verified' });
        }

        // Generate new verification code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Set new expiration time (24 hours from now)
        const verificationExpires = new Date();
        verificationExpires.setHours(verificationExpires.getHours() + 24);

        // Update user with new code and expiration
        user.emailVerificationCode = verificationCode;
        user.emailVerificationExpires = verificationExpires;
        await user.save();

        // Send verification email
        const emailResult = await nodemailerService.sendVerificationCode(user, verificationCode);
        
        if (!emailResult.success) {
            return res.status(500).json({ message: 'Failed to send verification email' });
        }

        res.status(200).json({ 
            message: 'A new verification code has been sent to your email',
            success: true
        });
    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({ message: 'An error occurred while resending verification code' });
    }
};

