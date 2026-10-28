// Root entry file for Hostinger Node.js Web App deployment
const path = require('path');
const fs = require('fs');

// Ensure working directory is set to backend folder
const backendDir = path.join(__dirname, 'backend');
if (fs.existsSync(backendDir)) {
  process.chdir(backendDir);
}

// Load and start the main backend server
require('./backend/server.js');
