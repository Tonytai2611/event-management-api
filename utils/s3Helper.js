import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import s3Client from '../config/s3Config.js';

// Generate random filename
export const randomImageName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

// Upload file to S3
export const uploadToS3 = async (fileBuffer, mimetype) => {
  const imageName = randomImageName();

  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: `uploads/${imageName}`,
    Body: fileBuffer,
    ContentType: mimetype,
  };

  const command = new PutObjectCommand(params);
  await s3Client.send(command);

  return `uploads/${imageName}`; // Return key, not URL
};

// Generate signed URL (temporary access)
export const getSignedUrlForKey = async (key, expiresIn = 3600) => {
  if (!key) return null;

  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
    };

    const command = new GetObjectCommand(params);
    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return null;
  }
};

// Delete file from S3
export const deleteFromS3 = async (key) => {
  if (!key) return false;

  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
    };

    const command = new DeleteObjectCommand(params);
    await s3Client.send(command);
    console.log('File deleted from S3:', key);
    return true;
  } catch (error) {
    console.error('Error deleting from S3:', error);
    return false;
  }
};