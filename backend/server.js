const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const { initDatabase } = require('./database/init');
const apiRoutes = require('./routes/api');
const { setSocketIO } = require('./services/NotificationService');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Dynamic CORS configuration allowing localhost, local network IPs (192.168.x.x), and production domains
const corsOptions = {
  origin: (origin, callback) => {
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS']
};

// Middleware
app.use(cors(corsOptions));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static image uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Socket.IO Setup with Permissive Mobile Cross-Origin
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      callback(null, true);
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    credentials: true
  }
});

setSocketIO(io);

const { setSocketIOInstance, processDriverLocationUpdate } = require('./services/DriverLocationService');
setSocketIOInstance(io);

io.on('connection', (socket) => {
  console.log(`🔌 Socket Client Connected: ${socket.id}`);

  // Join rooms
  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined room: ${room}`);
  });

  socket.on('leave_room', (room) => {
    socket.leave(room);
  });

  // Driver active delivery location stream (Phase 2 canonical pipeline)
  socket.on('driver_location_update', async (data) => {
    const { userId, latitude, longitude, orderId } = data;
    if (userId && latitude && longitude) {
      try {
        await processDriverLocationUpdate({ userId, latitude, longitude, orderId });
      } catch (err) {
        socket.emit('location_error', { message: err.message });
      }
    } else if (orderId && latitude && longitude) {
      // Fallback for legacy broadcast compatibility
      io.to(`order_${orderId}`).emit('driver_location_stream', {
        driverId: data.driverId || 1,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        timestamp: new Date()
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket Client Disconnected: ${socket.id}`);
  });
});

const { setSocketIO: setKOTSocketIO } = require('./config/socket');
setKOTSocketIO(io);

// ══════════════════════════════════════════════════════════
// MOUNT OFFLINE RESTAURANT & KOT API ROUTES
// ══════════════════════════════════════════════════════════
const kotAuthRoutes = require('./routes/kot/authRoutes');
const kotTableRoutes = require('./routes/kot/tableRoutes');
const kotMenuRoutes = require('./routes/kot/menuRoutes');
const kotOrderRoutes = require('./routes/kot/orderRoutes');
const kotRoutes = require('./routes/kot/kotRoutes');
const kotBillingRoutes = require('./routes/kot/billingRoutes');
const kotInventoryRoutes = require('./routes/kot/inventoryRoutes');
const kotReportRoutes = require('./routes/kot/reportRoutes');
const kotAuditRoutes = require('./routes/kot/auditRoutes');
const kotPublicRoutes = require('./routes/kot/publicRoutes');
const kotOperationsRoutes = require('./routes/kot/operationsRoutes');

// Mount under both direct /api/* and /api/restaurant/* for zero conflicts
const kotRouteMap = [
  ['/api/auth', kotAuthRoutes],
  ['/api/restaurant/auth', kotAuthRoutes],
  ['/api/tables', kotTableRoutes],
  ['/api/restaurant/tables', kotTableRoutes],
  ['/api/menu', kotMenuRoutes],
  ['/api/restaurant/menu', kotMenuRoutes],
  ['/api/orders', kotOrderRoutes],
  ['/api/restaurant/orders', kotOrderRoutes],
  ['/api/kots', kotRoutes],
  ['/api/restaurant/kots', kotRoutes],
  ['/api/billing', kotBillingRoutes],
  ['/api/restaurant/billing', kotBillingRoutes],
  ['/api/inventory', kotInventoryRoutes],
  ['/api/restaurant/inventory', kotInventoryRoutes],
  ['/api/reports', kotReportRoutes],
  ['/api/restaurant/reports', kotReportRoutes],
  ['/api/audit-logs', kotAuditRoutes],
  ['/api/restaurant/audit-logs', kotAuditRoutes],
  ['/api/public', kotPublicRoutes],
  ['/api/restaurant/public', kotPublicRoutes],
  ['/api/operations', kotOperationsRoutes],
  ['/api/restaurant/operations', kotOperationsRoutes],
];

for (const [routePath, routerHandler] of kotRouteMap) {
  app.use(routePath, routerHandler);
}

// Mount API Online Hotel & Restaurant Routes
app.use('/api', apiRoutes);
app.use('/api/v1', apiRoutes);

// Health & Root Status Endpoints
app.get('/', (req, res) => {
  res.json({
    status: 'ONLINE',
    message: '🏨 Grand Palace HMS Unified Restaurant & Hotel API is Live',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Hotel Restaurant API Server Running', timestamp: new Date() });
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Hotel & HMS Restaurant Unified API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
});

// Start Server
async function startServer() {
  server.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Hotel Restaurant Backend Server running on port ${PORT}`);
    console.log(`📡 Socket.IO server initialized`);
    console.log(`📁 Static uploads folder: ${path.join(__dirname, 'uploads')}`);

    try {
      await initDatabase();
      console.log(`✅ System database initialized and ready for production requests.`);
    } catch (err) {
      console.error('Database initialization warning/error:', err);
    }
  });
}

startServer();
