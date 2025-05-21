const PassportPost = require('../models/passportSchema');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const { body, validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose'); // Add this import for ObjectId

// Helper function to get current IST time
const getCurrentIST = () => {
  // Get current time in milliseconds
  const now = Date.now();
  
  // Add 5 hours and 30 minutes in milliseconds
  const istTimeInMs = now + (5.5 * 60 * 60 * 1000);
  
  // Create new date object with IST time
  return new Date(istTimeInMs);
};

// Validation rules for passport entries
exports.validatePassportEntries = [
  body('passports')
    .isArray()
    .withMessage('Passports must be an array')
    .notEmpty()
    .withMessage('At least one passport entry is required'),
  
  body('passports.*.passportNumber')
    .notEmpty()
    .withMessage('Passport number is required')
    .isString()
    .withMessage('Passport number must be a string')
    .isLength({ min: 5, max: 20 })
    .withMessage('Passport number must be between 5 and 20 characters'),
  
  body('passports.*.link')
    .notEmpty()
    .withMessage('Link is required')
    .isURL()
    .withMessage('Must provide a valid URL'),
  
  body('passports.*.city')
    .optional()
    .isString()
    .withMessage('City must be a string'),

  body('passports.*.slipNo')
    .optional()
    .isString()
    .withMessage('slipNo must be a string'),
  
  body('passports.*.postDate')
    .optional()
    .isISO8601()
    .withMessage('Post date must be a valid date'),
    
  body('passports.*.issuedCountry')
    .notEmpty()
    .withMessage('Issued country is required')
    .isString()
    .withMessage('Issued country must be a string')
    .isLength({ min: 2, max: 50 })
    .withMessage('Country name must be between 2 and 50 characters'),

  body('passports.*.otherDetails')
    .optional()
    .isString()
    .withMessage('Other details must be a string'),
  
  // Validation handler middleware
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    next();
  }
];

// Helper function to log deleted passport data
const logDeletedPassport = async (passportData, deletedBy) => {
  try {
    const logDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logFile = path.join(logDir, `deleted_passports_${new Date().toISOString().split('T')[0]}.json`);
    
    const logEntry = {
      deletedAt: new Date(),
      deletedBy: deletedBy,
      passportData: passportData
    };

    // Append to log file
    fs.appendFileSync(logFile, JSON.stringify(logEntry, null, 2) + '\n');
    
    console.log(`Deleted passport logged to: ${logFile}`);
  } catch (error) {
    console.error('Error logging deleted passport:', error);
  }
};

// @desc    Create new passport post with multiple passports
// @route   POST /api/v1/passport-posts
// @access  Private
exports.createPassportPost = asyncHandler(async (req, res, next) => {
  // Validate passport entries
  if (!Array.isArray(req.body.passports) || req.body.passports.length === 0) {
    return next(new ErrorResponse('At least one passport entry is required', 400));
  }

  // Add current IST date and time to each passport entry
  const currentIST = getCurrentIST();
  console.log('Setting current IST time:', currentIST);

  const passportsWithDate = req.body.passports.map(passport => {
    // Create new date object for each passport
    const passportDate = new Date(currentIST);
    return {
      ...passport,
      postDate: passportDate
    };
  });

  // Create a new passport post with multiple entries
  const passportPost = await PassportPost.create({
    passports: passportsWithDate,
    createdBy: req.user.id
  });

  console.log('Created passport post with dates:', passportPost.passports.map(p => p.postDate));

  res.status(201).json({
    success: true,
    data: passportPost
  });
});

// @desc    Get all passport posts (visible to everyone)
// @route   GET /api/v1/passport-posts
// @access  Private
exports.getPassportPosts = asyncHandler(async (req, res, next) => {
  // Get all posts without role-based filtering
  const posts = await PassportPost.find()
    .sort('-createdAt')
    .populate({
      path: 'createdBy',
      select: 'fullName email'
    })
    .populate({
      path: 'updatedBy',
      select: 'fullName email'
    });

  res.status(200).json({
    success: true,
    count: posts.length,
    data: posts
  });
});

