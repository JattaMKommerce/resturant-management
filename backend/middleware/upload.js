const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const randomSuffix = crypto.randomBytes(12).toString('hex');
    const safeFilename = `img-${Date.now()}-${randomSuffix}${ext}`;
    cb(null, safeFilename);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExtensions = /\.(jpg|jpeg|png|webp|gif|svg)$/i;
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

  const extValid = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
  const mimeValid = allowedMimes.includes(file.mimetype);

  if (extValid && mimeValid) {
    return cb(null, true);
  }
  return cb(new Error('Invalid image file. Only JPG, PNG, WebP, GIF, and SVG formats are permitted.'));
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

module.exports = upload;
