const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');

// Public contact endpoint used by marketing website
router.post('/', contactController.sendContactMessage);

module.exports = router;
export {};

