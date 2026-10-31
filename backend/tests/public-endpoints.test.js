import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { writePool } from '../src/config/db.js';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const fixturePrefix = `TEST_FIXTURE_${randomUUID().replaceAll('-', '')}`;
const fixtures = {
  clubIds: [],
  eventIds: [],
  eventIdsByLabel: {},
  userId: null,
  registrationId: null,
  certificateId: null,
  activeClubId: null,
  categoryId: null,
  eventIdsByMode: {},
  names: {},
  certificateCode: `${fixturePrefix.slice(0, 30)}_CERT`,
};
const listCalls = [];
const forbiddenKeys = new Set([
  'email', 'password_hash', 'passwordHash', 'phone', 'roll_no', 'rollNo',
  'is_active', 'created_by', 'db_user',
]);
const imageKeys = new Set(['logoUrl', 'photoUrl', 'posterUrl', 'imageUrl', 'thumbnailUrl']);
const sqlText = /\b(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|UNION|FROM|JOIN|WHERE|HAVING|ORDER\s+BY|GROUP\s+BY|LIMIT|OFFSET|SQLSTATE)\b|\bER_[A-Z0-9_]*\b|\bsqlMessage\b/i;
const stackTrace = /(?:\bat\s+.+:\d+:\d+\b|\b(?:Error|Exception):\s)/i;
const emailValue = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const isoDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const publicClubContactSchema = z.object({
  name: z.string(),
  designation: z.string(),
  isFaculty: z.boolean(),
}).strict();
const publicClubLinkSchema = z.object({
  platform: z.enum(['website', 'facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'blog', 'other']),
  url: z.string().url(),
}).strict();
const publicPlaceholderEventSchema = z.object({
  isPlaceholder: z.boolean(),
}).passthrough();
const publicEventListItemSchema = z.object({
  is_placeholder: z.union([z.boolean(), z.literal(0), z.literal(1)]),
}).passthrough();

function scanPublicJson(value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanPublicJson(item, `${path}[${index}]`));
    return;
  }
  if (value === null || typeof value !== 'object') return;

  for (const [key, child] of Object.entries(value)) {
    assert.equal(forbiddenKeys.has(key), false, `${path}.${key} must not be public`);
    if (typeof child === 'string') {
      if (emailValue.test(child)) {
        assert.equal(key, 'contactEmail', `${path}.${key} is the only public email field`);
        assert.match(child, /^[a-z0-9._+-]+@svnit\.ac\.in$/i, `${path}.${key} must be a generic SVNIT club address`);
      }
      if (/(datetime|issuedat)$/i.test(key)) {
        assert.match(child, isoDateTime, `${path}.${key} must be an ISO 8601 datetime`);
        assert.equal(new Date(child).toISOString(), child, `${path}.${key} must be a valid ISO datetime`);
      }
      if (imageKeys.has(key)) {
        assert.ok(
          child.startsWith('http://') || child.startsWith('https://'),
          `${path}.${key} must be null or an absolute HTTP(S) URL; got ${child}`,
        );
      }
    }
    scanPublicJson(child, `${path}.${key}`);
  }
}

function assertResponse(response, body) {
  scanPublicJson(body);
  if (response.status === 200) {
    assert.ok(body && typeof body === 'object' && !Array.isArray(body), 'success body must be an object');
    assert.ok(Object.hasOwn(body, 'data'), 'success body must have data');
    assert.ok(Object.hasOwn(body, 'meta'), 'success body must have meta');
    assert.equal(typeof body.meta.executionTimeMs, 'number', 'meta.executionTimeMs must be a number');
    return;
  }

  assert.deepEqual(Object.keys(body).sort(), ['error'], 'error body must contain only error');
  assert.equal(typeof body.error.code, 'string', 'error code must be a string');
  assert.equal(typeof body.error.message, 'string', 'error message must be a string');
  if (body.error.code === 'VALIDATION_ERROR') {
    assert.deepEqual(
      Object.keys(body.error).sort(),
      ['code', 'fields', 'message'],
      'VALIDATION_ERROR must contain code, message, and fields only',
    );
    assert.ok(Array.isArray(body.error.fields), 'VALIDATION_ERROR fields must be an array');
    for (const field of body.error.fields) {
      assert.deepEqual(Object.keys(field).sort(), ['field', 'message']);
      assert.equal(typeof field.field, 'string');
      assert.equal(typeof field.message, 'string');
    }
  } else {
    assert.deepEqual(Object.keys(body.error).sort(), ['code', 'message'], 'non-validation errors must contain only code and message');
  }
  const scanErrorText = value => {
    if (Array.isArray(value)) {
      value.forEach(scanErrorText);
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(scanErrorText);
    } else if (typeof value === 'string') {
      assert.doesNotMatch(value, sqlText, 'error text must not expose SQL details');
      assert.doesNotMatch(value, stackTrace, 'error text must not expose stack traces');
    }
  };
  scanErrorText(body.error);
}

