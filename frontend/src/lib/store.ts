import { useState, useEffect } from 'react';
import { 
  fetchEventsFromBackend, 
  fetchClubsFromBackend, 
  registerForEventBackend, 
  cancelRegistrationBackend,
  setAuthToken
} from './api';

export interface CampusEvent {
  id: string;
  title: string;
  clubId: string;
  clubName: string;
  category: 'Technical' | 'Cultural' | 'Sports' | 'Workshops' | 'Management' | 'Arts';
  date: string;
  time: string;
  venue: string;
  description: string;
  longDescription: string;
  image: string;
  capacity: number;
  registeredCount: number;
  registrationFee: number;
  featured: boolean;
  status: 'upcoming' | 'ongoing' | 'completed';
  prizes?: string;
  coordinatorName: string;
  coordinatorContact: string;
  tags: string[];
}

export interface Club {
  id: string;
  name: string;
  category: 'Technical' | 'Cultural' | 'Sports' | 'Arts' | 'Social';
  tagline: string;
  description: string;
  leadCoordinator: string;
  memberCount: number;
  eventsCount: number;
  logo: string;
  banner: string;
  socialLinks: {
    email: string;
    instagram?: string;
    linkedin?: string;
  };
}

export interface Registration {
  id: string;
  ticketNumber: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventVenue: string;
  userName: string;
  userEmail: string;
  userRoll: string;
  userDepartment: string;
  userYear: string;
  qrCodeData: string;
  registeredAt: string;
  status: 'confirmed' | 'cancelled' | 'attended';
}

export interface Memory {
  id: string;
  title: string;
  event: string;
  year: string;
  imageUrl: string;
  uploadedBy: string;
  likes: number;
  isLiked?: boolean;
}

export interface User {
  name: string;
  email: string;
  rollNumber: string;
  role: 'student' | 'admin' | 'club_lead';
  department?: string;
  year?: string;
}

const DEFAULT_CLUBS: Club[] = [
  {
    id: 'code-nexus',
    name: 'Code Nexus',
    category: 'Technical',
    tagline: 'Building algorithms, shaping future developers',
    description: 'The premier computer science and competitive programming society on campus. We host hackathons, web dev bootcamps, open-source sprints, and coding battles.',
    leadCoordinator: 'Aarav Sharma',
    memberCount: 240,
    eventsCount: 8,
    logo: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=150&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&auto=format&fit=crop&q=80',
    socialLinks: {
      email: 'codenexus@campus.edu',
      instagram: '@codenexus_hub',
      linkedin: 'codenexus-society'
    }
  },
  {
    id: 'robotics-club',
    name: 'RoboCrafters Club',
    category: 'Technical',
    tagline: 'Inventing autonomous bots and embedded hardware',
    description: 'Designing autonomous rovers, drone racing rigs, and combat robots for national-level tech fests.',
    leadCoordinator: 'Sneha Patel',
    memberCount: 165,
    eventsCount: 5,
    logo: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=150&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1563770660941-20978e870e26?w=1200&auto=format&fit=crop&q=80',
    socialLinks: {
      email: 'robocrafters@campus.edu',
      instagram: '@robocrafters'
    }
  },
  {
    id: 'tarang-cultural',
    name: 'Tarang Cultural Society',
    category: 'Cultural',
    tagline: 'The heartbeat of music, dance, and campus vibes',
    description: 'Home to the college choir, classical orchestra, western rock bands, street play troupes, and contemporary dance crews.',
    leadCoordinator: 'Rohan Deshmukh',
    memberCount: 310,
    eventsCount: 12,
    logo: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&auto=format&fit=crop&q=80',
    socialLinks: {
      email: 'tarang@campus.edu',
      instagram: '@tarang_campus'
    }
  },
  {
    id: 'shutterbugs',
    name: 'Aperture Shutterbugs',
    category: 'Arts',
    tagline: 'Freezing moments, creating eternal campus memories',
    description: 'Campus photography and cinematography collective covering college festivals, photo walks, portrait workshops, and short film shoots.',
    leadCoordinator: 'Kritika Roy',
    memberCount: 95,
    eventsCount: 4,
    logo: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=150&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=1200&auto=format&fit=crop&q=80',
    socialLinks: {
      email: 'shutterbugs@campus.edu',
      instagram: '@aperture_shutterbugs'
    }
  },
  {
    id: 'sports-council',
    name: 'Titan Sports Council',
    category: 'Sports',
    tagline: 'Pushing physical limits, building champions',
    description: 'Oversees inter-departmental tournaments in football, cricket, basketball, badminton, table tennis, and athletics.',
    leadCoordinator: 'Vikram Singh',
    memberCount: 420,
    eventsCount: 9,
    logo: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=150&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&auto=format&fit=crop&q=80',
    socialLinks: {
      email: 'sports@campus.edu',
      instagram: '@titan_sports_council'
    }
  }
];

