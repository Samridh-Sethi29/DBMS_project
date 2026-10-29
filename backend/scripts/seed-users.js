// backend/scripts/seed-users.js
// Dev-only seed script to create test users with real bcrypt password hashes.
// Uses existing write pool (role_developer). Idempotent.

import bcrypt from 'bcrypt';
import 'dotenv/config';
import { writePool } from '../src/config/db.js';

// 1. Safety check: refuse to run in production
if (process.env.NODE_ENV === 'production') {
  console.error('[ABORT] Safety check failed: seed-users.js cannot be run in production.');
  process.exit(1);
}

const SEED_PASSWORD = process.env.SEED_PASSWORD || 'Test@12345';
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;

const SEED_USERS = [
  {
    email: 'admin@test.edu',
    name: 'Test Admin',
    role: 'admin',
    isAdmin: true,
  },
  {
    email: 'chair1@test.edu',
    name: 'Test Chair 1',
    role: 'user',
    roll_no: 'TEST001',
    department_id: 1,
    year_of_study: 2,
    phone: '9000000001',
    club_id: 1,
    member_role: 'chair',
    position_title: 'Chairperson',
    status: 'approved',
  },
  {
    email: 'vice1@test.edu',
    name: 'Test Vice 1',
    role: 'user',
    roll_no: 'TEST002',
    department_id: 1,
    year_of_study: 2,
    phone: '9000000002',
    club_id: 1,
    member_role: 'vice_chair',
    position_title: 'Vice Chairperson',
    status: 'approved',
  },
  {
    email: 'core1@test.edu',
    name: 'Test Core 1',
    role: 'user',
    roll_no: 'TEST003',
    department_id: 1,
    year_of_study: 2,
    phone: '9000000003',
    club_id: 1,
    member_role: 'core_member',
    position_title: 'Core Member',
    status: 'approved',
  },
  {
    email: 'member1@test.edu',
    name: 'Test Member 1',
    role: 'user',
    roll_no: 'TEST004',
    department_id: 1,
    year_of_study: 2,
    phone: '9000000004',
    club_id: 1,
    member_role: 'member',
    position_title: null,
    status: 'approved',
  },
  {
    email: 'pending1@test.edu',
    name: 'Test Pending 1',
    role: 'user',
    roll_no: 'TEST005',
    department_id: 1,
    year_of_study: 2,
    phone: '9000000005',
    club_id: 1,
    member_role: 'member',
    position_title: null,
    status: 'pending',
  },
  {
    email: 'chair2@test.edu',
    name: 'Test Chair 2',
    role: 'user',
    roll_no: 'TEST006',
    department_id: 1,
    year_of_study: 2,
    phone: '9000000006',
    club_id: 2,
    member_role: 'chair',
    position_title: 'Chairperson',
    status: 'approved',
  },
  {
    email: 'core2@test.edu',
    name: 'Test Core 2',
    role: 'user',
    roll_no: 'TEST007',
    department_id: 1,
    year_of_study: 2,
    phone: '9000000007',
    club_id: 2,
    member_role: 'core_member',
    position_title: 'Core Member',
    status: 'approved',
  },
  {
    email: 'plain@test.edu',
    name: 'Test Plain',
    role: 'user',
    roll_no: 'TEST008',
    department_id: 1,
    year_of_study: 2,
    phone: '9000000008',
    club_id: null,
  },
];

async function ensureClubsAndEvents(conn, adminUserId) {
  // Ensure Club 1 exists
  const [c1] = await conn.execute('SELECT club_id FROM clubs WHERE club_id = 1');
  if (!c1.length) {
    await conn.execute(
      `INSERT INTO clubs (club_id, name, tagline, description, category_id, status)
       VALUES (1, 'Coding Club', 'Build. Break. Repeat.', 'Coding sessions and hackathons.', 1, 'active')
       ON DUPLICATE KEY UPDATE name = VALUES(name)`
    );
  }

  // Ensure Club 2 exists
  const [c2] = await conn.execute('SELECT club_id FROM clubs WHERE club_id = 2');
  if (!c2.length) {
    await conn.execute(
      `INSERT INTO clubs (club_id, name, tagline, description, category_id, status)
       VALUES (2, 'Music Club', 'Feel the rhythm.', 'Jamming sessions and music events.', 2, 'active')
       ON DUPLICATE KEY UPDATE name = VALUES(name)`
    );
  }

  // Ensure Venue 2 exists
  const [v2] = await conn.execute('SELECT venue_id, capacity FROM venues WHERE venue_id = 2');
  let cap = 60;
  if (!v2.length) {
    await conn.execute(
      `INSERT INTO venues (venue_id, name, location, capacity)
       VALUES (2, 'Lab 3', 'CE Block', 60)
       ON DUPLICATE KEY UPDATE capacity = VALUES(capacity)`
    );
  } else {
    cap = v2[0].capacity;
  }

  // Ensure one scheduled future event for Club 2 at Venue 2
  const [evt] = await conn.execute(
    `SELECT event_id FROM events
     WHERE club_id = 2 AND venue_id = 2 AND status = 'scheduled' AND start_datetime > NOW()
     LIMIT 1`
  );
  if (!evt.length) {
    const maxPart = Math.min(cap, 50);
    await conn.execute(
      `INSERT INTO events (club_id, venue_id, title, description, event_type,
                           start_datetime, end_datetime, registration_deadline,
                           max_participants, signup_mode, is_tentative, status, created_by)
       VALUES (2, 2, 'Music Jam Night', 'Live acoustic jam and open mic.', 'cultural',
               DATE_ADD(NOW(), INTERVAL 45 DAY),
               DATE_ADD(DATE_ADD(NOW(), INTERVAL 45 DAY), INTERVAL 2 HOUR),
               DATE_ADD(NOW(), INTERVAL 40 DAY),
               ?, 'internal', FALSE, 'scheduled', ?)`,
      [maxPart, adminUserId]
    );
  }
}