async function request(path, options = {}) {
  const url = new URL(path, BASE_URL);
  const startedAt = performance.now();
  const fetchOptions = options;
  const response = await fetch(url, fetchOptions);
  const body = await response.json();
  const elapsedMs = performance.now() - startedAt;
  assertResponse(response, body);

  const publicCachePath = url.pathname === '/api/clubs'
    || /^\/api\/clubs\/\d+(?:\/events\/(?:upcoming|past))?$/.test(url.pathname)
    || /^\/api\/events\/\d+(?:\/memories)?$/.test(url.pathname);
  if ((fetchOptions.method || 'GET') === 'GET' && response.status === 200 && publicCachePath) {
    assert.equal(response.headers.get('cache-control'), 'public, max-age=60');
  }
  if ((fetchOptions.method || 'GET') === 'GET'
      && (url.pathname === '/api/clubs' || /\/events\/(upcoming|past)$/.test(url.pathname))) {
    listCalls.push({ path: `${url.pathname}${url.search}`, elapsedMs, metaMs: body.meta?.executionTimeMs });
  }
  return { response, body, elapsedMs };
}

function assertStatus(response, expectedStatus, description = '') {
  assert.equal(response.status, expectedStatus, description);
}

function assertImageUrl(value, label) {
  assert.ok(value === null || /^https?:\/\//.test(value), `${label} must be null or an absolute HTTP(S) URL`);
}

function dateTime(daysFromNow, hour = 10) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + daysFromNow);
  value.setUTCHours(hour, 0, 0, 0);
  return value;
}

function mysqlDateTime(value) {
  return value.toISOString().slice(0, 19).replace('T', ' ');
}

