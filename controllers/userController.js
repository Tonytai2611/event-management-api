import bcrypt from "bcrypt";
import User from '../models/User.js';
import fs from 'fs';
import { logActivity } from '../middleware/logActivity.js';
import https from 'https';
import { uploadToS3, getSignedUrlForKey, deleteFromS3 } from '../utils/s3Helper.js';

const storageType = process.env.STORAGE_TYPE || 'cloudinary';

// Helper function to upload to Cloudinary
const uploadToCloudinary = async (file) => {
  const fileBuffer = fs.readFileSync(file.path);
  const base64File = fileBuffer.toString('base64');
  const dataURI = `data:${file.mimetype};base64,${base64File}`;

  const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/upload`;

  const boundary = '----WebKitFormBoundary' + Math.random().toString(16).slice(2);
  const payload = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"',
    `Content-Type: ${file.mimetype}`,
    '',
    dataURI,
    `--${boundary}`,
    'Content-Disposition: form-data; name="upload_preset"',
    '',
    process.env.CLOUDINARY_UPLOAD_PRESET,
    `--${boundary}--`,
    ''
  ].join('\r\n');

  const response = await new Promise((resolve, reject) => {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(cloudinaryUrl, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(JSON.parse(data));
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(payload);
    req.end();
  });

  return response.secure_url;
};

// Helper function to delete old image
const deleteOldImage = async (imageKey) => {
  if (!imageKey) return;
  
  if (storageType === 's3') {
    await deleteFromS3(imageKey);
  }
};

// Helper to add signed URLs to users
const addSignedUrlsToUsers = async (users) => {
  if (storageType !== 's3') return users;

  const usersArray = Array.isArray(users) ? users : [users];
  
  for (const user of usersArray) {
    if (user.avatar) {
      user.avatarUrl = await getSignedUrlForKey(user.avatar);
      // Keep original key in 'avatar' field for DB operations
    }
  }
  
  return users;
};

export const getUsers = async (req, res) => {
    try {
        let users = await User.find().select('-password');
        
        // Add signed URLs for avatars
        users = await addSignedUrlsToUsers(users);
        
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

export const getUser = async (req, res) => {
    try {
        let user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Add signed URL for avatar
        user = await addSignedUrlsToUsers(user);
        
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

export const updateUser = async (req, res) => {
    try {
        const { firstName, lastName, username, email, password, currentPassword } = req.body;

        // Check if user exists
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        console.log('User before update:', user);

        // Check if username is being changed and if it's already taken
        if (username && username !== user.username) {
            const existingUser = await User.findOne({ username });
            if (existingUser) {
                return res.status(400).json({ message: 'Username already taken' });
            }
        }

        // Check if email is being changed and if it's already taken
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ message: 'Email already taken' });
            }
        }

        // Update password if provided
        if (password) {
            if (!currentPassword) {
                return res.status(400).json({ message: 'Current password is required' });
            }
            
            const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
            if (!isPasswordValid) {
                return res.status(400).json({ message: 'Current password is incorrect' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            user.password = hashedPassword;
        }

        // Update other fields
        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (username) user.username = username;
        if (email) user.email = email;

        await user.save();

        await logActivity(
            req.userId,
            'updated',
            'user',
            user._id,
            { userEmail: user.email }
        );

        let userObject = user.toObject();
        delete userObject.password;

        // Add signed URL for response
        userObject = await addSignedUrlsToUsers(userObject);

        res.status(200).json(userObject);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Delete avatar from storage if exists
        if (user.avatar) {
            await deleteOldImage(user.avatar);
        }

        await User.findByIdAndDelete(req.params.id);

        await logActivity(
            req.userId,
            'deleted',
            'user',
            user._id,
            { userEmail: user.email }
        );

        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update user avatar
export const updateAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        let avatarKey = null;

        // Handle image upload based on storage type
        if (storageType === 's3') {
            // S3: Upload using buffer (memoryStorage)
            avatarKey = await uploadToS3(req.file.buffer, req.file.mimetype);
            console.log('✅ Avatar uploaded to S3:', avatarKey);
        } else {
            // Cloudinary: Manual upload
            avatarKey = await uploadToCloudinary(req.file);
            fs.unlinkSync(req.file.path); // Clean up temp file
            console.log('✅ Avatar uploaded to Cloudinary:', avatarKey);
        }

        // Get current user to check for old avatar
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Delete old avatar if exists
        if (user.avatar && avatarKey) {
            await deleteOldImage(user.avatar);
        }

        // Update user with new avatar KEY (not URL)
        user.avatar = avatarKey;
        await user.save();

        await logActivity(
            req.userId,
            'updated',
            'user',
            user._id,
            { action: 'avatar_update' }
        );

        let userObject = user.toObject();
        delete userObject.password;

        // Add signed URL for response
        userObject = await addSignedUrlsToUsers(userObject);

        res.status(200).json({
            message: 'Avatar updated successfully',
            avatar: userObject.avatarUrl, // Return signed URL
            user: userObject
        });
    } catch (err) {
        console.error('Avatar upload error:', err);
        
        // Clean up temp file if exists (only for Cloudinary)
        if (req.file?.path && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (cleanupError) {
                console.error('Error during file cleanup:', cleanupError);
            }
        }

        res.status(500).json({
            message: err.message || 'Failed to update avatar',
        });
    }
};

