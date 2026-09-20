const https = require('https');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../config/database');

const uploadsDir = path.join(__dirname, '..', 'uploads');
const passportDir = path.join(uploadsDir, 'passports');
const ticketDir = path.join(uploadsDir, 'tickets');

if (!fs.existsSync(passportDir)) fs.mkdirSync(passportDir, { recursive: true });
if (!fs.existsSync(ticketDir)) fs.mkdirSync(ticketDir, { recursive: true });

const passportStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, passportDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeRef = (req.params.ref || 'doc').replace(/[^a-zA-Z0-9_-]/g, '');
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    cb(null, `pass_${safeRef}_${unique}${ext}`);
  }
});

const ticketStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, ticketDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeId = (req.params.id || 'tkt').replace(/[^a-zA-Z0-9_-]/g, '');
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    cb(null, `ticket_${safeId}_${unique}${ext}`);
  }
});

exports.uploadPassportsMiddleware = multer({
  storage: passportStorage,
  limits: { fileSize: 15 * 1024 * 1024 }
}).array('passports', 10);

exports.uploadTicketMiddleware = multer({
  storage: ticketStorage,
  limits: { fileSize: 25 * 1024 * 1024 }
}).single('ticket');

function cleanMobile(mobile) {
  if (!mobile) return '';
  const digits = String(mobile).replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

function generateRefId() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TX-${rand}`;
}

/**
 * Dispatch automatic instant alert to Admin's WhatsApp Business via free CallMeBot webhook
 */
function sendWhatsAppAdminAlert(booking) {
  try {
    const phoneSetting = db.prepare("SELECT value FROM app_settings WHERE key = 'admin_whatsapp_phone'").get();
    const apiKeySetting = db.prepare("SELECT value FROM app_settings WHERE key = 'callmebot_api_key'").get();
    const enabledSetting = db.prepare("SELECT value FROM app_settings WHERE key = 'whatsapp_alerts_enabled'").get();

    if (!enabledSetting || enabledSetting.value !== '1') {
      return; // Alerts disabled
    }

    const phone = phoneSetting?.value ? phoneSetting.value.replace(/\D/g, '') : '';
    const apiKey = apiKeySetting?.value ? apiKeySetting.value.trim() : '';

    if (!phone || !apiKey) {
      console.log('WhatsApp alert skipped: missing phone or API key');
      return;
    }

    const text = `🚨 *TRAVELX NEW BOOKING REQUEST!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *Reference:* #${booking.request_ref}
• *Agency:* ${booking.agency_name}${booking.agent_city ? ` (${booking.agent_city})` : ''}
• *Mobile:* ${booking.agent_mobile}
• *Sector:* ${booking.origin} ➔ ${booking.destination}
• *Flight:* ${booking.airline_name || booking.airline_code} (${booking.flight_number || ''})
• *Date:* ${booking.travel_date} (${booking.departure_time || 'Non-Stop'})
• *Pax:* ${booking.pax_count} Passengers
• *Quoted Rate:* ₹${Number(booking.quoted_rate).toLocaleString('en-IN')}/pax
• *Total Value:* ₹${Number(booking.total_amount).toLocaleString('en-IN')}
• *Baggage:* ${booking.baggage || '30+7 KG'}
${booking.vendor_name ? `• *Winning Vendor:* ${booking.vendor_name} (Net: ₹${booking.net_fare})` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👉 Open TravelX Admin Desk to confirm seats!`;

    const encodedText = encodeURIComponent(text);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodedText}&apikey=${apiKey}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`WhatsApp Alert sent for #${booking.request_ref}: HTTP ${res.statusCode}`);
      });
    }).on('error', (err) => {
      console.warn('CallMeBot notification warning:', err.message);
    });
  } catch (err) {
    console.warn('WhatsApp alert warning:', err.message);
  }
}

/**
 * Lookup agent by mobile number
 */
exports.lookupAgent = (req, res) => {
  try {
    const rawMobile = req.query.mobile || req.body.mobile;
    const mobile = cleanMobile(rawMobile);
    if (!mobile || mobile.length < 10) {
      return res.status(400).json({ success: false, error: 'Valid 10-digit mobile number required' });
    }

    const agent = db.prepare('SELECT id, mobile, agency_name, agent_name, email, address, city, state, pincode, total_bookings, created_at FROM b2b_agents WHERE mobile = ?').get(mobile);
    if (agent) {
      return res.json({ success: true, exists: true, agent });
    }
    return res.json({ success: true, exists: false });
  } catch (err) {
    console.error('Error looking up agent:', err);
    return res.status(500).json({ success: false, error: 'Failed to look up agent' });
  }
};

