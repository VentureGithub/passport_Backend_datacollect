const User = require('../models/userSchema');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// @desc    Create admin user
// @route   POST /api/auth/create-admin
// @access  Public
exports.createAdmin = async (req, res) => {
    try {
        // First check if any user exists in the database
        const userCount = await User.countDocuments();
        
        if (userCount > 0) {
            // If users exist, check specifically for admin
            const adminExists = await User.findOne({ role: 'admin' });
            
            if (adminExists) {
                return res.status(400).json({
                    success: false,
                    error: 'Admin already exists, only one admin is allowed'
                });
            }
        }

        // Create new admin user
        const admin = await User.create({
            fullName: req.body.fullName,
            email: req.body.email,
            password: req.body.password,
            mobileNumber: req.body.mobileNumber,
            role: 'admin'
        });

        // Create token
        const token = jwt.sign(
            { id: admin._id },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: process.env.JWT_EXPIRE || '30d' }
        );

        res.status(201).json({
            success: true,
            data: {
                _id: admin._id,
                fullName: admin.fullName,
                email: admin.email,
                mobileNumber: admin.mobileNumber,
                role: admin.role,
                token
            }
        });
    } catch (error) {
        console.error('Admin creation error:', error);
        res.status(400).json({
            success: false,
            error: error.message || 'Error creating admin user'
        });
    }
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
    try {
        const user = await User.create({
            fullName: req.body.fullName,
            email: req.body.email,
            password: req.body.password,
            mobileNumber: req.body.mobileNumber,
            role: 'user'
        });

        // Create token
        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: process.env.JWT_EXPIRE || '30d' }
        );

        res.status(201).json({
            success: true,
            data: {
                _id: user._id,
                fullName: user.fullName,
                email: user.email,
                mobileNumber: user.mobileNumber,
                role: user.role,
                token
            }
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate email & password
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Please provide an email and password'
            });
        }

        // Check for user
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Check if password matches
        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Update last login time
        user.lastLogin = new Date();
        await user.save();

        // Create token
        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: process.env.JWT_EXPIRE || '30d' }
        );

        res.status(200).json({
            success: true,
            data: {
                _id: user._id,
                fullName: user.fullName,
                email: user.email,
                mobileNumber: user.mobileNumber,
                role: user.role,
                lastLogin: user.lastLogin,
                token
            }
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        res.status(200).json({
            success: true,
            data: {
                _id: user._id,
                fullName: user.fullName,
                email: user.email,
                mobileNumber: user.mobileNumber,
                role: user.role
            }
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Update last logout time
        user.lastLogout = new Date();
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Logged out successfully',
            data: {
                lastLogout: user.lastLogout
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || 'Error during logout'
        });
    }
}; 