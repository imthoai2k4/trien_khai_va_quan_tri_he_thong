'use strict';

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyTokenAndRole } = require('../middleware/authMiddleware');

// Bảo vệ TẤT CẢ các route trong này: Yêu cầu đăng nhập và có role là 'admin'
router.use(verifyTokenAndRole(['admin']));

router.get('/dashboard', adminController.getDashboardStats);

module.exports = router;