/**
 * Self-register or update B2B Agent details
 */
exports.registerOrUpdateAgent = (req, res) => {
  try {
    const { 
      mobile: rawMobile, 
      agency_name, 
      agent_name, 
      email, 
      address, 
      city, 
      state, 
      pincode 
    } = req.body;
    const mobile = cleanMobile(rawMobile);

    if (!mobile || mobile.length < 10) {
      return res.status(400).json({ success: false, error: 'Valid 10-digit mobile number required' });
    }
    if (!agency_name || !agency_name.trim()) {
      return res.status(400).json({ success: false, error: 'Agency name is required' });
    }

    const cleanAgency = agency_name.trim();
    const cleanAgentName = agent_name ? agent_name.trim() : null;
    const cleanEmail = email ? email.trim() : null;
    const cleanAddress = address ? address.trim() : null;
    const cleanCity = city ? city.trim() : null;
    const cleanState = state ? state.trim() : null;
    const cleanPincode = pincode ? pincode.trim() : null;

    const existing = db.prepare('SELECT id FROM b2b_agents WHERE mobile = ?').get(mobile);
    if (existing) {
      db.prepare(`
        UPDATE b2b_agents 
        SET agency_name = ?, 
            agent_name = COALESCE(?, agent_name), 
            email = COALESCE(?, email),
            address = COALESCE(?, address),
            city = COALESCE(?, city), 
            state = COALESCE(?, state),
            pincode = COALESCE(?, pincode),
            last_active_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(cleanAgency, cleanAgentName, cleanEmail, cleanAddress, cleanCity, cleanState, cleanPincode, existing.id);
    } else {
      db.prepare(`
        INSERT INTO b2b_agents (mobile, agency_name, agent_name, email, address, city, state, pincode)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(mobile, cleanAgency, cleanAgentName || '', cleanEmail || '', cleanAddress || '', cleanCity || '', cleanState || '', cleanPincode || '');
    }

    const agent = db.prepare('SELECT id, mobile, agency_name, agent_name, email, address, city, state, pincode, total_bookings FROM b2b_agents WHERE mobile = ?').get(mobile);
    return res.json({ success: true, agent });
  } catch (err) {
    console.error('Error registering agent:', err);
    return res.status(500).json({ success: false, error: 'Failed to register agent profile' });
  }
};

/**
 * Create a new Booking / Seat Hold Request
 */
exports.createBookingRequest = (req, res) => {
  try {
    const {
      mobile: rawMobile,
      agency_name,
      agent_name,
      email,
      address,
      city,
      state,
      pincode,
      origin,
      destination,
      route_label,
      airline_code,
      airline_name,
      flight_number,
      travel_date,
      departure_time,
      arrival_time,
      duration,
      quoted_rate,
      pax_count,
      pax_adults,
      pax_children,
      pax_infants,
      infant_fare,
      baggage,
      remarks
    } = req.body;

    const mobile = cleanMobile(rawMobile);
    if (!mobile || mobile.length < 10) {
      return res.status(400).json({ success: false, error: 'Valid 10-digit mobile number required' });
    }
    if (!agency_name || !agency_name.trim()) {
      return res.status(400).json({ success: false, error: 'Agency name is required' });
    }
    if (!origin || !destination || !travel_date) {
      return res.status(400).json({ success: false, error: 'Origin, destination, and travel date are required' });
    }

    const paxAdults = Math.max(1, parseInt(pax_adults || pax_count || 1, 10));
    const paxChildren = Math.max(0, parseInt(pax_children || 0, 10));
    const paxInfants = Math.max(0, parseInt(pax_infants || 0, 10));
    const totalPax = paxAdults + paxChildren + paxInfants;
    const rate = Number(quoted_rate) || 0;
    // Physical seats are (Adults + Children). Infant fare is charged at airline actuals upon desk confirmation
    const infantRate = (infant_fare !== undefined && infant_fare !== null && infant_fare !== '') ? Number(infant_fare) : null;
    const totalAmount = ((paxAdults + paxChildren) * rate) + (paxInfants * (infantRate || 0));

    // 1. Auto-upsert agent in b2b_agents directory
    let agentId = null;
    const existing = db.prepare('SELECT id, total_bookings FROM b2b_agents WHERE mobile = ?').get(mobile);
    if (existing) {
      agentId = existing.id;
      db.prepare(`
        UPDATE b2b_agents 
        SET agency_name = ?, 
            agent_name = COALESCE(?, agent_name), 
            email = COALESCE(?, email),
            address = COALESCE(?, address),
            city = COALESCE(?, city),
            state = COALESCE(?, state),
            pincode = COALESCE(?, pincode),
            total_bookings = total_bookings + 1, 
            last_active_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(
        agency_name.trim(), 
        agent_name ? agent_name.trim() : null, 
        email ? email.trim() : null,
        address ? address.trim() : null,
        city ? city.trim() : null,
        state ? state.trim() : null,
        pincode ? pincode.trim() : null,
        existing.id
      );
    } else {
      const ins = db.prepare(`
        INSERT INTO b2b_agents (mobile, agency_name, agent_name, email, address, city, state, pincode, total_bookings)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        mobile, 
        agency_name.trim(), 
        agent_name ? agent_name.trim() : '', 
        email ? email.trim() : '',
        address ? address.trim() : '',
        city ? city.trim() : '',
        state ? state.trim() : '',
        pincode ? pincode.trim() : ''
      );
      agentId = ins.lastInsertRowid;
    }

    // 2. Generate unique Reference ID
    let refId = generateRefId();
    for (let attempts = 0; attempts < 5; attempts++) {
      const conflict = db.prepare('SELECT id FROM booking_requests WHERE request_ref = ?').get(refId);
      if (!conflict) break;
      refId = generateRefId();
    }

    // 3. Auto-detect winning vendor & net fare for this flight
    let winningVendorId = null;
    let winningVendorName = null;
    let winningVendorPhone = null;
    let winningNetFare = null;

    try {
      const bestFare = db.prepare(`
        SELECT f.vendor_id, v.name as vendor_name, v.phone as vendor_phone, f.net_fare
        FROM fares f
        LEFT JOIN vendors v ON f.vendor_id = v.id
        WHERE f.origin = ? AND f.destination = ? AND f.airline_code = ? AND f.travel_date = ?
        ORDER BY (COALESCE(f.publish_fare, f.net_fare + f.margin_amount)) ASC
        LIMIT 1
      `).get(origin.toUpperCase(), destination.toUpperCase(), airline_code || '', travel_date);

      if (bestFare) {
        winningVendorId = bestFare.vendor_id || null;
        winningVendorName = bestFare.vendor_name || null;
        winningVendorPhone = bestFare.vendor_phone || null;
        winningNetFare = bestFare.net_fare || null;
      }
    } catch (ve) {
      console.warn('Vendor lookup notice:', ve.message);
    }

    // 4. Insert booking request
    const insertBooking = db.prepare(`
      INSERT INTO booking_requests (
        request_ref, agent_id, agent_name, agency_name, agent_mobile, agent_city,
        origin, destination, route_label, airline_code, airline_name, flight_number,
        travel_date, departure_time, arrival_time, duration, quoted_rate,
        pax_count, pax_adults, pax_children, pax_infants, total_amount, baggage, remarks, status,
        vendor_id, vendor_name, vendor_phone, net_fare
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, 'PENDING',
        ?, ?, ?, ?
      )
    `);

    const finalRouteLabel = route_label || `${origin} ➔ ${destination}`;

    const info = insertBooking.run(
      refId,
      agentId,
      agent_name ? agent_name.trim() : agency_name.trim(),
      agency_name.trim(),
      mobile,
      city ? city.trim() : '',
      origin.toUpperCase(),
      destination.toUpperCase(),
      finalRouteLabel,
      airline_code || '',
      airline_name || '',
      flight_number || '',
      travel_date,
      departure_time || '',
      arrival_time || '',
      duration || '',
      rate,
      totalPax,
      paxAdults,
      paxChildren,
      paxInfants,
      totalAmount,
      baggage || '30+7 KG',
      remarks ? remarks.trim() : '',
      winningVendorId,
      winningVendorName,
      winningVendorPhone,
      winningNetFare
    );

    const createdBooking = db.prepare('SELECT * FROM booking_requests WHERE id = ?').get(info.lastInsertRowid);

    // Asynchronously dispatch WhatsApp alert to Admin
    sendWhatsAppAdminAlert(createdBooking);

    return res.json({
      success: true,
      message: 'Booking request registered successfully',
      booking: createdBooking,
      agent: {
        id: agentId,
        mobile,
        agency_name: agency_name.trim(),
        agent_name: agent_name ? agent_name.trim() : '',
        city: city ? city.trim() : ''
      }
    });

  } catch (err) {
    console.error('Error creating booking request:', err);
    return res.status(500).json({ success: false, error: 'Failed to record booking request' });
  }
};

/**
 * Admin: Get all booking requests with stats
 */
exports.getBookingRequests = (req, res) => {
  try {
    const { status, search, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT b.*, 
        strftime('%d-%m-%Y %H:%M', b.created_at) as formatted_created_at
      FROM booking_requests b
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'ALL') {
      query += ` AND b.status = ?`;
      params.push(status.toUpperCase());
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      query += ` AND (b.request_ref LIKE ? OR b.agency_name LIKE ? OR b.agent_mobile LIKE ? OR b.route_label LIKE ? OR b.flight_number LIKE ?)`;
      params.push(q, q, q, q, q);
    }

    query += ` ORDER BY b.id DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const rows = db.prepare(query).all(...params);

    // Summary counts
    const totalCount = db.prepare('SELECT COUNT(*) as count FROM booking_requests').get().count;
    const pendingCount = db.prepare("SELECT COUNT(*) as count FROM booking_requests WHERE status = 'PENDING'").get().count;
    const availableCount = db.prepare("SELECT COUNT(*) as count FROM booking_requests WHERE status IN ('AVAILABLE', 'FARE_REVISED')").get().count;
    const docsSubmittedCount = db.prepare("SELECT COUNT(*) as count FROM booking_requests WHERE status = 'DOCS_SUBMITTED'").get().count;
    const confirmedCount = db.prepare("SELECT COUNT(*) as count FROM booking_requests WHERE status = 'CONFIRMED'").get().count;
    const todayCount = db.prepare("SELECT COUNT(*) as count FROM booking_requests WHERE date(created_at) = date('now', 'localtime')").get().count;

    return res.json({
      success: true,
      bookings: rows,
      stats: {
        total: totalCount,
        pending: pendingCount,
        available: availableCount,
        docs_submitted: docsSubmittedCount,
        confirmed: confirmedCount,
        today: todayCount
      }
    });
  } catch (err) {
    console.error('Error fetching booking requests:', err);
    return res.status(500).json({ success: false, error: 'Failed to load booking requests' });
  }
};

/**
 * Admin: Update booking status
 */
/**
 * Admin: Update booking status
 */
exports.updateBookingStatus = (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks, pnr_code, revised_fare, admin_notes } = req.body;

    const validStatuses = ['PENDING', 'AVAILABLE', 'FARE_REVISED', 'SOLD_OUT', 'DOCS_SUBMITTED', 'TICKET_ISSUED', 'CONFIRMED', 'CONTACTED', 'CANCELLED'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const booking = db.prepare('SELECT id FROM booking_requests WHERE id = ?').get(id);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking request not found' });
    }

    db.prepare(`
      UPDATE booking_requests 
      SET status = COALESCE(?, status), 
          remarks = COALESCE(?, remarks), 
          pnr_code = COALESCE(?, pnr_code),
          revised_fare = COALESCE(?, revised_fare),
          admin_notes = COALESCE(?, admin_notes),
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      status || null, 
      remarks !== undefined && remarks !== null ? remarks.trim() : null, 
      pnr_code !== undefined && pnr_code !== null ? pnr_code.trim().toUpperCase() : null, 
      revised_fare !== undefined && revised_fare !== null && revised_fare !== '' ? Number(revised_fare) : null,
      admin_notes !== undefined && admin_notes !== null ? admin_notes.trim() : null,
      id
    );

    const updated = db.prepare('SELECT * FROM booking_requests WHERE id = ?').get(id);
    return res.json({ success: true, booking: updated });
  } catch (err) {
    console.error('Error updating booking status:', err);
    return res.status(500).json({ success: false, error: 'Failed to update booking status' });
  }
};

