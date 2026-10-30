import 'dotenv/config';
import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { AGGREGATE_TABLES, JOIN_MAP, SELECTABLE_COLUMNS, SUBQUERY_OPTIONS, CORRELATED_OPTIONS } from '../src/utils/allowlists.js';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const password = process.env.SEED_PASSWORD || 'Test@12345';
const tokens = {};
const accounts = {};
const sqlText = /\b(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|UNION|FROM|JOIN|WHERE|HAVING|ORDER\s+BY|GROUP\s+BY|LIMIT|OFFSET|SQLSTATE)\b|\bER_[A-Z0-9_]*\b|\bsqlMessage\b/i;
const stackTrace = /(?:\bat\s+.+:\d+:\d+\b|\b(?:Error|Exception):\s)/i;

function scanSensitiveValues(value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanSensitiveValues(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string') {
      assert.equal(value.startsWith('$2'), false, `${path} must not contain a bcrypt hash`);
    }
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    assert.ok(!['password_hash', 'passwordHash'].includes(key), `${path}.${key} must not be returned`);
    scanSensitiveValues(child, `${path}.${key}`);
  }
}

function assertErrorBody(body) {
  assert.deepEqual(Object.keys(body).sort(), ['error']);
  assert.deepEqual(Object.keys(body.error).sort(), ['code', 'message']);
  assert.equal(typeof body.error.code, 'string');
  assert.equal(typeof body.error.message, 'string');
  for (const text of Object.values(body.error)) {
    if (typeof text === 'string') {
      assert.doesNotMatch(text, sqlText, 'error text must not expose SQL');
      assert.doesNotMatch(text, stackTrace, 'error text must not expose a stack trace');
    }
  }
}