// @desc    Get single passport post
// @route   GET /api/v1/passport-posts/:id
// @access  Private
exports.getPassportPost = asyncHandler(async (req, res, next) => {
  const post = await PassportPost.findById(req.params.id)
    .populate({
      path: 'createdBy',
      select: 'fullName email'
    })
    .populate({
      path: 'updatedBy',
      select: 'fullName email'
    });

  if (!post) {
    return next(new ErrorResponse(`Post not found with id ${req.params.id}`, 404));
  }

  // Make sure user is post owner or admin
  if (post.createdBy._id.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to access this post', 403));
  }

  res.status(200).json({
    success: true,
    data: post
  });
});

// @desc    Get single passport by ID (within a post)
// @route   GET /api/v1/passport-posts/passport/:passportId
// @access  Private
exports.getSinglePassport = asyncHandler(async (req, res, next) => {
  try {
    const passportId = req.params.passportId;
    console.log("Looking for passport with ID:", passportId);
    
    // Get all posts
    const posts = await PassportPost.find().populate({
      path: 'createdBy',
      select: 'fullName email'
    });
    
    // Variable to track if passport was found
    let foundPassport = null;
    let foundPost = null;
    
    // Search through each post
    for (const post of posts) {
      // Find the passport in this post
      const passport = post.passports.find(p => p._id.toString() === passportId);
      
      if (passport) {
        console.log(`Found passport ${passportId} in post ${post._id}`);
        foundPassport = passport;
        foundPost = post;
        break;
      }
    }
    
    // If passport not found in any post
    if (!foundPassport) {
      console.log("No passport found with ID:", passportId);
      return next(new ErrorResponse(`Passport not found with id ${passportId}`, 404));
    }

    // Make sure user is post owner or admin
    if (foundPost.createdBy._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return next(new ErrorResponse('Not authorized to access this passport', 403));
    }

    // Return the passport with related data
    res.status(200).json({
      success: true,
      data: {
        passport: foundPassport,
        createdBy: foundPost.createdBy,
        postId: foundPost._id
      }
    });
  } catch (error) {
    console.error("Error in getSinglePassport:", error);
    return next(new ErrorResponse("Error retrieving passport: " + error.message, 500));
  }
});

// @desc    Update passport post (all passports in the post)
// @route   PUT /api/v1/passport-posts/:id
// @access  Private

exports.updatePassportPost = asyncHandler(async (req, res, next) => {
  try {
    // First fetch the original post to get existing passports with their timestamps
    let originalPost = await PassportPost.findById(req.params.id);
    
    if (!originalPost) {
      return next(new ErrorResponse(`Post not found with id ${req.params.id}`, 404));
    }
    
    // Make sure user is post owner or admin
    if (originalPost.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return next(new ErrorResponse('Not authorized to update this post', 403));
    }
    
    // Validate that passports array is provided
    if (!req.body.passports || !Array.isArray(req.body.passports) || req.body.passports.length === 0) {
      return next(new ErrorResponse('At least one passport entry is required', 400));
    }
    
    // Create a map of existing passports by their ID for easy lookup
    const existingPassportsMap = {};
    originalPost.passports.forEach(passport => {
      // Store as plain JavaScript object to avoid any Mongoose conversion issues
      existingPassportsMap[passport._id.toString()] = {
        _id: passport._id,
        postDate: new Date(passport.postDate) // Create a new Date object from the original date
      };
    });
    
    // Get current IST for any new passports
    const currentIST = getCurrentIST();
    
    // Process each passport in the request
    const processedPassports = req.body.passports.map(passport => {
      // Check if passport has an ID and it exists in original data
      if (passport._id && existingPassportsMap[passport._id]) {
        const existingPassport = existingPassportsMap[passport._id];
        console.log(`Preserving timestamp for passport ID: ${passport._id}, original date: ${existingPassport.postDate}`);
        
        // IMPORTANT: Create a new object with all request fields EXCEPT postDate
        // Then add back the original postDate
        const { postDate, ...passportUpdates } = passport;
        
        return {
          ...passportUpdates,
          _id: existingPassport._id,
          postDate: existingPassport.postDate // Use the original timestamp
        };
      } else {
        // This is a new passport, assign current time
        console.log('New passport detected, assigning current timestamp');
        return {
          ...passport,
          postDate: new Date(currentIST)
        };
      }
    });
    
    // CRITICAL CHANGE: Use direct document manipulation instead of findByIdAndUpdate
    // This gives us more control over what gets updated
    originalPost.passports = processedPassports;
    originalPost.updatedBy = req.user.id;
    
    // Save the document directly
    await originalPost.save();
    
    // Retrieve the fully populated document
    const updatedPost = await PassportPost.findById(req.params.id)
      .populate({
        path: 'createdBy',
        select: 'fullName email'
      })
      .populate({
        path: 'updatedBy',
        select: 'fullName email'
      });
    
    // Log the updated dates for verification
    console.log('Final passport dates after update:');
    updatedPost.passports.forEach(p => {
      console.log(`ID: ${p._id}, Date: ${p.postDate}`);
    });
    
    res.status(200).json({
      success: true,
      data: updatedPost
    });
  } catch (error) {
    console.error("Error in updatePassportPost:", error);
    return next(new ErrorResponse("Error updating passport post: " + error.message, 500));
  }
});
// @desc    Update single passport within a post
// @route   PUT /api/v1/passport-posts/passport/:passportId
// @access  Private
// exports.updateSinglePassport = asyncHandler(async (req, res, next) => {
//   try {
//     const passportId = req.params.passportId;
//     console.log("Attempting to update passport with ID:", passportId);
    
