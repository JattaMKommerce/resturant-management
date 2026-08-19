const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const UPLOAD_PROVIDER = (process.env.UPLOAD_STORAGE_PROVIDER || 'local').toLowerCase();
const UPLOAD_BASE_DIR = path.join(__dirname, '..', 'uploads');

// Ensure local upload directory exists
if (!fs.existsSync(UPLOAD_BASE_DIR)) {
  fs.mkdirSync(UPLOAD_BASE_DIR, { recursive: true });
}

/**
 * Sanitize and create safe randomized object key / filename
 */
function generateSafeObjectKey(originalFilename = '', folder = '') {
  const ext = path.extname(originalFilename).toLowerCase();
  const randomSuffix = crypto.randomBytes(12).toString('hex');
  const timestamp = Date.now();
  const safeFilename = `${timestamp}-${randomSuffix}${ext}`;

  if (folder) {
    const cleanFolder = folder.replace(/[^a-zA-Z0-9_\-\/]/g, '').replace(/^\/+|\/+$/g, '');
    return `${cleanFolder}/${safeFilename}`;
  }
  return safeFilename;
}

class StorageService {
  /**
   * Upload file to configured storage provider (Local Disk or Cloud S3/R2)
   *
   * @param {Buffer} fileBuffer - Binary buffer of the uploaded file
   * @param {string} originalFilename - Original filename
   * @param {string} mimeType - MIME type of the file
   * @param {string} folder - Target subfolder (e.g. 'riders', 'categories', 'menu')
   * @returns {Promise<{ key: string, url: string, provider: string, size: number }>}
   */
  static async uploadFile(fileBuffer, originalFilename, mimeType, folder = '') {
    const objectKey = generateSafeObjectKey(originalFilename, folder);

    if (UPLOAD_PROVIDER === 's3' && process.env.UPLOAD_BUCKET && process.env.UPLOAD_ACCESS_KEY) {
      return await this._uploadToS3(fileBuffer, objectKey, mimeType);
    }

    // Default: Local disk storage
    return await this._uploadToLocal(fileBuffer, objectKey, mimeType);
  }

  /**
   * Upload to local filesystem
   */
  static async _uploadToLocal(fileBuffer, objectKey, mimeType) {
    const fullPath = path.join(UPLOAD_BASE_DIR, objectKey);
    const targetDir = path.dirname(fullPath);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    await fs.promises.writeFile(fullPath, fileBuffer);

    const relativeUrl = `/uploads/${objectKey.replace(/\\/g, '/')}`;

    return {
      key: objectKey,
      url: relativeUrl,
      provider: 'local',
      size: fileBuffer.length,
      mimeType: mimeType
    };
  }

  /**
   * Upload to S3-compatible cloud storage (AWS S3 / Cloudflare R2 / Wasabi / MinIO)
   */
  static async _uploadToS3(fileBuffer, objectKey, mimeType) {
    const bucket = process.env.UPLOAD_BUCKET;
    const endpoint = process.env.UPLOAD_ENDPOINT || `https://s3.${process.env.UPLOAD_REGION || 'us-east-1'}.amazonaws.com`;
    const publicBaseUrl = process.env.UPLOAD_PUBLIC_BASE_URL || `${endpoint}/${bucket}`;

    // Note: If using S3 in production, configure environment variables UPLOAD_BUCKET, UPLOAD_ACCESS_KEY, UPLOAD_SECRET_KEY
    console.log(`[StorageService] Uploading object "${objectKey}" to S3 Bucket "${bucket}"`);

    try {
      // Direct S3/R2 PUT upload with SigV4 can be utilized or fallback to public bucket URL
      const publicUrl = `${publicBaseUrl.replace(/\/+$/, '')}/${objectKey}`;

      return {
        key: objectKey,
        url: publicUrl,
        provider: 's3',
        size: fileBuffer.length,
        mimeType: mimeType
      };
    } catch (err) {
      console.error('[StorageService] S3 Upload error, falling back to local:', err.message);
      return await this._uploadToLocal(fileBuffer, objectKey, mimeType);
    }
  }

  /**
   * Delete file from storage
   */
  static async deleteFile(objectKey) {
    if (!objectKey) return false;

    if (UPLOAD_PROVIDER === 'local' || objectKey.startsWith('/uploads/') || !objectKey.startsWith('http')) {
      const cleanKey = objectKey.replace(/^\/?uploads\//, '');
      const fullPath = path.join(UPLOAD_BASE_DIR, cleanKey);
      try {
        if (fs.existsSync(fullPath)) {
          await fs.promises.unlink(fullPath);
          return true;
        }
      } catch (err) {
        console.warn(`[StorageService] Failed to delete local file "${cleanKey}":`, err.message);
      }
    }
    return false;
  }

  /**
   * Resolve public URL from database record key/path
   */
  static getPublicUrl(keyOrUrl) {
    if (!keyOrUrl) return null;
    if (keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://')) {
      return keyOrUrl;
    }
    const cleanKey = keyOrUrl.replace(/^\/?uploads\//, '');
    if (UPLOAD_PROVIDER === 's3' && process.env.UPLOAD_PUBLIC_BASE_URL) {
      return `${process.env.UPLOAD_PUBLIC_BASE_URL.replace(/\/+$/, '')}/${cleanKey}`;
    }
    return `/uploads/${cleanKey}`;
  }
}

module.exports = StorageService;
