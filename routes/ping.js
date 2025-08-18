// Just a basic sanity check endpoint for now
const express = require('express');
const router = express.Router();
const { pingDatabase, checkTables } = require('../controllers/dbTestController');

// GET /ping - sanity check
router.get('/ping', (req, res) => {
  // If you see this, the server is alive!
  res.json({ message: "pong! (yep, it's working)" });
});

// GET /ping-db - test database connection
router.get('/ping-db', pingDatabase);

// GET /check-tables - see if our tables exist
router.get('/check-tables', checkTables);

module.exports = router;
