// src/utils/allowlists.js
// Server-side allowlists for dynamic query construction.
// ANY identifier that varies (table, column, operator, join type) MUST come
// from these maps. Requests with values not in the maps are rejected with 400.

// ── Tables exposed via GET /api/aggregate ─────────────────────────────────
export const AGGREGATE_TABLES = new Set([
  'events', 'registrations', 'clubs', 'students', 'venues',
  'attendance', 'certificates', 'club_members', 'users',
]);

// ── Columns allowed per table for aggregation ─────────────────────────────
export const AGGREGATE_COLUMNS = {
  events        : new Set(['event_id','max_participants','status','event_type']),
  registrations : new Set(['registration_id','event_id','student_id','status']),
  clubs         : new Set(['club_id','status','category_id','coordinator_id']),
  students      : new Set(['student_id','department_id','year_of_study']),
  venues        : new Set(['venue_id','capacity']),
  attendance    : new Set(['attendance_id','status']),
  certificates  : new Set(['certificate_id']),
  club_members  : new Set(['club_id','student_id','status']),
  users         : new Set(['user_id','role','is_active']),
};

// ── Aggregate functions ───────────────────────────────────────────────────
export const AGGREGATE_FNS = new Set(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX']);

// ── Filter operators (GET /api/events/filter) ────────────────────────────
export const FILTER_OPS = new Set(['=', '<>', '<', '>', '<=', '>=', 'LIKE', 'BETWEEN']);

// ── Filterable columns on the events table ───────────────────────────────
export const EVENT_FILTER_COLS = new Set([
  'event_id','club_id','venue_id','event_type','status',
  'start_datetime','end_datetime','registration_deadline','max_participants',
]);

// ── JOIN types ────────────────────────────────────────────────────────────
export const JOIN_TYPES = new Set(['INNER', 'LEFT', 'RIGHT', 'FULL']);

// ── FK join map: allowed (left, right) table pairs and how they join.
// Value: { leftCol, rightCol }
export const JOIN_MAP = {
  'events,clubs'          : { leftCol: 'club_id',         rightCol: 'club_id'         },
  'events,venues'         : { leftCol: 'venue_id',        rightCol: 'venue_id'         },
  'events,users'          : { leftCol: 'created_by',      rightCol: 'user_id'          },
  'registrations,events'  : { leftCol: 'event_id',        rightCol: 'event_id'         },
  'registrations,students': { leftCol: 'student_id',      rightCol: 'student_id'       },
  'students,departments'  : { leftCol: 'department_id',   rightCol: 'department_id'    },
  'students,users'        : { leftCol: 'student_id',      rightCol: 'user_id'          },
  'clubs,club_categories' : { leftCol: 'category_id',     rightCol: 'category_id'      },
  'clubs,users'           : { leftCol: 'coordinator_id',  rightCol: 'user_id'          },
  'attendance,registrations':{ leftCol:'registration_id', rightCol:'registration_id'   },
  'certificates,registrations':{ leftCol:'registration_id',rightCol:'registration_id' },
  'club_members,clubs'    : { leftCol: 'club_id',         rightCol: 'club_id'         },
  'club_members,students' : { leftCol: 'student_id',      rightCol: 'student_id'      },
};

// ── Subquery options (GET /api/subquery) ──────────────────────────────────
export const SUBQUERY_OPTIONS = new Set([
  'students_in_club_events',    // students registered for events of a given club
  'clubs_above_avg_membership', // clubs with above-average approved membership
  'events_no_registrations',    // events with no registrations at all
]);

// ── Correlated subquery options (GET /api/correlated) ────────────────────
export const CORRELATED_OPTIONS = new Set([
  'events_above_club_avg',      // events whose registrations exceed their club's average
  'students_above_avg_events',  // students registered for more events than average
]);
