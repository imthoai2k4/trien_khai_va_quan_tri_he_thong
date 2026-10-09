'use strict';

const express = require('express');
const router = express.Router();
const movieRoutes = require('./movieRoutes');
const showtimeRoutes = require('./showtimeRoutes');
const bookingRoutes = require('./bookingRoutes');
const paymentRoutes = require('./paymentRoutes');

router.use('/movies', movieRoutes);
router.use('/showtimes', showtimeRoutes);
router.use('/bookings', bookingRoutes);
router.use('/payments', paymentRoutes);

module.exports = router;
