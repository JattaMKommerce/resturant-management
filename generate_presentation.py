import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

def create_deck():
    prs = Presentation()
    # 16:9 Widescreen dimensions
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Color Palette
    BG_DARK = RGBColor(15, 23, 42)       # Slate 900
    BG_CARD = RGBColor(30, 41, 59)       # Slate 800
    BG_LIGHT_CARD = RGBColor(51, 65, 85) # Slate 700
    TEXT_LIGHT = RGBColor(248, 250, 252) # Slate 50
    TEXT_MUTED = RGBColor(148, 163, 184) # Slate 400
    ACCENT_EMERALD = RGBColor(16, 185, 129) # Emerald 500
    ACCENT_BLUE = RGBColor(59, 130, 246)    # Blue 500
    ACCENT_AMBER = RGBColor(245, 158, 11)   # Amber 500
    ACCENT_PURPLE = RGBColor(168, 85, 247)  # Purple 500
    BORDER_COLOR = RGBColor(71, 85, 105)

    def set_slide_background(slide, color=BG_DARK):
        background = slide.background
        fill = background.fill
        fill.solid()
        fill.fore_color.rgb = color

    def add_header(slide, title_text, category_text="HOTEL & RESTAURANT MANAGEMENT SYSTEM"):
        # Category Tag
        cat_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.5), Inches(0.4))
        tf_cat = cat_box.text_frame
        tf_cat.word_wrap = True
        tf_cat.margin_left = tf_cat.margin_top = tf_cat.margin_right = tf_cat.margin_bottom = 0
        p_cat = tf_cat.paragraphs[0]
        p_cat.text = category_text.upper()
        p_cat.font.size = Pt(11)
        p_cat.font.bold = True
        p_cat.font.color.rgb = ACCENT_EMERALD

        # Title
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.75), Inches(11.5), Inches(0.7))
        tf_title = title_box.text_frame
        tf_title.word_wrap = True
        tf_title.margin_left = tf_title.margin_top = tf_title.margin_right = tf_title.margin_bottom = 0
        p_title = tf_title.paragraphs[0]
        p_title.text = title_text
        p_title.font.size = Pt(24)
        p_title.font.bold = True
        p_title.font.color.rgb = TEXT_LIGHT

    def add_card(slide, left, top, width, height, title, items, badge="", accent=ACCENT_BLUE):
        # Card shape
        shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        shape.fill.solid()
        shape.fill.fore_color.rgb = BG_CARD
        shape.line.color.rgb = BORDER_COLOR
        shape.line.width = Pt(1)

        # Header box inside card
        tb = slide.shapes.add_textbox(left + Inches(0.25), top + Inches(0.2), width - Inches(0.5), Inches(0.5))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
        p = tf.paragraphs[0]
        p.text = title
        p.font.size = Pt(16)
        p.font.bold = True
        p.font.color.rgb = accent

        if badge:
            p_badge = tf.add_paragraph()
            p_badge.text = badge.upper()
            p_badge.font.size = Pt(9)
            p_badge.font.bold = True
            p_badge.font.color.rgb = ACCENT_AMBER

        # Items box
        content_top = top + Inches(0.75) if not badge else top + Inches(0.95)
        content_height = height - (content_top - top) - Inches(0.2)
        tb_content = slide.shapes.add_textbox(left + Inches(0.25), content_top, width - Inches(0.5), content_height)
        tf_content = tb_content.text_frame
        tf_content.word_wrap = True
        tf_content.margin_left = tf_content.margin_top = tf_content.margin_right = tf_content.margin_bottom = 0

        for i, item in enumerate(items):
            p_item = tf_content.paragraphs[0] if i == 0 else tf_content.add_paragraph()
            p_item.text = f"• {item}"
            p_item.font.size = Pt(12)
            p_item.font.color.rgb = TEXT_LIGHT
            p_item.space_after = Pt(6)

    # =========================================================================
    # SLIDE 1: Title Slide
    # =========================================================================
    slide1 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide1)

    # Accent decorative bar
    bar = slide1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.5), Inches(0.15), Inches(4.2))
    bar.fill.solid()
    bar.fill.fore_color.rgb = ACCENT_EMERALD
    bar.line.fill.background()

    tb1 = slide1.shapes.add_textbox(Inches(1.2), Inches(1.4), Inches(11), Inches(4.5))
    tf1 = tb1.text_frame
    tf1.word_wrap = True

    p = tf1.paragraphs[0]
    p.text = "CLOUD-READY MULTI-TENANT"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = ACCENT_EMERALD

    p = tf1.add_paragraph()
    p.text = "Hotel & Restaurant Management Platform"
    p.font.size = Pt(38)
    p.font.bold = True
    p.font.color.rgb = TEXT_LIGHT
    p.space_after = Pt(12)

    p = tf1.add_paragraph()
    p.text = "Next-Gen Unified Ecosystem for Contactless QR Ordering, Real-Time KDS, Floor Waiters, Driver Dispatch, Offline POS & Multi-Tenant SaaS Governance"
    p.font.size = Pt(16)
    p.font.color.rgb = TEXT_MUTED
    p.space_after = Pt(28)

    p = tf1.add_paragraph()
    p.text = "Full Stack Architecture: React 18 · Node.js · Express · Socket.IO · MySQL · Leaflet · Razorpay"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = ACCENT_BLUE

    slide1.notes_slide.notes_text_frame.text = (
        "Welcome everyone. Today I'm presenting our comprehensive Hotel & Restaurant Management System (HMS). "
        "This project bridges front-of-house customer interactions, real-time kitchen operations, "
        "delivery driver tracking, and multi-tenant administrative controls in one modern web platform."
    )

    # =========================================================================
    # SLIDE 2: Executive Summary & Project Background
    # =========================================================================
    slide2 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide2)
    add_header(slide2, "Executive Overview: Transforming Hospitality Operations")

    add_card(slide2, Inches(0.8), Inches(1.6), Inches(3.7), Inches(5.2),
             "Industry Challenges",
             ["High Aggregator Commissions (20-30% loss to 3rd party apps)",
              "Siloed Systems: POS, KOT printing & delivery are disconnected",
              "Slow service & order errors during peak hours",
              "No unified view for multi-branch franchise owners"],
             "The Problem", ACCENT_AMBER)

    add_card(slide2, Inches(4.8), Inches(1.6), Inches(3.7), Inches(5.2),
             "Our Solution",
             ["Unified Multi-Tenant Platform with branded storefronts",
              "Contactless QR Table Ordering with live status & bell paging",
              "Real-time WebSocket KDS with audio cues & ticket bumping",
              "In-house Rider Dispatch with live GPS tracking & salary ledger"],
             "The Innovation", ACCENT_EMERALD)

    add_card(slide2, Inches(8.8), Inches(1.6), Inches(3.7), Inches(5.2),
             "Business Impact",
             ["0% Commission on direct customer orders",
              "35% Faster table turnaround & instant KOT routing",
              "Zero paper waste with digital Kitchen Bump Bars",
              "Complete control over staff, finances & inventory audit logs"],
             "Measurable Value", ACCENT_BLUE)

    slide2.notes_slide.notes_text_frame.text = (
        "Traditional restaurants struggle with disjointed systems. Our platform provides a single source of truth, "
        "eliminating expensive aggregator fees and synchronizing orders in real time via WebSockets."
    )

    # =========================================================================
    # SLIDE 3: System Architecture & Technology Stack
    # =========================================================================
    slide3 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide3)
    add_header(slide3, "System Architecture & Modern Tech Stack")

    add_card(slide3, Inches(0.8), Inches(1.6), Inches(3.7), Inches(5.2),
             "Frontend Layer",
             ["React 18 & Vite for sub-second build & render times",
              "TailwindCSS 3 responsive mobile-first UI",
              "Socket.IO Client for real-time bidirectional events",
              "Leaflet.js for interactive live rider GPS map tracking",
              "Audio Web API for audible KDS order alerts",
              "Lucide React Icons & dynamic QR token generator"],
             "Client Experience", ACCENT_BLUE)

    add_card(slide3, Inches(4.8), Inches(1.6), Inches(3.7), Inches(5.2),
             "Backend & API Layer",
             ["Node.js & Express.js RESTful API architecture",
              "Socket.IO Server with tenant-isolated security rooms",
              "JWT Authentication & role-based middleware (RBAC)",
              "WhatsApp OTP & SMS integration for friction-free logins",
              "Razorpay Payment Gateway SDK for web & QR checkout",
              "Multer storage for menus, branding & receipt uploads"],
             "Core Engine", ACCENT_PURPLE)

    add_card(slide3, Inches(8.8), Inches(1.6), Inches(3.7), Inches(5.2),
             "Data & Deployment",
             ["MySQL 8.0 with relational connection pooling",
              "ACID Atomic Transactions for billing & inventory burn",
              "Idempotent schema migrations with indexing",
              "Vercel frontend hosting & Railway cloud backend",
              "Zero Client-Trust security policy across all endpoints",
              "Production sanitization of error logs and stack traces"],
             "Database & Cloud", ACCENT_EMERALD)

    slide3.notes_slide.notes_text_frame.text = (
        "The architecture separates presentation, real-time messaging, and transactional data. "
        "Notice the heavy emphasis on WebSockets for live status updates across kitchen, waiter, and rider stations."
    )

    # =========================================================================
    # SLIDE 4: Multi-Tenant Architecture & Roles
    # =========================================================================
    slide4 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide4)
    add_header(slide4, "Multi-Tenant Governance & Role-Based Access")

    add_card(slide4, Inches(0.8), Inches(1.6), Inches(2.8), Inches(5.2),
             "Super Admin",
             ["Platform-wide overview",
              "Tenant restaurant provisioning",
              "Subscription tiers & licensing",
              "Global transaction audit logs",
              "Portal: /super-admin"],
             "Level 1", ACCENT_AMBER)

    add_card(slide4, Inches(3.8), Inches(1.6), Inches(2.8), Inches(5.2),
             "Restaurant Admin",
             ["Storefront branding & slug",
              "Menu, categories & pricing",
              "Floor plans & table QR setup",
              "POS offline billing & tax setup",
              "Driver payouts & staff RBAC"],
             "Level 2", ACCENT_EMERALD)

    add_card(slide4, Inches(6.8), Inches(1.6), Inches(2.8), Inches(5.2),
             "Staff & Kitchen",
             ["Kitchen Display System (KDS)",
              "Station routing (Bar, Grill, etc.)",
              "Waiter handheld table console",
              "Customer paging & bill calls",
              "Bump bar ticket transitions"],
             "Level 3", ACCENT_BLUE)

    add_card(slide4, Inches(9.8), Inches(1.6), Inches(2.8), Inches(5.2),
             "Riders & Customers",
             ["Branded customer storefront",
              "Contactless Dine-in QR scan",
              "Driver portal with GPS telemetry",
              "Proof of delivery & tips",
              "Order tracking progress bar"],
             "Level 4", ACCENT_PURPLE)

    slide4.notes_slide.notes_text_frame.text = (
        "Each restaurant tenant operates with strict isolation. A super admin oversees subscription plans, "
        "while restaurant admins manage their individual branches, staff, floor plans, and financial reports."
    )

    # =========================================================================
    # SLIDE 5: Module 1 - Dine-in QR Ordering & Waiter Station
    # =========================================================================
    slide5 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide5)
    add_header(slide5, "Module 1: Contactless QR Dine-In & Waiter Handheld")

    add_card(slide5, Inches(0.8), Inches(1.6), Inches(5.6), Inches(5.2),
             "Customer Contactless Experience (/order/table/:token)",
             ["Instant QR scan on tabletop without downloading any app",
              "Encrypted cryptographic table token validates physical presence",
              "Browse dynamic digital menu with high-res photos & dietary tags",
              "Custom food notes (e.g., 'extra spicy', 'no onions', allergen alerts)",
              "One-tap 'Call Waiter' or 'Request Bill' with real-time floor chime",
              "View running table bill & live cooking progress in real time"],
             "Guest Front-of-House", ACCENT_EMERALD)

    add_card(slide5, Inches(6.8), Inches(1.6), Inches(5.6), Inches(5.2),
             "Waiter Handheld Floor Station (/waiter/dashboard)",
             ["Mobile-optimized console designed for tablets and smartphones",
              "Color-coded visual table status (Available, Occupied, Billing)",
              "Instant popup & audio alert when kitchen bumps order as 'Ready'",
              "Instant customer assistance notifications with table number badge",
              "Place manual table orders for walk-in guests or update existing bills",
              "Significantly reduces floor staff walking distance and order lag"],
             "Floor Operations", ACCENT_BLUE)

    slide5.notes_slide.notes_text_frame.text = (
        "Module 1 revolutionizes dine-in. Customers scan a table QR code and order directly. "
        "Waiters receive instant alerts on handheld devices when food is ready or when a customer calls them."
    )

    # =========================================================================
    # SLIDE 6: Module 2 - Real-Time Kitchen Display System (KDS)
    # =========================================================================
    slide6 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide6)
    add_header(slide6, "Module 2: Real-Time Kitchen Display System (KDS)")

    add_card(slide6, Inches(0.8), Inches(1.6), Inches(5.6), Inches(5.2),
             "Smart Ticket Routing & Departments",
             ["Eliminates lost paper KOT slips and thermal printer jams",
              "Automatic ticket splitting across kitchen departments:",
              "  • Main Kitchen (Curries, Entrees)",
              "  • Bar & Beverages (Mocktails, Cocktails)",
              "  • Tandoor & Grill (Breads, Kebabs)",
              "  • Pastry & Desserts (Sweets, Cakes)",
              "Zero cross-department confusion during peak weekend rushes",
              "Audible notification chime every time a new order lands"],
             "Kitchen Organization", ACCENT_AMBER)

    add_card(slide6, Inches(6.8), Inches(1.6), Inches(5.6), Inches(5.2),
             "Interactive Bump Bar & Prep Timers",
             ["One-click bump status transitions: Pending → In Preparation → Ready",
              "Visual timer indicators: Green (<10 min), Yellow (10-20 min), Red (>20 min)",
              "Prioritize oldest tickets first to prevent customer dissatisfaction",
              "Live sync: Bumping an item immediately alerts waiter & updates customer UI",
              "Historical average prep time metrics for kitchen efficiency tracking",
              "High-contrast dark mode display optimized for kitchen tablet screens"],
             "Chef Workflow", ACCENT_EMERALD)

    slide6.notes_slide.notes_text_frame.text = (
        "The KDS replaces traditional noisy, jam-prone ticket printers with digital bump bars. "
        "Department-based routing ensures the bar only sees drinks and the grill only sees barbecue."
    )

    # =========================================================================
    # SLIDE 7: Module 3 - Online Delivery Storefront & Tracking
    # =========================================================================
    slide7 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide7)
    add_header(slide7, "Module 3: Direct-to-Consumer Online Ordering Storefront")

    add_card(slide7, Inches(0.8), Inches(1.6), Inches(5.6), Inches(5.2),
             "Custom Branded Storefront (/restaurant/:slug)",
             ["White-labeled online ordering portal with custom restaurant branding",
              "Categorized menus, search filters, variants & combo add-ons",
              "Instant WhatsApp OTP authentication for fast login without passwords",
              "Automated delivery zone validation & minimum order restrictions",
              "Integrated Razorpay gateway for UPI, Cards, NetBanking, plus COD",
              "Discount coupon vouchers & promo code validation engine"],
             "Customer Portal", ACCENT_BLUE)

    add_card(slide7, Inches(6.8), Inches(1.6), Inches(5.6), Inches(5.2),
             "Live Order Status & Telemetry",
             ["Four-stage live tracker: Order Placed → Kitchen Prep → Out for Delivery → Delivered",
              "WebSocket powered real-time progress updates without page refreshes",
              "Live interactive Leaflet map showing delivery rider's live coordinates",
              "Direct call button to restaurant & assigned delivery rider",
              "Digital invoice generation with downloadable GST breakdown",
              "SMS & WhatsApp notifications at each milestone of the order lifecycle"],
             "Tracking Experience", ACCENT_PURPLE)

    slide7.notes_slide.notes_text_frame.text = (
        "Instead of giving up 30% revenue to delivery aggregators, restaurants provide their own URL. "
        "Customers authenticate via WhatsApp OTP, pay securely via Razorpay, and track their delivery live on a map."
    )

    # =========================================================================
    # SLIDE 8: Module 4 - Rider Logistics, GPS Tracking & Payouts
    # =========================================================================
    slide8 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide8)
    add_header(slide8, "Module 4: Delivery Rider Portal & Driver Payout System")

    add_card(slide8, Inches(0.8), Inches(1.6), Inches(5.6), Inches(5.2),
             "Rider Onboarding & Delivery Console (/driver/* & /rider/*)",
             ["Self-service rider application & document KYC verification",
              "Active delivery queue with pickup & drop-off address coordinates",
              "GPS Location Streaming: Emits device coordinates to Socket.IO backend",
              "Turn-by-turn navigation link to Google Maps / Leaflet",
              "Proof of delivery confirmation via secure customer OTP or signature",
              "Shift toggle (Online/Offline) to control rider availability"],
             "Rider Operations", ACCENT_AMBER)

    add_card(slide8, Inches(6.8), Inches(1.6), Inches(5.6), Inches(5.2),
             "Automated Salary & Payout Ledger (driverPayoutController.js)",
             ["Configurable payout model: Base Salary + Per-Delivery Commission + Tips",
              "Date-driven settlement flow (Daily, Weekly, Monthly cycles)",
              "Live earnings dashboard showing today's deliveries, tips & net payable",
              "Admin review & one-click payout clearance with payment reference IDs",
              "Prevents financial discrepancies with an immutable transaction log",
              "Comprehensive scripts testing driver salary date flows and edge cases"],
             "Financial Accounting", ACCENT_EMERALD)

    slide8.notes_slide.notes_text_frame.text = (
        "A standout feature of our codebase is the driver payout controller. It handles rider GPS telemetry, "
        "onboarding KYC, delivery confirmation, and automated commission/salary settlement cycles."
    )

    # =========================================================================
    # SLIDE 9: Module 5 - Admin Console, Offline POS & Floor Plans
    # =========================================================================
    slide9 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide9)
    add_header(slide9, "Module 5: Unified Admin Console & Offline POS Billing")

    add_card(slide9, Inches(0.8), Inches(1.6), Inches(5.6), Inches(5.2),
             "Centralized Operations Command (/admin/:slug)",
             ["Real-time sales analytics, top-selling dishes, and revenue charts",
              "Interactive Floor Plan Builder: Drag-and-drop table layout management",
              "Dynamic QR Code Generator: Export print-ready high-res table stands",
              "Recipe & Inventory deduction: Stock burns automatically upon order completion",
              "Expiry date tracking, low-stock alerts & raw material wastage audits",
              "Staff Management: Role assignments, shift logs, and permission toggles"],
             "Management Hub", ACCENT_BLUE)

    add_card(slide9, Inches(6.8), Inches(1.6), Inches(5.6), Inches(5.2),
             "Offline POS Mode (/admin/offline/*)",
             ["High-speed cashier POS designed for fast counter and dine-in billing",
              "Optimized for keyboard shortcuts & barcode / touch item search",
              "Splits bills by item or seat with custom discount percentages",
              "Thermal receipt printing (80mm & 58mm) with customizable header/footer",
              "Calculates CGST/SGST/VAT automatically based on tax rules",
              "Seamless fallback if internet connectivity flickers during service"],
             "Cashier & Billing", ACCENT_EMERALD)

    slide9.notes_slide.notes_text_frame.text = (
        "Restaurant managers have an end-to-end command center. From interactive floor layouts "
        "to offline POS billing and automated recipe-based inventory deductions, everything is centralized."
    )

    # =========================================================================
    # SLIDE 10: Security, Multi-Tenancy & Data Integrity
    # =========================================================================
    slide10 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide10)
    add_header(slide10, "Platform Security, Multi-Tenancy & Data Integrity")

    add_card(slide10, Inches(0.8), Inches(1.6), Inches(3.7), Inches(5.2),
             "Zero Client-Trust Security",
             ["No restaurantId accepted from client payload",
              "Identity resolved solely from verified JWT session",
              "Prevents tenant data leaks or cross-tenant tampering",
              "Bcrypt salted hashing for all user credentials",
              "CORS & Helmet secure HTTP headers enabled"],
             "Authentication", ACCENT_EMERALD)

    add_card(slide10, Inches(4.8), Inches(1.6), Inches(3.7), Inches(5.2),
             "Tenant-Scoped Sockets",
             ["WebSocket connections require JWT authorization",
              "Dynamic isolated channels:",
              "  • restaurant_{id}_admin",
              "  • restaurant_{id}_kitchen",
              "  • restaurant_{id}_waiter",
              "  • driver_{id}",
              "Events broadcast strictly to authorized listeners"],
             "Real-Time Isolation", ACCENT_BLUE)

    add_card(slide10, Inches(8.8), Inches(1.6), Inches(3.7), Inches(5.2),
             "ACID Database Transactions",
             ["Atomic transactions prevent partial writes",
              "Order creation + KOT routing + stock burn succeed or roll back together",
              "Prevents double-billing or phantom inventory numbers",
              "Parameterized SQL queries prevent SQL injection",
              "Connection pooling ensures high concurrency"],
             "Data Reliability", ACCENT_PURPLE)

    slide10.notes_slide.notes_text_frame.text = (
        "Security is baked in. Tenant isolation is enforced at the database and WebSocket layers. "
        "Orders and stock burns execute in atomic database transactions to guarantee data integrity."
    )

    # =========================================================================
    # SLIDE 11: Live User Flow & Demonstration Walkthrough
    # =========================================================================
    slide11 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide11)
    add_header(slide11, "End-to-End Operational Lifecycle Walkthrough")

    add_card(slide11, Inches(0.8), Inches(1.6), Inches(2.8), Inches(5.2),
             "Step 1: Order",
             ["Customer scans Table QR or visits online storefront",
              "Selects items, modifiers, spice levels",
              "Places order via Razorpay / COD",
              "Instant confirmation screen"],
             "Guest Action", ACCENT_EMERALD)

    add_card(slide11, Inches(3.8), Inches(1.6), Inches(2.8), Inches(5.2),
             "Step 2: Kitchen KDS",
             ["Audio chime alerts kitchen",
              "KOT routed to Bar / Kitchen",
              "Chef taps 'Start Prep'",
              "Timer tracks cooking duration",
              "Chef bumps to 'Ready'"],
             "Kitchen Action", ACCENT_AMBER)

    add_card(slide11, Inches(6.8), Inches(1.6), Inches(2.8), Inches(5.2),
             "Step 3: Service / Dispatch",
             ["Dine-in: Waiter receives alert & serves food to table",
              "Delivery: Rider assigned & accepts dispatch",
              "Live GPS telemetry streams to customer map"],
             "Floor / Delivery", ACCENT_BLUE)

    add_card(slide11, Inches(9.8), Inches(1.6), Inches(2.8), Inches(5.2),
             "Step 4: Settlement",
             ["Table requests bill via QR",
              "Cashier prints tax invoice",
              "Inventory auto-deducted",
              "Driver payout logged",
              "Admin dashboard updates"],
             "Admin & Settlement", ACCENT_PURPLE)

    slide11.notes_slide.notes_text_frame.text = (
        "This slide visualizes the full operational circle: from order placement to kitchen ticket bumping, "
        "waiter/rider dispatch, and automatic financial and inventory settlement."
    )

    # =========================================================================
    # SLIDE 12: Business Benefits & ROI
    # =========================================================================
    slide12 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide12)
    add_header(slide12, "Business Value & Return on Investment (ROI)")

    add_card(slide12, Inches(0.8), Inches(1.6), Inches(3.7), Inches(5.2),
             "Cost Reduction",
             ["Eliminate 20-30% food aggregator commission fees",
              "Cut thermal paper and printing maintenance costs by 100%",
              "Reduce food wastage through exact recipe inventory tracking",
              "Fewer order errors and zero misplaced order tickets"],
             "Financial Gains", ACCENT_EMERALD)

    add_card(slide12, Inches(4.8), Inches(1.6), Inches(3.7), Inches(5.2),
             "Operational Speed",
             ["Table turnover rate increases by 25-35%",
              "Average order-to-cook latency cut from 6 mins to instant",
              "Waiters handle 2x more tables with handheld paging",
              "Automated rider dispatch accelerates delivery cycles"],
             "Efficiency", ACCENT_BLUE)

    add_card(slide12, Inches(8.8), Inches(1.6), Inches(3.7), Inches(5.2),
             "Customer Satisfaction",
             ["Friction-free contactless ordering without waiting for staff",
              "Live transparent GPS tracking of delivery riders",
              "Accurate dietary customizations and allergens",
              "Direct digital feedback and instant bill checkout"],
             "Guest Experience", ACCENT_AMBER)

    slide12.notes_slide.notes_text_frame.text = (
        "The return on investment is immediate. Restaurants recapture substantial revenue lost to 3rd-party aggregators "
        "while streamlining table turnover and reducing labor friction."
    )

    # =========================================================================
    # SLIDE 13: Future Roadmap & Enhancements
    # =========================================================================
    slide13 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide13)
    add_header(slide13, "Future Enhancements & Scalability Roadmap")

    add_card(slide13, Inches(0.8), Inches(1.6), Inches(3.7), Inches(5.2),
             "AI & Automation",
             ["Predictive demand forecasting based on historical sales",
              "AI dynamic pricing recommendations during peak hours",
              "Conversational WhatsApp AI bot for voice/text ordering",
              "Smart kitchen prep pacing based on dining speed"],
             "Phase 1", ACCENT_BLUE)

    add_card(slide13, Inches(4.8), Inches(1.6), Inches(3.7), Inches(5.2),
             "Hotel Accommodation",
             ["Unified room booking & table reservation system",
              "Direct room-service ordering charged to hotel room folio",
              "Housekeeping & minibar inventory integration",
              "Keyless digital room check-in module"],
             "Phase 2", ACCENT_PURPLE)

    add_card(slide13, Inches(8.8), Inches(1.6), Inches(3.7), Inches(5.2),
             "Global Scale & Enterprise",
             ["Multi-currency and global payment support (Stripe, Adyen)",
              "Franchise master dashboard for 500+ outlets",
              "Offline-first PWA sync for remote locations with patchy internet",
              "IoT weight sensors for smart bar and beverage taps"],
             "Phase 3", ACCENT_EMERALD)

    slide13.notes_slide.notes_text_frame.text = (
        "Looking forward, we have plans for AI-driven inventory forecasting, "
        "deeper hotel accommodation and room-service integration, and international enterprise franchise scaling."
    )

    # =========================================================================
    # SLIDE 14: Conclusion & Live Demonstration
    # =========================================================================
    slide14 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide14)
    add_header(slide14, "Conclusion & Project Demonstration")

    add_card(slide14, Inches(0.8), Inches(1.6), Inches(5.6), Inches(5.2),
             "Key Accomplishments",
             ["Complete end-to-end multi-tenant platform built and tested",
              "Full real-time synchronization between 5 distinct portals",
              "Robust financial accounting for driver salaries and taxes",
              "Production-ready deployment config (Railway + Vercel)",
              "Clean, modular codebase ready for enterprise adoption"],
             "Project Milestones", ACCENT_EMERALD)

    add_card(slide14, Inches(6.8), Inches(1.6), Inches(5.6), Inches(5.2),
             "Ready for Live Demonstration",
             ["Super Admin Portal: /super-admin (superadmin@gmail.com)",
              "Restaurant Admin: /admin/grand-palace (admin@hotel.com)",
              "Kitchen KDS Display: /kitchen (chef@hotel.com)",
              "Floor Waiter Station: /waiter/dashboard (waiter@hotel.com)",
              "Rider Delivery App: /rider/dashboard (driver@hotel.com)",
              "Customer Table QR: /order/table/:token"],
             "Demo Access", ACCENT_BLUE)

    slide14.notes_slide.notes_text_frame.text = (
        "In summary, this system is a cloud-ready, enterprise-grade hospitality platform. "
        "We are now ready to demonstrate the live portal across all 5 operational roles."
    )

    # =========================================================================
    # SLIDE 15: Q&A Slide
    # =========================================================================
    slide15 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide15)

    tb15 = slide15.shapes.add_textbox(Inches(1.5), Inches(2.2), Inches(10.3), Inches(3.5))
    tf15 = tb15.text_frame
    tf15.word_wrap = True

    p = tf15.paragraphs[0]
    p.text = "THANK YOU!"
    p.font.size = Pt(44)
    p.font.bold = True
    p.font.color.rgb = ACCENT_EMERALD
    p.alignment = PP_ALIGN.CENTER

    p = tf15.add_paragraph()
    p.text = "Hotel & Restaurant Management Platform"
    p.font.size = Pt(22)
    p.font.bold = True
    p.font.color.rgb = TEXT_LIGHT
    p.alignment = PP_ALIGN.CENTER
    p.space_after = Pt(20)

    p = tf15.add_paragraph()
    p.text = "Questions & Answers / Open Discussion"
    p.font.size = Pt(18)
    p.font.color.rgb = ACCENT_BLUE
    p.alignment = PP_ALIGN.CENTER

    output_path = "Hotel_Restaurant_Management_System_Presentation.pptx"
    prs.save(output_path)
    print(f"Presentation generated successfully: {os.path.abspath(output_path)}")

if __name__ == "__main__":
    create_deck()