const DEFAULT_EVENTS: CampusEvent[] = [
  {
    id: 'hack-campus-2026',
    title: 'HackNova 2026: 36-Hour Hackathon',
    clubId: 'code-nexus',
    clubName: 'Code Nexus',
    category: 'Technical',
    date: '2026-11-15',
    time: '09:00 AM - Next Day 09:00 PM',
    venue: 'Main Auditorium & CS Labs 1-4',
    description: 'The annual flagship 36-hour hackathon where 100+ teams build AI solutions, Web3 apps, and IoT devices.',
    longDescription: 'HackNova 2026 brings together the brightest student minds to solve real-world problems in AI, Climate Tech, Healthcare, and Decentralized Systems. Enjoy free meals, midnight pizza, mentor office hours, industry workshops, and generous prize pools. Teams can comprise 2 to 4 members. Hardware components will be provided for IoT tracks.',
    image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&auto=format&fit=crop&q=80',
    capacity: 250,
    registeredCount: 184,
    registrationFee: 0,
    featured: true,
    status: 'upcoming',
    prizes: '₹1,50,000 Cash Pool + Cloud Credits + Internship Offers',
    coordinatorName: 'Aarav Sharma',
    coordinatorContact: '+91 98765 43210',
    tags: ['AI/ML', 'Hackathon', 'Coding', 'Open Source']
  },
  {
    id: 'battle-of-bands',
    title: 'Echoes 2026: Battle of the Bands',
    clubId: 'tarang-cultural',
    clubName: 'Tarang Cultural Society',
    category: 'Cultural',
    date: '2026-11-20',
    time: '06:00 PM - 10:30 PM',
    venue: 'Open Air Amphitheatre',
    description: 'High-voltage live rock, indie, and fusion performances under the stars with guest celebrity judges.',
    longDescription: 'Get ready for thunderous guitar solos, explosive drum solos, and mesmerizing vocals! Eight shortlisted campus bands will battle it out on stage for the coveted Golden Pick Trophy. Food stalls, glow sticks, and merchandise booths will be open throughout the evening.',
    image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&auto=format&fit=crop&q=80',
    capacity: 800,
    registeredCount: 640,
    registrationFee: 50,
    featured: true,
    status: 'upcoming',
    prizes: '₹50,000 Cash + Studio Recording Contract',
    coordinatorName: 'Rohan Deshmukh',
    coordinatorContact: '+91 98111 22334',
    tags: ['Music', 'Live Concert', 'Festival', 'Rock']
  },
  {
    id: 'robowars-arena',
    title: 'MechaClash: 15kg RoboWars',
    clubId: 'robotics-club',
    clubName: 'RoboCrafters Club',
    category: 'Technical',
    date: '2026-11-25',
    time: '11:00 AM - 05:00 PM',
    venue: 'Reinforced Arena, Indoor Sports Complex',
    description: 'Armored combat bots collide with spinners, flippers, and wedge blades in a polycarbonate bulletproof cage.',
    longDescription: 'Witness high-impact steel destruction in the battle cage! Certified combat bots up to 15kg weight category face off in a double-elimination knockout tournament. Live commentary and technical inspection in the pit stop area.',
    image: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1200&auto=format&fit=crop&q=80',
    capacity: 400,
    registeredCount: 312,
    registrationFee: 200,
    featured: true,
    status: 'upcoming',
    prizes: '₹75,000 Cash + 3D Printer for Winner',
    coordinatorName: 'Sneha Patel',
    coordinatorContact: '+91 97234 56789',
    tags: ['Robotics', 'Combat', 'Engineering', 'Hardware']
  },
  {
    id: 'inter-college-football',
    title: 'Titan Cup 2026: 7v7 Football League',
    clubId: 'sports-council',
    clubName: 'Titan Sports Council',
    category: 'Sports',
    date: '2026-12-02',
    time: '04:00 PM - 09:00 PM',
    venue: 'Campus Football Turf Grounds',
    description: 'Under-the-lights fast-paced 7-a-side football championship featuring 16 department teams.',
    longDescription: 'The annual inter-department football tournament played on professional artificial turf with floodlights. Two halves of 25 minutes each, professional referees, hydration stations, and cheer sections for each college house.',
    image: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&auto=format&fit=crop&q=80',
    capacity: 500,
    registeredCount: 420,
    registrationFee: 0,
    featured: false,
    status: 'upcoming',
    prizes: 'Titan Trophy + Medals & Sports Kits',
    coordinatorName: 'Vikram Singh',
    coordinatorContact: '+91 99887 66554',
    tags: ['Football', 'Sports', 'Tournament', 'Fitness']
  },
  {
    id: 'ai-gen-masterclass',
    title: 'Hands-On Generative AI & LLM Systems',
    clubId: 'code-nexus',
    clubName: 'Code Nexus',
    category: 'Workshops',
    date: '2026-12-08',
    time: '02:00 PM - 06:00 PM',
    venue: 'Seminar Hall 2, Tech Block',
    description: 'Deep dive into building RAG pipelines, fine-tuning open-weights models, and deploying production agent workflows.',
    longDescription: 'Led by visiting Google AI engineers and alumni researchers. Hands-on coding session covering LangChain, vector databases (Pinecone/Milvus), and building real-time multi-agent systems with live API credentials provided.',
    image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80',
    capacity: 120,
    registeredCount: 118,
    registrationFee: 0,
    featured: false,
    status: 'upcoming',
    prizes: 'Verified Certificate of Completion + Cloud Credits',
    coordinatorName: 'Aarav Sharma',
    coordinatorContact: '+91 98765 43210',
    tags: ['Workshop', 'GenAI', 'Python', 'LLM']
  },
  {
    id: 'monochrome-frames',
    title: 'Perspectives: Street & Light Photo Walk',
    clubId: 'shutterbugs',
    clubName: 'Aperture Shutterbugs',
    category: 'Arts',
    date: '2026-12-14',
    time: '06:30 AM - 11:00 AM',
    venue: 'Old Heritage Campus & Riverfront',
    description: 'Early morning photography excursion exploring golden hour lighting, architectural geometry, and street candids.',
    longDescription: 'Bring your DSLR, mirrorless or mobile camera. Professional photographers will walk you through manual exposure, shutter speed tricks, composition rules, and Adobe Lightroom mobile presets.',
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=1200&auto=format&fit=crop&q=80',
    capacity: 50,
    registeredCount: 42,
    registrationFee: 0,
    featured: false,
    status: 'upcoming',
    prizes: 'Top 3 photos exhibited at Annual Art Gala',
    coordinatorName: 'Kritika Roy',
    coordinatorContact: '+91 98333 44556',
    tags: ['Photography', 'PhotoWalk', 'Creative', 'VisualArts']
  }
];

