// const jwt = require('jsonwebtoken');
// const asyncHandler = require('./async.js');
// const ErrorResponse = require('../utils/errorResponse');
// const User = require('../models/userSchema');

// // Protect routes
// exports.protect = asyncHandler(async (req, res, next) => {
//   let token;
  
//   // Get token from header
//   if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
//     token = req.headers.authorization.split(' ')[1];
//   }

//   // Make sure token exists
//   if (!token) {
//     return next(new ErrorResponse('Not authorized to access this route - no token provided', 401));
//   }

//   try {
//     // Verify token - make sure to use the correct secret that you used when creating tokens
//     // This should match what you use in your login/auth controller
//     const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
//     console.log("Decoded token:", decoded); // Add for debugging
    
//     // Check if user still exists
//     const user = await User.findById(decoded.id);
    
//     if (!user) {
//       console.log("User not found for ID:", decoded.id);
//       return next(new ErrorResponse('User no longer exists', 401));
//     }
    
//     // Check if user is active
//     if (!user.isActive) {
//       return next(new ErrorResponse('Your account has been deactivated', 401));
//     }
    
//     // Set user in request object
//     req.user = user;
//     next();
//   } catch (error) {
//     console.log("Token verification error:", error.message);
//     return next(new ErrorResponse('Not authorized to access this route - invalid token', 401));
//   }
// });

// // Grant access to specific roles
// exports.authorize = (...roles) => {
//   return (req, res, next) => {
//     if (!req.user) {
//       return next(new ErrorResponse('User not authenticated', 401));
//     }
    
//     console.log("User role:", req.user.role, "Required roles:", roles);
    
//     if (!roles.includes(req.user.role)) {
//       return next(new ErrorResponse(`User role ${req.user.role} is not authorized to access this route. Required: ${roles.join(', ')}`, 403));
//     }
//     next();
//   };
// };











const jwt = require('jsonwebtoken');
const asyncHandler = require('./async.js');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/userSchema');

// Protect routes - verifies token only
exports.protect = asyncHandler(async (req, res, next) => {
  let token;
  
  // Get token from header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Make sure token exists
  if (!token) {
    return next(new ErrorResponse('Not authorized to access this route - no token provided', 401));
  }

  try {
    // Verify token - uses the JWT_SECRET from environment or falls back to default
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Check if user still exists
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return next(new ErrorResponse('User not found', 401));
    }
    
    // Check if user is active
    if (!user.isActive) {
      return next(new ErrorResponse('Your account has been deactivated', 401));
    }
    
    // Set user in request object
    req.user = user;
    next();
  } catch (error) {
    return next(new ErrorResponse('Invalid token', 401));
  }
});

// Grant access to specific roles (used only when specific role checks are needed)
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new ErrorResponse(`User role ${req.user.role} is not authorized to access this route`, 403));
    }
    next();
  };
};