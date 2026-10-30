import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import EventCard from '@/components/EventCard';
import ClubCard from '@/components/ClubCard';
import ApiImage from '@/components/ApiImage';
import QueryState from '@/components/QueryState';
import { useClubs, useEvents, useMemories } from '@/lib/store';

export default function Home() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const eventsQuery = useEvents();
  const clubsQuery = useClubs({ page: 1, pageSize: 3 });
  const memoriesQuery = useMemories();
  const events = eventsQuery.events.slice(0, 3);
  const clubs = clubsQuery.clubs.slice(0, 3);
  const memories = memoriesQuery.memories.slice(0, 4);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    navigate(`/events?search=${encodeURIComponent(search.trim())}`);
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />
      <section className="px-4 py-20 text-center">
        <p className="text-sm font-semibold text-indigo-300">Campus clubs and events</p>
        <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-extrabold text-white sm:text-6xl">Discover what is happening on campus</h1>
        <p className="mx-auto mt-5 max-w-2xl text-slate-300">Browse live club details, upcoming events, and memories shared from past events.</p>
        <form onSubmit={submitSearch} className="mx-auto mt-8 flex max-w-xl gap-2">
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search events" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white" />
          <button className="rounded-xl bg-indigo-600 px-5 font-semibold text-white">Search</button>
        </form>
      </section>
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-14 px-4 py-8 sm:px-6 lg:px-8">
        <section>
          <div className="mb-5 flex items-center justify-between"><h2 className="text-2xl font-bold text-white">Upcoming events</h2><Link to="/events" className="text-sm text-indigo-300">All events</Link></div>
          <QueryState loading={eventsQuery.isLoading} error={eventsQuery.error} empty={!eventsQuery.isLoading && !eventsQuery.error && events.length === 0} onRetry={() => void eventsQuery.refetch()} />
          {!eventsQuery.isLoading && !eventsQuery.error && events.length > 0 && <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{events.map(event => <EventCard key={event.id} event={event} />)}</div>}
        </section>
        <section>
          <div className="mb-5 flex items-center justify-between"><h2 className="text-2xl font-bold text-white">Clubs</h2><Link to="/clubs" className="text-sm text-cyan-300">Browse clubs</Link></div>
          <QueryState loading={clubsQuery.isLoading} error={clubsQuery.error} empty={!clubsQuery.isLoading && !clubsQuery.error && clubs.length === 0} onRetry={() => void clubsQuery.refetch()} />
          {!clubsQuery.isLoading && !clubsQuery.error && clubs.length > 0 && <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{clubs.map(club => <ClubCard key={club.id} club={club} />)}</div>}
        </section>
        <section>
          <div className="mb-5 flex items-center justify-between"><h2 className="text-2xl font-bold text-white">Past-event memories</h2><Link to="/memories" className="text-sm text-fuchsia-300">View gallery</Link></div>
          <QueryState loading={memoriesQuery.isLoading} error={memoriesQuery.error} empty={!memoriesQuery.isLoading && !memoriesQuery.error && memories.length === 0} onRetry={() => void memoriesQuery.refetch()} />
          {!memoriesQuery.isLoading && !memoriesQuery.error && memories.length > 0 && <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {memories.map(memory => <article key={memory.id} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              <ApiImage src={memory.imageUrl} alt={memory.title} className="h-48 w-full object-cover" />
              <div className="p-3"><p className="text-xs text-indigo-300">{memory.event}</p><h3 className="mt-1 truncate text-sm font-semibold text-white">{memory.title}</h3></div>
            </article>)}
          </div>}
        </section>
      </main>
      <Footer />
    </div>
  );
}