async function insertFixtureEvent({
  label,
  daysFromNow,
  status,
  signupMode = 'none',
  tentative = false,
  placeholder = false,
}) {
  const title = `${fixturePrefix}_${label}`;
  const start = dateTime(daysFromNow, 10);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const [venues] = await writePool.execute(
    `SELECT v.venue_id
     FROM venues v
     WHERE NOT EXISTS (
       SELECT 1 FROM events e
       WHERE e.venue_id = v.venue_id
         AND e.status <> 'cancelled'
         AND e.start_datetime < ?
         AND e.end_datetime > ?
     )
     ORDER BY v.venue_id
     LIMIT 1`,
    [mysqlDateTime(end), mysqlDateTime(start)],
  );
  assert.ok(venues.length, `a free venue must be available for fixture ${label}`);

  const externalUrl = signupMode === 'external' ? 'https://example.invalid/signup' : null;
  const maxParticipants = signupMode === 'internal' ? 20 : null;
  const description = `${fixturePrefix} description for ${label}`;
  const [result] = await writePool.execute(
    `INSERT INTO events
      (club_id, venue_id, title, description, event_type, start_datetime, end_datetime,
       is_tentative, is_placeholder, recap_text, signup_mode, external_signup_url, max_participants,
       status, created_by)
     VALUES (?, ?, ?, ?, 'technical', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fixtures.activeClubId,
      venues[0].venue_id,
      title,
      description,
      mysqlDateTime(start),
      mysqlDateTime(end),
      tentative,
      placeholder,
      status === 'completed' ? `${fixturePrefix} event recap` : null,
      signupMode,
      externalUrl,
      maxParticipants,
      status,
      fixtures.userId,
    ],
  );
  fixtures.eventIds.push(result.insertId);
  fixtures.eventIdsByLabel[label] = result.insertId;
  fixtures.names[label] = title;
  if (['none', 'internal', 'external'].includes(label)) {
    fixtures.eventIdsByMode[label] = result.insertId;
  }
  return result.insertId;
}

before(async () => {
  const [[club]] = await writePool.execute(
    "SELECT club_id, category_id FROM clubs WHERE name = 'Coding Club' AND status = 'active'",
  );
  assert.ok(club, 'the seeded active Coding Club must exist');
  fixtures.activeClubId = club.club_id;
  fixtures.categoryId = club.category_id;

  const [[department]] = await writePool.execute('SELECT department_id FROM departments ORDER BY department_id LIMIT 1');
  assert.ok(department, 'at least one seeded department must exist');
  const [userResult] = await writePool.execute(
    `INSERT INTO users (name, email, password_hash, role, is_active)
     VALUES (?, ?, 'fixture-hash-not-for-authentication', 'user', TRUE)`,
    [`${fixturePrefix}_Certificate Student`, `${fixturePrefix.toLowerCase()}@example.invalid`],
  );
  fixtures.userId = userResult.insertId;
  await writePool.execute(
    `INSERT INTO students (student_id, roll_no, department_id, year_of_study, phone)
     VALUES (?, ?, ?, 1, '0000000000')`,
    [fixtures.userId, `${fixturePrefix.slice(-20)}_ROLL`, department.department_id],
  );

  const [inactiveClub] = await writePool.execute(
    `INSERT INTO clubs (name, tagline, description, category_id, status)
     VALUES (?, ?, ?, ?, 'inactive')`,
    [`${fixturePrefix}_Inactive Club`, `${fixturePrefix} inactive tagline`, `${fixturePrefix} inactive club`, fixtures.categoryId],
  );
  fixtures.clubIds.push(inactiveClub.insertId);
  fixtures.names.inactiveClub = `${fixturePrefix}_Inactive Club`;

  await insertFixtureEvent({ label: 'Cancelled Past Event', daysFromNow: -40, status: 'cancelled' });
  await insertFixtureEvent({ label: 'Cancelled Future Event', daysFromNow: 25, status: 'cancelled' });
  const pastEventId = await insertFixtureEvent({ label: 'Completed Past Event', daysFromNow: -30, status: 'completed' });
  const photoRows = [
    ['first', 1],
    ['second', 2],
    ['third', 3],
  ];
  for (const [caption, displayOrder] of photoRows) {
    await writePool.execute(
      `INSERT INTO event_photos (event_id, image_url, thumbnail_url, caption, display_order, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        pastEventId,
        `/uploads/events/${fixturePrefix}-${caption}.jpg`,
        `/uploads/events/${fixturePrefix}-${caption}-thumb.jpg`,
        `${fixturePrefix} photo ${caption}`,
        displayOrder,
        fixtures.userId,
      ],
    );
  }
  await insertFixtureEvent({ label: 'internal', daysFromNow: 8, status: 'scheduled', signupMode: 'internal', tentative: true });
  await insertFixtureEvent({ label: 'external', daysFromNow: 12, status: 'scheduled', signupMode: 'external' });
  await insertFixtureEvent({ label: 'none', daysFromNow: 16, status: 'scheduled', signupMode: 'none' });
  await insertFixtureEvent({ label: 'placeholder', daysFromNow: 20, status: 'scheduled', tentative: true, placeholder: true });
  await insertFixtureEvent({ label: 'Thirteen Months Event', daysFromNow: 400, status: 'scheduled' });

  const [registration] = await writePool.execute(
    "INSERT INTO registrations (event_id, student_id, status) VALUES (?, ?, 'registered')",
    [pastEventId, fixtures.userId],
  );
  fixtures.registrationId = registration.insertId;
  const [certificate] = await writePool.execute(
    'INSERT INTO certificates (registration_id, certificate_code, certificate_type) VALUES (?, ?, ?)',
    [fixtures.registrationId, fixtures.certificateCode, 'participation'],
  );
  fixtures.certificateId = certificate.insertId;
});