//     // Find all posts
//     const posts = await PassportPost.find();
    
//     // Variable to track if passport was found
//     let found = false;
    
//     // Loop through each post to find the one containing our passport
//     for (const post of posts) {
//       // Find the passport in this post's array
//       const passportIndex = post.passports.findIndex(
//         p => p._id.toString() === passportId
//       );
      
//       // If passport found in this post
//       if (passportIndex !== -1) {
//         found = true;
//         console.log(`Found passport ${passportId} in post ${post._id}`);
        
//         // Make sure user is post owner or admin
//         if (post.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
//           return next(new ErrorResponse('Not authorized to update this passport', 403));
//         }
        
//         // Get current IST time
//         const currentIST = getCurrentIST();
//         console.log('Setting current IST time for single update:', currentIST);
        
//         // Update the passport fields while preserving the _id and adding current IST date
//         const updatedPassport = {
//           _id: post.passports[passportIndex]._id, // Preserve the original ID
//           ...req.body,
//           postDate: new Date(currentIST) // Create new date object
//         };
        
//         console.log('Updated passport with date:', updatedPassport.postDate);
        
//         // Replace the passport in the array
//         post.passports[passportIndex] = updatedPassport;
        
//         // Set the updatedBy field
//         post.updatedBy = req.user.id;
        
//         // Save the post
//         await post.save();
        
//         // Get the updated post with populated fields
//         const updatedPost = await PassportPost.findById(post._id)
//           .populate({
//             path: 'createdBy',
//             select: 'fullName email'
//           })
//           .populate({
//             path: 'updatedBy',
//             select: 'fullName email'
//           });
        
//         console.log('Updated post with date:', updatedPost.passports[passportIndex].postDate);
        
//         // Return success response
//         res.status(200).json({
//           success: true,
//           data: {
//             post: updatedPost,
//             updatedPassport: updatedPost.passports[passportIndex]
//           }
//         });
        
//         // Exit the function after successful update
//         return;
//       }
//     }
    
//     // If we've gone through all posts and not found the passport
//     if (!found) {
//       console.log(`No passport found with ID: ${passportId}`);
//       return next(new ErrorResponse(`Passport not found with id ${passportId}`, 404));
//     }
//   } catch (error) {
//     console.error("Error in updateSinglePassport:", error);
//     return next(new ErrorResponse("Error updating passport: " + error.message, 500));
//   }
// });






