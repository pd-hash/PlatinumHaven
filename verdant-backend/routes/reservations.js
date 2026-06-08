const router = require('express').Router();
const pool = require('../db');
const nodemailer = require('nodemailer');
const { authenticate, adminOnly } = require('../middleware/auth');
const { ensureHousekeepingTaskForReservation } = require('./housekeeping');

const formatPH = (phone) => {
  if (!phone) return null;
  let n = phone.replace(/[^0-9]/g, '');
  if (n.startsWith('1639') && n.length === 13) n = n.slice(1);
  if (n.startsWith('639') && n.length === 12) return `+${n}`;
  if (n.startsWith('63') && n.length === 12) return `+${n}`;
  if (n.startsWith('09') && n.length === 11) return `+63${n.slice(1)}`;
  if (n.startsWith('06') && n.length === 11) return `+63${n.slice(1)}`;
  if (n.startsWith('9') && n.length === 10) return `+63${n}`;
  return `+63${n}`;
};

const sendTextBee = async (phone, message) => {
  try {
    const apiKey = process.env.TEXTBEE_API_KEY;
    const deviceId = process.env.TEXTBEE_DEVICE_ID;
    if (!apiKey || !deviceId) {
      console.log('TextBee credentials missing');
      return;
    }

    const cleaned = formatPH(phone);
    if (!cleaned) {
      console.log('Invalid phone:', phone);
      return;
    }

    const res = await fetch(
      `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`,
      {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recipients: [cleaned], message }),
      }
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok) console.error('TextBee failed:', res.status, data);
  } catch (error) {
    console.error('TextBee error:', error.message);
  }
};

const getGuestReservationDetails = async (reservationId) => {
  const { rows } = await pool.query(
    `SELECT p.phone, p.email, p.full_name, rm.name AS room_name
     FROM profiles p
     JOIN reservations r ON r.customer_id = p.id
     JOIN rooms rm ON r.room_id = rm.id
     WHERE r.id = $1`,
    [reservationId]
  );

  return rows[0] || null;
};

const formatBookingDate = (value) =>
  new Date(value).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

const padDatePart = (value) => String(value).padStart(2, '0');

const serializeReservationDateTime = (value) => {
  if (!value) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/.test(trimmed)) {
      return trimmed.length === 10 ? `${trimmed} 00:00` : trimmed;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return [
        parsed.getFullYear(),
        padDatePart(parsed.getMonth() + 1),
        padDatePart(parsed.getDate()),
      ].join('-') + ` ${padDatePart(parsed.getHours())}:${padDatePart(parsed.getMinutes())}`;
    }
    return trimmed;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return [
    parsed.getFullYear(),
    padDatePart(parsed.getMonth() + 1),
    padDatePart(parsed.getDate()),
  ].join('-') + ` ${padDatePart(parsed.getHours())}:${padDatePart(parsed.getMinutes())}`;
};

const formatBookingDateTime = (value) => {
  const normalized = serializeReservationDateTime(value);
  if (!normalized) return 'N/A';

  const [datePart, timePart = '00:00'] = normalized.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  const parsed = new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0);

  return parsed.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const serializeReservation = (reservation) => ({
  ...reservation,
  check_in: serializeReservationDateTime(reservation.check_in),
  check_out: serializeReservationDateTime(reservation.check_out),
});

const getStartOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const resolveReservationStatus = ({ status, paymentStatus, paymentMethod, checkOut }) => {
  if (status === 'Cancelled') return 'Cancelled';
  if (status === 'Completed') return 'Completed';

  const today = getStartOfToday();
  const checkOutDate = new Date(checkOut);
  checkOutDate.setHours(0, 0, 0, 0);

  if (!Number.isNaN(checkOutDate.getTime()) && checkOutDate < today) {
    return 'Completed';
  }

  if (paymentStatus === 'Paid') return 'Confirmed';
  if (status === 'Holding') return 'Holding';
  if (status === 'Confirmed') return 'Confirmed';
  return paymentMethod === 'Cash' ? 'Pending' : 'Pending';
};

const deriveReservationState = ({ status, paymentStatus, paymentMethod, checkOut }) => {
  const normalizedPaymentMethod = paymentMethod || 'PayPal';
  const normalizedPaymentStatus = paymentStatus || 'Paid';
  const normalizedStatus = resolveReservationStatus({
    status,
    paymentStatus: normalizedPaymentStatus,
    paymentMethod: normalizedPaymentMethod,
    checkOut,
  });

  return {
    paymentMethod: normalizedPaymentMethod,
    paymentStatus: normalizedPaymentStatus,
    status: normalizedStatus,
  };
};

