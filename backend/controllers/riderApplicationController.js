const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { getConnection, query } = require('../config/db');
const { validateRestaurantAccess } = require('../middleware/auth');
const { getRelativeFilePath } = require('../middleware/riderUpload');

/**
 * Helper to log audit trail
 */
async function createAuditLog(actorId, actorRole, action, entityType, entityId, metadata = {}, conn = null) {
  try {
    const executeQuery = conn ? conn.query.bind(conn) : query;
    await executeQuery(
      `INSERT INTO audit_trail (actor_id, actor_role, action, entity_type, entity_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [actorId || null, actorRole || 'SYSTEM', action, entityType, entityId || null, JSON.stringify(metadata)]
    );
  } catch (err) {
    console.error('Audit Log Error:', err.message);
  }
}

/**
 * 1. PUBLIC: Submit Rider Application
 * Includes multi-file upload for Selfie, Aadhaar, Driving License.
 */
async function submitApplication(req, res) {
  try {
    const {
      restaurantId, fullName, mobile, email, dateOfBirth,
      homeCity, currentCity, currentAddress, emergencyContact,
      vehicleType, vehicleNumber, password
    } = req.body;

    if (!restaurantId || !fullName || !mobile || !email || !vehicleType) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant ID, Full Name, Mobile, Email, and Vehicle Type are required.'
      });
    }

    // Server-side restaurant validation
    const [restaurant] = await query(
      'SELECT id, name, status, accepts_rider_applications FROM restaurants WHERE id = ?',
      [restaurantId]
    );

    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Selected restaurant does not exist.' });
    }

    if (restaurant.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'This restaurant is not currently active.' });
    }

    if (restaurant.accepts_rider_applications !== 1) {
      return res.status(400).json({ success: false, message: 'This restaurant is not currently accepting delivery partner applications.' });
    }

    // Check duplicate PENDING/UNDER_REVIEW applications for same mobile/email + restaurant
    const existing = await query(
      `SELECT id, application_status FROM rider_applications
       WHERE restaurant_id = ? AND (mobile = ? OR email = ?) AND application_status IN ('PENDING', 'UNDER_REVIEW')`,
      [restaurantId, mobile.trim(), email.trim().toLowerCase()]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active application under review for this restaurant.'
      });
    }

    const files = req.files || {};
    // Ensure selfie is present
    if (!files.selfie || files.selfie.length === 0) {
      return res.status(400).json({ success: false, message: 'Selfie photo is required.' });
    }

    const conn = await getConnection();
    try {
      await conn.beginTransaction();

      // Create application record
      const [appRes] = await conn.query(
        `INSERT INTO rider_applications (
          restaurant_id, full_name, mobile, email, date_of_birth,
          home_city, current_city, current_address, emergency_contact,
          vehicle_type, vehicle_number, application_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        [
          restaurantId, fullName.trim(), mobile.trim(), email.trim().toLowerCase(),
          dateOfBirth || null, homeCity || null, currentCity || null,
          currentAddress || null, emergencyContact || null,
          vehicleType, vehicleNumber || null
        ]
      );

      const applicationId = appRes.insertId;

      // Process uploaded document files
      const documentEntries = [];
      const docTypeKeys = [
        'selfie', 'aadhaar_front', 'aadhaar_back',
        'driving_license_front', 'driving_license_back',
        'pan', 'vehicle_rc', 'insurance'
      ];

      for (const key of docTypeKeys) {
        if (files[key] && files[key].length > 0) {
          const file = files[key][0];
          const docType = key.toUpperCase();
          const relPath = getRelativeFilePath(file.path);

          const [docRes] = await conn.query(
            `INSERT INTO rider_documents (
              application_id, document_type, file_path, original_file_name, mime_type, file_size, verification_status
            ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
            [applicationId, docType, relPath, file.originalname, file.mimetype, file.size]
          );

          documentEntries.push({ id: docRes.insertId, type: docType, path: relPath });
        }
      }

      await conn.commit();

      await createAuditLog(null, 'GUEST_RIDER', 'SUBMIT_APPLICATION', 'rider_applications', applicationId, {
        restaurantId, fullName, mobile, email, documentCount: documentEntries.length
      });

      res.status(201).json({
        success: true,
        message: 'Your delivery partner application has been submitted successfully! The restaurant team will review it shortly.',
        applicationId,
        restaurantName: restaurant.name,
        submittedAt: new Date()
      });

    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

  } catch (err) {
    console.error('submitApplication Error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error submitting application.' });
  }
}

/**
 * 2. PUBLIC: Check Application Status by ID & Mobile
 */
async function checkApplicationStatus(req, res) {
  try {
    const { id } = req.params;
    const { mobile } = req.query;

    if (!mobile) {
      return res.status(400).json({ success: false, message: 'Mobile number query parameter is required for verification.' });
    }

    const [app] = await query(
      `SELECT a.*, r.name as restaurant_name, r.slug as restaurant_slug
       FROM rider_applications a
       JOIN restaurants r ON a.restaurant_id = r.id
       WHERE a.id = ? AND a.mobile = ?`,
      [id, mobile.trim()]
    );

    if (!app) {
      return res.status(404).json({ success: false, message: 'Application not found or mobile mismatch.' });
    }

    res.json({
      success: true,
      application: {
        id: app.id,
        restaurantName: app.restaurant_name,
        restaurantSlug: app.restaurant_slug,
        fullName: app.full_name,
        mobile: app.mobile,
        vehicleType: app.vehicle_type,
        vehicleNumber: app.vehicle_number,
        status: app.application_status,
        rejectionReason: app.application_status === 'REJECTED' ? app.rejection_reason : null,
        submittedAt: app.submitted_at,
        reviewedAt: app.reviewed_at
      }
    });
  } catch (err) {
    console.error('checkApplicationStatus Error:', err);
    res.status(500).json({ success: false, message: 'Server error checking application status.' });
  }
}

/**
 * 3. ADMIN: Get Rider Applications (Restaurant-Isolated)
 */
async function getAdminApplications(req, res) {
  try {
    const { status, search, restaurant_id } = req.query;
    const restId = req.adminRestaurantId;

    if (!restId && !req.isSuperAdmin && (!req.adminRestaurantIds || req.adminRestaurantIds.length === 0)) {
      return res.status(403).json({ success: false, message: 'No restaurant assigned.' });
    }

    let sql = `
      SELECT a.*, r.name as restaurant_name
      FROM rider_applications a
      JOIN restaurants r ON a.restaurant_id = r.id
    `;
    const params = [];
    const wheres = [];

    if (!req.isSuperAdmin) {
      if (req.adminRestaurantIds && req.adminRestaurantIds.length > 0) {
        const placeholders = req.adminRestaurantIds.map(() => '?').join(',');
        wheres.push(`a.restaurant_id IN (${placeholders})`);
        params.push(...req.adminRestaurantIds);
      } else if (restId) {
        wheres.push('a.restaurant_id = ?');
        params.push(restId);
      }
    } else if (restaurant_id) {
      wheres.push('a.restaurant_id = ?');
      params.push(restaurant_id);
    }

    if (status) {
      wheres.push('a.application_status = ?');
      params.push(status);
    }

    if (search) {
      wheres.push('(a.full_name LIKE ? OR a.mobile LIKE ? OR a.email LIKE ? OR a.vehicle_number LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    if (wheres.length > 0) sql += ' WHERE ' + wheres.join(' AND ');
    sql += ` ORDER BY a.created_at DESC`;

    const applications = await query(sql, params);
    res.json({ success: true, count: applications.length, applications });
  } catch (err) {
    console.error('getAdminApplications Error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving applications.' });
  }
}

/**
 * 4. ADMIN: Get Application Detail with Document Metadata
 */
async function getAdminApplicationById(req, res) {
  try {
    const { id } = req.params;

    const [app] = await query(
      `SELECT a.*, r.name as restaurant_name
       FROM rider_applications a
       JOIN restaurants r ON a.restaurant_id = r.id
       WHERE a.id = ?`,
      [id]
    );

    if (!app) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    // Enforce restaurant access
    if (!validateRestaurantAccess(app.restaurant_id, req)) {
      return res.status(403).json({ success: false, message: 'Access denied to this restaurant application.' });
    }

    const documents = await query(
      `SELECT id, document_type, original_file_name, mime_type, file_size, verification_status, created_at
       FROM rider_documents
       WHERE application_id = ?`,
      [app.id]
    );

    res.json({
      success: true,
      application: { ...app, documents }
    });
  } catch (err) {
    console.error('getAdminApplicationById Error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving application details.' });
  }
}

/**
 * 5. ADMIN: Approve Application (ATOMIC TRANSACTIONAL)
 * Approves application -> creates User -> creates Driver -> creates Driver Restaurant Assignment -> sets credentials
 */
async function approveApplication(req, res) {
  try {
    const { id } = req.params;
    const { initialPassword } = req.body;
    const adminUserId = req.user.id;

    const [app] = await query('SELECT * FROM rider_applications WHERE id = ?', [id]);
    if (!app) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    if (!validateRestaurantAccess(app.restaurant_id, req)) {
      return res.status(403).json({ success: false, message: 'Access denied to this restaurant application.' });
    }

    if (app.application_status === 'APPROVED') {
      return res.status(400).json({ success: false, message: 'Application is already approved.' });
    }

    const pwd = initialPassword || 'driver123';
    const conn = await getConnection();

    try {
      await conn.beginTransaction();

      // a) Get or Create User account with DRIVER role
      let userId;
      const [existingUsers] = await conn.query('SELECT id FROM users WHERE email = ?', [app.email]);

      if (existingUsers.length > 0) {
        userId = existingUsers[0].id;
        await conn.query(
          `UPDATE users SET role = 'DRIVER', status = 'ACTIVE' WHERE id = ?`,
          [userId]
        );
      } else {
        const pwdHash = await bcrypt.hash(pwd, 10);
        const [userRes] = await conn.query(
          `INSERT INTO users (name, email, password_hash, plain_password, phone, role, status)
           VALUES (?, ?, ?, ?, ?, 'DRIVER', 'ACTIVE')`,
          [app.full_name, app.email, pwdHash, pwd, app.mobile]
        );
        userId = userRes.insertId;
      }

      // b) Get or Create Delivery Driver profile
      let driverId;
      const [existingDrivers] = await conn.query('SELECT id FROM delivery_drivers WHERE user_id = ?', [userId]);

      // Get selfie document path
      const [selfieDocs] = await conn.query(
        `SELECT file_path FROM rider_documents WHERE application_id = ? AND document_type = 'SELFIE'`,
        [app.id]
      );
      const selfiePath = selfieDocs.length > 0 ? selfieDocs[0].file_path : null;

      if (existingDrivers.length > 0) {
        driverId = existingDrivers[0].id;
        await conn.query(
          `UPDATE delivery_drivers SET
            full_name = ?, mobile = ?, email = ?, date_of_birth = ?,
            home_city = ?, current_city = ?, current_address = ?, emergency_contact = ?,
            vehicle_type = ?, vehicle_number = ?, selfie_path = COALESCE(?, selfie_path),
            account_status = 'ACTIVE', approval_status = 'APPROVED'
           WHERE id = ?`,
          [
            app.full_name, app.mobile, app.email, app.date_of_birth,
            app.home_city, app.current_city, app.current_address, app.emergency_contact,
            app.vehicle_type, app.vehicle_number || 'TEMP-000', selfiePath,
            driverId
          ]
        );
      } else {
        const [driverRes] = await conn.query(
          `INSERT INTO delivery_drivers (
            user_id, full_name, mobile, email, date_of_birth,
            home_city, current_city, current_address, emergency_contact,
            vehicle_type, vehicle_number, selfie_path, account_status, availability_status, approval_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 'OFFLINE', 'APPROVED')`,
          [
            userId, app.full_name, app.mobile, app.email, app.date_of_birth,
            app.home_city, app.current_city, app.current_address, app.emergency_contact,
            app.vehicle_type, app.vehicle_number || 'TEMP-000', selfiePath
          ]
        );
        driverId = driverRes.insertId;
      }

      // c) Create driver_restaurant_assignments entry
      await conn.query(
        `INSERT INTO driver_restaurant_assignments (driver_id, restaurant_id, application_id, status, approved_by)
         VALUES (?, ?, ?, 'ACTIVE', ?)
         ON DUPLICATE KEY UPDATE status = 'ACTIVE', approved_by = ?, approved_at = NOW()`,
        [driverId, app.restaurant_id, app.id, adminUserId, adminUserId]
      );

      // d) Link application to rider_id & set status APPROVED
      await conn.query(
        `UPDATE rider_applications SET
          application_status = 'APPROVED', rider_id = ?, reviewed_by = ?, reviewed_at = NOW()
         WHERE id = ?`,
        [driverId, adminUserId, app.id]
      );

      // e) Update rider_documents linked rider_id
      await conn.query(
        `UPDATE rider_documents SET rider_id = ?, verification_status = 'VERIFIED' WHERE application_id = ?`,
        [driverId, app.id]
      );

      await conn.commit();

      await createAuditLog(adminUserId, 'RESTAURANT_ADMIN', 'APPROVE_RIDER_APPLICATION', 'rider_applications', app.id, {
        riderId: driverId, userId, restaurantId: app.restaurant_id, email: app.email
      });

      res.json({
        success: true,
        message: `Rider application for "${app.full_name}" has been approved! Driver account created/activated.`,
        credentials: {
          email: app.email,
          temporaryPassword: pwd
        },
        driverId,
        userId
      });

    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

  } catch (err) {
    console.error('approveApplication Error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error approving application.' });
  }
}

/**
 * 6. ADMIN: Reject Application
 */
async function rejectApplication(req, res) {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const adminUserId = req.user.id;

    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
    }

    const [app] = await query('SELECT * FROM rider_applications WHERE id = ?', [id]);
    if (!app) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    if (!validateRestaurantAccess(app.restaurant_id, req)) {
      return res.status(403).json({ success: false, message: 'Access denied to this restaurant application.' });
    }

    await query(
      `UPDATE rider_applications SET
        application_status = 'REJECTED', rejection_reason = ?, reviewed_by = ?, reviewed_at = NOW()
       WHERE id = ?`,
      [rejectionReason.trim(), adminUserId, id]
    );

    await createAuditLog(adminUserId, 'RESTAURANT_ADMIN', 'REJECT_RIDER_APPLICATION', 'rider_applications', id, {
      rejectionReason: rejectionReason.trim()
    });

    res.json({
      success: true,
      message: `Application for "${app.full_name}" has been rejected.`,
      applicationId: id
    });
  } catch (err) {
    console.error('rejectApplication Error:', err);
    res.status(500).json({ success: false, message: 'Server error rejecting application.' });
  }
}

/**
 * 7. ADMIN / AUTHORIZED: Stream Sensitive Rider Document
 * Prevents public direct URLs. Enforces auth & restaurant isolation.
 */
async function streamDocument(req, res) {
  try {
    const { riderId, documentId } = req.params;

    const [doc] = await query(
      `SELECT d.*, a.restaurant_id
       FROM rider_documents d
       JOIN rider_applications a ON d.application_id = a.id
       WHERE d.id = ? AND (d.rider_id = ? OR d.application_id IS NOT NULL)`,
      [documentId, riderId]
    );

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    // Auth & restaurant access check
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const isSuper = req.user.role === 'SUPER_ADMIN';
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'RESTAURANT_ADMIN';
    const isOwnerDriver = req.user.role === 'DRIVER' && req.user.id;

    if (!isSuper && !isAdmin && !isOwnerDriver) {
      return res.status(403).json({ success: false, message: 'Access denied to rider document.' });
    }

    if (isAdmin && !validateRestaurantAccess(doc.restaurant_id, req)) {
      return res.status(403).json({ success: false, message: 'Access denied: document belongs to another restaurant.' });
    }

    // Resolve file path safely
    const absolutePath = path.resolve(__dirname, '..', doc.file_path);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ success: false, message: 'File missing from server storage.' });
    }

    res.setHeader('Content-Type', doc.mime_type || 'image/jpeg');
    res.setHeader('Content-Disposition', `inline; filename="${doc.original_file_name || 'document'}"`);
    fs.createReadStream(absolutePath).pipe(res);

  } catch (err) {
    console.error('streamDocument Error:', err);
    res.status(500).json({ success: false, message: 'Server error streaming document.' });
  }
}

/**
 * 8. ADMIN: Verify / Reject Specific Document
 */
async function verifyDocument(req, res) {
  try {
    const { documentId } = req.params;
    const { status } = req.body; // 'VERIFIED' or 'REJECTED'
    const adminUserId = req.user.id;

    if (!['VERIFIED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be VERIFIED or REJECTED.' });
    }

    const [doc] = await query(
      `SELECT d.*, a.restaurant_id FROM rider_documents d JOIN rider_applications a ON d.application_id = a.id WHERE d.id = ?`,
      [documentId]
    );

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    if (!validateRestaurantAccess(doc.restaurant_id, req)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    await query(
      `UPDATE rider_documents SET verification_status = ?, verified_by = ?, verified_at = NOW() WHERE id = ?`,
      [status, adminUserId, documentId]
    );

    res.json({ success: true, message: `Document verification status updated to ${status}.` });
  } catch (err) {
    console.error('verifyDocument Error:', err);
    res.status(500).json({ success: false, message: 'Server error updating document status.' });
  }
}

module.exports = {
  submitApplication,
  checkApplicationStatus,
  getAdminApplications,
  getAdminApplicationById,
  approveApplication,
  rejectApplication,
  streamDocument,
  verifyDocument
};
