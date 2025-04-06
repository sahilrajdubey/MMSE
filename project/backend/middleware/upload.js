const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath = '../uploads/';

    // Determine upload directory based on mime type
    if (file.mimetype.startsWith('image/')) {
      uploadPath += 'images/';
    } else if (file.mimetype.startsWith('video/')) {
      uploadPath += 'videos/';
    } else if (file.mimetype.startsWith('audio/')) {
      uploadPath += 'audio/';
    } else {
      uploadPath += 'documents/';
    }

    // Create directory if it doesn't exist
    fs.mkdirSync(path.join(__dirname, uploadPath), { recursive: true });
    
    cb(null, path.join(__dirname, uploadPath));
  },
  filename: function (req, file, cb) {
    // Create a unique file name
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Allowed extensions
  const allowedImageTypes = /jpeg|jpg|png|gif|svg|webp/;
  const allowedVideoTypes = /mp4|mov|avi|mkv|webm/;
  const allowedAudioTypes = /mp3|wav|ogg|flac|aac/;
  const allowedDocTypes = /pdf|doc|docx|txt|xls|xlsx|ppt|pptx/;
  
  // Check extension
  const extname = allowedImageTypes.test(path.extname(file.originalname).toLowerCase()) ||
                  allowedVideoTypes.test(path.extname(file.originalname).toLowerCase()) ||
                  allowedAudioTypes.test(path.extname(file.originalname).toLowerCase()) ||
                  allowedDocTypes.test(path.extname(file.originalname).toLowerCase());
  
  // Check mime type
  const mimetype = allowedImageTypes.test(file.mimetype) ||
                  allowedVideoTypes.test(file.mimetype) ||
                  allowedAudioTypes.test(file.mimetype) ||
                  allowedDocTypes.test(file.mimetype);
  
  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Error: Unsupported file type!'), false);
  }
};

// Initialize upload
const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB file size limit
  fileFilter: fileFilter
});

module.exports = upload;