/**
 * Admin: Quick Review / Reply (Available, Fare Revised, Sold Out)
 */
exports.reviewBookingRequest = (req, res) => {
  try {
    const { id } = req.params;
    const { status, revised_fare, admin_notes, infant_fare } = req.body;

    const validReviewStatuses = ['AVAILABLE', 'FARE_REVISED', 'SOLD_OUT', 'PENDING', 'CANCELLED'];
    if (!validReviewStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid review status' });
    }

    const booking = db.prepare('SELECT * FROM booking_requests WHERE id = ?').get(id);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking request not found' });
    }

    let finalRevisedFare = booking.revised_fare;
    if (status === 'AVAILABLE') {
      finalRevisedFare = booking.quoted_rate; // Same rate
    } else if (status === 'FARE_REVISED') {
      finalRevisedFare = (revised_fare !== undefined && revised_fare !== null && revised_fare !== '') 
        ? Number(revised_fare) 
        : booking.quoted_rate;
    }

    const finalInfantFare = (infant_fare !== undefined && infant_fare !== null && infant_fare !== '') 
      ? Number(infant_fare) 
      : (status === 'AVAILABLE' || status === 'FARE_REVISED' ? booking.infant_fare : null);

    const seatPax = (booking.pax_adults || 1) + (booking.pax_children || 0);
    const seatRate = (status === 'FARE_REVISED' ? finalRevisedFare : booking.quoted_rate);
    const infantTotal = (booking.pax_infants || 0) * (finalInfantFare ? Number(finalInfantFare) : 0);
    const newTotalAmount = (seatPax * seatRate) + infantTotal;

    db.prepare(`
      UPDATE booking_requests 
      SET status = ?, 
          revised_fare = ?, 
          infant_fare = ?,
          total_amount = ?,
          admin_notes = COALESCE(?, admin_notes),
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      status, 
      finalRevisedFare, 
      finalInfantFare,
      newTotalAmount,
      admin_notes !== undefined ? admin_notes.trim() : null, 
      id
    );

    const updated = db.prepare('SELECT * FROM booking_requests WHERE id = ?').get(id);
    return res.json({ success: true, booking: updated });
  } catch (err) {
    console.error('Error reviewing booking request:', err);
    return res.status(500).json({ success: false, error: 'Failed to record review' });
  }
};

/**
 * Public: Agent Booking Live Status & Self-Service Tracker
 */
exports.trackBooking = (req, res) => {
  try {
    const { ref } = req.params;
    if (!ref || !ref.trim()) {
      return res.status(400).json({ success: false, error: 'Reference ID is required' });
    }

    const booking = db.prepare(`
      SELECT 
        id, request_ref, status, agent_name, agency_name, agent_mobile, agent_city,
        origin, destination, route_label, airline_code, airline_name, flight_number,
        travel_date, departure_time, arrival_time, duration,
        quoted_rate, pax_count, pax_adults, pax_children, pax_infants, infant_fare,
        total_amount, baggage, remarks,
        revised_fare, admin_notes, pnr_code, ticket_file_path, passport_files,
        created_at, updated_at
      FROM booking_requests 
      WHERE UPPER(request_ref) = UPPER(?)
    `).get(ref.trim());

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking reference not found' });
    }

    let parsedPassports = [];
    try {
      if (booking.passport_files) {
        parsedPassports = JSON.parse(booking.passport_files);
      }
    } catch (e) {}

    const hasTicket = Boolean(booking.ticket_file_path && fs.existsSync(booking.ticket_file_path));

    return res.json({
      success: true,
      booking: {
        id: booking.id,
        request_ref: booking.request_ref,
        status: booking.status,
        agency_name: booking.agency_name,
        agent_name: booking.agent_name,
        agent_mobile: booking.agent_mobile,
        agent_city: booking.agent_city,
        origin: booking.origin,
        destination: booking.destination,
        route_label: booking.route_label,
        airline_code: booking.airline_code,
        airline_name: booking.airline_name,
        flight_number: booking.flight_number,
        travel_date: booking.travel_date,
        departure_time: booking.departure_time,
        arrival_time: booking.arrival_time,
        duration: booking.duration,
        quoted_rate: booking.quoted_rate,
        pax_count: booking.pax_count,
        pax_adults: booking.pax_adults,
        pax_children: booking.pax_children,
        pax_infants: booking.pax_infants,
        infant_fare: booking.infant_fare,
        total_amount: booking.total_amount,
        baggage: booking.baggage,
        remarks: booking.remarks,
        revised_fare: booking.revised_fare,
        admin_notes: booking.admin_notes,
        pnr_code: booking.pnr_code,
        has_passports: parsedPassports.length > 0,
        passport_count: parsedPassports.length,
        has_ticket: hasTicket,
        ticket_download_url: hasTicket ? `/api/public/bookings/${booking.request_ref}/ticket-download` : null,
        passports: parsedPassports.map(p => ({
          originalName: p.originalName,
          filename: p.filename,
          size: p.size,
          uploadedAt: p.uploadedAt
        })),
        created_at: booking.created_at,
        updated_at: booking.updated_at
      }
    });
  } catch (err) {
    console.error('Error tracking booking:', err);
    return res.status(500).json({ success: false, error: 'Failed to track booking' });
  }
};

/**
 * Public: Agent Responds to Airline Fare Revision (Accept or Decline)
 */
exports.respondToRevisedFare = (req, res) => {
  try {
    const { ref } = req.params;
    const { action } = req.body; // 'ACCEPT' | 'DECLINE'

    if (!ref || !ref.trim()) {
      return res.status(400).json({ success: false, error: 'Reference ID is required' });
    }

    const booking = db.prepare('SELECT * FROM booking_requests WHERE UPPER(request_ref) = UPPER(?)').get(ref.trim());
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking reference not found' });
    }

    if (action === 'ACCEPT') {
      const noteAppend = ` • [Agent Accepted Revised Fare ₹${Number(booking.revised_fare || booking.quoted_rate).toLocaleString('en-IN')}]`;
      db.prepare(`
        UPDATE booking_requests
        SET admin_notes = COALESCE(admin_notes, '') || ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(noteAppend, booking.id);

      const updated = db.prepare('SELECT * FROM booking_requests WHERE id = ?').get(booking.id);
      return res.json({ success: true, message: 'Revised fare accepted by agent', action: 'ACCEPT', booking: updated });
    } else if (action === 'DECLINE') {
      const noteAppend = ` • [Agent Declined Revised Fare - Request Cancelled]`;
      db.prepare(`
        UPDATE booking_requests
        SET status = 'CANCELLED',
            admin_notes = COALESCE(admin_notes, '') || ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(noteAppend, booking.id);

      const updated = db.prepare('SELECT * FROM booking_requests WHERE id = ?').get(booking.id);
      return res.json({ success: true, message: 'Booking cancelled upon agent decline', action: 'DECLINE', booking: updated });
    }

    return res.status(400).json({ success: false, error: 'Invalid action. Expected ACCEPT or DECLINE.' });
  } catch (err) {
    console.error('Error responding to revised fare:', err);
    return res.status(500).json({ success: false, error: 'Failed to record fare response' });
  }
};

/**
 * Public: Agent Uploads Passenger Passports
 */
exports.uploadPassports = (req, res) => {
  try {
    const { ref } = req.params;
    const booking = db.prepare('SELECT * FROM booking_requests WHERE UPPER(request_ref) = UPPER(?)').get(ref.trim());
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking reference not found' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No passport files uploaded' });
    }

    let existingPassports = [];
    try {
      if (booking.passport_files) {
        existingPassports = JSON.parse(booking.passport_files);
      }
    } catch (e) {}

    const newPassports = req.files.map(f => ({
      originalName: f.originalname,
      filename: f.filename,
      path: f.path,
      size: f.size,
      mimetype: f.mimetype,
      uploadedAt: new Date().toISOString()
    }));

    const combined = [...existingPassports, ...newPassports];

    // Transition status to DOCS_SUBMITTED (unless already confirmed/issued)
    const newStatus = (booking.status === 'CONFIRMED' || booking.status === 'TICKET_ISSUED') 
      ? booking.status 
      : 'DOCS_SUBMITTED';

    db.prepare(`
      UPDATE booking_requests 
      SET passport_files = ?, 
          status = ?, 
          updated_at = datetime('now', 'localtime') 
      WHERE id = ?
    `).run(JSON.stringify(combined), newStatus, booking.id);

    return res.json({
      success: true,
      message: `${newPassports.length} passport(s) uploaded successfully`,
      total_passports: combined.length,
      status: newStatus
    });
  } catch (err) {
    console.error('Error uploading passports:', err);
    return res.status(500).json({ success: false, error: 'Failed to upload passports' });
  }
};

/**
 * Admin: Upload E-Ticket PDF/Image & Confirm Booking
 */
exports.uploadTicket = (req, res) => {
  try {
    const { id } = req.params;
    const { pnr_code } = req.body;

    const booking = db.prepare('SELECT * FROM booking_requests WHERE id = ?').get(id);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking request not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Ticket file is required' });
    }

    const ticketPath = req.file.path;
    const finalPnr = (pnr_code && pnr_code.trim()) ? pnr_code.trim().toUpperCase() : booking.pnr_code;

    db.prepare(`
      UPDATE booking_requests 
      SET ticket_file_path = ?, 
          pnr_code = COALESCE(?, pnr_code),
          status = 'CONFIRMED',
          updated_at = datetime('now', 'localtime') 
      WHERE id = ?
    `).run(ticketPath, finalPnr, id);

    const updated = db.prepare('SELECT * FROM booking_requests WHERE id = ?').get(id);
    return res.json({
      success: true,
      message: 'E-Ticket uploaded and booking confirmed successfully',
      booking: updated
    });
  } catch (err) {
    console.error('Error uploading ticket:', err);
    return res.status(500).json({ success: false, error: 'Failed to upload ticket' });
  }
};

/**
 * Public: Agent E-Ticket Download
 */
exports.downloadTicket = (req, res) => {
  try {
    const { ref } = req.params;
    const booking = db.prepare('SELECT * FROM booking_requests WHERE UPPER(request_ref) = UPPER(?)').get(ref.trim());
    if (!booking || !booking.ticket_file_path) {
      return res.status(404).send('E-Ticket not available yet for this booking.');
    }

    if (!fs.existsSync(booking.ticket_file_path)) {
      return res.status(404).send('Ticket file could not be found on server.');
    }

    const ext = path.extname(booking.ticket_file_path) || '.pdf';
    const downloadName = `TravelX_Ticket_${booking.request_ref}${ext}`;
    return res.download(booking.ticket_file_path, downloadName);
  } catch (err) {
    console.error('Error downloading ticket:', err);
    return res.status(500).send('Failed to download ticket');
  }
};

/**
 * Admin: Download Passenger Passport File
 */
exports.downloadPassport = (req, res) => {
  try {
    const { id, filename } = req.params;
    const booking = db.prepare('SELECT passport_files FROM booking_requests WHERE id = ?').get(id);
    if (!booking || !booking.passport_files) {
      return res.status(404).send('No passports found for this booking.');
    }

    const passports = JSON.parse(booking.passport_files);
    const target = passports.find(p => p.filename === filename);
    if (!target || !fs.existsSync(target.path)) {
      return res.status(404).send('Passport file not found on server.');
    }

    return res.download(target.path, target.originalName || filename);
  } catch (err) {
    console.error('Error downloading passport:', err);
    return res.status(500).send('Failed to download passport');
  }
};

/**
 * Admin: Get all registered B2B Agents directory
 */
exports.getAgentsDirectory = (req, res) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT 
        a.id,
        a.mobile,
        a.agency_name,
        a.agent_name,
        a.email,
        a.address,
        a.city,
        a.state,
        a.pincode,
        a.total_bookings,
        a.created_at,
        a.last_active_at,
        (SELECT COUNT(*) FROM booking_requests WHERE agent_id = a.id) as actual_bookings_count,
        (SELECT MAX(created_at) FROM booking_requests WHERE agent_id = a.id) as last_booking_date
      FROM b2b_agents a
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      query += ` AND (a.agency_name LIKE ? OR a.mobile LIKE ? OR a.city LIKE ? OR a.agent_name LIKE ? OR a.address LIKE ? OR a.state LIKE ?)`;
      params.push(q, q, q, q, q, q);
    }

    query += ` ORDER BY a.total_bookings DESC, a.last_active_at DESC`;
    const agents = db.prepare(query).all(...params);

    return res.json({
      success: true,
      agents,
      totalCount: agents.length
    });
  } catch (err) {
    console.error('Error fetching agents directory:', err);
    return res.status(500).json({ success: false, error: 'Failed to load agents directory' });
  }
};

/**
 * Admin: Manually Add New B2B Agent
 */
exports.createAgentFromAdmin = (req, res) => {
  try {
    const { mobile: rawMobile, agency_name, agent_name, email, address, city, state, pincode } = req.body;
    const mobile = cleanMobile(rawMobile);
    if (!mobile || mobile.length < 10) {
      return res.status(400).json({ success: false, error: 'Valid 10-digit mobile number required' });
    }
    if (!agency_name || !agency_name.trim()) {
      return res.status(400).json({ success: false, error: 'Agency name is required' });
    }

    const existing = db.prepare('SELECT id FROM b2b_agents WHERE mobile = ?').get(mobile);
    if (existing) {
      return res.status(400).json({ success: false, error: 'An agent with this mobile number already exists' });
    }

    const info = db.prepare(`
      INSERT INTO b2b_agents (mobile, agency_name, agent_name, email, address, city, state, pincode, total_bookings)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      mobile,
      agency_name.trim(),
      agent_name ? agent_name.trim() : '',
      email ? email.trim() : '',
      address ? address.trim() : '',
      city ? city.trim() : '',
      state ? state.trim() : '',
      pincode ? pincode.trim() : ''
    );

    const created = db.prepare('SELECT * FROM b2b_agents WHERE id = ?').get(info.lastInsertRowid);
    return res.json({ success: true, agent: created, message: 'Agent registered successfully' });
  } catch (err) {
    console.error('Error creating agent:', err);
    return res.status(500).json({ success: false, error: 'Failed to create agent' });
  }
};

