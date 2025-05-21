const User = require('../models/userSchema');
const PassportPost = require('../models/passportSchema');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get dashboard statistics
// @route   GET /api/v1/dashboard/stats
// @access  Private/Admin
exports.getDashboardStats = asyncHandler(async (req, res, next) => {
  // Only allow admin to access dashboard
  if (req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to access this route', 403));
  }

  // Get total number of regular users
  const totalUsers = await User.countDocuments({ role: 'user' });

  // Get total number of passport posts
  const totalPosts = await PassportPost.countDocuments();

  // Get current date in UTC for consistent date filtering
  const today = new Date();
  const startOfDay = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
    0, 0, 0
  ));
  const endOfDay = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
    23, 59, 59, 999
  ));

  // Get posts created today
  const todayPosts = await PassportPost.countDocuments({
    postDate: {
      $gte: startOfDay,
      $lte: endOfDay
    }
  });

  // Get recent posts (last 7 days)
  const lastWeekStart = new Date(startOfDay);
  lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 7);
  
  const recentPosts = await PassportPost.countDocuments({
    postDate: {
      $gte: lastWeekStart,
      $lte: endOfDay
    }
  });

  // Return the statistics
  res.status(200).json({
    success: true,
    data: {
      totalUsers,
      totalPosts,
      todayPosts,
      recentPosts,
      dateInfo: {
        today: today.toISOString().split('T')[0]
      }
    }
  });
});

// @desc    Get graph data for daily passport posts
// @route   GET /api/v1/dashboard/graph/daily
// @access  Private/Admin
exports.getDailyPostsGraph = asyncHandler(async (req, res, next) => {
  // Only allow admin to access dashboard
  if (req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to access this route', 403));
  }

  // Get query parameters or set defaults
  const days = parseInt(req.query.days) || 30; // Default to last 30 days
  
  // Calculate start and end dates
  const endDate = new Date();
  endDate.setUTCHours(23, 59, 59, 999);
  
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - days);
  startDate.setUTCHours(0, 0, 0, 0);

  // Use MongoDB aggregation to get posts by day
  const dailyPosts = await PassportPost.aggregate([
    // Match documents within the date range
    {
      $match: {
        postDate: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    // Group documents by date
    {
      $group: {
        _id: {
          year: { $year: "$postDate" },
          month: { $month: "$postDate" },
          day: { $dayOfMonth: "$postDate" }
        },
        count: { $sum: 1 }
      }
    },
    // Project the data into a more usable format
    {
      $project: {
        _id: 0,
        date: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: {
              $dateFromParts: {
                year: "$_id.year",
                month: "$_id.month",
                day: "$_id.day"
              }
            }
          }
        },
        count: 1
      }
    },
    // Sort by date
    {
      $sort: { date: 1 }
    }
  ]);

  // Generate a complete date range with zeros for missing dates
  const graphData = [];
  const dateMap = {};

  // Map the results by date for easier access
  dailyPosts.forEach(item => {
    dateMap[item.date] = item.count;
  });

  // Create a complete date range
  for (let i = 0; i < days; i++) {
    const currentDate = new Date(startDate);
    currentDate.setUTCDate(currentDate.getUTCDate() + i);
    
    const dateString = currentDate.toISOString().split('T')[0];
    
    graphData.push({
      date: dateString,
      count: dateMap[dateString] || 0
    });
  }

  res.status(200).json({
    success: true,
    data: {
      range: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        days
      },
      graphData
    }
  });
});

