# 🏨 Hotel & Restaurant Management System (HMS)

> A modern, multi-tenant cloud-ready platform unifying Online Customer Ordering, Dine-In Contactless QR Ordering, Service Waiter Stations, Real-time Kitchen Display Systems (KDS), Delivery Rider Tracking, Billing & Inventory Management.

---

## 🌟 Key Features

- **🌐 Multi-Tenant Online Ordering (`/restaurant/:slug`)**: Custom branded storefronts, item customization, Razorpay checkout, live order tracking.
- **📱 Dine-In QR Table Ordering (`/order/table/:token`)**: Contactless table ordering, digital waiter paging, and one-tap bill requests.
- **⚡ Real-Time Kitchen Display System (KDS) (`/kitchen` & `/kds`)**: Split department ticket routing (Main Kitchen, Bar, Tandoor, Pastry), audible sound chimes, prep timers, item bump bar.
- **🛎️ Handheld Waiter Station (`/waiter/dashboard`)**: Mobile-first floor station with instant hot food ready alerts, customer call notifications, and table management.
- **🛵 Delivery Partner / Rider Portal (`/driver/*` & `/rider/*`)**: Rider onboarding, active deliveries pipeline, GPS location streaming, and proof of delivery.
- **📊 Unified Admin Console (`/admin/:slug` & `/admin/offline/*`)**: Operations center, interactive floor plans, tax invoices, discount vouchers, recipe inventory deduction, expiry audits, reports, and security audit logs.
- **👑 Super Admin Platform Portal (`/super-admin`)**: Multi-restaurant provisioning, tenant activation toggles, subscription controls.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, React Router DOM v6, TailwindCSS 3, Lucide Icons, Socket.IO Client, Leaflet Maps, Axios, QRCode |
| **Backend** | Node.js (CommonJS), Express.js, Socket.IO, MySQL2 (Connection Pooling & Transactions), JWT, BcryptJS, Cookie-Parser, Helmet, Express-Rate-Limit, Razorpay Node SDK, Multer |
| **Database** | Managed Cloud MySQL (with idempotent migrations and tenant indexing) |
| **Cloud Deployment** | **Frontend**: Vercel · **Backend & WebSockets**: Railway · **Storage**: S3 / Cloudflare R2 / Local |

---

## 🚀 Local Development Setup

### 1. Prerequisites
- Node.js (v18+ or v20+)
- MySQL Server (v8.0+)
- npm or yarn

### 2. Clone and Setup Environment Variables
```bash
git clone https://github.com/JattaMKommerce/resturant-management.git
cd resturant-management
```

Copy the example environment files:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Configure your local MySQL credentials in `backend/.env`:
```ini
DB_HOST=localhost
DB_PORT=3306
DB_NAME=hotel_db
DB_USER=root
DB_PASSWORD=your_mysql_password
```

### 3. Initialize Database & Seed Data
```bash
cd backend
npm install
npm run db:init
```

### 4. Run Development Servers

**Run Backend (Port 5000)**:
```bash
cd backend
npm run dev
```

**Run Frontend (Port 5173)**:
```bash
cd frontend
npm install
npm run dev
```

Visit:
- **Frontend App**: `http://localhost:5173`
- **Backend API Health**: `http://localhost:5000/health`
- **Database Health**: `http://localhost:5000/health/db`

---

## 🔐 Default Demo Accounts (Development)

| Role | Email | Password | Portal |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin@gmail.com` | `admin@123` | `/super-admin` |
| **Restaurant Admin** | `admin@hotel.com` | `123456789` | `/admin/grand-palace` |
| **Chef / Kitchen** | `chef@hotel.com` | `123456789` | `/kitchen` |
| **Waiter / Service**| `waiter@hotel.com`| `123456789` | `/waiter/dashboard` |
| **Delivery Rider** | `driver@hotel.com`| `123456789` | `/rider/dashboard` |

---

## ☁️ Production Cloud Deployment

For the complete step-by-step production deployment guide on **Railway** and **Vercel**, please refer to:
👉 **[DEPLOYMENT.md](./DEPLOYMENT.md)**

---

## 🛡️ Multi-Tenant Security & Isolation

- **Zero Client-Trust**: All restaurant IDs and role permissions are resolved strictly on the backend from verified JWT/session identity.
- **Tenant-Scoped Sockets**: Socket.IO rooms (`restaurant_${id}_admin`, `restaurant_${id}_waiter`, `restaurant_${id}_kitchen`, `driver_${id}`) require cryptographic JWT verification and authorization before joining.
- **Atomic Transactions**: Multi-step business operations (Order placement, KOT routing, bill generation, stock deduction) execute inside atomic database transactions.
- **Sanitized Errors**: In production mode (`NODE_ENV=production`), raw SQL queries, stack traces, and internal secrets are suppressed from API responses.

---

## 📄 License
Private & Proprietary - JattaMKommerce Restaurant Management Systems.