after(async () => {
  let cleanupError;
  const cleanupOperations = [
    async () => {
      if (fixtures.certificateId) {
        await writePool.execute('DELETE FROM certificates WHERE certificate_id = ?', [fixtures.certificateId]);
      }
    },
    async () => {
      if (fixtures.registrationId) {
        await writePool.execute('DELETE FROM registrations WHERE registration_id = ?', [fixtures.registrationId]);
      }
    },
    async () => {
      if (fixtures.eventIds.length) {
        const placeholders = fixtures.eventIds.map(() => '?').join(', ');
        await writePool.execute(`DELETE FROM event_photos WHERE event_id IN (${placeholders})`, fixtures.eventIds);
        await writePool.execute(`DELETE FROM events WHERE event_id IN (${placeholders})`, fixtures.eventIds);
      }
    },
    async () => {
      for (const clubId of fixtures.clubIds) {
        await writePool.execute('DELETE FROM clubs WHERE club_id = ?', [clubId]);
      }
    },
    async () => {
      if (fixtures.userId) {
        await writePool.execute('DELETE FROM students WHERE student_id = ?', [fixtures.userId]);
        await writePool.execute('DELETE FROM users WHERE user_id = ?', [fixtures.userId]);
      }
    },
  ];

  try {
    for (const cleanup of cleanupOperations) {
      try {
        await cleanup();
      } catch (error) {
        cleanupError ??= error;
      }
    }
    if (!cleanupError) {
      const [[{ remaining }]] = await writePool.execute(
        "SELECT COUNT(*) AS remaining FROM clubs WHERE name LIKE 'TEST_FIXTURE_%'",
      );
      assert.equal(Number(remaining), 0, 'all TEST_FIXTURE_ clubs must be removed');
    }
  } finally {
    await writePool.end();
  }
  if (cleanupError) throw cleanupError;
});

test('GET /api/clubs defaults to active clubs and exposes the exact public item shape', async () => {
  const { response, body } = await request('/api/clubs');
  assertStatus(response, 200);
  assert.ok(body.data.length > 0);
  assert.equal(body.data.some(club => club.name === fixtures.names.inactiveClub), false);
  for (const club of body.data) {
    assert.deepEqual(Object.keys(club).sort(), ['category', 'clubId', 'logoUrl', 'memberCount', 'name', 'tagline']);
    const [[{ approvedCount }]] = await writePool.execute(
      "SELECT COUNT(*) AS approvedCount FROM club_members WHERE club_id = ? AND status = 'approved'",
      [club.clubId],
    );
    assert.equal(Number(club.memberCount), Number(approvedCount), `${club.name} memberCount must count approved members only`);
    assertImageUrl(club.logoUrl, `${club.name}.logoUrl`);
  }
  assert.deepEqual(body.data.map(club => club.name), [...body.data.map(club => club.name)].sort((a, b) => a.localeCompare(b)));
});

test('GET /api/clubs search treats wildcards literally and safely handles SQL punctuation', async () => {
  const coding = await request('/api/clubs?search=coding');
  assertStatus(coding.response, 200);
  assert.ok(coding.body.data.some(club => club.name === 'Coding Club'));

  for (const term of ['%', '_']) {
    const result = await request(`/api/clubs?search=${encodeURIComponent(term)}`);
    assertStatus(result.response, 200);
    assert.equal(result.body.data.length, 0, `${JSON.stringify(term)} must not act as a LIKE wildcard`);
  }

  const injected = await request(`/api/clubs?search=${encodeURIComponent("'; DROP TABLE clubs;--")}`);
  assertStatus(injected.response, 200);
  assert.ok(Array.isArray(injected.body.data));
  const [[table]] = await writePool.execute("SHOW TABLES LIKE 'clubs'");
  assert.ok(table, 'clubs table must still exist after quote/semicolon search');
});

test('GET /api/clubs supports category id/name and returns no rows for an unknown category', async () => {
  const byId = await request(`/api/clubs?category=${fixtures.categoryId}`);
  const byName = await request('/api/clubs?category=Technical');
  const unknown = await request('/api/clubs?category=TEST_FIXTURE_unknown_category');
  for (const { response } of [byId, byName, unknown]) assertStatus(response, 200);
  assert.ok(byId.body.data.some(club => club.name === 'Coding Club'));
  assert.ok(byName.body.data.some(club => club.name === 'Coding Club'));
  assert.equal(unknown.body.data.length, 0);
});

test('GET /api/clubs pagination reports the total for pageSize=2', async () => {
  const paged = await request('/api/clubs?page=1&pageSize=2');
  assertStatus(paged.response, 200);
  assert.ok(paged.body.data.length <= 2);
  const [[{ total }]] = await writePool.execute("SELECT COUNT(*) AS total FROM clubs WHERE status = 'active'");
  assert.equal(Number(paged.body.meta.total), Number(total));
});

