const bcrypt = require('bcryptjs');
const { Client } = require('pg');

const main = async () => {
  const hash = await bcrypt.hash('Admin123', 12);
  const client = new Client({
    host: '127.0.0.1',
    port: 55432,
    database: 'verdant_haven',
    user: 'postgres',
    password: 'VerdantLocal2026!',
  });

  await client.connect();
  const users = [
    ['Admin User', 'admin@verdant.local', 'admin'],
    ['Admin User', 'admin@verdanthaven.com', 'admin'],
    ['Manager User', 'manager@verdanthaven.com', 'manager'],
    ['Staff User', 'staff@verdanthaven.com', 'staff'],
  ];

  for (const [fullName, email, role] of users) {
    await client.query(
      `INSERT INTO profiles
        (full_name, email, password_hash, role, is_approved, approval_status, is_active)
       VALUES ($1, $2, $3, $4, true, 'Approved', true)
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         is_approved = true,
         approval_status = 'Approved',
         is_active = true`,
      [fullName, email, hash, role]
    );
  }

  const { rows } = await client.query(
    "SELECT id, email, role, is_active FROM profiles WHERE email LIKE '%verdant%' ORDER BY id"
  );
  console.log(rows);
  await client.end();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
