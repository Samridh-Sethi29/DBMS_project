import { request } from './client.js';
import { getPastEvents, getUpcomingEvents, listClubs } from './clubs.js';

export const getEvent = eventId => request(`/api/events/${encodeURIComponent(eventId)}`);
export const getEventMemories = eventId => request(`/api/events/${encodeURIComponent(eventId)}/memories`);
export const registerForEvent = eventId =>
  request(`/api/events/${encodeURIComponent(eventId)}/register`, { method: 'POST' });

const categories = {
  technical: 'Technical',
  cultural: 'Cultural',
  sports: 'Sports',
  workshop: 'Workshops',
  academic: 'Management',
  other: 'Technical',
};

export function mapEvent(event) {
  const start = event.startDatetime || event.start_datetime;
  const startDate = start ? new Date(start) : null;
  return {
    id: String(event.eventId ?? event.event_id),
    title: event.title,
    clubId: String(event.clubId ?? event.club_id ?? ''),
    clubName: event.clubName || event.club_name || event.club?.name || '',
    category: categories[String(event.eventType || event.event_type || '').toLowerCase()] || 'Technical',
    startDatetime: start ? new Date(start).toISOString() : '',
    date: startDate ? startDate.toLocaleDateString() : '',
    time: startDate ? startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
    venue: event.venue || event.venue_name || '',
    description: event.description || event.recapText || event.recap_text || '',
    longDescription: event.description || event.recapText || event.recap_text || '',
    image: event.posterUrl || event.poster_url || '',
    status: event.status === 'completed' ? 'completed' : 'upcoming',
    isTentative: Boolean(event.isTentative ?? event.is_tentative),
    signupMode: event.signupMode || event.signup_mode || 'none',
    externalSignupUrl: event.externalSignupUrl || event.external_signup_url || null,
    endDatetime: event.endDatetime || event.end_datetime || null,
  };
}

export async function listUpcomingEvents() {
  const clubs = await listClubs({ page: 1, pageSize: 100 });
  const pages = await Promise.all(
    clubs.data.map(club => getUpcomingEvents(club.clubId, 12)),
  );
  return pages.flatMap((page, index) => page.data.map(event => mapEvent({
    ...event,
    clubId: clubs.data[index].clubId,
    clubName: clubs.data[index].name,
  })));
}

export async function listMemories() {
  const clubs = await listClubs({ page: 1, pageSize: 100 });
  const pastPages = await Promise.all(
    clubs.data.map(club => getPastEvents(club.clubId, 1, 100)),
  );
  const past = pastPages.flatMap(page => page.data);
  const memories = await Promise.all(past.map(event => getEventMemories(event.eventId)));
  return memories.flatMap(({ data }) => {
    const eventInfo = {
      event: data.event.title,
      year: data.event.startDatetime ? String(new Date(data.event.startDatetime).getFullYear()) : '',
      recapText: data.event.recapText || '',
      eventId: String(data.event.eventId),
    };
    if (data.photos.length === 0) {
      return [{ ...eventInfo, id: `event-${data.event.eventId}`, title: data.event.title, imageUrl: '' }];
    }
    return data.photos.map(photo => ({
      ...eventInfo,
      id: String(photo.photoId),
      title: photo.caption || data.event.title,
      imageUrl: photo.imageUrl || photo.thumbnailUrl || '',
    }));
  });
}
