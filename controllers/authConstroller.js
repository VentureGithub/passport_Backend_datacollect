const User = require('../models/userSchema');
const asyncHandler = require('../middleware/async.js'); // Utility for handling async errors
const ErrorResponse = require('../utils/errorResponse'); // Custom error handler

// @desc    Register user (Admin only)
// @route   POST /api/v1/auth/register
// @access  Private/Admin
exports.registerUser = asyncHandler(async (req, res, next) => {
  // Check if the requester is admin
  if (req.user.role !== 'admin') {
    return next(new ErrorResponse('Only admin can register new users', 403));
  }

  const { fullName, email, password, mobileNumber, role = 'user', isActive = true } = req.body;

  // Create user and add createdBy reference
  const user = await User.create({
    fullName,
    email,
    password,
    mobileNumber,
    role,
    isActive,
    createdBy: req.user.id
  });

  // Remove password from response
  user.password = undefined;

  res.status(201).json({
    success: true,
    data: user
  });
});

// @desc    Create admin (Only if no admin exists)
// @route   POST /api/v1/auth/create-admin
// @access  Public (but can only be used once)
exports.createAdmin = asyncHandler(async (req, res, next) => {
  try {
    const { fullName, email, password, mobileNumber } = req.body;
    
    // Use the static method to ensure only one admin exists
    const admin = await User.createAdmin({
      fullName,
      email,
      password,
      mobileNumber
    });

    // Generate JWT token for the admin
    const token = admin.generateAuthToken();
    
    res.status(201).json({
      success: true,
      token,
      data: {
        id: admin._id,
        fullName: admin.fullName,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    return next(new ErrorResponse(error.message, 400));
  }
});

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate email & password
  if (!email || !password) {
    return next(new ErrorResponse('Please provide email and password', 400));
  }

  // Check for user
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  // Check if user is active
  if (!user.isActive) {
    return next(new ErrorResponse('Your account has been deactivated. Please contact admin', 401));
  }

  // Check if password matches
  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  // Update last login time
  user.lastLogin = new Date();
  await user.save();

  // Generate JWT token
  const token = user.generateAuthToken();

  res.status(200).json({
    success: true,
    token,
    data: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      lastLogin: user.lastLogin
    }
  });
});

// @desc    Get current logged in user
// @route   GET /api/v1/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    success: true,
    data: user
  });
});

exports.changePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  // Validate input
  if (!currentPassword || !newPassword) {
    return next(new ErrorResponse('Please provide current and new password', 400));
  }

  if (newPassword.length < 6) {
    return next(new ErrorResponse('New password should be at least 6 characters', 400));
  }

  // Get user with password field
  const user = await User.findById(req.user.id).select('+password');

  // Check if current password matches
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    return next(new ErrorResponse('Current password is incorrect', 401));
  }

  // Update password
  user.password = newPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password changed successfully'
  });
});

// @desc    Admin changes own password (separate from user password reset)
// @route   PATCH /api/auth/admin-change-password
// @access  Private/Admin
exports.adminChangePassword = asyncHandler(async (req, res, next) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to access this route', 403));
  }

  const { currentPassword, newPassword } = req.body;

  // Validate input
  if (!currentPassword || !newPassword) {
    return next(new ErrorResponse('Please provide current and new password', 400));
  }

  if (newPassword.length < 6) {
    return next(new ErrorResponse('New password should be at least 6 characters', 400));
  }

  // Get admin with password field
  const admin = await User.findById(req.user.id).select('+password');

  // Check if current password matches
  const isMatch = await admin.comparePassword(currentPassword);
  if (!isMatch) {
    return next(new ErrorResponse('Current password is incorrect', 401));
  }

  // Update password
  admin.password = newPassword;
  await admin.save();

  // Generate new token with updated credentials
  const token = admin.generateAuthToken();

  res.status(200).json({
    success: true,
    message: 'Password changed successfully',
    token
  });
});

// @desc    Logout user
// @route   POST /api/v1/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res, next) => {
  // Update last logout time
  const user = await User.findById(req.user.id);
  user.lastLogout = new Date();
  await user.save();
  
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
    data: {
      lastLogout: user.lastLogout
    }
  });
});