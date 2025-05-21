const User = require('../models/userSchema');
const PassportPost = require('../models/passportSchema');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const mongoose = require('mongoose');

// @desc    Get user's dashboard data
// @route   GET /api/v1/user-dashboard
// @access  Private
exports.getUserDashboardData = asyncHandler(async (req, res, next) => {
  // Get user ID from authenticated user
  const userId = req.user.id;
  
  // Get current date in UTC
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

  // Execute all queries in parallel for efficiency
  const [
    totalPosts,
    todayPosts,
    recentPosts,
    countryData,
    monthlyPosts,
    userData
  ] = await Promise.all([
    // Total posts by user
    PassportPost.countDocuments({ createdBy: userId }),
    
    // Posts created today by user
    PassportPost.countDocuments({
      createdBy: userId,
      postDate: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    }),
    
    // Recent posts by user (last 5)
    PassportPost.find({ createdBy: userId })
      .sort('-postDate')
      .limit(5),
    
    // Country distribution of user's posts
    PassportPost.aggregate([
      { $match: { createdBy: new mongoose.Types.ObjectId(userId) } },
      { $group: {
          _id: "$issuedCountry",
          count: { $sum: 1 }
        }
      },
      { $project: {
          _id: 0,
          country: "$_id",
          count: 1
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]),
    
    // Monthly posts for the past 6 months
    PassportPost.aggregate([
      { $match: { createdBy: new mongoose.Types.ObjectId(userId) } },
      { $group: {
          _id: {
            year: { $year: "$postDate" },
            month: { $month: "$postDate" }
          },
          count: { $sum: 1 }
        }
      },
      { $project: {
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
      { $sort: { date: 1 } },
      { $limit: 6 }
    ]),
    
    // User data
    User.findById(userId).select('fullName email mobileNumber createdAt')
  ]);

  // Prepare recent activity data
  const recentActivity = await PassportPost.find({ createdBy: userId })
    .sort('-createdAt')
    .limit(10)
    .select('passportNumber issuedCountry postDate createdAt');

  // Get last 7 days data for daily chart
  const dailyData = [];
  for (let i = 6; i >= 0; i--) {
    const currentDate = new Date();
    currentDate.setDate(currentDate.getDate() - i);
    
    const startDate = new Date(Date.UTC(
      currentDate.getUTCFullYear(),
      currentDate.getUTCMonth(),
      currentDate.getUTCDate(),
      0, 0, 0
    ));
    
    const endDate = new Date(Date.UTC(
      currentDate.getUTCFullYear(),
      currentDate.getUTCMonth(),
      currentDate.getUTCDate(),
      23, 59, 59, 999
    ));

    const count = await PassportPost.countDocuments({
      createdBy: userId,
      postDate: {
        $gte: startDate,
        $lte: endDate
      }
    });

    dailyData.push({
      date: startDate.toISOString().split('T')[0],
      count
    });
  }

  // Calculate activity statistics
  const firstPost = await PassportPost.findOne({ createdBy: userId })
    .sort('createdAt')
    .select('createdAt');

  const accountAge = firstPost 
    ? Math.floor((new Date() - new Date(firstPost.createdAt)) / (1000 * 60 * 60 * 24))
    : 0;

  // Add missing months if some months have no data
  const monthLabels = [];
  const monthCounts = [];
  
  // Get last 6 months
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthLabel = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    monthLabels.push(monthLabel);
    
    // Find the count or default to 0
    const monthData = monthlyPosts.find(m => m.date === monthLabel);
    monthCounts.push(monthData ? monthData.count : 0);
  }

  res.status(200).json({
    success: true,
    data: {
      user: userData,
      stats: {
        totalPosts,
        todayPosts,
        accountAge,
        firstPostDate: firstPost ? firstPost.createdAt : null
      },
      charts: {
        dailyChart: {
          labels: dailyData.map(d => d.date.substring(5)), // MM-DD format
          data: dailyData.map(d => d.count)
        },
        monthlyChart: {
          labels: monthLabels.map(m => m.substring(5)), // MM format
          data: monthCounts
        },
        countryChart: {
          labels: countryData.map(c => c.country),
          data: countryData.map(c => c.count)
        }
      },
      recentPosts,
      recentActivity,
      dateInfo: {
        today: today.toISOString().split('T')[0]
      }
    }
  });
});

// @desc    Get user's quick summary data
// @route   GET /api/v1/user-dashboard/summary
// @access  Private
exports.getUserDashboardSummary = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  
  // Get current date in UTC
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

  // Get yesterday's date
  const yesterday = new Date(startOfDay);
  yesterday.setDate(yesterday.getDate() - 1);
  const startOfYesterday = new Date(Date.UTC(
    yesterday.getUTCFullYear(),
    yesterday.getUTCMonth(),
    yesterday.getUTCDate(),
    0, 0, 0
  ));
  const endOfYesterday = new Date(Date.UTC(
    yesterday.getUTCFullYear(),
    yesterday.getUTCMonth(),
    yesterday.getUTCDate(),
    23, 59, 59, 999
  ));

  // Execute queries in parallel
  const [totalPosts, todayPosts, yesterdayPosts, mostRecentPost] = await Promise.all([
    PassportPost.countDocuments({ createdBy: userId }),
    PassportPost.countDocuments({
      createdBy: userId,
      postDate: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    }),
    PassportPost.countDocuments({
      createdBy: userId,
      postDate: {
        $gte: startOfYesterday,
        $lte: endOfYesterday
      }
    }),
    PassportPost.findOne({ createdBy: userId })
      .sort('-postDate')
      .select('passportNumber issuedCountry postDate')
  ]);

  // Calculate daily change percentage
  let dailyChangePercent = 0;
  if (yesterdayPosts > 0) {
    dailyChangePercent = ((todayPosts - yesterdayPosts) / yesterdayPosts) * 100;
  } else if (todayPosts > 0) {
    dailyChangePercent = 100; // If yesterday was 0 and today has posts, 100% increase
  }

  res.status(200).json({
    success: true,
    data: {
      totalPosts,
      todayPosts,
      dailyChange: {
        percentage: dailyChangePercent.toFixed(1),
        isPositive: dailyChangePercent >= 0
      },
      mostRecentPost,
      date: today.toISOString().split('T')[0]
    }
  });
});

// @desc    Get user's posts by country 
// @route   GET /api/v1/user-dashboard/posts-by-country
// @access  Private
exports.getUserPostsByCountry = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  
  const countryData = await PassportPost.aggregate([
    { $match: { createdBy: new mongoose.Types.ObjectId(userId) } },
    { $group: {
        _id: "$issuedCountry",
        count: { $sum: 1 }
      }
    },
    { $project: {
        _id: 0,
        country: "$_id",
        count: 1
      }
    },
    { $sort: { count: -1 } }
  ]);

  res.status(200).json({
    success: true,
    count: countryData.length,
    data: countryData
  });
});

