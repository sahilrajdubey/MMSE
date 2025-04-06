const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const upload = require('../middleware/upload');

// @route   GET /api/search/text
// @desc    Search media by text
// @access  Public
router.get('/text', searchController.searchByText);

// @route   POST /api/search/image
// @desc    Search media by image similarity
// @access  Public
router.post('/image', upload.single('image'), searchController.searchByImage);

// @route   POST /api/search/audio
// @desc    Search media by audio similarity
// @access  Public
router.post('/audio', upload.single('audio'), searchController.searchByAudio);

// @route   GET /api/search/tags
// @desc    Search by tags
// @access  Public
router.get('/tags', searchController.searchByTags);

module.exports = router;