const express = require('express');
const router = express.Router();
const { 
  createPassportPost,
  getPassportPosts,
  getPassportPost,
  getSinglePassport,
  updatePassportPost,
  updateSinglePassport,
  deletePassportPost,
  deleteSinglePassport,
  deleteMultiplePassports,
  getPassportsByCountry,
  validatePassportEntries
} = require('../controllers/passportController');

const { protect } = require('../middleware/authMiddleware');

// Protect all routes - but don't require specific roles
router.use(protect);

// Routes for single passports within posts (must come BEFORE the /:id routes)
router.route('/passport/:passportId')
  .get(getSinglePassport)
  .put(updateSinglePassport)
  .delete(deleteSinglePassport);

// Route for multiple passport deletion
router.route('/passports')
  .delete(deleteMultiplePassports);

// Route for country-specific passports
router.route('/country/:countryName')
  .get(getPassportsByCountry);

// Routes for individual passport posts by ID
router.route('/:id')
  .get(getPassportPost)
  .put(validatePassportEntries, updatePassportPost)
  .delete(deletePassportPost);

// Routes for all passport posts
router.route('/')
  .get(getPassportPosts)
  .post(validatePassportEntries, createPassportPost);

module.exports = router;