async function seedUser(conn, userDef, passwordHash, adminUserId) {
  await conn.beginTransaction();
  try {
    // 1. Look up user by email
    const [existing] = await conn.execute('SELECT user_id FROM users WHERE email = ?', [userDef.email]);
    let userId;

    if (existing.length > 0) {
      userId = existing[0].user_id;
      await conn.execute(
        'UPDATE users SET name = ?, password_hash = ?, role = ?, is_active = TRUE WHERE user_id = ?',
        [userDef.name, passwordHash, userDef.role, userId]
      );
    } else {
      const [insertRes] = await conn.execute(
        'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, TRUE)',
        [userDef.name, userDef.email, passwordHash, userDef.role]
      );
      userId = insertRes.insertId;
    }

    // 2. Students table row (skip for admin)
    if (!userDef.isAdmin) {
      const [existingStudent] = await conn.execute('SELECT student_id FROM students WHERE student_id = ?', [userId]);
      if (existingStudent.length > 0) {
        await conn.execute(
          'UPDATE students SET roll_no = ?, department_id = ?, year_of_study = ?, phone = ? WHERE student_id = ?',
          [userDef.roll_no.toUpperCase(), userDef.department_id, userDef.year_of_study, userDef.phone, userId]
        );
      } else {
        await conn.execute(
          `INSERT INTO students (student_id, roll_no, department_id, year_of_study, phone)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             roll_no = VALUES(roll_no),
             department_id = VALUES(department_id),
             year_of_study = VALUES(year_of_study),
             phone = VALUES(phone)`,
          [userId, userDef.roll_no.toUpperCase(), userDef.department_id, userDef.year_of_study, userDef.phone]
        );
      }

      // 3. Club membership
      if (userDef.club_id) {
        const [existingMember] = await conn.execute(
          'SELECT member_role, status FROM club_members WHERE club_id = ? AND student_id = ?',
          [userDef.club_id, userId]
        );

        if (existingMember.length > 0) {
          // If updating to chair, ensure no other member holds chair
          if (userDef.member_role === 'chair') {
            await conn.execute(
              `UPDATE club_members SET member_role = 'core_member'
               WHERE club_id = ? AND member_role = 'chair' AND student_id <> ?`,
              [userDef.club_id, userId]
            );
          }
          await conn.execute(
            `UPDATE club_members
             SET member_role = ?, position_title = ?, status = ?, granted_by = ?, role_granted_at = NOW()
             WHERE club_id = ? AND student_id = ?`,
            [
              userDef.member_role,
              userDef.position_title || null,
              userDef.status,
              userDef.status === 'approved' ? adminUserId : null,
              userDef.club_id,
              userId,
            ]
          );
        } else {
          // New member insertion: ensure no existing chair if inserting chair
          if (userDef.member_role === 'chair') {
            await conn.execute(
              `UPDATE club_members SET member_role = 'core_member'
               WHERE club_id = ? AND member_role = 'chair'`,
              [userDef.club_id]
            );
          }
          await conn.execute(
            `INSERT INTO club_members (club_id, student_id, member_role, position_title, status, granted_by, role_granted_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [
              userDef.club_id,
              userId,
              userDef.member_role,
              userDef.position_title || null,
              userDef.status,
              userDef.status === 'approved' ? adminUserId : null,
            ]
          );
        }
      } else {
        await conn.execute('DELETE FROM club_members WHERE student_id = ?', [userId]);
      }
    }

    await conn.commit();
    return userId;
  } catch (err) {
    await conn.rollback();
    throw err;
  }
}

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, BCRYPT_ROUNDS);

  let conn;
  try {
    conn = await writePool.getConnection();

    // First ensure or seed the admin so we have adminUserId for granter/creator FKs
    const adminDef = SEED_USERS.find(u => u.isAdmin);
    const adminUserId = await seedUser(conn, adminDef, passwordHash, null);

    // Ensure Club 1, Club 2, and future event on Club 2 at Venue 2
    await ensureClubsAndEvents(conn, adminUserId);

    // Seed remaining users
    for (const u of SEED_USERS) {
      if (!u.isAdmin) {
        await seedUser(conn, u, passwordHash, adminUserId);
      }
    }

    // Fetch summary for display
    const [rows] = await conn.execute(
      `SELECT u.email, u.role,
              COALESCE(cm.member_role, 'none') AS \`club roles\`,
              COALESCE(CAST(cm.club_id AS CHAR), 'none') AS \`club id\`
       FROM users u
       LEFT JOIN club_members cm ON cm.student_id = u.user_id
       WHERE u.email LIKE '%@test.edu'
       ORDER BY u.email`
    );

    console.log('\n--- Seeded Users Summary ---');
    console.table(rows);
    console.log(`Shared password reminder: ${SEED_PASSWORD}\n`);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  } finally {
    if (conn) conn.release();
    await writePool.end();
  }
}

main();