test('GET /api/clubs pageSize=1000 is clamped or rejected', async () => {
  const oversized = await request('/api/clubs?pageSize=1000');
  assert.ok([200, 400].includes(oversized.response.status));
  if (oversized.response.status === 200) assert.ok(oversized.body.meta.pageSize <= 100);
  else assert.equal(oversized.body.error.code, 'VALIDATION_ERROR');
});

for (const query of ['page=0', 'page=-1', 'pageSize=abc']) {
  test(`GET /api/clubs rejects ${query}`, async () => {
    const invalid = await request(`/api/clubs?${query}`);
    assertStatus(invalid.response, 400, `${query} must return 400`);
    assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');
  });
}

test('GET /api/clubs/:clubId returns the public Coding Club profile and ordered eligible core members', async () => {
  const { response, body } = await request(`/api/clubs/${fixtures.activeClubId}`);
  assertStatus(response, 200);
  assert.equal(body.data.name, 'Coding Club');
  assert.ok(body.data.description);
  assert.equal(typeof body.data.websiteUrl, 'string');
  assert.ok(body.data.category);
  assert.ok(body.data.facultyAdvisor === null || typeof body.data.facultyAdvisor === 'string');

  const expectedKeys = ['name', 'photoUrl', 'positionTitle', 'role', 'studentId'];
  for (const member of body.data.coreMembers) {
    assert.deepEqual(Object.keys(member).sort(), expectedKeys);
    assert.notEqual(member.role, 'member');
    assert.ok(['core_member', 'vice_chair', 'chair'].includes(member.role));
    assertImageUrl(member.photoUrl, 'core member photoUrl');
  }
  const [expectedMembers] = await writePool.execute(
    `SELECT cm.student_id AS studentId, u.name, cm.member_role AS role, cm.position_title AS positionTitle
     FROM club_members cm JOIN users u ON u.user_id = cm.student_id
     WHERE cm.club_id = ? AND cm.status = 'approved' AND cm.member_role <> 'member' AND u.is_active = TRUE
     ORDER BY cm.display_order, u.name`,
    [fixtures.activeClubId],
  );
  assert.deepEqual(
    body.data.coreMembers.map(({ studentId, name, role, positionTitle }) => ({ studentId, name, role, positionTitle })),
    expectedMembers,
  );
  assert.ok(Array.isArray(body.data.upcomingEvents));
  assert.ok(body.data.upcomingEvents.every(event => typeof event.isPlaceholder === 'boolean'));
});

test('GET /api/clubs/:clubId exposes scraped public metadata without personal contact details', async () => {
  const [[club]] = await writePool.execute(
    'SELECT club_id, source_url FROM clubs WHERE source_url IS NOT NULL LIMIT 1',
  );
  assert.ok(club, 'an imported SVNIT club must be available');
  const { response, body } = await request(`/api/clubs/${club.club_id}`);
  assertStatus(response, 200);
  assert.equal(body.data.sourceUrl, club.source_url);
  assert.ok(body.data.contactEmail === null || /^[a-z0-9._+-]+@svnit\.ac\.in$/i.test(body.data.contactEmail));
  assert.ok(publicClubContactSchema.array().safeParse(body.data.contacts).success);
  assert.ok(publicClubLinkSchema.array().safeParse(body.data.links).success);
  for (const link of body.data.links) assert.ok(link.url.startsWith('http://') || link.url.startsWith('https://'));
});

test('GET /api/clubs/:clubId returns CLUB_NOT_FOUND for inactive or nonexistent clubs', async () => {
  const inactive = await request(`/api/clubs/${fixtures.clubIds[0]}`);
  const missing = await request('/api/clubs/999999999');
  assertStatus(inactive.response, 404);
  assert.equal(inactive.body.error.code, 'CLUB_NOT_FOUND');
  assertStatus(missing.response, 404);
  assert.equal(missing.body.error.code, 'CLUB_NOT_FOUND');
});

