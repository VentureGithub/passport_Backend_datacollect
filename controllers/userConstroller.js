const User = require('../models/userSchema');
const asyncHandler = require('../middleware/async.js');
const ErrorResponse = require('../utils/errorResponse');


exports.checkPasswordChangeAuthorization = (req, res, next) => {
  // Admin can change any user's password
  if (req.user.role === 'admin') {
    return next();
  }
  
  // User can only change their own password
  if (req.user.id !== req.params.id) {
    return next(new ErrorResponse('Not authorized to change this password', 403));
  }
  
  next();
};

// @desc    Get all users
// @route   GET /api/v1/users
// @access  Private/Admin
exports.getUsers = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to access this route', 403));
  }

  const users = await User.find({ role: 'user' }).sort('-createdAt');

  res.status(200).json({
    success: true,
    count: users.length,
    data: users
  });
});

// @desc    Get single user
// @route   GET /api/v1/users/:id
// @access  Private/Admin
exports.getUser = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to access this route', 403));
  }

  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Update user
// @route   PUT /api/v1/users/:id
// @access  Private/Admin
exports.updateUser = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to access this route', 403));
  }

  // Don't allow changing the role to admin
  if (req.body.role === 'admin') {
    return next(new ErrorResponse('Cannot update user role to admin', 400));
  }

  // Fields to update
  const fieldsToUpdate = {
    fullName: req.body.fullName,
    mobileNumber: req.body.mobileNumber,
    isActive: req.body.isActive
  };

  // Filter out undefined fields
  Object.keys(fieldsToUpdate).forEach(key => 
    fieldsToUpdate[key] === undefined && delete fieldsToUpdate[key]
  );

  // Update user and get updated record
  const user = await User.findByIdAndUpdate(
    req.params.id,
    fieldsToUpdate,
    {
      new: true,
      runValidators: true
    }
  );

  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Activate/Deactivate user
// @route   PATCH /api/v1/users/:id/toggle-status
// @access  Private/Admin
exports.toggleUserStatus = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to access this route', 403));
  }

  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }

  if (user.role === 'admin') {
    return next(new ErrorResponse('Cannot modify admin status', 400));
  }

  // Toggle the isActive status
  user.isActive = !user.isActive;
  await user.save();

  res.status(200).json({
    success: true,
    data: user,
    message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`
  });
});

// @desc    Delete user
// @route   DELETE /api/v1/users/:id
// @access  Private/Admin
exports.deleteUser = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to access this route', 403));
  }

  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }

  if (user.role === 'admin') {
    return next(new ErrorResponse('Cannot delete admin user', 400));
  }

  await user.remove();

  res.status(200).json({
    success: true,
    data: {},
    message: 'User deleted successfully'
  });
});

// @desc    Reset user password (Admin only)
// @route   PATCH /api/v1/users/:id/reset-password
// @access  Private/Admin
exports.resetUserPassword = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to access this route', 403));
  }

  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return next(new ErrorResponse('Password should be at least 6 characters', 400));
  }

  const user = await User.findById(req.params.id).select('+password');

  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }

  if (user.role === 'admin') {
    return next(new ErrorResponse('Cannot reset admin password through this route', 400));
  }

  // Set new password
  user.password = newPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password reset successfully'
  });
});

exports.changeUserPassword = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;

  // Find user by ID
  const user = await User.findById(id);

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // If not admin, verify current password
  if (req.user.role !== 'admin') {
    // Check if current password is correct
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return next(new ErrorResponse('Current password is incorrect', 400));
    }
  }

  // Validate new password
  if (!newPassword || newPassword.length < 6) {
    return next(new ErrorResponse('Password must be at least 6 characters long', 400));
  }

  // Update password
  user.password = newPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password updated successfully'
  });
});
