# 🚀 Production Deployment Guide: Hotel & Restaurant Management System (HMS)

This document provides the exact production deployment procedure for deploying the **Hotel & Restaurant Management System** to **Railway** (Backend API + WebSockets + Cloud MySQL) and **Vercel** (Frontend React SPA).

---

## 🏗️ Production Architecture Overview

```
 ┌────────────────────────────────────────────────────────┐
 │                   Vercel Frontend                      │
 │    React 18 + Vite SPA (https://your-domain.vercel.app) │
 └──────────┬─────────────────────────────┬───────────────┘
            │ HTTPS API Calls             │ WSS WebSocket
            ▼                             ▼
 ┌────────────────────────────────────────────────────────┐
 │                   Railway Backend                      │
 │        Node.js + Express + Socket.IO Server            │
 │            (0.0.0.0:$PORT on Railway)                  │
 └──────────┬─────────────────────────────┬───────────────┘
            │ MySQL Pool                  │ Object Storage
            ▼                             ▼
 ┌──────────────────────┐      ┌──────────────────────────┐
 │  Cloud MySQL (DB)    │      │ Cloudflare R2 / AWS S3   │
 │ (Railway MySQL Plugin│      │ (Food Images, Category,  │
 │  or Managed MySQL)   │      │  Rider Documents)        │
 └──────────────────────┘      └──────────────────────────┘
```

---

## 📋 Step 1: Provision Cloud Database (MySQL)

You can provision a managed MySQL database directly in **Railway** or via any cloud MySQL provider:

