'use strict';

const express = require('express');
const router = express.Router();
const showtimeController = require('../controllers/showtimeController');

router.get('/:id', showtimeController.getShowtimeById);
router.get('/:id/seats', showtimeController.getSeatsForShowtime);

module.exports = router;
