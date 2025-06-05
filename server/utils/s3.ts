import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const bucketName = process.env.AWS_S3_BUCKET_NAME || '';

if (!bucketName) {
  throw new Error('AWS_S3_BUCKET_NAME is not defined in environment variables');
}

/**
 * Upload a file to S3 from a URL
 * @param url The URL of the file to upload
 * @param key The key to use for the S3 object
 * @returns The URL of the uploaded file
 */
export async function uploadFileFromUrl(url: string, key: string): Promise<string> {
  try {
    // Fetch the file from the URL
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch file from URL: ${response.statusText}`);
    }
    
    // Get the file data as a buffer
    const fileData = await response.arrayBuffer();
    
    // Upload the file to S3
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: Buffer.from(fileData),
      ContentType: response.headers.get('content-type') || 'application/octet-stream',
    });
    
    await s3Client.send(command);
    
    // Generate a presigned URL for the uploaded file (valid for 7 days)
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    
    const presignedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 604800 }); // 7 days
    
    return presignedUrl;
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw error;
  }
}

/**
 * Generate a presigned URL for an S3 object
 * @param key The key of the S3 object
 * @returns A presigned URL for the S3 object
 */
export async function getPresignedUrl(key: string): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 604800 }); // 7 days
    
    return presignedUrl;
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw error;
  }
}