// @desc    Get user's most active periods
// @route   GET /api/v1/user-dashboard/activity-periods
// @access  Private
exports.getUserActivityPeriods = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  
  // Get activity by hour of day
  const hourlyActivity = await PassportPost.aggregate([
    { $match: { createdBy: new mongoose.Types.ObjectId(userId) } },
    { $group: {
        _id: { $hour: "$postDate" },
        count: { $sum: 1 }
      }
    },
    { $project: {
        _id: 0,
        hour: "$_id",
        count: 1
      }
    },
    { $sort: { hour: 1 } }
  ]);

  // Get activity by day of week
  const weekdayActivity = await PassportPost.aggregate([
    { $match: { createdBy: new mongoose.Types.ObjectId(userId) } },
    { $group: {
        _id: { $dayOfWeek: "$postDate" }, // 1 for Sunday, 2 for Monday, etc.
        count: { $sum: 1 }
      }
    },
    { $project: {
        _id: 0,
        dayOfWeek: "$_id",
        count: 1
      }
    },
    { $sort: { dayOfWeek: 1 } }
  ]);

  // Create a complete array for hours (0-23)
  const completeHourlyActivity = Array.from({ length: 24 }, (_, i) => {
    const existingHour = hourlyActivity.find(h => h.hour === i);
    return {
      hour: i,
      count: existingHour ? existingHour.count : 0
    };
  });

  // Create a complete array for weekdays (1-7)
  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const completeWeekdayActivity = Array.from({ length: 7 }, (_, i) => {
    const existingDay = weekdayActivity.find(d => d.dayOfWeek === i + 1);
    return {
      dayOfWeek: i + 1,
      dayName: weekdayNames[i],
      count: existingDay ? existingDay.count : 0
    };
  });

  res.status(200).json({
    success: true,
    data: {
      hourlyActivity: completeHourlyActivity,
      weekdayActivity: completeWeekdayActivity
    }
  });
});