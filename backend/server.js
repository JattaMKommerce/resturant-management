const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { initDatabase } = require('./database/init');
const apiRoutes = require('./routes/api');
const { setSocketIO } = require('./services/NotificationService');
const { setSocketIO: setKOTSocketIO, trackUserConnection, trackUserDisconnection } = require('./config/socket');
const { setSocketIOInstance, processDriverLocationUpdate } = require('./services/DriverLocationService');
const { pool, testConnection } = require('./config/db');

// Security & Logging Middleware
const {
  securityHeaders,
  authRateLimiter,
  generalRateLimiter,
  requestCorrelationId,
  requestLogger
} = require('./middleware/security');
const errorHandler = require('./middleware/errorHandler');

const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_hotel_jwt_key_2026';

const app = express();
const server = http.createServer(app);

// ──────────────────────────────────────────────────────────
// 1. CORS CONFIGURATION
// ──────────────────────────────────────────────────────────
const rawOrigins = [
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'https://resturant-management-pied.vercel.app'
].filter(Boolean).join(',');

const allowedOrigins = rawOrigins
  .split(',')
  .map(url => url.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow all browser and non-browser origins to prevent any customer blockage
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-Id',
    'x-request-id',
    'X-Idempotency-Key',
    'x-idempotency-key',
    'X-Guest-Token',
    'x-guest-token',
    'X-Guest-Identity-Token',
    'x-guest-identity-token',
    'X-Requested-With',
    'x-client-platform',
    'Accept',
    'Origin'
  ]
};

// ──────────────────────────────────────────────────────────
// 2. GLOBAL MIDDLEWARE PIPELINE
// ──────────────────────────────────────────────────────────
app.use(securityHeaders);
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(requestCorrelationId);
app.use(requestLogger);
app.use(generalRateLimiter);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static asset uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ──────────────────────────────────────────────────────────
// 3. SOCKET.IO HARDENING & TENANT ROOM AUTHORIZATION
// ──────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: corsOptions,
  transports: ['polling', 'websocket'],
  pingTimeout: 30000,
  pingInterval: 25000
});

setSocketIO(io);
setKOTSocketIO(io);
setSocketIOInstance(io);

// Socket.IO Handshake Authentication Middleware
io.use((socket, next) => {
  try {
    let token = socket.handshake.auth?.token;

    if (!token && socket.handshake.headers?.authorization) {
      const authHeader = socket.handshake.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token && socket.handshake.headers?.cookie) {
      const match = socket.handshake.headers.cookie.match(/(?:^|;\s*)(?:token|hotel_token|jwt)=([^;]+)/);
      if (match) token = match[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.user = decoded;
      } catch (e) {
        // Expired or invalid token -s socket remains unauthenticated/guest
      }
    }
    next();
  } catch (err) {
    next();
  }
});

io.on('connection', (socket) => {
  const userId = socket.user?.id || 'GUEST';
  const userRole = socket.user?.role || 'GUEST';

  if (socket.user) {
    trackUserConnection(socket, socket.user);
  }

  socket.on('disconnect', () => {
    if (socket.user) {
      trackUserDisconnection(socket, socket.user);
    }
  });

  // Room Join Authorization
  socket.on('join_room', (room) => {
    if (!room || typeof room !== 'string') return;

    // 1. Public Order & Customer tracking rooms (Permitted for live tracking)
    if (room.startsWith('order_') || room.startsWith('customer_') || room.startsWith('table_')) {
      socket.join(room);
      return;
    }

    // 2. Super Admin can join any operational room
    if (socket.user?.role === 'SUPER_ADMIN') {
      socket.join(room);
      return;
    }

    // 3. Tenant Admin Rooms: restaurant_${id}_admin or restaurant_admin_${id}
    const adminMatch = room.match(/^restaurant_(?:admin_)?(\d+)(?:_admin)?$/);
    if (adminMatch) {
      const targetRestId = parseInt(adminMatch[1], 10);
      const isAuthorized = socket.user && (
        socket.user.role === 'ADMIN' ||
        socket.user.role === 'RESTAURANT_ADMIN' ||
        socket.user.role === 'MANAGER'
      );

      if (isAuthorized && (!socket.user.restaurant_id || parseInt(socket.user.restaurant_id, 10) === targetRestId)) {
        socket.join(room);
      } else if (!isProduction) {
        socket.join(room); // Permissive in dev
      } else {
        socket.emit('room_error', { message: 'Unauthorized access to restaurant management room.', room });
      }
      return;
    }

    // 4. Waiter & Kitchen Stations
    if (room.includes('waiter') || room === 'waiter') {
      if (['WAITER', 'MANAGER', 'ADMIN', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'].includes(userRole) || !isProduction) {
        socket.join(room);
      } else {
        socket.emit('room_error', { message: 'Unauthorized access to waiter station room.', room });
      }
      return;
    }

    if (room.includes('kitchen') || room === 'kitchen') {
      if (['KITCHEN', 'CHEF', 'MANAGER', 'ADMIN', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'].includes(userRole) || !isProduction) {
        socket.join(room);
      } else {
        socket.emit('room_error', { message: 'Unauthorized access to kitchen display room.', room });
      }
      return;
    }

    // 5. Driver private rooms
    const driverMatch = room.match(/driver_(\d+)/);
    if (driverMatch) {
      const targetDriverId = parseInt(driverMatch[1], 10);
      if (socket.user?.id === targetDriverId || ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(userRole) || !isProduction) {
        socket.join(room);
      } else {
        socket.emit('room_error', { message: 'Unauthorized access to driver communication room.', room });
      }
      return;
    }

    // Default join
    socket.join(room);
  });

  socket.on('leave_room', (room) => {
    if (room) socket.leave(room);
  });

  // Driver GPS Location Streaming
  socket.on('driver_location_update', async (data) => {
    const { userId, latitude, longitude, orderId } = data;
    if (userId && latitude && longitude) {
      try {
        await processDriverLocationUpdate({ userId, latitude, longitude, orderId });
      } catch (err) {
        socket.emit('location_error', { message: err.message });
      }
    } else if (orderId && latitude && longitude) {
      io.to(`order_${orderId}`).emit('driver_location_stream', {
        driverId: data.driverId || 1,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        timestamp: new Date()
      });
    }
  });

  socket.on('disconnect', () => {
    // Clean socket disconnection
  });
});

// ──────────────────────────────────────────────────────────
// 4. HEALTH CHECK ENDPOINTS
// ──────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'OK',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/health/db', async (req, res) => {
  const targetHost = pool.pool?.config?.connectionConfig?.host || 'unknown';
  const targetDb = pool.pool?.config?.connectionConfig?.database || 'unknown';
  try {
    const isHealthy = await testConnection();
    if (isHealthy) {
      return res.status(200).json({
        success: true,
        status: 'OK',
        database: 'CONNECTED',
        host: targetHost,
        db: targetDb,
        timestamp: new Date().toISOString()
      });
    }
    return res.status(503).json({ success: false, status: 'ERROR', database: 'DISCONNECTED', host: targetHost });
  } catch (err) {
    return res.status(503).json({
      success: false,
      status: 'ERROR',
      database: 'UNAVAILABLE',
      targetHost: targetHost,
      error: err.message,
      code: err.code
    });
  }
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Hotel & HMS Restaurant Unified API is healthy and running.'
  });
});

