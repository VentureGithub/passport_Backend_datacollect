const express = require('express');
const router = express.Router();
const {
  createAdmin,
  register,
  login,
  getMe,
  logout
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');

// Public routes
router.post('/create-admin', createAdmin);
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);

module.exports = router;
