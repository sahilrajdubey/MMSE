const Media = require('../models/media');
const path = require('path');
const sharp = require('sharp');
const fs = require('fs');
const { NlpManager } = require('node-nlp');

// Initialize NLP manager for search enhancement
const nlpManager = new NlpManager({ languages: ['en'] });

// @desc    Search media by text
// @route   GET /api/search/text
// @access  Public
exports.searchByText = async (req, res) => {
  try {
    const { q, type, sort, page = 1, limit = 12 } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }
    
    // Process query with NLP to extract entities and keywords
    const nlpResult = await nlpManager.process('en', q);
    let enhancedQuery = q;
    
    // Add entities to enhance search
    if (nlpResult.entities && nlpResult.entities.length > 0) {
      const entities = nlpResult.entities.map(entity => entity.entity);
      enhancedQuery += ' ' + entities.join(' ');
    }
    
    // Build search query
    const searchQuery = {
      $and: [
        { public: true },
        {
          $text: {
            $search: enhancedQuery
          }
        }
      ]
    };
    
    // Add type filter if specified
    if (type && ['image', 'video', 'audio', 'document'].includes(type)) {
      searchQuery.$and.push({ type });
    }
    
    // Build sort options
    let sortOptions = { score: { $meta: 'textScore' } }; // Default: relevance
    if (sort === 'newest') {
      sortOptions = { createdAt: -1 };
    } else if (sort === 'popular') {
      sortOptions = { views: -1 };
    } else if (sort === 'liked') {
      sortOptions = { likes: -1 };
    }
    
    // Execute search with pagination
    const results = await Media.find(searchQuery)
      .select({ score: { $meta: 'textScore' } })
      .sort(sortOptions)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .populate('user', 'name avatar');
    
    // Get total count
    const total = await Media.countDocuments(searchQuery);
    
    res.json({
      success: true,
      query: q,
      count: results.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      data: results
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Search media by image similarity
// @route   POST /api/search/image
// @access  Public
exports.searchByImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Please upload an image'
      });
    }
    
    const { page = 1, limit = 12 } = req.query;
    
    // Process the uploaded image
    // In a real implementation, this would use image similarity algorithms
    // For now, we'll use a simplified approach based on the image metadata
    
    // Extract image dimensions
    const imageInfo = await sharp(req.file.path).metadata();
    const { width, height } = imageInfo;
    
    // Calculate aspect ratio
    const aspectRatio = width / height;
    
    // Find images with similar dimensions and aspect ratio
    // This is a simplified simulation - real image search would use more sophisticated algorithms
    const results = await Media.find({
      type: 'image',
      public: true,
      'metadata.width': { $gte: width * 0.7, $lte: width * 1.3 },
      'metadata.height': { $gte: height * 0.7, $lte: height * 1.3 }
    })
      .sort({ views: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .populate('user', 'name avatar');
    
    // Get total count
    const total = await Media.countDocuments({
      type: 'image',
      public: true,
      'metadata.width': { $gte: width * 0.7, $lte: width * 1.3 },
      'metadata.height': { $gte: height * 0.7, $lte: height * 1.3 }
    });
    
    // Delete the temporary uploaded file
    fs.unlinkSync(req.file.path);
    
    res.json({
      success: true,
      count: results.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      data: results
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Search media by audio similarity
// @route   POST /api/search/audio
// @access  Public
exports.searchByAudio = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Please upload an audio file'
      });
    }
    
    const { page = 1, limit = 12 } = req.query;
    
    // Process the uploaded audio
    // In a real implementation, this would use audio fingerprinting
    // For now, we'll use a simplified approach based on the audio metadata
    
    // Extract audio duration and bitrate (using ffprobe)
    let duration = 0;
    let bitrate = 0;
    
    try {
      const ffmpeg = require('fluent-ffmpeg');
      await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(req.file.path, (err, data) => {
          if (err) {
            reject(err);
            return;
          }
          
          duration = data.format.duration;
          bitrate = data.format.bit_rate;
          resolve();
        });
      });
    } catch (err) {
      console.error('FFprobe error:', err);
    }
    
    // Find audio files with similar duration
    // This is a simplified simulation - real audio search would use more sophisticated algorithms
    const results = await Media.find({
      type: 'audio',
      public: true,
      'metadata.duration': { $gte: duration * 0.7, $lte: duration * 1.3 }
    })
      .sort({ views: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .populate('user', 'name avatar');
    
    // Get total count
    const total = await Media.countDocuments({
      type: 'audio',
      public: true,
      'metadata.duration': { $gte: duration * 0.7, $lte: duration * 1.3 }
    });
    
    // Delete the temporary uploaded file
    fs.unlinkSync(req.file.path);
    
    res.json({
      success: true,
      count: results.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      data: results
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Search by tags
// @route   GET /api/search/tags
// @access  Public
exports.searchByTags = async (req, res) => {
  try {
    const { tags, type, page = 1, limit = 12 } = req.query;
    
    if (!tags) {
      return res.status(400).json({
        success: false,
        error: 'Tags are required'
      });
    }
    
    const tagsArray = tags.split(',').map(tag => tag.trim());
    
    // Build search query
    const searchQuery = {
      public: true,
      $or: [
        { tags: { $in: tagsArray } },
        { 'aiTags.tag': { $in: tagsArray } }
      ]
    };
    
    // Add type filter if specified
    if (type && ['image', 'video', 'audio', 'document'].includes(type)) {
      searchQuery.type = type;
    }
    
    // Execute search with pagination
    const results = await Media.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .populate('user', 'name avatar');
    
    // Get total count
    const total = await Media.countDocuments(searchQuery);
    
    res.json({
      success: true,
      tags: tagsArray,
      count: results.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      data: results
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};