/**
 * Admin: Update Existing B2B Agent
 */
exports.updateAgentFromAdmin = (req, res) => {
  try {
    const { id } = req.params;
    const { mobile: rawMobile, agency_name, agent_name, email, address, city, state, pincode } = req.body;
    const mobile = cleanMobile(rawMobile);
    if (!mobile || mobile.length < 10) {
      return res.status(400).json({ success: false, error: 'Valid 10-digit mobile number required' });
    }
    if (!agency_name || !agency_name.trim()) {
      return res.status(400).json({ success: false, error: 'Agency name is required' });
    }

    // Check duplicate mobile for another agent
    const duplicate = db.prepare('SELECT id FROM b2b_agents WHERE mobile = ? AND id != ?').get(mobile, id);
    if (duplicate) {
      return res.status(400).json({ success: false, error: 'Another agent already has this mobile number' });
    }

    db.prepare(`
      UPDATE b2b_agents 
      SET mobile = ?, agency_name = ?, agent_name = ?, email = ?, address = ?, city = ?, state = ?, pincode = ?, last_active_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      mobile,
      agency_name.trim(),
      agent_name ? agent_name.trim() : '',
      email ? email.trim() : '',
      address ? address.trim() : '',
      city ? city.trim() : '',
      state ? state.trim() : '',
      pincode ? pincode.trim() : '',
      id
    );

    const updated = db.prepare('SELECT * FROM b2b_agents WHERE id = ?').get(id);
    return res.json({ success: true, agent: updated, message: 'Agent updated successfully' });
  } catch (err) {
    console.error('Error updating agent:', err);
    return res.status(500).json({ success: false, error: 'Failed to update agent' });
  }
};

/**
 * Admin: Get WhatsApp Alert & Automation Settings
 */
exports.getWhatsAppSettings = (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM app_settings').all();
    const settings = {};
    rows.forEach(r => {
      settings[r.key] = r.value;
    });

    return res.json({
      success: true,
      settings: {
        admin_whatsapp_phone: settings.admin_whatsapp_phone || '919888888888',
        callmebot_api_key: settings.callmebot_api_key || '',
        whatsapp_alerts_enabled: settings.whatsapp_alerts_enabled === '1',
        auto_expiry_enabled: settings.auto_expiry_enabled !== '0'
      }
    });
  } catch (err) {
    console.error('Error fetching settings:', err);
    return res.status(500).json({ success: false, error: 'Failed to load settings' });
  }
};

/**
 * Admin: Save WhatsApp Alert & Automation Settings
 */
exports.saveWhatsAppSettings = (req, res) => {
  try {
    const { admin_whatsapp_phone, callmebot_api_key, whatsapp_alerts_enabled, auto_expiry_enabled } = req.body;

    const upsert = db.prepare(`
      INSERT INTO app_settings (key, value, updated_at) 
      VALUES (?, ?, datetime('now', 'localtime'))
      ON CONFLICT(key) DO UPDATE SET 
        value = excluded.value, 
        updated_at = excluded.updated_at
    `);

    if (admin_whatsapp_phone !== undefined) {
      upsert.run('admin_whatsapp_phone', String(admin_whatsapp_phone).replace(/\D/g, ''));
    }
    if (callmebot_api_key !== undefined) {
      upsert.run('callmebot_api_key', String(callmebot_api_key).trim());
    }
    if (whatsapp_alerts_enabled !== undefined) {
      upsert.run('whatsapp_alerts_enabled', whatsapp_alerts_enabled ? '1' : '0');
    }
    if (auto_expiry_enabled !== undefined) {
      upsert.run('auto_expiry_enabled', auto_expiry_enabled ? '1' : '0');
    }

    return res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err) {
    console.error('Error saving settings:', err);
    return res.status(500).json({ success: false, error: 'Failed to save settings' });
  }
};

/**
 * Admin: Test WhatsApp Alert to phone
 */
exports.testWhatsAppAlert = (req, res) => {
  try {
    const { phone: rawPhone, api_key: rawKey } = req.body;
    const phone = rawPhone ? String(rawPhone).replace(/\D/g, '') : '';
    const apiKey = rawKey ? String(rawKey).trim() : '';

    if (!phone || phone.length < 10) {
      return res.status(400).json({ success: false, error: 'Valid 10+ digit WhatsApp phone number required (with country code, e.g. 919888888888)' });
    }
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'CallMeBot API Key is required' });
    }

    const testMessage = `✅ *TravelX Live Alert Connected!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Congratulations! Your WhatsApp Business is now connected to TravelX Special Fare Manager.
You will now receive instant live alerts on this number whenever an agent books a seat!`;

    const encoded = encodeURIComponent(testMessage);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encoded}&apikey=${apiKey}`;

    https.get(url, (botRes) => {
      let data = '';
      botRes.on('data', chunk => data += chunk);
      botRes.on('end', () => {
        if (botRes.statusCode === 200 && !data.toLowerCase().includes('error')) {
          return res.json({ success: true, message: 'Test message sent to your WhatsApp Business! Check your phone.' });
        } else {
          return res.status(400).json({ success: false, error: data || `CallMeBot returned HTTP ${botRes.statusCode}` });
        }
      });
    }).on('error', (err) => {
      return res.status(500).json({ success: false, error: `Connection failed: ${err.message}` });
    });

  } catch (err) {
    console.error('Error testing WhatsApp alert:', err);
    return res.status(500).json({ success: false, error: 'Failed to dispatch test alert' });
  }
};