test('GET /api/clubs/:clubId rejects malformed ids', async () => {
  for (const id of ['abc', '1abc', '-1', '0', '1.5']) {
    const result = await request(`/api/clubs/${encodeURIComponent(id)}`);
    assertStatus(result.response, 400, `${id} must return 400`);
    assert.equal(result.body.error.code, 'VALIDATION_ERROR');
  }
});

test('GET /api/clubs/:clubId/events/upcoming orders events and excludes cancelled, past, and 13-month events', async () => {
  const { response, body } = await request(`/api/clubs/${fixtures.activeClubId}/events/upcoming`);
  assertStatus(response, 200);
  const names = body.data.map(event => event.title);
  assert.equal(names.includes(fixtures.names['Cancelled Future Event']), false);
  assert.equal(names.includes(fixtures.names['Cancelled Past Event']), false);
  assert.equal(names.includes(fixtures.names['Completed Past Event']), false);
  assert.equal(names.includes(fixtures.names['Thirteen Months Event']), false);
  assert.deepEqual(
    body.data.map(event => Date.parse(event.startDatetime)),
    [...body.data.map(event => Date.parse(event.startDatetime))].sort((a, b) => a - b),
  );
  assert.ok(body.data.every(event => typeof event.isPlaceholder === 'boolean'));
});

test('GET /api/clubs/:clubId/events/upcoming accepts months=1 and months=24', async () => {
  for (const months of ['1', '24']) {
    const result = await request(`/api/clubs/${fixtures.activeClubId}/events/upcoming?months=${months}`);
    assertStatus(result.response, 200);
  }
});

for (const months of ['0', '100', 'abc']) {
  test(`GET /api/clubs/:clubId/events/upcoming rejects months=${months}`, async () => {
    const result = await request(`/api/clubs/${fixtures.activeClubId}/events/upcoming?months=${months}`);
    assertStatus(result.response, 400, `months=${months} is outside 1..24 or nonnumeric`);
    assert.equal(result.body.error.code, 'VALIDATION_ERROR');
  });
}

test('GET /api/clubs/:clubId/events/upcoming exposes signup modes and tentative status', async () => {
  const { body } = await request(`/api/clubs/${fixtures.activeClubId}/events/upcoming?months=24`);
  const byTitle = new Map(body.data.map(event => [event.title, event]));
  const internal = byTitle.get(fixtures.names.internal);
  const external = byTitle.get(fixtures.names.external);
  const none = byTitle.get(fixtures.names.none);
  const placeholder = byTitle.get(fixtures.names.placeholder);
  assert.ok(internal && external && none && placeholder, 'all signup-mode and placeholder fixtures must be present');
  assert.equal(internal.signupMode, 'internal');
  assert.equal(internal.externalSignupUrl, null);
  assert.equal(internal.isTentative, true);
  assert.equal(internal.isPlaceholder, false);
  assert.equal(external.signupMode, 'external');
  assert.equal(external.externalSignupUrl, 'https://example.invalid/signup');
  assert.equal(none.signupMode, 'none');
  assert.equal(none.externalSignupUrl, null);
  assert.equal(placeholder.isTentative, true);
  assert.ok(publicPlaceholderEventSchema.safeParse(placeholder).success);
  assert.equal(placeholder.isPlaceholder, true);
});

test('GET /api/clubs/:clubId/events/upcoming returns 404 for unknown or inactive clubs', async () => {
  const missing = await request('/api/clubs/999999999/events/upcoming');
  const inactive = await request(`/api/clubs/${fixtures.clubIds[0]}/events/upcoming`);
  assertStatus(missing.response, 404);
  assertStatus(inactive.response, 404);
  assert.equal(missing.body.error.code, 'CLUB_NOT_FOUND');
  assert.equal(inactive.body.error.code, 'CLUB_NOT_FOUND');
});

