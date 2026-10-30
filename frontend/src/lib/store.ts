import { useQuery } from '@tanstack/react-query';
import { listClubs, mapClub } from '@/api/clubs.js';
import { listMemories, listUpcomingEvents } from '@/api/events.js';

export interface CampusEvent {
  id: string;
  title: string;
  clubId: string;
  clubName: string;
  category: 'Technical' | 'Cultural' | 'Sports' | 'Workshops' | 'Management' | 'Arts';
  startDatetime: string;
  date: string;
  time: string;
  venue: string;
  description: string;
  longDescription: string;
  image: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  isTentative?: boolean;
  signupMode?: string;
  externalSignupUrl?: string | null;
  endDatetime?: string | null;
}

export interface Club {
  id: string;
  name: string;
  category: string;
  tagline: string;
  description: string;
  memberCount: number;
  logo: string;
  banner: string;
}

export interface Memory {
  id: string;
  title: string;
  event: string;
  year: string;
  imageUrl: string;
  recapText?: string;
  eventId?: string;
}

export function useEvents() {
  const query = useQuery<CampusEvent[]>({ queryKey: ['events'], queryFn: listUpcomingEvents });
  return { events: query.data || [], ...query };
}

export function useClubs(options = {}) {
  const query = useQuery<{ clubs: Club[]; meta: any }>({
    queryKey: ['clubs', options],
    queryFn: async () => {
      const response = await listClubs(options);
      return { clubs: response.data.map(mapClub), meta: response.meta };
    },
  });
  return { clubs: query.data?.clubs || [], meta: query.data?.meta, ...query };
}

export function useMemories() {
  const query = useQuery<Memory[]>({ queryKey: ['memories'], queryFn: listMemories });
  return { memories: query.data || [], ...query };
}
