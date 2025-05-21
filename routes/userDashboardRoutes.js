const express = require('express');
const router = express.Router();
const { 
  getUserDashboardData,
  getUserDashboardSummary,
  getUserPostsByCountry,
  getUserActivityPeriods
} = require('../controllers/userDashboardController');
const { protect } = require('../middleware/authMiddleware');

// Protect all routes - regular users can access their own dashboard
router.use(protect);

// User dashboard routes
router.get('/', getUserDashboardData);
router.get('/summary', getUserDashboardSummary);
router.get('/posts-by-country', getUserPostsByCountry);
router.get('/activity-periods', getUserActivityPeriods);

module.exports = router;