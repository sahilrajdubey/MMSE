const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

// @route   POST /api/media/upload
// @desc    Upload media
// @access  Private
router.post(
  '/upload',
  protect,
  upload.single('media'),
  mediaController.uploadMedia
);

// @route   GET /api/media
// @desc    Get all public media
// @access  Public
router.get('/', mediaController.getAllMedia);

// @route   GET /api/media/trending
// @desc    Get trending media
// @access  Public
router.get('/trending', mediaController.getTrendingMedia);

// @route   GET /api/media/stats
// @desc    Get media statistics
// @access  Public
router.get('/stats', mediaController.getStats);

// @route   GET /api/media/user
// @desc    Get user's media
// @access  Private
router.get('/user', protect, mediaController.getUserMedia);

// @route   GET /api/media/:id
// @desc    Get media by ID
// @access  Public/Private (depends on media privacy)
router.get('/:id', mediaController.getMedia);

// @route   PUT /api/media/:id
// @desc    Update media
// @access  Private
router.put('/:id', protect, mediaController.updateMedia);

// @route   DELETE /api/media/:id
// @desc    Delete media
// @access  Private
router.delete('/:id', protect, mediaController.deleteMedia);

// @route   PUT /api/media/:id/like
// @desc    Like media
// @access  Private
router.put('/:id/like', protect, mediaController.likeMedia);

module.exports = router;