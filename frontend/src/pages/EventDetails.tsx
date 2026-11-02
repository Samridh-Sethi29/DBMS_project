import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, ImageIcon, MapPin } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ApiImage from '@/components/ApiImage';
import QueryState from '@/components/QueryState';
import EventRegistrationButton from '@/components/EventRegistrationButton';
import { getEvent, getEventMemories, mapEvent } from '@/api/events.js';

export default function EventDetails() {
  const { eventId = '' } = useParams();
  const { data: event, isLoading, error, refetch } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => mapEvent((await getEvent(eventId)).data),
  });
  const { data: memoriesData, isLoading: memoriesLoading, error: memoriesError, refetch: refetchMemories } = useQuery({
    queryKey: ['event-memories', eventId],
    queryFn: async () => (await getEventMemories(eventId)).data,
    enabled: !!eventId,
  });
  const memories = memoriesData?.photos || [];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Link to="/events" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> All events</Link>
        <QueryState loading={isLoading} error={error} onRetry={() => void refetch()} />
        {!isLoading && !error && !event && <p className="py-12 text-center text-slate-400">Event not found.</p>}
        {!isLoading && !error && event && <>
          <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
            <ApiImage src={event.image} alt={`${event.title} poster`} className="max-h-[28rem] w-full object-cover" />
            <div className="space-y-5 p-6 sm:p-10">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs text-indigo-300">{event.category}</span>
                {event.isTentative && <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-300">Tentative</span>}
              </div>
              <h1 className="text-3xl font-bold text-white">{event.title}</h1>
              <p className="text-slate-300">{event.description || 'No description provided.'}</p>
              <div className="flex flex-wrap gap-6 text-sm text-slate-300">
                <span className="inline-flex items-center gap-2"><Calendar className="h-4 w-4 text-indigo-300" />{event.isPlaceholder ? 'Date to be announced' : `${event.date} ${event.time}`}</span>
                <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-indigo-300" />{event.venue || 'Venue not specified'}</span>
                <span>By {event.clubName}</span>
              </div>
              {event.signupMode === 'internal' || event.signupMode === 'external' ? (
                <EventRegistrationButton event={event} className="max-w-sm" />
              ) : (
                <p className="text-sm text-slate-400">Registration is not available for this event.</p>
              )}
            </div>
          </div>

          <section className="mt-10 rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
            <div className="mb-5 flex items-center gap-2 text-fuchsia-300">
              <ImageIcon className="h-5 w-5" />
              <h2 className="text-xl font-bold text-white">Event memories</h2>
            </div>
            <QueryState
              loading={memoriesLoading}
              error={memoriesError}
              empty={!memoriesLoading && !memoriesError && memories.length === 0}
              onRetry={() => void refetchMemories()}
            />
            {!memoriesLoading && !memoriesError && memories.length > 0 && (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {memories.map(memory => (
                  <article key={memory.photoId} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                    <ApiImage src={memory.imageUrl} alt={memory.caption || event.title} className="h-64 w-full object-cover" />
                    {memory.caption && <div className="p-4 text-sm text-slate-300">{memory.caption}</div>}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>}
      </main>
      <Footer />
    </div>
  );
}
