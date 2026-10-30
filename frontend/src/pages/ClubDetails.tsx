import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Users } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import EventCard from '@/components/EventCard';
import ApiImage from '@/components/ApiImage';
import QueryState from '@/components/QueryState';
import { getClub } from '@/api/clubs.js';
import { mapEvent } from '@/api/events.js';

export default function ClubDetails() {
  const { clubId = '' } = useParams();
  const { data: club, isLoading, error, refetch } = useQuery({
    queryKey: ['club', clubId],
    queryFn: async () => (await getClub(clubId)).data,
  });

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <Link to="/clubs" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> All clubs</Link>
        <QueryState loading={isLoading} error={error} onRetry={() => void refetch()} />
        {!isLoading && !error && !club && <p className="py-12 text-center text-slate-400">Club not found.</p>}
        {!isLoading && !error && club && (
          <>
            <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-10">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <ApiImage src={club.logoUrl} alt={`${club.name} logo`} className="h-24 w-24 rounded-2xl object-cover" />
                <div>
                  <p className="text-sm text-indigo-300">{club.category}</p>
                  <h1 className="mt-1 text-3xl font-bold text-white">{club.name}</h1>
                  {club.tagline && <p className="mt-1 text-indigo-300">{club.tagline}</p>}
                  <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">{club.description || 'No description provided.'}</p>
                  {club.websiteUrl && <a className="mt-4 inline-block text-sm text-cyan-300 underline" href={club.websiteUrl} target="_blank" rel="noreferrer">Club website</a>}
                </div>
              </div>
            </section>
            <section className="mb-10">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-white"><Calendar className="h-5 w-5" /> Upcoming events</h2>
              {club.upcomingEvents?.length ? <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{club.upcomingEvents.map(event => <EventCard key={event.eventId} event={mapEvent({ ...event, clubId: club.clubId, clubName: club.name })} />)}</div> : <p className="rounded-2xl border border-slate-800 p-6 text-sm text-slate-400">No upcoming events.</p>}
            </section>
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-white"><Users className="h-5 w-5" /> Core members</h2>
              {club.coreMembers?.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {club.coreMembers.map(member => (
                  <article key={`${member.studentId}-${member.positionTitle}`} className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
                    <ApiImage src={member.photoUrl} alt={`${member.name} photo`} className="h-14 w-14 rounded-full object-cover" />
                    <div><h3 className="font-semibold text-white">{member.name}</h3><p className="text-sm text-slate-400">{member.positionTitle || member.role}</p></div>
                  </article>
                ))}
              </div> : <p className="rounded-2xl border border-slate-800 p-6 text-sm text-slate-400">No core members are listed.</p>}
              {club.facultyAdvisor && <p className="mt-5 text-sm text-slate-400">Faculty advisor: <span className="text-slate-200">{club.facultyAdvisor}</span></p>}
            </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