const isManualReservationStatus = (value) =>
  ['Pending', 'Confirmed', 'Holding', 'Completed', 'Cancelled'].includes(value);

const buildEmailCopy = (reservation, roomName, customerName) => {
  const checkIn = formatBookingDateTime(reservation.check_in);
  const checkOut = formatBookingDateTime(reservation.check_out);
  const total = Number(reservation.total_amount || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const isPaid = String(reservation.payment_status || '').toLowerCase() === 'paid';
  const heading = isPaid ? 'Payment Receipt' : 'Booking Receipt';
  const paymentMethod = reservation.payment_method || 'N/A';
  const paymentStatus = reservation.payment_status || 'Pending';
  const guestSummary = `${reservation.guests_adults || 1} Adult(s), ${reservation.guests_children || 0} Child(ren)`;
  const statusCopy = isPaid
    ? 'Your reservation has been secured and payment has been successfully received.'
    : 'Your reservation request has been recorded. Please settle payment at the front desk upon arrival.';

  return {
    subject: `${heading} - ${reservation.reservation_no} | The Platinum Haven`,
    text: [
      `The Platinum Haven`,
      `${heading}`,
      '',
      `Dear ${customerName},`,
      '',
      statusCopy,
      '',
      `Reservation Reference: ${reservation.reservation_no}`,
      `Room: ${roomName}`,
      `Check-in: ${checkIn}`,
      `Check-out: ${checkOut}`,
      `Guests: ${guestSummary}`,
      `Payment Method: ${paymentMethod}`,
      `Payment Status: ${paymentStatus}`,
      `Total Amount: PHP ${total}`,
      '',
      'If you need any assistance before your stay, please reply to this email.',
      '',
      'Thank you for choosing The Platinum Haven.',
    ].join('\n'),
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { margin: 0; padding: 24px 0; background: #f3f4f6; font-family: Arial, Helvetica, sans-serif; color: #1f2937; }
          .wrapper { width: 100%; }
          .card { width: 100%; max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 14px 40px rgba(15, 23, 42, 0.10); }
          .header { padding: 34px 36px 28px; background: linear-gradient(135deg, #173826 0%, #1f5136 100%); color: #ffffff; }
          .brand-mark { width: 52px; height: 52px; margin: 0 auto 18px; border-radius: 50%; background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.25); color: #ffffff; font-size: 22px; font-weight: 700; line-height: 52px; text-align: center; }
          .eyebrow { margin: 0 0 10px; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #cfe6d2; }
          .header h1 { margin: 0; font-size: 30px; line-height: 1.1; font-weight: 700; }
          .header p { margin: 10px 0 0; font-size: 15px; line-height: 1.6; color: #e5f3e8; max-width: 480px; }
          .body { padding: 32px 36px 20px; }
          .greeting { margin: 0 0 10px; font-size: 16px; line-height: 1.7; color: #374151; }
          .reference-box { margin: 24px 0; padding: 20px 24px; border: 1px solid #d1d5db; border-radius: 14px; background: #fafafa; text-align: center; }
          .reference-label { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: 0.14em; color: #6b7280; margin-bottom: 8px; }
          .reference-value { font-size: 28px; font-weight: 700; letter-spacing: 0.06em; color: #173826; }
          .section-title { margin: 0 0 14px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.14em; color: #6b7280; }
          .details { border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
          .row { width: 100%; border-collapse: collapse; }
          .row td { padding: 14px 0; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
          .row tr:last-child td { border-bottom: none; }
          .label { width: 42%; font-size: 13px; color: #6b7280; }
          .value { font-size: 14px; font-weight: 700; color: #173826; text-align: right; }
          .payment-box { margin: 22px 0 0; padding: 18px 22px; border-radius: 14px; background: #eef8f1; border: 1px solid #d7eadb; }
          .payment-box table { width: 100%; border-collapse: collapse; }
          .payment-box td { padding: 0; }
          .payment-label { font-size: 13px; color: #4b5563; }
          .payment-value { font-size: 24px; font-weight: 700; color: #173826; text-align: right; }
          .note { margin: 22px 0 0; font-size: 14px; line-height: 1.7; color: #4b5563; }
          .pill { display: inline-block; margin-top: 14px; padding: 8px 12px; border-radius: 999px; background: ${isPaid ? '#dcfce7' : '#fef3c7'}; color: ${isPaid ? '#166534' : '#92400e'}; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
          .footer { padding: 22px 36px 28px; background: #fbfbfb; color: #6b7280; font-size: 12px; line-height: 1.7; border-top: 1px solid #eceff1; }
          .footer strong { color: #173826; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="card">
            <div class="header">
              <div class="brand-mark">PH</div>
              <p class="eyebrow">The Platinum Haven</p>
              <h1>${heading}</h1>
              <p>${statusCopy}</p>
              <span class="pill">${paymentStatus}</span>
            </div>
            <div class="body">
              <p class="greeting">Dear <strong>${customerName}</strong>,</p>
              <p class="greeting">Thank you for choosing The Platinum Haven. Below is your official booking summary for your records.</p>

              <div class="reference-box">
                <span class="reference-label">Reservation Reference</span>
                <span class="reference-value">${reservation.reservation_no}</span>
              </div>

              <p class="section-title">Booking Details</p>
              <div class="details">
                <table class="row" role="presentation">
                  <tr><td class="label">Room Accommodation</td><td class="value">${roomName}</td></tr>
                  <tr><td class="label">Check-in Schedule</td><td class="value">${checkIn}</td></tr>
                  <tr><td class="label">Check-out Schedule</td><td class="value">${checkOut}</td></tr>
                  <tr><td class="label">Guests</td><td class="value">${guestSummary}</td></tr>
                  <tr><td class="label">Payment Method</td><td class="value">${paymentMethod}</td></tr>
                  <tr><td class="label">Payment Status</td><td class="value">${paymentStatus}</td></tr>
                </table>
              </div>

              <div class="payment-box">
                <table role="presentation">
                  <tr>
                    <td class="payment-label">Total Amount</td>
                    <td class="payment-value">PHP ${total}</td>
                  </tr>
                </table>
              </div>

              <p class="note">If you need assistance before your stay, you may reply directly to this email and our team will get back to you.</p>
            </div>
            <div class="footer">
              <strong>The Platinum Haven</strong><br />
              Nature's Luxury Retreat<br />
              Reservation Desk Receipt Notice<br />
              This email serves as your booking confirmation and payment record.
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  };
};

const sendEmailReceipt = async (email, customerName, reservation, roomName) => {
  try {
    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASS;
    if (!gmailUser || !gmailPass) {
      console.log('Gmail credentials missing');
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    });
    const message = buildEmailCopy(reservation, roomName, customerName);

    await transporter.sendMail({
      from: `"The Platinum Haven" <${gmailUser}>`,
      to: email,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  } catch (error) {
    console.error('Email error:', error.message);
  }
};

const sendReservationNotifications = async (reservation) => {
  try {
    const guest = await getGuestReservationDetails(reservation.id);
    if (!guest) return;

    const smsMessage = [
      'The Platinum Haven',
      String(reservation.payment_status || '').toLowerCase() === 'paid'
        ? 'Payment received.'
        : 'Booking request received.',
      `Reservation: ${reservation.reservation_no}`,
      `Room: ${guest.room_name}`,
      `Check-in: ${formatBookingDateTime(reservation.check_in)}`,
      `Check-out: ${formatBookingDateTime(reservation.check_out)}`,
      `Total: PHP ${Number(reservation.total_amount || 0).toLocaleString('en-PH')}`,
    ].join('\n');

    if (guest.phone) await sendTextBee(guest.phone, smsMessage);
    if (guest.email) await sendEmailReceipt(guest.email, guest.full_name, reservation, guest.room_name);
  } catch (error) {
    console.error('Notification error:', error.message);
  }
};

const syncReservationStatuses = async (reservations) => {
  const updates = [];

  for (const reservation of reservations) {
    const derivedStatus = resolveReservationStatus({
      status: reservation.status,
      paymentStatus: reservation.payment_status,
      paymentMethod: reservation.payment_method,
      checkOut: reservation.check_out,
    });

    if (derivedStatus !== reservation.status) {
      updates.push(
        pool.query(
          'UPDATE reservations SET status = $1 WHERE id = $2',
          [derivedStatus, reservation.id]
        )
      );
      reservation.status = derivedStatus;
    }

    if (reservation.status === 'Completed' && reservation.room_id) {
      await ensureHousekeepingTaskForReservation({ reservation });
    }
  }

  if (updates.length) {
    await Promise.all(updates);
  }
};

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const isStaff = ['staff', 'manager', 'admin'].includes(req.user.role);

    let query = `
      SELECT r.*,
        p.full_name AS guest_name, p.email AS guest_email,
        rm.room_number, rm.name AS room_name, rm.type AS room_type,
        EXISTS(SELECT 1 FROM feedback f WHERE f.reservation_id = r.id) AS has_reviewed
      FROM reservations r
      LEFT JOIN profiles p ON r.customer_id = p.id
      LEFT JOIN rooms rm ON r.room_id = rm.id
      WHERE 1=1
    `;
    const params = [];
    let i = 1;

    if (!isStaff) {
      query += ` AND r.customer_id = $${i++}`;
      params.push(req.user.id);
    }

    if (status && status !== 'All Statuses') {
      query += ` AND r.status = $${i++}`;
      params.push(status);
    }

    if (search) {
      query += ` AND (r.reservation_no ILIKE $${i} OR p.full_name ILIKE $${i})`;
      params.push(`%${search}%`);
      i++;
    }

    query += ' ORDER BY r.created_at DESC';

    const { rows } = await pool.query(query, params);
    await syncReservationStatuses(rows);
    res.json(rows.map(serializeReservation));
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const {
      room_id,
      check_in,
      check_out,
      guests_adults,
      guests_children,
      special_request,
      total_amount,
      payment_method,
      addon_ids = [],
    } = req.body;

    if (payment_method && payment_method !== 'PayPal') {
      return res.status(400).json({ error: 'PayPal is the only supported payment method.' });
    }

    const reservationState = deriveReservationState({
      paymentMethod: payment_method,
      checkOut: check_out,
    });
    const handledBy = ['staff', 'manager', 'admin'].includes(req.user.role) ? req.user.id : null;

    const reservationNo = `RES-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const { rows } = await pool.query(
      `INSERT INTO reservations
        (reservation_no, customer_id, room_id, check_in, check_out,
         guests_adults, guests_children, special_request,
         total_amount, payment_method, status, payment_status, handled_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        reservationNo,
        req.user.id,
        room_id,
        check_in,
        check_out,
        guests_adults || 1,
        guests_children || 0,
        special_request,
        total_amount,
        reservationState.paymentMethod,
        reservationState.status,
        reservationState.paymentStatus,
        handledBy,
      ]
    );

    if (addon_ids.length) {
      const addonRows = await pool.query(
        'SELECT id, price FROM addons WHERE id = ANY($1)',
        [addon_ids]
      );

      for (const addon of addonRows.rows) {
        await pool.query(
          `INSERT INTO reservation_addons (reservation_id, addon_id, price_snapshot)
           VALUES ($1, $2, $3)`,
          [rows[0].id, addon.id, addon.price]
        );
        await pool.query('UPDATE addons SET stock = stock - 1 WHERE id = $1', [addon.id]);
      }
    }

    await sendReservationNotifications(rows[0]);
    res.status(201).json(serializeReservation(rows[0]));
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { status, payment_status } = req.body;
    const current = await pool.query(
      'SELECT * FROM reservations WHERE id = $1',
      [req.params.id]
    );
    if (!current.rows[0]) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    const currentReservation = current.rows[0];
    const requestedStatus = typeof status === 'string' ? status.trim() : '';
    const requestedPaymentStatus =
      typeof payment_status === 'string' ? payment_status.trim() : '';

    const nextState = isManualReservationStatus(requestedStatus)
      ? {
          status: requestedStatus,
          paymentStatus: requestedPaymentStatus || currentReservation.payment_status,
          paymentMethod: currentReservation.payment_method,
        }
      : deriveReservationState({
          status: requestedStatus || (requestedPaymentStatus === 'Paid' ? 'Confirmed' : undefined),
          paymentStatus: requestedPaymentStatus || currentReservation.payment_status,
          paymentMethod: currentReservation.payment_method,
          checkOut: currentReservation.check_out,
        });
    const handledBy = ['staff', 'manager', 'admin'].includes(req.user.role) ? req.user.id : null;
    const { rows } = await pool.query(
      `UPDATE reservations SET
        status = COALESCE($1, status),
        payment_status = COALESCE($2, payment_status),
        handled_by = COALESCE($3, handled_by)
       WHERE id = $4
       RETURNING *`,
      [nextState.status, nextState.paymentStatus, handledBy, req.params.id]
    );

    const reservation = rows[0];
    const becameConfirmed =
      currentReservation.status !== 'Confirmed' && reservation.status === 'Confirmed';
    const becamePaid =
      String(currentReservation.payment_status || '').toLowerCase() !== 'paid' &&
      String(reservation.payment_status || '').toLowerCase() === 'paid';

    if (reservation.status === 'Completed' && reservation.room_id) {
      await ensureHousekeepingTaskForReservation({ reservation });
    }

    if (becameConfirmed || becamePaid) {
      await sendReservationNotifications(reservation);
    }

    res.json(serializeReservation(reservation));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, adminOnly, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM reservations WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
