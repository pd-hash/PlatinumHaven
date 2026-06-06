const router = require('express').Router();
const pool = require('../db');
const { authenticate, adminOnly } = require('../middleware/auth');
const multer = require('multer');
const { uploadRoomImage } = require('../lib/storage');

const buildMonthRange = (month) => {
  const now = new Date();
  const baseDate = month ? new Date(`${month}-01`) : now;
  const year = baseDate.getFullYear();
  const mon = baseDate.getMonth();

  return {
    year,
    mon,
    startDate: formatLocalDate(new Date(year, mon, 1)),
    endDate: formatLocalDate(new Date(year, mon + 1, 0)),
  };
};

const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildRoomAvailabilityMap = async (roomId, month) => {
  const { startDate, endDate } = buildMonthRange(month);
  const { rows } = await pool.query(
    `
      SELECT (check_in AT TIME ZONE 'Asia/Manila')::date AS check_in,
             (check_out AT TIME ZONE 'Asia/Manila')::date AS check_out,
             status
      FROM reservations
      WHERE room_id = $1
        AND status NOT IN ('Cancelled', 'Completed')
        AND (check_out AT TIME ZONE 'Asia/Manila')::date > $2::date
        AND (check_in AT TIME ZONE 'Asia/Manila')::date <= $3::date
      ORDER BY check_in
    `,
    [roomId, startDate, endDate]
  );

  const dayMap = {};
  const cursor = new Date(startDate);
  const end = new Date(endDate);

  while (cursor <= end) {
    dayMap[formatLocalDate(cursor)] = 'available';
    cursor.setDate(cursor.getDate() + 1);
  }

  rows.forEach((reservation) => {
    const inDate = new Date(reservation.check_in);
    const outDate = new Date(reservation.check_out);
    const dayCursor = new Date(inDate);

    while (dayCursor < outDate) {
      const key = formatLocalDate(dayCursor);
      if (dayMap[key] !== undefined) {
        dayMap[key] = 'fully_booked';
      }
      dayCursor.setDate(dayCursor.getDate() + 1);
    }
  });

  return dayMap;
};

const summarizeMonthlyAvailability = (room, dayMap, month) => {
  if (room.status === 'Maintenance' || room.status === 'Unavailable') {
    return {
      monthly_availability_status: 'unavailable',
      available_days_this_month: 0,
      bookable_days_this_month: 0,
    };
  }

  const { year, mon } = buildMonthRange(month);
  const today = new Date();
  const cursor = new Date(year, mon, 1);
  const end = new Date(year, mon + 1, 0);
  const isCurrentMonth =
    today.getFullYear() === year &&
    today.getMonth() === mon;

  if (isCurrentMonth && today > cursor) {
    cursor.setDate(today.getDate());
  }

  let availableDays = 0;
  let partialDays = 0;
  let fullyBookedDays = 0;
  let bookableDays = 0;

  while (cursor <= end) {
    const key = formatLocalDate(cursor);
    const status = dayMap[key] || 'available';

    if (status === 'available') {
      availableDays += 1;
      bookableDays += 1;
    } else if (status === 'partially_booked') {
      partialDays += 1;
      bookableDays += 1;
    } else {
      fullyBookedDays += 1;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  let monthlyStatus = 'available';
  if (bookableDays === 0) {
    monthlyStatus = 'fully_booked';
  } else if (fullyBookedDays > 0 || partialDays > 0) {
    monthlyStatus = 'limited';
  }

  return {
    monthly_availability_status: monthlyStatus,
    available_days_this_month: availableDays,
    bookable_days_this_month: bookableDays,
  };
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

router.post('/upload-image', authenticate, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { publicUrl } = await uploadRoomImage(req.file);
    res.json({ url: publicUrl });
  } catch (err) {
    next(err);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { type, search, status, include_monthly_availability, month } = req.query;
    let query = `
      SELECT
        rooms.*,
        COALESCE(room_feedback.average_rating, 0)::float AS average_rating,
        COALESCE(room_feedback.rating_count, 0)::int AS rating_count
      FROM rooms
      LEFT JOIN (
        SELECT
          reservations.room_id,
          ROUND(AVG(feedback.rating)::numeric, 1) AS average_rating,
          COUNT(feedback.id)::int AS rating_count
        FROM feedback
        INNER JOIN reservations ON reservations.id = feedback.reservation_id
        GROUP BY reservations.room_id
      ) AS room_feedback ON room_feedback.room_id = rooms.id
      WHERE 1=1
    `;
    const params = [];
    let i = 1;

    if (type && type !== 'All Types') {
      query += ` AND rooms.type = $${i++}`;
      params.push(type);
    }
    if (search) {
      query += ` AND (rooms.name ILIKE $${i} OR rooms.room_number ILIKE $${i})`;
      params.push(`%${search}%`);
      i += 1;
    }
    if (status && status !== 'All Status' && status !== 'Available') {
      query += ` AND rooms.status = $${i++}`;
      params.push(status);
    }

    query += ' ORDER BY rooms.created_at DESC';
    const { rows } = await pool.query(query, params);

    if (include_monthly_availability === 'true') {
      const enrichedRooms = await Promise.all(
        rows.map(async (room) => {
          const dayMap = await buildRoomAvailabilityMap(room.id, month);
          return {
            ...room,
            ...summarizeMonthlyAvailability(room, dayMap, month),
          };
        })
      );
      return res.json(enrichedRooms);
    }

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, adminOnly, async (req, res, next) => {
  try {
    const { room_number, name, type, price, beds, max_guests, description, image_url } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO rooms (room_number, name, type, price, beds, max_guests, description, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [room_number, name, type, price, beds, max_guests, description, image_url]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, adminOnly, async (req, res, next) => {
  try {
    const { name, type, price, beds, max_guests, description, status, image_url } = req.body;
    const { rows } = await pool.query(
      `UPDATE rooms SET name=$1, type=$2, price=$3, beds=$4, max_guests=$5,
       description=$6, status=$7, image_url=$8 WHERE id=$9 RETURNING *`,
      [name, type, price, beds, max_guests, description, status, image_url, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Room not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, adminOnly, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM rooms WHERE id=$1', [req.params.id]);
    res.json({ message: 'Room deleted' });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/availability', authenticate, async (req, res, next) => {
  try {
    const { month } = req.query;
    const dayMap = await buildRoomAvailabilityMap(req.params.id, month);
    const result = Object.entries(dayMap).map(([date, status]) => ({ date, status }));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