async function request(path, { token, method = 'GET', body } = {}) {
  const startedAt = performance.now();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(new URL(path, BASE_URL), {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json();
  const elapsedMs = performance.now() - startedAt;
  assert.ok(elapsedMs < 10_000, `${method} ${path} took ${elapsedMs.toFixed(1)} ms`);

  if (response.status === 200) {
    assert.ok(payload && typeof payload === 'object' && !Array.isArray(payload));
    assert.ok(Object.hasOwn(payload, 'data'));
    assert.ok(Object.hasOwn(payload, 'meta'));
    assert.equal(typeof payload.meta.executionTimeMs, 'number');
  } else {
    assertErrorBody(payload);
  }
  scanSensitiveValues(payload);
  return { response, payload, elapsedMs };
}

async function login(email) {
  const { response, payload } = await request('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert.equal(response.status, 200, `login failed for seeded account ${email}`);
  assert.equal(typeof payload.data.token, 'string');
  for (const key of ['userId', 'name', 'email', 'role']) {
    assert.ok(Object.hasOwn(payload.data, key), `login response must include ${key}`);
  }
  if (payload.data.role === 'user') {
    for (const key of ['roll_no', 'phone']) {
      assert.ok(Object.hasOwn(payload.data, key), `login response must include own ${key}`);
    }
  }
  accounts[email] = payload.data;
  return payload.data.token;
}

before(async () => {
  tokens.admin = await login('admin@test.edu');
  tokens.plain = await login('plain@test.edu');
  tokens.core = await login('core1@test.edu');
  assert.equal(accounts['admin@test.edu'].role, 'admin');
  assert.equal(accounts['plain@test.edu'].role, 'user');
  assert.equal(accounts['core1@test.edu'].role, 'user');
});

const adminEndpoints = [
  '/api/join?left=events&right=clubs&pageSize=2',
  '/api/aggregate?table=events&column=event_id&fn=COUNT',
  '/api/subquery?option=clubs_above_avg_membership&pageSize=2',
  '/api/correlated?option=students_above_avg_events&pageSize=2',
];

test('assignment query endpoints require authentication and admin role', async () => {
  for (const path of adminEndpoints) {
    const anonymous = await request(path);
    assert.equal(anonymous.response.status, 401, `${path} without a token`);
    const plain = await request(path, { token: tokens.plain });
    assert.equal(plain.response.status, 403, `${path} with a plain-user token`);
    const admin = await request(path, { token: tokens.admin });
    assert.equal(admin.response.status, 200, `${path} with an admin token`);
  }
});

test('event filtering requires a valid token while event and venue lists remain public', async () => {
  const anonymousFilter = await request('/api/events/filter?field=status&op=%3D&value=scheduled');
  assert.equal(anonymousFilter.response.status, 401);
  const userFilter = await request('/api/events/filter?field=status&op=%3D&value=scheduled', { token: tokens.plain });
  assert.equal(userFilter.response.status, 200);
  const adminFilter = await request('/api/events/filter?field=status&op=%3D&value=scheduled', { token: tokens.admin });
  assert.equal(adminFilter.response.status, 200);
  assert.equal((await request('/api/events?pageSize=1')).response.status, 200);
  assert.equal((await request('/api/venues?pageSize=1')).response.status, 200);
});

test('admin join responses use every allowlisted pair without password hashes', async () => {
  for (const pairKey of Object.keys(JOIN_MAP)) {
    const [left, right] = pairKey.split(',');
    const result = await request(
      `/api/join?left=${encodeURIComponent(left)}&right=${encodeURIComponent(right)}&pageSize=2`,
      { token: tokens.admin },
    );
    assert.equal(result.response.status, 200, `${pairKey} must return 200`);
  }
});

test('admins can aggregate every explicitly selectable column', async () => {
  for (const table of AGGREGATE_TABLES) {
    for (const column of SELECTABLE_COLUMNS[table]) {
      const result = await request(
        `/api/aggregate?table=${encodeURIComponent(table)}&column=${encodeURIComponent(column)}&fn=COUNT`,
        { token: tokens.admin },
      );
      assert.equal(result.response.status, 200, `${table}.${column} aggregate must return 200`);
    }
  }

  for (const columns of Object.values(SELECTABLE_COLUMNS)) {
    assert.ok(!columns.includes('password_hash'));
    assert.ok(!columns.includes('created_by'));
  }
  for (const [table, column] of [
    ['events', 'created_by'],
    ['users', 'password_hash'],
    ['users', 'roll_no'],
  ]) {
    const forbidden = await request(
      `/api/aggregate?table=${table}&column=${column}&fn=COUNT`,
      { token: tokens.admin },
    );
    assert.equal(forbidden.response.status, 400, `${table}.${column} must not be selectable`);
  }
});

test('admins can execute every subquery and correlated option without password hashes', async () => {
  const clubs = await request('/api/clubs?pageSize=1');
  assert.equal(clubs.response.status, 200);
  const clubId = clubs.payload.data[0]?.clubId;
  assert.ok(clubId, 'a seeded active club is required for students_in_club_events');

  for (const option of SUBQUERY_OPTIONS) {
    const clubParam = option === 'students_in_club_events' ? `&club_id=${clubId}` : '';
    const result = await request(`/api/subquery?option=${option}&pageSize=2${clubParam}`, {
      token: tokens.admin,
    });
    assert.equal(result.response.status, 200, `${option} must return 200`);
  }
  for (const option of CORRELATED_OPTIONS) {
    const result = await request(`/api/correlated?option=${option}&pageSize=2`, {
      token: tokens.admin,
    });
    assert.equal(result.response.status, 200, `${option} must return 200`);
  }
});

test('database query timeouts return the standard 503 response', () => {
  let statusCode;
  let responseBody;
  const response = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };
  errorHandler({ code: 'ER_QUERY_TIMEOUT' }, {}, response, () => {});
  assert.equal(statusCode, 503);
  assert.deepEqual(responseBody, {
    error: {
      code: 'QUERY_TIMEOUT',
      message: 'The query exceeded the execution time limit.',
    },
  });
});

test('student list is admin-only and student/report details are self-or-admin', async () => {
  const anonymous = await request('/api/students?pageSize=1');
  assert.equal(anonymous.response.status, 401);
  const plainList = await request('/api/students?pageSize=1', { token: tokens.plain });
  assert.equal(plainList.response.status, 403);
  const adminList = await request('/api/students?pageSize=1', { token: tokens.admin });
  assert.equal(adminList.response.status, 200);

  const plainId = accounts['plain@test.edu'].userId;
  const otherId = accounts['core1@test.edu'].userId;
  const me = await request('/auth/me', { token: tokens.plain });
  assert.equal(me.response.status, 200);
  assert.deepEqual(
    Object.keys(me.payload.data).sort(),
    ['email', 'name', 'phone', 'role', 'roll_no', 'userId'].sort(),
  );
  assert.equal(me.payload.data.userId, plainId);
  assert.equal(me.payload.data.email, 'plain@test.edu');
  assert.ok(me.payload.data.roll_no);
  assert.ok(me.payload.data.phone === null || typeof me.payload.data.phone === 'string');

  const anonymousRegistrations = await request('/auth/me/registrations');
  assert.equal(anonymousRegistrations.response.status, 401);
  const ownRegistrations = await request('/auth/me/registrations', { token: tokens.plain });
  assert.equal(ownRegistrations.response.status, 200);
  assert.ok(Array.isArray(ownRegistrations.payload.data));
  for (const registration of ownRegistrations.payload.data) {
    for (const key of ['registrationId', 'eventId', 'eventTitle', 'status']) {
      assert.ok(Object.hasOwn(registration, key), `registration must include ${key}`);
    }
    for (const key of ['email', 'phone', 'roll_no', 'studentId', 'password_hash']) {
      assert.ok(!Object.hasOwn(registration, key), `registration must not include ${key}`);
    }
  }

  const adminMe = await request('/auth/me', { token: tokens.admin });
  assert.equal(adminMe.response.status, 200);
  for (const key of ['userId', 'name', 'email', 'role']) {
    assert.ok(Object.hasOwn(adminMe.payload.data, key));
  }

  for (const prefix of ['/api/students']) {
    const own = await request(`${prefix}/${plainId}?pageSize=1`, { token: tokens.plain });
    assert.equal(own.response.status, 200, `${prefix} must allow the user's own record`);
    for (const key of ['email', 'roll_no', 'phone']) {
      assert.ok(Object.hasOwn(own.payload.data, key), `own record must include ${key}`);
    }
    const updated = await request(`${prefix}/${plainId}`, {
      token: tokens.plain,
      method: 'PUT',
      body: {
        name: own.payload.data.name,
        email: own.payload.data.email,
        roll_no: own.payload.data.roll_no,
        department_id: own.payload.data.department_id,
        year_of_study: own.payload.data.year_of_study,
        ...(own.payload.data.phone === null ? {} : { phone: own.payload.data.phone }),
      },
    });
    assert.equal(updated.response.status, 200, 'owner PUT must succeed');
    for (const key of ['email', 'roll_no', 'phone']) {
      assert.ok(Object.hasOwn(updated.payload.data, key), `owner PUT response must include ${key}`);
    }
    const other = await request(`${prefix}/${otherId}?pageSize=1`, { token: tokens.plain });
    assert.equal(other.response.status, 403, `${prefix} must deny another user's record`);
    const admin = await request(`${prefix}/${otherId}?pageSize=1`, { token: tokens.admin });
    assert.equal(admin.response.status, 200, `${prefix} must allow admin access`);
    for (const key of ['email', 'roll_no', 'phone']) {
      assert.ok(Object.hasOwn(admin.payload.data, key), `admin response must include ${key}`);
    }
  }

  const ownReport = await request(`/api/reports/student/${plainId}?pageSize=1`, { token: tokens.plain });
  assert.equal(ownReport.response.status, 200);
  for (const row of ownReport.payload.data) {
    assert.ok(!Object.hasOwn(row, 'email'));
    assert.ok(!Object.hasOwn(row, 'roll_no'));
    assert.ok(!Object.hasOwn(row, 'phone'));
  }
  const otherReport = await request(`/api/reports/student/${otherId}?pageSize=1`, { token: tokens.plain });
  assert.equal(otherReport.response.status, 403);
  const adminReport = await request(`/api/reports/student/${otherId}?pageSize=1`, { token: tokens.admin });
  assert.equal(adminReport.response.status, 200);
});