test('GET /api/clubs/:clubId/events/past orders events newest-first and reports the fixture photo count', async () => {
  const { response, body } = await request(`/api/clubs/${fixtures.activeClubId}/events/past`);
  assertStatus(response, 200);
  const names = body.data.map(event => event.title);
  assert.ok(names.includes(fixtures.names['Completed Past Event']));
  assert.equal(names.includes(fixtures.names['Cancelled Past Event']), false);
  assert.equal(names.includes(fixtures.names['Cancelled Future Event']), false);
  assert.equal(names.includes(fixtures.names.internal), false);
  assert.deepEqual(
    body.data.map(event => Date.parse(event.startDatetime)),
    [...body.data.map(event => Date.parse(event.startDatetime))].sort((a, b) => b - a),
  );
  const pastFixture = body.data.find(event => event.title === fixtures.names['Completed Past Event']);
  const [[{ photoCount }]] = await writePool.execute('SELECT COUNT(*) AS photoCount FROM event_photos WHERE event_id = ?', [
    fixtures.eventIdsByLabel['Completed Past Event'],
  ]);
  assert.equal(Number(pastFixture.photoCount), Number(photoCount));
  assert.equal(Number(pastFixture.photoCount), 3);
  assert.equal(typeof pastFixture.isPlaceholder, 'boolean');
});

test('GET /api/clubs/:clubId/events/past pagination supports pageSize=2', async () => {
  const paged = await request(`/api/clubs/${fixtures.activeClubId}/events/past?page=1&pageSize=2`);
  assertStatus(paged.response, 200);
  assert.ok(paged.body.data.length <= 2);
});

test('GET /api/clubs/:clubId/events/past pageSize=1000 is clamped or rejected', async () => {
  const oversized = await request(`/api/clubs/${fixtures.activeClubId}/events/past?pageSize=1000`);
  assert.ok([200, 400].includes(oversized.response.status));
  if (oversized.response.status === 200) assert.ok(oversized.body.meta.pageSize <= 100);
});

for (const query of ['page=0', 'page=-1', 'pageSize=abc']) {
  test(`GET /api/clubs/:clubId/events/past rejects ${query}`, async () => {
    const invalid = await request(`/api/clubs/${fixtures.activeClubId}/events/past?${query}`);
    assertStatus(invalid.response, 400, `${query} must return 400`);
    assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');
  });
}

test('GET /api/events/:eventId/memories returns the past event and three ordered photos', async () => {
  const eventId = fixtures.eventIdsByLabel['Completed Past Event'];
  const { response, body } = await request(`/api/events/${eventId}/memories`);
  assertStatus(response, 200);
  assert.equal(body.data.event.title, fixtures.names['Completed Past Event']);
  assert.deepEqual(Object.keys(body.data.event.club).sort(), ['clubId', 'name']);
  assert.equal(body.data.event.club.clubId, fixtures.activeClubId);
  assert.equal(body.data.photos.length, 3);
  assert.equal(typeof body.data.event.isPlaceholder, 'boolean');
  assert.deepEqual(body.data.photos.map(photo => photo.caption), [
    `${fixturePrefix} photo first`,
    `${fixturePrefix} photo second`,
    `${fixturePrefix} photo third`,
  ]);
  for (const photo of body.data.photos) {
    assert.ok(Object.hasOwn(photo, 'imageUrl'));
    assert.ok(Object.hasOwn(photo, 'thumbnailUrl'));
    assert.ok(Object.hasOwn(photo, 'caption'));
    assertImageUrl(photo.imageUrl, 'memory imageUrl');
    assertImageUrl(photo.thumbnailUrl, 'memory thumbnailUrl');
  }
  const [[{ photoCount }]] = await writePool.execute('SELECT COUNT(*) AS photoCount FROM event_photos WHERE event_id = ?', [eventId]);
  assert.equal(Number(photoCount), 3);
});

test('GET /api/events/:eventId/memories hides future, cancelled, and unknown events', async () => {
  const futureId = fixtures.eventIdsByMode.internal;
  const cancelledPastId = fixtures.eventIdsByLabel['Cancelled Past Event'];
  const unknownId = 999999999;
  for (const id of [futureId, cancelledPastId, unknownId]) {
    const result = await request(`/api/events/${id}/memories`);
    assertStatus(result.response, 404);
  }

  const malformed = await request('/api/events/abc/memories');
  assert.ok([400, 404].includes(malformed.response.status));
});