// ──────────────────────────────────────────────────────────
// 5. RESTAURANT & KOT API ROUTES
// ──────────────────────────────────────────────────────────
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
const subscriptionRoutes = require('./routes/subscriptionRoutes');

// Apply stricter rate limiting to auth routes
app.use('/api/auth', authRateLimiter, kotAuthRoutes);
app.use('/api/restaurant/auth', authRateLimiter, kotAuthRoutes);

// Mount SaaS Subscription & Platform Governance Routes (Unblocked for expired renewals)
app.use('/api', subscriptionRoutes);
app.use('/api/v1', subscriptionRoutes);

const kotRouteMap = [
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

const { enforceSubscriptionAccess } = require('./middleware/subscriptionAuth');

for (const [routePath, routerHandler] of kotRouteMap) {
  // Public customer menu and guest tracking are strictly unblocked
  if (routePath.includes('/public')) {
    app.use(routePath, routerHandler);
  } else {
    app.use(routePath, enforceSubscriptionAccess, routerHandler);
  }
}

// Mount Online Store & Platform API Routes
app.use('/api', apiRoutes);
app.use('/api/v1', apiRoutes);

// ──────────────────────────────────────────────────────────
// 6. SPA STATIC SERVING & ROOT HANDLER
// ──────────────────────────────────────────────────────────
const distCandidates = [
  path.join(__dirname, '../dist'),
  path.join(__dirname, '../frontend/dist'),
  path.join(__dirname, 'dist')
];
const frontendDist = distCandidates.find(p => fs.existsSync(p));

if (frontendDist) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/health')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({
      status: 'ONLINE',
      message: '🏨 Grand Palace HMS Unified Restaurant & Hotel API is Live',
      version: '2.0.0',
      timestamp: new Date().toISOString()
    });
  });
}

// ──────────────────────────────────────────────────────────
// 7. CENTRALIZED ERROR HANDLER
// ──────────────────────────────────────────────────────────
app.use(errorHandler);

// ──────────────────────────────────────────────────────────
// 8. SERVER STARTUP & GRACEFUL SHUTDOWN
// ──────────────────────────────────────────────────────────
async function startServer() {
  try {
    await initDatabase();
    console.log(`✅ System database initialized and ready for production requests.`);
  } catch (err) {
    console.error('Database initialization warning/error:', err.message);
  }

  if (typeof(PhusionPassenger) !== 'undefined') {
    server.listen('passenger', () => {
      console.log(`🚀 Hotel Restaurant Backend Server running under Phusion Passenger`);
      console.log(`🛡️  Security headers and rate limiting active`);
      console.log(`🌐 Allowed CORS origins:`, allowedOrigins);
    });
  } else {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Hotel Restaurant Backend Server running on port ${PORT}`);
      console.log(`📡 Socket.IO server bound to 0.0.0.0:${PORT}`);
      console.log(`🛡️  Security headers and rate limiting active`);
      console.log(`🌐 Allowed CORS origins:`, allowedOrigins);
    });
  }
}

let isShuttingDown = false;
async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n🛑 Received ${signal}. Initiating graceful shutdown...`);

  server.close(async () => {
    console.log('  ↳ Closed incoming HTTP & WebSocket server.');

    try {
      io.close();
      console.log('  ↳ Terminated Socket.IO connection manager.');
    } catch (e) { }

    try {
      await pool.end();
      console.log('  ↳ Closed MySQL database connection pool.');
    } catch (e) { }

    console.log('✅ Graceful shutdown completed cleanly.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('⚠️ Forcefully terminating process after 10s timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();
