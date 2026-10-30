// frontend/src/lib/api.ts
// Handles communication between the frontend and the Express + MySQL backend.
// Gracefully handles network/offline states and transforms backend DTOs to UI models.

import { CampusEvent, Club, Registration } from './store';

const API_BASE = ((import.meta as any).env?.VITE_API_URL || '').replace(/\/$/, '');

export function getAuthToken(): string | null {
  return localStorage.getItem('ch_token');
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('ch_token', token);
  } else {
    localStorage.removeItem('ch_token');
  }
}

/**
 * Universal fetch wrapper with automatic JWT authorization header
 */
export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const errJson = await res.json();
      errorMsg = errJson?.error?.message || errJson?.message || errorMsg;
    } catch {
      // not JSON
    }
    throw new Error(errorMsg);
  }

  return res.json();
}

/**
 * Check if the Express backend is alive
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    const data = await res.json();
    return data?.status === 'ok';
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Clubs API
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchClubsFromBackend(): Promise<Club[]> {
  const json = await apiRequest<{ data: any[] }>('/api/clubs');
  const items = json.data || [];

  return items.map((c: any) => ({
    id: String(c.clubId || c.club_id || c.id),
    name: c.name,
    category: (c.category || 'Technical') as Club['category'],
    tagline: c.tagline || 'Student Community',
    description: c.description || c.tagline || 'Campus student society.',
    leadCoordinator: c.facultyAdvisor?.name || 'Faculty & Core Team',
    memberCount: Number(c.memberCount) || 1,
    eventsCount: Number(c.eventsCount) || 0,
    logo: c.logoUrl || c.logo_url || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1200&auto=format&fit=crop&q=80',
    socialLinks: {
      email: `${(c.name || 'club').toLowerCase().replace(/[^a-z0-9]/g, '')}@campus.edu`,
      instagram: `@${(c.name || 'club').toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    },
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Events API
// ─────────────────────────────────────────────────────────────────────────────

const categoryMap: Record<string, CampusEvent['category']> = {
  technical: 'Technical',
  cultural: 'Cultural',
  sports: 'Sports',
  workshop: 'Workshops',
  academic: 'Management',
  other: 'Technical'
};

export async function fetchEventsFromBackend(): Promise<CampusEvent[]> {
  const json = await apiRequest<{ data: any[] }>('/api/events');
  const items = json.data || [];

  return items.map((e: any) => {
    const start = e.start_datetime || e.startDatetime;
    const dateObj = start ? new Date(start) : new Date();
    const dateStr = dateObj.toISOString().slice(0, 10);
    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const rawType = (e.event_type || e.eventType || 'technical').toLowerCase();
    const mappedCategory = categoryMap[rawType] || 'Technical';

    return {
      id: String(e.event_id || e.eventId || e.id),
      title: e.title,
      clubId: String(e.club_id || e.clubId || ''),
      clubName: e.club_name || e.club?.name || 'Campus Club',
      category: mappedCategory,
      date: dateStr,
      time: timeStr,
      venue: e.venue_name || e.venue || 'Campus Auditorium',
      description: e.description || '',
      longDescription: e.description || e.recap_text || e.title,
      image: e.poster_url || e.posterUrl || 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&auto=format&fit=crop&q=80',
      capacity: Number(e.max_participants || e.maxParticipants) || 100,
      registeredCount: Number(e.registeredCount || 0),
      registrationFee: 0,
      featured: e.status === 'scheduled',
      status: (e.status === 'completed' ? 'completed' : 'upcoming') as CampusEvent['status'],
      coordinatorName: 'Event Coordinator',
      coordinatorContact: '+91 98765 43210',
      tags: [mappedCategory, 'Campus2026'],
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Authentication API
// ─────────────────────────────────────────────────────────────────────────────

export async function loginUser(email: string, password: string) {
  const json = await apiRequest<{ data: { token: string; userId: number; name: string; role: string } }>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }
  );

  if (json?.data?.token) {
    setAuthToken(json.data.token);
  }
  return json.data;
}

export async function registerUser(payload: {
  name: string;
  email: string;
  password: string;
  roll_no: string;
  department_id: number;
  year_of_study: number;
  phone?: string;
}) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Registration API
// ─────────────────────────────────────────────────────────────────────────────

export async function registerForEventBackend(eventId: string | number) {
  return apiRequest(`/api/events/${eventId}/register`, {
    method: 'POST',
  });
}

export async function cancelRegistrationBackend(eventId: string | number) {
  return apiRequest(`/api/events/${eventId}/register`, {
    method: 'DELETE',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Lookups (Departments & Categories)
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchDepartments(): Promise<{ department_id: number; name: string }[]> {
  try {
    const res = await apiRequest<{ data: { department_id: number; name: string }[] }>('/api/departments');
    return res.data || [];
  } catch {
    return [
      { department_id: 1, name: 'Computer Science and Engineering' },
      { department_id: 2, name: 'Electronics and Communication Engineering' },
      { department_id: 3, name: 'Electrical Engineering' },
      { department_id: 4, name: 'Mechanical Engineering' },
      { department_id: 5, name: 'Civil Engineering' },
    ];
  }
}

export async function fetchCategories(): Promise<{ category_id: number; name: string }[]> {
  try {
    const res = await apiRequest<{ data: { category_id: number; name: string }[] }>('/api/categories');
    return res.data || [];
  } catch {
    return [
      { category_id: 1, name: 'Technical' },
      { category_id: 2, name: 'Cultural' },
      { category_id: 3, name: 'Sports' },
      { category_id: 4, name: 'Workshops' },
      { category_id: 5, name: 'Management' },
    ];
  }
}
