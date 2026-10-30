// src/utils/allowlists.js
// Server-side allowlists for dynamic query construction.
// ANY identifier that varies (table, column, operator, join type) MUST come
// from these maps. Requests with values not in the maps are rejected with 400.

// ── Tables exposed via GET /api/aggregate ─────────────────────────────────
export const AGGREGATE_TABLES = new Set([
  'events', 'registrations', 'clubs', 'students', 'venues',
  'attendance', 'certificates', 'club_members', 'users',
]);

// Explicit fields exposed by the dynamic join and aggregate endpoints.
// Password hashes and event creator IDs are deliberately excluded.
export const SELECTABLE_COLUMNS = {
  events: [
    'event_id', 'club_id', 'venue_id', 'title', 'description', 'event_type',
    'start_datetime', 'end_datetime', 'is_tentative', 'poster_url', 'recap_text',
    'signup_mode', 'external_signup_url', 'registration_deadline',
    'max_participants', 'status', 'created_at', 'updated_at',
  ],
  registrations: ['registration_id', 'event_id', 'student_id', 'status', 'registered_at'],
  clubs: [
    'club_id', 'name', 'tagline', 'description', 'logo_url', 'website_url',
    'category_id', 'faculty_advisor_id', 'status', 'created_at', 'updated_at', 'updated_by',
  ],
  students: ['student_id', 'roll_no', 'department_id', 'year_of_study', 'phone'],
  venues: ['venue_id', 'name', 'location', 'capacity'],
  attendance: ['attendance_id', 'registration_id', 'status', 'marked_by', 'marked_at'],
  certificates: [
    'certificate_id', 'registration_id', 'certificate_code', 'certificate_type', 'issued_at',
  ],
  club_members: [
    'club_id', 'student_id', 'member_role', 'position_title', 'display_order',
    'status', 'granted_by', 'role_granted_at', 'joined_at',
  ],
  users: ['user_id', 'name', 'email', 'role', 'profile_photo_url', 'is_active', 'created_at'],
  departments: ['department_id', 'name'],
  club_categories: ['category_id', 'name'],
};

export const AGGREGATE_COLUMNS = Object.fromEntries(
  [...AGGREGATE_TABLES].map(table => [table, new Set(SELECTABLE_COLUMNS[table])]),
);

// ── Aggregate functions ───────────────────────────────────────────────────
export const AGGREGATE_FNS = new Set(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX']);

// ── Filter operators (GET /api/events/filter) ────────────────────────────
export const FILTER_OPS = new Set(['=', '<>', '<', '>', '<=', '>=', 'LIKE', 'BETWEEN']);

// ── Filterable columns on the events table ───────────────────────────────
export const EVENT_FILTER_COLS = new Set([
  'event_id','club_id','venue_id','event_type','status',
  'start_datetime','end_datetime','registration_deadline','max_participants',
  'is_tentative','signup_mode',
]);

// ── JOIN types ────────────────────────────────────────────────────────────
export const JOIN_TYPES = new Set(['INNER', 'LEFT', 'RIGHT', 'FULL']);

// ── FK join map: allowed (left, right) table pairs and how they join.
// Value: { leftCol, rightCol }
export const JOIN_MAP = {
  'events,clubs'          : { leftCol: 'club_id',            rightCol: 'club_id'         },
  'events,venues'         : { leftCol: 'venue_id',           rightCol: 'venue_id'        },
  'events,users'          : { leftCol: 'created_by',         rightCol: 'user_id'         },
  'registrations,events'  : { leftCol: 'event_id',           rightCol: 'event_id'        },
  'registrations,students': { leftCol: 'student_id',         rightCol: 'student_id'      },
  'students,departments'  : { leftCol: 'department_id',      rightCol: 'department_id'   },
  'students,users'        : { leftCol: 'student_id',         rightCol: 'user_id'         },
  'clubs,club_categories' : { leftCol: 'category_id',        rightCol: 'category_id'     },
  'clubs,users'           : { leftCol: 'faculty_advisor_id', rightCol: 'user_id'         },
  'attendance,registrations':{ leftCol:'registration_id',    rightCol:'registration_id'  },
  'certificates,registrations':{ leftCol:'registration_id',  rightCol:'registration_id'  },
  'club_members,clubs'    : { leftCol: 'club_id',            rightCol: 'club_id'         },
  'club_members,students' : { leftCol: 'student_id',         rightCol: 'student_id'      },
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
