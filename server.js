// Root entry file for Hostinger Node.js Web App deployment
const path = require('path');
const fs = require('fs');

const backendDir = path.join(__dirname, 'backend');
const backendNodeModules = path.join(backendDir, 'node_modules');

// Ensure module resolver searches backend/node_modules if needed
if (fs.existsSync(backendNodeModules)) {
  module.paths.unshift(backendNodeModules);
  try {
    require('module').globalPaths.unshift(backendNodeModules);
  } catch (e) { }
}

// Ensure working directory is set to backend folder
if (fs.existsSync(backendDir)) {
  process.chdir(backendDir);
}

// Load and start the main backend server
require('./backend/server.js');
