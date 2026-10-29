if (typeof(PhusionPassenger) !== 'undefined') {
  PhusionPassenger.configure({ autoInstall: false });
}

// Root entry file for Hostinger Node.js Web App deployment
console.log('🚀 [Hostinger Web App] Initializing Hotel Restaurant Backend...');
console.log('📍 __dirname:', __dirname);
console.log('📍 process.cwd():', process.cwd());
console.log('📍 process.env.PORT:', process.env.PORT);
console.log('📍 process.env.NODE_ENV:', process.env.NODE_ENV);
console.log('📍 Node.js version:', process.version);

const path = require('path');
const fs = require('fs');

const backendDir = path.join(__dirname, 'backend');
const backendNodeModules = path.join(backendDir, 'node_modules');
const backendEnvFile = path.join(backendDir, '.env');

console.log('📍 backendDir exists:', fs.existsSync(backendDir));
console.log('📍 backend/.env exists:', fs.existsSync(backendEnvFile));
console.log('📍 backend/node_modules exists:', fs.existsSync(backendNodeModules));

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
  console.log('📍 Changed CWD to:', process.cwd());
}

// Load and start the main backend server
require('./backend/server.js');