test('GET /api/events/:eventId returns public detail and hides cancelled events', async () => {
  const eventId = fixtures.eventIdsByLabel['Completed Past Event'];
  const { response, body } = await request(`/api/events/${eventId}`);
  assertStatus(response, 200);
  assert.ok(body.data.description);
  assert.deepEqual(Object.keys(body.data.club).sort(), ['clubId', 'name']);
  assert.equal(body.data.club.clubId, fixtures.activeClubId);
  assert.equal(body.data.club.name, 'Coding Club');

  const placeholder = await request(`/api/events/${fixtures.eventIdsByLabel.placeholder}`);
  assertStatus(placeholder.response, 200);
  assert.equal(placeholder.body.data.isPlaceholder, true);
  assert.ok(publicPlaceholderEventSchema.safeParse(placeholder.body.data).success);

  const cancelled = await request(`/api/events/${fixtures.eventIdsByLabel['Cancelled Future Event']}`);
  assertStatus(cancelled.response, 404);
  assert.equal(cancelled.body.error.code, 'NOT_FOUND');
});

test('GET /api/events list route exposes the placeholder flag', async () => {
  const all = await request('/api/events?pageSize=100');
  assertStatus(all.response, 200);
  const placeholder = all.body.data.find(event => event.event_id === fixtures.eventIdsByLabel.placeholder);
  assert.ok(placeholder, 'placeholder fixture must appear in the public event list');
  assert.ok(publicEventListItemSchema.safeParse(placeholder).success);
  assert.equal(Boolean(placeholder.is_placeholder), true);
});

test('GET /api/events/filter reaches the existing filter route', async () => {
  const filter = await request('/api/events/filter?field=status&op=%3D&value=scheduled');
  assert.ok(filter.response.status === 200 || filter.response.status === 401,
    `expected 200 or an auth-required 401, received ${filter.response.status}`);
});

test('GET /certificates/verify/:code returns only public certificate fields', async () => {
  const { response, body } = await request(`/certificates/verify/${encodeURIComponent(fixtures.certificateCode)}`);
  assertStatus(response, 200);
  assert.deepEqual(Object.keys(body.data).sort(), ['club', 'eventTitle', 'issuedAt', 'studentName', 'type', 'valid']);
  assert.deepEqual(body.data, {
    valid: true,
    studentName: `${fixturePrefix}_Certificate Student`,
    eventTitle: fixtures.names['Completed Past Event'],
    club: 'Coding Club',
    type: 'participation',
    issuedAt: body.data.issuedAt,
  });
  assert.equal(body.data.valid, true);
});

test('GET /certificates/verify/:code rejects unknown, empty-ish, long, and injected codes', async () => {
  const codes = [
    'not-a-certificate',
    ' ',
    'x'.repeat(500),
    "x' OR '1'='1",
  ];
  for (const code of codes) {
    const result = await request(`/certificates/verify/${encodeURIComponent(code)}`);
    assertStatus(result.response, 404);
    assert.equal(result.body.error.code, 'CERTIFICATE_NOT_FOUND');
  }
  const emptyCode = await request('/certificates/verify/');
  assertStatus(emptyCode.response, 404);
});

test('unknown routes return the standard NOT_FOUND error', async () => {
  const result = await request('/__public_endpoint_test_unknown_route__');
  assertStatus(result.response, 404);
  assert.equal(result.body.error.code, 'NOT_FOUND');
});

test('POST /api/clubs without a token is rejected and leaves database row counts unchanged', async () => {
  const tables = ['clubs', 'events', 'users', 'club_members', 'event_photos', 'registrations', 'certificates'];
  const counts = async () => {
    const result = {};
    for (const table of tables) {
      const [[row]] = await writePool.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
      result[table] = Number(row.count);
    }
    return result;
  };
  const beforeCounts = await counts();
  const result = await request('/api/clubs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: `${fixturePrefix}_Unauthorized Club` }),
  });
  assert.ok([401, 403, 404].includes(result.response.status));
  assert.notEqual(result.response.status, 200);
  assert.deepEqual(await counts(), beforeCounts);
});

test('every public list request completes in under one second', () => {
  assert.ok(listCalls.length, 'list endpoint calls must be measured');
  const slowest = listCalls.reduce((slowestCall, call) => call.elapsedMs > slowestCall.elapsedMs ? call : slowestCall);
  console.log(
    `PUBLIC_LIST_PERFORMANCE slowest=${slowest.path} roundTripMs=${slowest.elapsedMs.toFixed(2)} meta.executionTimeMs=${slowest.metaMs}`,
  );
  for (const call of listCalls) {
    assert.ok(call.elapsedMs < 1000, `${call.path} took ${call.elapsedMs.toFixed(2)}ms (limit: 1000ms)`);
  }
});