const DEFAULT_MEMORIES: Memory[] = [
  {
    id: 'mem-1',
    title: 'Star Night at Utkarsh 2025',
    event: 'Annual Cultural Fest',
    year: '2025',
    imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&auto=format&fit=crop&q=80',
    uploadedBy: 'Ritika Sharma (Media Cell)',
    likes: 342,
    isLiked: false
  },
  {
    id: 'mem-2',
    title: 'CodeSprint 24hr Finalist Showcase',
    event: 'National Hackathon',
    year: '2025',
    imageUrl: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&auto=format&fit=crop&q=80',
    uploadedBy: 'Code Nexus Team',
    likes: 198,
    isLiked: true
  },
  {
    id: 'mem-3',
    title: 'Championship Winning Goal!',
    event: 'Inter-University Football Cup',
    year: '2025',
    imageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&auto=format&fit=crop&q=80',
    uploadedBy: 'Titan Sports Crew',
    likes: 412,
    isLiked: false
  },
  {
    id: 'mem-4',
    title: 'Drone Flying Demonstration',
    event: 'TechnoShakti 2024',
    year: '2024',
    imageUrl: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=800&auto=format&fit=crop&q=80',
    uploadedBy: 'RoboCrafters Club',
    likes: 156,
    isLiked: false
  },
  {
    id: 'mem-5',
    title: 'Diwali Lantern Lighting on Quad',
    event: 'Deepotsav Festival',
    year: '2024',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
    uploadedBy: 'Student Affairs',
    likes: 529,
    isLiked: true
  },
  {
    id: 'mem-6',
    title: 'Unplugged Acoustic Jam Session',
    event: 'Sunset Melodies',
    year: '2025',
    imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80',
    uploadedBy: 'Tarang Society',
    likes: 278,
    isLiked: false
  }
];