exports.updateSinglePassport = asyncHandler(async (req, res, next) => {
  try {
    const passportId = req.params.passportId;
    console.log("Attempting to update passport with ID:", passportId);
    
    // Find all posts
    const posts = await PassportPost.find();
    
    // Variable to track if passport was found
    let found = false;
    
    // Loop through each post to find the one containing our passport
    for (const post of posts) {
      // Find the passport in this post's array
      const passportIndex = post.passports.findIndex(
        p => p._id.toString() === passportId
      );
      
      // If passport found in this post
      if (passportIndex !== -1) {
        found = true;
        console.log(`Found passport ${passportId} in post ${post._id}`);
        
        // Make sure user is post owner or admin
        if (post.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
          return next(new ErrorResponse('Not authorized to update this passport', 403));
        }
        
        // Get the original passport data
        const originalPassport = post.passports[passportIndex];
        
        // Update the passport fields while preserving the _id AND the original postDate
        const updatedPassport = {
          _id: originalPassport._id, // Preserve the original ID
          ...req.body,
          postDate: originalPassport.postDate // Preserve the original timestamp
        };
        
        console.log('Preserved original post date:', updatedPassport.postDate);
        
        // Replace the passport in the array
        post.passports[passportIndex] = updatedPassport;
        
        // Set the updatedBy field
        post.updatedBy = req.user.id;
        
        // Save the post
        await post.save();
        
        // Get the updated post with populated fields
        const updatedPost = await PassportPost.findById(post._id)
          .populate({
            path: 'createdBy',
            select: 'fullName email'
          })
          .populate({
            path: 'updatedBy',
            select: 'fullName email'
          });
        
        console.log('Updated post with preserved date:', updatedPost.passports[passportIndex].postDate);
        
        // Return success response
        res.status(200).json({
          success: true,
          data: {
            post: updatedPost,
            updatedPassport: updatedPost.passports[passportIndex]
          }
        });
        
        // Exit the function after successful update
        return;
      }
    }
    
    // If we've gone through all posts and not found the passport
    if (!found) {
      console.log(`No passport found with ID: ${passportId}`);
      return next(new ErrorResponse(`Passport not found with id ${passportId}`, 404));
    }
  } catch (error) {
    console.error("Error in updateSinglePassport:", error);
    return next(new ErrorResponse("Error updating passport: " + error.message, 500));
  }
});

// @desc    Delete passport post
// @route   DELETE /api/v1/passport-posts/:id
// @access  Private
exports.deletePassportPost = asyncHandler(async (req, res, next) => {
  const post = await PassportPost.findById(req.params.id);
  
  if (!post) {
    return next(new ErrorResponse(`Post not found with id ${req.params.id}`, 404));
  }

  // Make sure user is post owner or admin
  // if (post.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
  //   return next(new ErrorResponse('Not authorized to delete this post', 403));
  // }

  // Log the passport data before deletion
  await logDeletedPassport(post, req.user.id);

  // Delete the passport post
  await post.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Passport post deleted successfully'
  });
});

// @desc    Delete single passport
// @route   DELETE /api/v1/passport-posts/passport/:passportId
// @access  Private
exports.deleteSinglePassport = asyncHandler(async (req, res, next) => {
  try {
    const passportId = req.params.passportId;
    console.log("Attempting to delete passport with ID:", passportId);
    
    // Find all posts
    const posts = await PassportPost.find();
    
    // Variable to track if passport was found
    let found = false;
    
    // Loop through each post to find the one containing our passport
    for (const post of posts) {
      // Find the passport in this post's array
      const passportIndex = post.passports.findIndex(
        p => p._id.toString() === passportId
      );
      
      // If passport found in this post
      if (passportIndex !== -1) {
        found = true;
        console.log(`Found passport ${passportId} in post ${post._id}`);
        
        // Make sure user is post owner or admin
        // if (post.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
        //   return next(new ErrorResponse('Not authorized to delete this passport', 403));
        // }
        
        // Get the passport to log before deletion
        const passportToDelete = post.passports[passportIndex];
        
        // Log the passport data before deletion
        await logDeletedPassport(passportToDelete, req.user.id);
        
        // If post only has one passport, delete the entire post
        if (post.passports.length === 1) {
          console.log(`Deleting entire post ${post._id} as it has only one passport`);
          await post.deleteOne();
        } else {
          // Otherwise, remove just the specific passport
          console.log(`Removing passport ${passportId} from post ${post._id} which has ${post.passports.length} passports`);
          // Use splice to remove the passport at the found index
          post.passports.splice(passportIndex, 1);
          post.updatedBy = req.user.id;
          await post.save();
        }
        
        res.status(200).json({
          success: true,
          message: 'Passport deleted successfully',
          data: {
            deletedPassport: passportId,
            postId: post._id
          }
        });
        
        // Exit the function after successful deletion
        return;
      }
    }
    
    // If we've gone through all posts and not found the passport
    if (!found) {
      console.log(`No passport found with ID: ${passportId}`);
      return next(new ErrorResponse(`Passport not found with id ${passportId}`, 404));
    }
  } catch (error) {
    console.error("Error in deleteSinglePassport:", error);
    return next(new ErrorResponse("Error deleting passport: " + error.message, 500));
  }
});

