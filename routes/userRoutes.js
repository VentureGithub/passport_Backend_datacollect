const express = require('express');
const router = express.Router();
const { 
  getUsers,
  getUser,
  updateUser,
  toggleUserStatus,
  deleteUser,
  resetUserPassword,
  changeUserPassword,
  checkPasswordChangeAuthorization
} = require('../controllers/userConstroller');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes below are protected and require admin role
router.use(protect);
router.patch('/:id/change-password', 
  checkPasswordChangeAuthorization, 
  changeUserPassword
);
router.use(authorize('admin'));

router.route('/')
  .get(getUsers);

router.route('/:id')
  .get(getUser)
  .put(updateUser)
  .delete(deleteUser);

router.patch('/:id/toggle-status', toggleUserStatus);
router.patch('/:id/reset-password', resetUserPassword);
module.exports = router;