const DEFAULT_USER: User = {
  name: 'Shriyanshi V.',
  email: 'shriyanshi@campus.edu',
  rollNumber: 'CS23B1042',
  role: 'student',
  department: 'Computer Science & Engineering',
  year: '3rd Year'
};

const DEFAULT_REGISTRATIONS: Registration[] = [
  {
    id: 'reg-101',
    ticketNumber: 'CH-2026-4891',
    eventId: 'hack-campus-2026',
    eventTitle: 'HackNova 2026: 36-Hour Hackathon',
    eventDate: '2026-11-15',
    eventTime: '09:00 AM',
    eventVenue: 'Main Auditorium & CS Labs',
    userName: 'Shriyanshi V.',
    userEmail: 'shriyanshi@campus.edu',
    userRoll: 'CS23B1042',
    userDepartment: 'Computer Science',
    userYear: '3rd Year',
    qrCodeData: 'TICKET:CH-2026-4891:EVENT:hack-campus-2026:STUDENT:CS23B1042',
    registeredAt: '2026-10-25 14:30',
    status: 'confirmed'
  },
  {
    id: 'reg-102',
    ticketNumber: 'CH-2026-7215',
    eventId: 'battle-of-bands',
    eventTitle: 'Echoes 2026: Battle of the Bands',
    eventDate: '2026-11-20',
    eventTime: '06:00 PM',
    eventVenue: 'Open Air Amphitheatre',
    userName: 'Shriyanshi V.',
    userEmail: 'shriyanshi@campus.edu',
    userRoll: 'CS23B1042',
    userDepartment: 'Computer Science',
    userYear: '3rd Year',
    qrCodeData: 'TICKET:CH-2026-7215:EVENT:battle-of-bands:STUDENT:CS23B1042',
    registeredAt: '2026-10-28 10:15',
    status: 'confirmed'
  }
];

// Helper to get from storage or default
function getStored<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

function setStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(e);
  }
}

// React custom hooks for store reactivity
export function useEvents() {
  const [events, setEvents] = useState<CampusEvent[]>(() => getStored('ch_events', DEFAULT_EVENTS));
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    fetchEventsFromBackend()
      .then((data) => {
        if (data && data.length > 0) {
          setEvents(data);
          setStored('ch_events', data);
          setIsLive(true);
        }
      })
      .catch(() => {});
  }, []);

  const saveEvents = (newEvents: CampusEvent[]) => {
    setEvents(newEvents);
    setStored('ch_events', newEvents);
  };

  const addEvent = (newEvent: Omit<CampusEvent, 'id' | 'registeredCount'>) => {
    const event: CampusEvent = {
      ...newEvent,
      id: 'event-' + Date.now(),
      registeredCount: 0
    };
    const updated = [event, ...events];
    saveEvents(updated);
    return event;
  };

  const updateEvent = (id: string, updates: Partial<CampusEvent>) => {
    const updated = events.map(e => e.id === id ? { ...e, ...updates } : e);
    saveEvents(updated);
  };

  const deleteEvent = (id: string) => {
    const updated = events.filter(e => e.id !== id);
    saveEvents(updated);
  };

  return { events, addEvent, updateEvent, deleteEvent };
}

