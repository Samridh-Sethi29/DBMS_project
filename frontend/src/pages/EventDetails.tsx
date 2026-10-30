import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ApiImage from '@/components/ApiImage';
import QueryState from '@/components/QueryState';
import { getEvent, mapEvent, registerForEvent } from '@/api/events.js';
import { useAuth } from '@/auth/AuthContext';

export default function EventDetails() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { data: event, isLoading, error, refetch } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => mapEvent((await getEvent(eventId)).data),
  });

  async function register() {
    if (!user) {
      navigate('/login');
      return;
    }
    setSubmitting(true);
    setMessage('');
    try {
      await registerForEvent(eventId);
      setMessage('Registration completed.');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  }

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
                <span className="inline-flex items-center gap-2"><Calendar className="h-4 w-4 text-indigo-300" />{event.date} {event.time}</span>
                <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-indigo-300" />{event.venue || 'Venue not specified'}</span>
                <span>By {event.clubName}</span>
              </div>
              {event.signupMode === 'external' && event.externalSignupUrl ? (
                <a href={event.externalSignupUrl} target="_blank" rel="noreferrer" className="inline-block rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white">External registration</a>
              ) : event.signupMode === 'internal' ? (
                <button disabled={submitting} onClick={() => void register()} className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{submitting ? 'Registering…' : 'Register'}</button>
              ) : <p className="text-sm text-slate-400">Registration is not available for this event.</p>}
              {message && <p role="status" className="text-sm text-slate-300">{message}</p>}
            </div>
          </div>
        </>}
      </main>
      <Footer />
    </div>
  );
}