### Option A: Railway MySQL Plugin (Recommended)
1. In your [Railway Dashboard](https://railway.app/), create a **New Project** (or open your existing project).
2. Click **+ New** ➔ **Database** ➔ **Add MySQL**.
3. Railway will provision a MySQL instance and provide the `DATABASE_URL` (e.g. `mysql://root:password@mysql.railway.internal:3306/railway`).

---

## ⚙️ Step 2: Deploy Backend to Railway

1. In the same Railway project, click **+ New** ➔ **GitHub Repo** ➔ select your `resturant-management` repository.
2. Go to the newly created service **Settings**:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Healthcheck Path**: `/health`
   - **Healthcheck Timeout**: `30`
3. Go to the **Variables** tab and set the required backend environment variables:

### 🔑 Railway Backend Environment Variables Matrix

| Variable | Required | Example / Description |
| :--- | :---: | :--- |
| `NODE_ENV` | **Yes** | `production` |
| `PORT` | Auto | *Automatically provided by Railway* |
| `DATABASE_URL` | **Yes** | `${{MySQL.DATABASE_URL}}` (Use Railway reference or direct MySQL connection URI) |
| `DB_SSL` | **Yes** | `true` |
| `DB_CONNECTION_LIMIT` | No | `15` |
| `FRONTEND_URL` | **Yes** | `https://your-app.vercel.app` *(Your Vercel domain without trailing slash)* |
| `JWT_SECRET` | **Yes** | `a_very_long_secure_random_string_32_chars_minimum` |
| `JWT_EXPIRES_IN` | No | `7d` |
| `RAZORPAY_KEY_ID` | **Yes** | `rzp_live_yourActualKeyId` (or `rzp_test_...`) |
| `RAZORPAY_KEY_SECRET`| **Yes** | `yourActualRazorpayKeySecret` |
| `RAZORPAY_MOCK_MODE` | No | `false` |
| `UPLOAD_STORAGE_PROVIDER` | No | `local` *(or `s3` when Cloudflare R2 / AWS S3 is configured)* |
| `UPLOAD_BUCKET` | Cond. | *Required if UPLOAD_STORAGE_PROVIDER=s3* |
| `UPLOAD_ACCESS_KEY` | Cond. | *Required if UPLOAD_STORAGE_PROVIDER=s3* |
| `UPLOAD_SECRET_KEY` | Cond. | *Required if UPLOAD_STORAGE_PROVIDER=s3* |
| `UPLOAD_ENDPOINT` | Cond. | *Required if UPLOAD_STORAGE_PROVIDER=s3* |
| `GOOGLE_MAPS_API_KEY`| No | *Optional Google Maps API key* |

4. Go to **Networking** in Railway and click **Generate Domain** (e.g. `https://hotel-api-production.up.railway.app`).
5. Verify the health endpoints:
   - `https://hotel-api-production.up.railway.app/health` ➔ `{"success":true,"status":"OK"}`
   - `https://hotel-api-production.up.railway.app/health/db` ➔ `{"success":true,"status":"OK","database":"CONNECTED"}`

---

## 🌐 Step 3: Deploy Frontend to Vercel

1. In your [Vercel Dashboard](https://vercel.com/dashboard), click **Add New...** ➔ **Project**.
2. Select your `resturant-management` repository.
3. Configure the Project Settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add the following client-safe Environment Variables in **Environment Variables**:

### 🔑 Vercel Frontend Environment Variables Matrix

| Variable | Required | Value |
| :--- | :---: | :--- |
| `VITE_API_BASE_URL` | **Yes** | `https://hotel-api-production.up.railway.app/api/v1` |
| `VITE_SOCKET_URL` | **Yes** | `https://hotel-api-production.up.railway.app` |
| `VITE_RAZORPAY_KEY_ID`| **Yes** | `rzp_live_yourActualKeyId` (or test key) |
| `VITE_GOOGLE_MAPS_API_KEY`| No | *Optional Maps Key* |

5. Click **Deploy**. Vercel will build and assign your production domain (`https://resturant-management-pied.vercel.app`).
6. Update the `FRONTEND_URL` on Railway with your exact Vercel URL to complete the CORS handshake!

---

## 🗄️ Step 4: Run Initial Database Migrations & Seeds

On Railway:
1. Open your backend service on Railway.
2. Open the **Deployments** log or open the **Railway CLI / Shell**.
3. During service startup, `initDatabase()` runs automatically:
   - Executes all idempotent table schemas (`schema.sql`).
   - Applies table alter migrations and tenant query optimization indexes.
   - Ensures the default Super Admin user exists (`superadmin@gmail.com`).
4. To run a manual database re-init from Railway shell if needed:
   ```bash
   npm run db:init
   ```

---

## 🔒 Production Security & Verification Checklist

- [x] **No Secrets Exposed**: Frontend bundle only includes `VITE_*` variables.
- [x] **No Localhost in Production**: API calls and WebSockets use environment variables.
- [x] **CORS Locked**: Only allowed origins (`FRONTEND_URL`) can access credentials/cookies.
- [x] **Socket Rooms Scoped**: Sockets authenticate with JWT and verify tenant access before joining rooms.
- [x] **Transactions**: Multi-step operations (order creation, KOT routing, billing settlement, inventory stock) are wrapped in atomic MySQL transactions.
- [x] **Centralized Error Handling**: Stack traces and raw SQL errors are sanitized in production (`NODE_ENV=production`).
- [x] **Graceful Shutdown**: Server cleanly closes HTTP, Socket.IO, and MySQL pool on `SIGTERM`.

---

## 💾 Database Backups & Disaster Recovery

1. **Automated Backups on Railway**:
   - In Railway MySQL, automatic point-in-time daily snapshots are taken.
   - You can export a snapshot directly under the **Backups** tab in Railway.
2. **Manual MySQL Dump (Command Line)**:
   ```bash
   mysqldump -h <DB_HOST> -u <DB_USER> -p<DB_PASSWORD> --ssl-mode=REQUIRED <DB_NAME> > backup_$(date +%Y%m%d).sql
   ```
3. **Restoring a Database**:
   ```bash
   mysql -h <DB_HOST> -u <DB_USER> -p<DB_PASSWORD> --ssl-mode=REQUIRED <DB_NAME> < backup_file.sql
   ```
