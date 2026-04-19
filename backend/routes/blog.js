const express = require('express');
const BlogPost = require('../models/BlogPost');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Middleware to verify token
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Create blog post
router.post('/', verifyToken, async (req, res) => {
  try {
    const { title, content, excerpt, featuredImage, category, tags } = req.body;

    const blogPost = new BlogPost({
      title,
      content,
      excerpt,
      featuredImage,
      category,
      tags: tags || [],
      author: req.userId,
      published: false
    });

    await blogPost.save();
    await blogPost.populate('author', 'username email profileImage');

    res.status(201).json({
      success: true,
      blogPost
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all published blog posts
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const blogPosts = await BlogPost.find({ published: true })
      .populate('author', 'username email profileImage firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await BlogPost.countDocuments({ published: true });

    res.status(200).json({
      success: true,
      count: blogPosts.length,
      total,
      pages: Math.ceil(total / limit),
      blogPosts
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get blog post by slug
router.get('/:slug', async (req, res) => {
  try {
    const blogPost = await BlogPost.findOne({ slug: req.params.slug, published: true })
      .populate('author', 'username email profileImage firstName lastName')
      .populate('comments.author', 'username profileImage');

    if (!blogPost) {
      return res.status(404).json({ success: false, message: 'Blog post not found' });
    }

    blogPost.views += 1;
    await blogPost.save();

    res.status(200).json({
      success: true,
      blogPost
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update blog post
router.put('/:id', verifyToken, async (req, res) => {
  try {
    let blogPost = await BlogPost.findById(req.params.id);

    if (!blogPost) {
      return res.status(404).json({ success: false, message: 'Blog post not found' });
    }

    if (blogPost.author.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    blogPost = await BlogPost.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('author', 'username email profileImage');

    res.status(200).json({
      success: true,
      blogPost
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete blog post
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const blogPost = await BlogPost.findById(req.params.id);

    if (!blogPost) {
      return res.status(404).json({ success: false, message: 'Blog post not found' });
    }

    if (blogPost.author.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await BlogPost.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Blog post deleted'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add comment to blog post
router.post('/:id/comment', verifyToken, async (req, res) => {
  try {
    const { content } = req.body;

    const blogPost = await BlogPost.findById(req.params.id);

    if (!blogPost) {
      return res.status(404).json({ success: false, message: 'Blog post not found' });
    }

    blogPost.comments.push({
      author: req.userId,
      content
    });

    await blogPost.save();
    await blogPost.populate('comments.author', 'username profileImage');

    res.status(201).json({
      success: true,
      blogPost
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Like blog post
router.post('/:id/like', verifyToken, async (req, res) => {
  try {
    const blogPost = await BlogPost.findById(req.params.id);

    if (!blogPost) {
      return res.status(404).json({ success: false, message: 'Blog post not found' });
    }

    if (blogPost.likes.includes(req.userId)) {
      blogPost.likes = blogPost.likes.filter(id => id.toString() !== req.userId);
    } else {
      blogPost.likes.push(req.userId);
    }

    await blogPost.save();

    res.status(200).json({
      success: true,
      likes: blogPost.likes.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;