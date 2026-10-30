import { request } from './client.js';

export const listClubs = ({ category = '', search = '', page = 1, pageSize = 12 } = {}) => {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (category && category !== 'All') query.set('category', category);
  if (search.trim()) query.set('search', search.trim());
  return request(`/api/clubs?${query}`);
};

export const getClub = clubId => request(`/api/clubs/${encodeURIComponent(clubId)}`);
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