// @desc    Get posts by country for graph
// @route   GET /api/v1/dashboard/graph/countries
// @access  Private/Admin
exports.getCountryDistributionGraph = asyncHandler(async (req, res, next) => {
  // Only allow admin to access dashboard
  if (req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to access this route', 403));
  }

  // Use MongoDB aggregation to get posts by country
  const countryData = await PassportPost.aggregate([
    {
      $group: {
        _id: "$issuedCountry",
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        country: "$_id",
        count: 1
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: 10 // Limit to top 10 countries
    }
  ]);

  res.status(200).json({
    success: true,
    count: countryData.length,
    data: countryData
  });
});

// @desc    Get user registration trend
// @route   GET /api/v1/dashboard/graph/users
// @access  Private/Admin
exports.getUserRegistrationTrend = asyncHandler(async (req, res, next) => {
  // Only allow admin to access dashboard
  if (req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to access this route', 403));
  }

  // Get query parameters or set defaults
  const months = parseInt(req.query.months) || 12; // Default to last 12 months
  
  // Calculate start and end dates
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  
  // Use MongoDB aggregation to get user registrations by month
  const userRegistrations = await User.aggregate([
    {
      $match: {
        role: 'user',
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" }
        },
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        date: {
          $dateToString: {
            format: "%Y-%m",
            date: {
              $dateFromParts: {
                year: "$_id.year",
                month: "$_id.month",
                day: 1
              }
            }
          }
        },
        count: 1
      }
    },
    {
      $sort: { date: 1 }
    }
  ]);

  // Generate a complete month range with zeros for missing months
  const graphData = [];
  const monthMap = {};

  // Map the results by month for easier access
  userRegistrations.forEach(item => {
    monthMap[item.date] = item.count;
  });

  // Create a complete month range
  for (let i = 0; i < months; i++) {
    const currentDate = new Date(startDate);
    currentDate.setMonth(currentDate.getMonth() + i);
    
    const monthString = currentDate.toISOString().substring(0, 7); // YYYY-MM format
    
    graphData.push({
      month: monthString,
      count: monthMap[monthString] || 0
    });
  }

  res.status(200).json({
    success: true,
    data: {
      range: {
        start: startDate.toISOString().substring(0, 7),
        end: endDate.toISOString().substring(0, 7),
        months
      },
      graphData
    }
  });
});

// @desc    Get comprehensive dashboard data
// @route   GET /api/v1/dashboard/all
// @access  Private/Admin
exports.getAllDashboardData = asyncHandler(async (req, res, next) => {
  // Only allow admin to access dashboard
  if (req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to access this route', 403));
  }

  // Get total number of regular users
  const totalUsers = await User.countDocuments({ role: 'user' });

  // Get total number of passport posts
  const totalPosts = await PassportPost.countDocuments();

  // Get current date in UTC for consistent date filtering
  const today = new Date();
  const startOfDay = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
    0, 0, 0
  ));
  const endOfDay = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
    23, 59, 59, 999
  ));

  // Get posts created today
  const todayPosts = await PassportPost.countDocuments({
    postDate: {
      $gte: startOfDay,
      $lte: endOfDay
    }
  });

  // Get 7-day data for graph
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const currentDate = new Date(startOfDay);
    currentDate.setUTCDate(currentDate.getUTCDate() - i);
    
    const nextDate = new Date(currentDate);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    
    const count = await PassportPost.countDocuments({
      postDate: {
        $gte: currentDate,
        $lt: nextDate
      }
    });
    
    last7Days.push({
      date: currentDate.toISOString().split('T')[0],
      count
    });
  }

  // Get country distribution
  const countryData = await PassportPost.aggregate([
    {
      $group: {
        _id: "$issuedCountry",
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        country: "$_id",
        count: 1
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: 5 // Limit to top 5 countries
    }
  ]);

  // Recent users (last 5)
  const recentUsers = await User.find({ role: 'user' })
    .sort('-createdAt')
    .limit(5)
    .select('fullName email createdAt');

  // Recent passport posts (last 5)
  const recentPosts = await PassportPost.find()
    .sort('-postDate')
    .limit(5)
    .populate({
      path: 'createdBy',
      select: 'fullName email'
    });

  // Return the complete dashboard data
  res.status(200).json({
    success: true,
    data: {
      stats: {
        totalUsers,
        totalPosts,
        todayPosts
      },
      dailyChart: {
        labels: last7Days.map(day => day.date),
        data: last7Days.map(day => day.count)
      },
      countryChart: {
        labels: countryData.map(item => item.country),
        data: countryData.map(item => item.count)
      },
      recentUsers,
      recentPosts,
      dateInfo: {
        today: today.toISOString().split('T')[0]
      }
    }
  });
});