export function useClubs() {
  const [clubs, setClubs] = useState<Club[]>(() => getStored('ch_clubs', DEFAULT_CLUBS));
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    fetchClubsFromBackend()
      .then((data) => {
        if (data && data.length > 0) {
          setClubs(data);
          setStored('ch_clubs', data);
          setIsLive(true);
        }
      })
      .catch(() => {});
  }, []);

  const saveClubs = (newClubs: Club[]) => {
    setClubs(newClubs);
    setStored('ch_clubs', newClubs);
  };

  const addClub = (newClub: Omit<Club, 'id' | 'memberCount' | 'eventsCount'>) => {
    const club: Club = {
      ...newClub,
      id: 'club-' + Date.now(),
      memberCount: 1,
      eventsCount: 0
    };
    const updated = [...clubs, club];
    saveClubs(updated);
    return club;
  };

  return { clubs, addClub };
}

export function useRegistrations() {
  const [registrations, setRegistrations] = useState<Registration[]>(() => 
    getStored('ch_registrations', DEFAULT_REGISTRATIONS)
  );

  const saveRegistrations = (newRegs: Registration[]) => {
    setRegistrations(newRegs);
    setStored('ch_registrations', newRegs);
  };

  const registerForEvent = (event: CampusEvent, user: User) => {
    const ticketNumber = 'CH-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);
    const newReg: Registration = {
      id: 'reg-' + Date.now(),
      ticketNumber,
      eventId: event.id,
      eventTitle: event.title,
      eventDate: event.date,
      eventTime: event.time,
      eventVenue: event.venue,
      userName: user.name,
      userEmail: user.email,
      userRoll: user.rollNumber,
      userDepartment: user.department || 'General',
      userYear: user.year || 'N/A',
      qrCodeData: `PASS:${ticketNumber}:EVENT:${event.id}:USER:${user.rollNumber}`,
      registeredAt: new Date().toLocaleString(),
      status: 'confirmed'
    };

    const updated = [newReg, ...registrations];
    saveRegistrations(updated);

    // Also increment event registeredCount in events store
    const allEvents = getStored<CampusEvent[]>('ch_events', DEFAULT_EVENTS);
    const evUpdated = allEvents.map(e => e.id === event.id ? { ...e, registeredCount: e.registeredCount + 1 } : e);
    setStored('ch_events', evUpdated);

    return newReg;
  };

  const cancelRegistration = (id: string) => {
    const reg = registrations.find(r => r.id === id);
    if (!reg) return;
    const updated = registrations.map(r => r.id === id ? { ...r, status: 'cancelled' as const } : r);
    saveRegistrations(updated);

    // Decrement event registered count
    const allEvents = getStored<CampusEvent[]>('ch_events', DEFAULT_EVENTS);
    const evUpdated = allEvents.map(e => e.id === reg.eventId ? { ...e, registeredCount: Math.max(0, e.registeredCount - 1) } : e);
    setStored('ch_events', evUpdated);
  };

  return { registrations, registerForEvent, cancelRegistration };
}

export function useMemories() {
  const [memories, setMemories] = useState<Memory[]>(() => getStored('ch_memories', DEFAULT_MEMORIES));

  const saveMemories = (newMems: Memory[]) => {
    setMemories(newMems);
    setStored('ch_memories', newMems);
  };

  const toggleLike = (id: string) => {
    const updated = memories.map(m => {
      if (m.id === id) {
        const isLiked = !m.isLiked;
        return {
          ...m,
          isLiked,
          likes: isLiked ? m.likes + 1 : m.likes - 1
        };
      }
      return m;
    });
    saveMemories(updated);
  };

  const addMemory = (title: string, event: string, year: string, imageUrl: string, uploadedBy: string) => {
    const newMem: Memory = {
      id: 'mem-' + Date.now(),
      title,
      event,
      year,
      imageUrl,
      uploadedBy,
      likes: 1,
      isLiked: true
    };
    const updated = [newMem, ...memories];
    saveMemories(updated);
    return newMem;
  };

  return { memories, toggleLike, addMemory };
}

export function useUser() {
  const [user, setUser] = useState<User | null>(() => getStored('ch_user', DEFAULT_USER));

  const login = (newUser: User) => {
    setUser(newUser);
    setStored('ch_user', newUser);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('ch_user');
  };

  return { user, login, logout };
}
