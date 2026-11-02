import { request } from './client.js';

export const listClubs = ({ category = '', search = '', page = 1, pageSize = 12 } = {}) => {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (category && category !== 'All') query.set('category', category);
  if (search.trim()) query.set('search', search.trim());
  return request(`/api/clubs?${query}`);
};

export const getClub = clubId => request(`/api/clubs/${encodeURIComponent(clubId)}`);
export const getMyMemberships = () => request('/api/me/memberships');
export const joinClub = clubId => request(`/api/clubs/${encodeURIComponent(clubId)}/join`, { method: 'POST' });
export const leaveClub = clubId => request(`/api/clubs/${encodeURIComponent(clubId)}/join`, { method: 'DELETE' });
export const getClubMembers = (clubId, { status = 'all', page = 1, pageSize = 50 } = {}) => {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (status && status !== 'all') query.set('status', status);
  return request(`/api/clubs/${encodeURIComponent(clubId)}/members?${query}`);
};
export const updateMemberStatus = (clubId, studentId, status) =>
  request(`/api/clubs/${encodeURIComponent(clubId)}/members/${encodeURIComponent(studentId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
export const updateMemberRole = (clubId, studentId, payload) =>
  request(`/api/clubs/${encodeURIComponent(clubId)}/members/${encodeURIComponent(studentId)}/role`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
export const assignClubLeadership = (clubId, payload) =>
  request(`/api/admin/clubs/${encodeURIComponent(clubId)}/members`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
export const createClubEvent = (clubId, payload) =>
  request(`/api/clubs/${encodeURIComponent(clubId)}/events`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
export const listManageEvents = (clubId, status = 'all', pageSize = 100) => {
  const query = new URLSearchParams({ page: '1', pageSize: String(pageSize) });
  if (status && status !== 'all') query.set('status', status);
  return request(`/api/clubs/${encodeURIComponent(clubId)}/events/manage?${query}`);
};
export const getEventRegistrations = (clubId, eventId) =>
  request(`/api/clubs/${encodeURIComponent(clubId)}/events/${encodeURIComponent(eventId)}/registrations`);
export const markAttendance = (clubId, eventId, studentId, status = 'present') =>
  request(`/api/clubs/${encodeURIComponent(clubId)}/events/${encodeURIComponent(eventId)}/attendance`, {
    method: 'POST',
    body: JSON.stringify({ studentId, status }),
  });
export const issueCertificate = (clubId, eventId, studentId, certificateType = 'participation') =>
  request(`/api/clubs/${encodeURIComponent(clubId)}/events/${encodeURIComponent(eventId)}/certificates`, {
    method: 'POST',
    body: JSON.stringify({ studentId, certificateType }),
  });
export const updateClubProfile = (clubId, payload) =>
  request(`/api/clubs/${encodeURIComponent(clubId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
export const uploadClubLogo = (clubId, file) => {
  const form = new FormData();
  form.append('logo', file);
  return request(`/api/clubs/${encodeURIComponent(clubId)}/logo`, { method: 'POST', body: form });
};
export const uploadEventPhoto = (clubId, eventId, file, caption = '') => {
  const form = new FormData();
  form.append('photos', file);
  if (caption) form.append('caption', caption);
  return request(`/api/clubs/${encodeURIComponent(clubId)}/events/${encodeURIComponent(eventId)}/photos`, { method: 'POST', body: form });
};
export const checkVenueConflicts = payload =>
  request('/api/venues/conflicts/check', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
export const listAvailableVenues = ({ start, end, minCapacity = 0 }) => {
  const query = new URLSearchParams({ start, end });
  if (minCapacity) query.set('minCapacity', String(minCapacity));
  return request(`/api/venues/available?${query}`);
};
export const getUpcomingEvents = (clubId, months = 12) =>
  request(`/api/clubs/${encodeURIComponent(clubId)}/events/upcoming?months=${months}`);
export const getPastEvents = (clubId, page = 1, pageSize = 100) =>
  request(`/api/clubs/${encodeURIComponent(clubId)}/events/past?page=${page}&pageSize=${pageSize}`);

export function mapClub(club) {
  return {
    id: String(club.clubId),
    name: club.name,
    category: club.category,
    tagline: club.tagline || '',
    description: club.description || '',
    memberCount: Number(club.memberCount) || 0,
    logo: club.logoUrl || '',
    banner: '',
  };
}
