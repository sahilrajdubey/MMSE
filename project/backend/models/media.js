const mongoose = require('mongoose');

const MediaSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['image', 'video', 'audio', 'document'],
    required: true
  },
  filename: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  fileFormat: {
    type: String,
    required: true
  },
  thumbnailPath: {
    type: String,
    default: null
  },
  metadata: {
    width: Number,
    height: Number,
    duration: Number,
    bitrate: Number,
    // Additional metadata fields based on file type
  },
  tags: [{
    type: String,
    trim: true
  }],
  aiTags: [{
    tag: String,
    confidence: Number
  }],
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  public: {
    type: Boolean,
    default: true
  },
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create text indexes for search
MediaSchema.index({ 
  title: 'text', 
  description: 'text', 
  tags: 'text',
  'aiTags.tag': 'text'
});

module.exports = mongoose.model('Media', MediaSchema);