// @desc    Delete multiple passports
// @route   DELETE /api/v1/passport-posts/passports
// @access  Private
exports.deleteMultiplePassports = asyncHandler(async (req, res, next) => {
  try {
    const { passportIds } = req.body;
    
    console.log("Received passport IDs for deletion:", passportIds);
    
    if (!passportIds || !Array.isArray(passportIds) || passportIds.length === 0) {
      return next(new ErrorResponse('Please provide an array of passport IDs to delete', 400));
    }

    const deletedPassports = [];
    const errors = [];

    // Process each passport ID
    for (const passportId of passportIds) {
      try {
        console.log(`Processing passport ID: ${passportId}`);
        
        // Find all posts
        const posts = await PassportPost.find();
        let found = false;
        
        // Search through each post manually
        for (const post of posts) {
          // Find the passport in this post
          const passportIndex = post.passports.findIndex(
            p => p._id.toString() === passportId
          );
          
          // If passport found in this post
          if (passportIndex !== -1) {
            found = true;
            console.log(`Found passport ${passportId} in post ${post._id}`);
            
            // Make sure user is post owner or admin
            // if (post.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
            //   console.log(`User not authorized to delete passport ID: ${passportId}`);
            //   errors.push({ id: passportId, message: 'Not authorized to delete this passport' });
            //   continue;
            // }
            
            // Get the passport to log before deletion
            const passportToDelete = post.passports[passportIndex];
            
            // Log the passport data before deletion
            await logDeletedPassport(passportToDelete, req.user.id);
            deletedPassports.push(passportToDelete);

            // If post only has one passport, delete the entire post
            if (post.passports.length === 1) {
              console.log(`Deleting entire post with ID ${post._id} as it has only one passport`);
              await post.deleteOne();
            } else {
              // Otherwise, remove just the specific passport
              console.log(`Removing passport ${passportId} from post ${post._id}`);
              post.passports.splice(passportIndex, 1);
              post.updatedBy = req.user.id;
              await post.save();
            }
            
            // We found and processed the passport, so break the loop
            break;
          }
        }
        
        // If passport not found in any post
        if (!found) {
          console.log(`No post found with passport ID: ${passportId}`);
          errors.push({ id: passportId, message: 'Passport not found' });
        }
      } catch (error) {
        console.error(`Error processing passport ID ${passportId}:`, error);
        errors.push({ id: passportId, message: error.message });
      }
    }

    res.status(200).json({
      success: true,
      message: `${deletedPassports.length} passports deleted successfully`,
      count: deletedPassports.length,
      deleted: deletedPassports.map(p => p._id),
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error("Error in deleteMultiplePassports:", error);
    return next(new ErrorResponse("Error deleting passports: " + error.message, 500));
  }
});

// @desc    Get passports by country
// @route   GET /api/v1/passport-posts/country/:countryName
// @access  Private
exports.getPassportsByCountry = asyncHandler(async (req, res, next) => {
  let query = {
    'passports.issuedCountry': { $regex: new RegExp(req.params.countryName, 'i') }
  };

  // If user is not admin, show only their posts
  if (req.user.role !== 'admin') {
    query.createdBy = req.user.id;
  }

  const posts = await PassportPost.find(query)
    .sort('-createdAt')
    .populate({
      path: 'createdBy',
      select: 'fullName email'
    });

  res.status(200).json({
    success: true,
    count: posts.length,
    data: posts
  });
});