const Media = require('../model/media');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const { NlpManager } = require('node-nlp');

// Initialize NLP manager for entity recognition and tagging
const nlpManager = new NlpManager({ languages: ['en'] });

// @desc    Upload media
// @route   POST /api/media/upload
// @access  Private
exports.uploadMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Please upload a file'
      });
    }

    const { title, description, tags = '', public = true } = req.body;
    const tagsArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);

    // Determine file type
    let fileType = '';
    let thumbnailPath = null;
    const metadata = {};

    if (req.file.mimetype.startsWith('image/')) {
      fileType = 'image';
      
      // Process image with sharp
      const imageInfo = await sharp(req.file.path).metadata();
      metadata.width = imageInfo.width;
      metadata.height = imageInfo.height;
      
      // Create thumbnail
      const thumbnailName = `thumbnail-${path.basename(req.file.filename)}`;
      const thumbnailDir = path.join(__dirname, '../../uploads/thumbnails');
      
      // Ensure thumbnail directory exists
      if (!fs.existsSync(thumbnailDir)) {
        fs.mkdirSync(thumbnailDir, { recursive: true });
      }
      
      thumbnailPath = `/uploads/thumbnails/${thumbnailName}`;
      
      await sharp(req.file.path)
        .resize(300, 200, { fit: 'inside' })
        .toFile(path.join(thumbnailDir, thumbnailName));
    } 
    else if (req.file.mimetype.startsWith('video/')) {
      fileType = 'video';
      
      const thumbnailName = `thumbnail-${path.parse(req.file.filename).name}.jpg`;
      const thumbnailDir = path.join(__dirname, '../../uploads/thumbnails');
      
      // Ensure thumbnail directory exists
      if (!fs.existsSync(thumbnailDir)) {
        fs.mkdirSync(thumbnailDir, { recursive: true });
      }
      
      thumbnailPath = `/uploads/thumbnails/${thumbnailName}`;
      
      // Generate thumbnail from video
      await new Promise((resolve, reject) => {
        ffmpeg(req.file.path)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .screenshots({
            count: 1,
            folder: thumbnailDir,
            filename: thumbnailName,
            size: '300x?'
          });
      });
      
      // Get video metadata
      await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(req.file.path, (err, data) => {
          if (err) {
            reject(err);
            return;
          }
          
          const videoStream = data.streams.find(stream => stream.codec_type === 'video');
          if (videoStream) {
            metadata.width = videoStream.width;
            metadata.height = videoStream.height;
            metadata.duration = data.format.duration;
            metadata.bitrate = data.format.bit_rate;
          }
          resolve();
        });
      });
    } 
    else if (req.file.mimetype.startsWith('audio/')) {
      fileType = 'audio';
      
      // Use a default audio thumbnail
      thumbnailPath = '/uploads/thumbnails/audio-default.jpg';
      
      // Get audio metadata
      await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(req.file.path, (err, data) => {
          if (err) {
            reject(err);
            return;
          }
          
          metadata.duration = data.format.duration;
          metadata.bitrate = data.format.bit_rate;
          resolve();
        });
      });
    } 
    else {
      fileType = 'document';
      // Use a default document thumbnail
      thumbnailPath = '/uploads/thumbnails/document-default.jpg';
    }

    // Generate AI tags using NLP
    const nlpResult = await nlpManager.process('en', description);
    const aiTags = [];
    
    // Extract entities and concepts
    if (nlpResult.entities && nlpResult.entities.length > 0) {
      nlpResult.entities.forEach(entity => {
        aiTags.push({
          tag: entity.entity,
          confidence: entity.accuracy
        });
      });
    }
    
    // Extract keywords
    const keywords = description.split(' ')
      .filter(word => word.length > 3)
      .map(word => word.toLowerCase().replace(/[^\w\s]/gi, ''));
    
    // Add unique keywords to AI tags
    new Set(keywords).forEach(keyword => {
      if (keyword && !aiTags.some(tag => tag.tag === keyword)) {
        aiTags.push({
          tag: keyword,
          confidence: 0.5
        });
      }
    });

    // Create media record
    const media = await Media.create({
      title,
      description,
      type: fileType,
      filename: req.file.filename,
      filePath: req.file.path.replace(path.join(__dirname, '../..'), ''),
      fileSize: req.file.size,
      fileFormat: path.extname(req.file.originalname).substring(1),
      thumbnailPath,
      metadata,
      tags: tagsArray,
      aiTags,
      user: req.user.id,
      public: public === 'true' || public === true
    });

    res.status(201).json({
      success: true,
      data: media
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Get all media
// @route   GET /api/media
// @access  Public
exports.getAllMedia = async (req, res) => {
  try {
    const { page = 1, limit = 12, type, sort } = req.query;
    
    // Build query
    const query = { public: true };
    if (type && ['image', 'video', 'audio', 'document'].includes(type)) {
      query.type = type;
    }
    
    // Build sort options
    let sortOptions = { createdAt: -1 }; // Default: newest first
    if (sort === 'popular') {
      sortOptions = { views: -1 };
    } else if (sort === 'liked') {
      sortOptions = { likes: -1 };
    }
    
    // Execute query with pagination
    const media = await Media.find(query)
      .sort(sortOptions)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .populate('user', 'name avatar');
    
    // Get total count
    const total = await Media.countDocuments(query);
    
    res.json({
      success: true,
      count: media.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      data: media
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Get media by ID
// @route   GET /api/media/:id
// @access  Public/Private (depends on media privacy)
exports.getMedia = async (req, res) => {
  try {
    const media = await Media.findById(req.params.id)
      .populate('user', 'name avatar');
    
    if (!media) {
      return res.status(404).json({
        success: false,
        error: 'Media not found'
      });
    }
    
    // Check if media is private and user is not the owner
    if (!media.public && (!req.user || media.user.toString() !== req.user.id)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this media'
      });
    }
    
    // Increment view count
    media.views += 1;
    await media.save();
    
    res.json({
      success: true,
      data: media
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Update media
// @route   PUT /api/media/:id
// @access  Private
exports.updateMedia = async (req, res) => {
  try {
    let media = await Media.findById(req.params.id);
    
    if (!media) {
      return res.status(404).json({
        success: false,
        error: 'Media not found'
      });
    }
    
    // Check if user is the owner
    if (media.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this media'
      });
    }
    
    const { title, description, tags, public } = req.body;
    
    // Update fields
    if (title) media.title = title;
    if (description) media.description = description;
    if (tags) media.tags = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    if (public !== undefined) media.public = public === 'true' || public === true;
    
    // Update AI tags if description is updated
    if (description) {
      const nlpResult = await nlpManager.process('en', description);
      const aiTags = [];
      
      // Extract entities and concepts
      if (nlpResult.entities && nlpResult.entities.length > 0) {
        nlpResult.entities.forEach(entity => {
          aiTags.push({
            tag: entity.entity,
            confidence: entity.accuracy
          });
        });
      }
      
      // Extract keywords
      const keywords = description.split(' ')
        .filter(word => word.length > 3)
        .map(word => word.toLowerCase().replace(/[^\w\s]/gi, ''));
      
      // Add unique keywords to AI tags
      new Set(keywords).forEach(keyword => {
        if (keyword && !aiTags.some(tag => tag.tag === keyword)) {
          aiTags.push({
            tag: keyword,
            confidence: 0.5
          });
        }
      });
      
      media.aiTags = aiTags;
    }
    
    await media.save();
    
    res.json({
      success: true,
      data: media
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Delete media
// @route   DELETE /api/media/:id
// @access  Private
exports.deleteMedia = async (req, res) => {
  try {
    const media = await Media.findById(req.params.id);
    
    if (!media) {
      return res.status(404).json({
        success: false,
        error: 'Media not found'
      });
    }
    
    // Check if user is the owner or admin
    if (media.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this media'
      });
    }
    
    // Delete the file
    try {
      fs.unlinkSync(path.join(__dirname, '../..', media.filePath));
      
      // Delete thumbnail if it exists
      if (media.thumbnailPath && 
          !media.thumbnailPath.includes('default') && 
          fs.existsSync(path.join(__dirname, '../..', media.thumbnailPath))) {
        fs.unlinkSync(path.join(__dirname, '../..', media.thumbnailPath));
      }
    } catch (err) {
      console.error('File deletion error:', err);
      // Continue with database deletion even if file deletion fails
    }
    
    // Delete from database
    await media.remove();
    
    res.json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Like media
// @route   PUT /api/media/:id/like
// @access  Private
exports.likeMedia = async (req, res) => {
  try {
    const media = await Media.findById(req.params.id);
    
    if (!media) {
      return res.status(404).json({
        success: false,
        error: 'Media not found'
      });
    }
    
   // Increment like count
   media.likes += 1;
   await media.save();
   
   res.json({
     success: true,
     data: media
   });
 } catch (error) {
   console.error(error);
   res.status(500).json({
     success: false,
     error: 'Server error'
   });
 }
};

// @desc    Get user media
// @route   GET /api/media/user
// @access  Private
exports.getUserMedia = async (req, res) => {
 try {
   const { page = 1, limit = 12, type } = req.query;
   
   // Build query
   const query = { user: req.user.id };
   if (type && ['image', 'video', 'audio', 'document'].includes(type)) {
     query.type = type;
   }
   
   // Execute query with pagination
   const media = await Media.find(query)
     .sort({ createdAt: -1 })
     .skip((parseInt(page) - 1) * parseInt(limit))
     .limit(parseInt(limit));
   
   // Get total count
   const total = await Media.countDocuments(query);
   
   res.json({
     success: true,
     count: media.length,
     total,
     totalPages: Math.ceil(total / parseInt(limit)),
     currentPage: parseInt(page),
     data: media
   });
 } catch (error) {
   console.error(error);
   res.status(500).json({
     success: false,
     error: 'Server error'
   });
 }
};

// @desc    Get trending media
// @route   GET /api/media/trending
// @access  Public
exports.getTrendingMedia = async (req, res) => {
 try {
   const { limit = 8 } = req.query;
   
   // Get trending media based on views and likes
   const media = await Media.find({ public: true })
     .sort({ views: -1, likes: -1 })
     .limit(parseInt(limit))
     .populate('user', 'name avatar');
   
   res.json({
     success: true,
     count: media.length,
     data: media
   });
 } catch (error) {
   console.error(error);
   res.status(500).json({
     success: false,
     error: 'Server error'
   });
 }
};

// @desc    Get stats
// @route   GET /api/media/stats
// @access  Public
exports.getStats = async (req, res) => {
 try {
   // Count total media
   const totalMedia = await Media.countDocuments({ public: true });
   
   // Count by type
   const imageCount = await Media.countDocuments({ type: 'image', public: true });
   const videoCount = await Media.countDocuments({ type: 'video', public: true });
   const audioCount = await Media.countDocuments({ type: 'audio', public: true });
   const documentCount = await Media.countDocuments({ type: 'document', public: true });
   
   res.json({
     success: true,
     data: {
       totalMedia,
       imageCount,
       videoCount,
       audioCount,
       documentCount
     }
   });
 } catch (error) {
   console.error(error);
   res.status(500).json({
     success: false,
     error: 'Server error'
   });
 }
};