const express = require('express');
const router = express.Router();
const { 
  getDashboardStats,
  getDailyPostsGraph,
  getCountryDistributionGraph,
  getUserRegistrationTrend,
  getAllDashboardData
} = require('../controllers/dashboardController');

const { protect, authorize } = require('../middleware/authMiddleware');

// Protect all routes and restrict to admin only
router.use(protect);
router.use(authorize('admin'));

// Dashboard routes
router.get('/stats', getDashboardStats);
router.get('/graph/daily', getDailyPostsGraph);
router.get('/graph/countries', getCountryDistributionGraph);
router.get('/graph/users', getUserRegistrationTrend);
router.get('/all', getAllDashboardData);

module.exports = router;