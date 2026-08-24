const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Create rider upload directories
const riderUploadBase = path.join(__dirname, '..', 'uploads', 'riders');
const riderSubdirs = ['selfies', 'aadhaar', 'driving-licence', 'pan', 'vehicle-rc', 'insurance'];

riderSubdirs.forEach(dir => {
  const fullPath = path.join(riderUploadBase, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

// Map document_type to storage subdirectory
const DOCUMENT_TYPE_DIR = {
  'SELFIE': 'selfies',
  'AADHAAR_FRONT': 'aadhaar',
  'AADHAAR_BACK': 'aadhaar',
  'DRIVING_LICENSE_FRONT': 'driving-licence',
  'DRIVING_LICENSE_BACK': 'driving-licence',
  'PAN': 'pan',
  'VEHICLE_RC': 'vehicle-rc',
  'INSURANCE': 'insurance',
};

// Allowed MIME types for rider documents
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp'
];

// Allowed extensions
const ALLOWED_EXTENSIONS = /\.(jpg|jpeg|png|webp)$/i;

// Max file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Max files per application
const MAX_FILES_PER_APPLICATION = 10;

/**
 * Generate a safe filename that prevents path traversal
 */
function generateSafeFilename(originalname, docType) {
  const ext = path.extname(originalname).toLowerCase();
  const randomId = crypto.randomBytes(12).toString('hex');
  const timestamp = Date.now();
  const safeType = docType.toLowerCase().replace(/_/g, '-');
  return `rider-${safeType}-${timestamp}-${randomId}${ext}`;
}

/**
 * Create multer memory storage for direct database persistence
 */
const riderMemoryStorage = multer.memoryStorage();

/**
 * File filter: validate MIME type and extension
 */
const riderFileFilter = (req, file, cb) => {
  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error(`Invalid file type "${file.mimetype}". Only JPEG, PNG, and WebP images are allowed.`));
  }
  // Validate extension
  if (!ALLOWED_EXTENSIONS.test(file.originalname)) {
    return cb(new Error(`Invalid file extension. Only .jpg, .jpeg, .png, and .webp files are allowed.`));
  }
  // Check for path traversal in filename
  const basename = path.basename(file.originalname);
  if (basename !== file.originalname || file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
    return cb(new Error('Invalid filename detected.'));
  }
  cb(null, true);
};

/**
 * Rider application upload middleware
 * Accepts specific document fields
 */
const riderUpload = multer({
  storage: riderMemoryStorage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES_PER_APPLICATION
  },
  fileFilter: riderFileFilter
});

/**
 * Get the relative file path for database storage
 */
function getRelativeFilePath(absolutePath) {
  const uploadsIndex = absolutePath.indexOf('uploads');
  if (uploadsIndex === -1) return absolutePath;
  return absolutePath.substring(uploadsIndex).replace(/\\/g, '/');
}

module.exports = {
  riderUpload,
  getRelativeFilePath,
  DOCUMENT_TYPE_DIR,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  riderUploadBase
};
