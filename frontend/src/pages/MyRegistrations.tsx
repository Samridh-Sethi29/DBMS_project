import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import QueryState from '@/components/QueryState';
import { getMyRegistrations } from '@/api/auth.js';
import { cancelEventRegistration } from '@/api/events.js';
import { useAuth } from '@/auth/AuthContext';

interface Registration {
  registrationId: number;
  eventId: number;
  eventTitle: string;
  startDatetime: string | null;
  eventStatus: string;
  venue: string;
  status: 'registered' | 'cancelled';
  registeredAt: string | null;
}

export default function MyRegistrations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: registrations = [], isLoading, error, refetch } = useQuery<Registration[]>({
    queryKey: ['my-registrations'],
    queryFn: async () => (await getMyRegistrations()).data,
  });
  const cancel = useMutation<unknown, Error, number>({
    mutationFn: (eventId: number) => cancelEventRegistration(eventId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-registrations'] }),
  });

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
        <h1 className="text-3xl font-bold text-white">My registrations</h1>
        <p className="mt-3 text-slate-300">Signed in as {user?.name}.</p>
        <QueryState loading={isLoading} error={error} empty={!isLoading && !error && registrations.length === 0} onRetry={() => void refetch()} />
        {cancel.error && <p role="alert" className="mt-4 text-sm text-rose-300">{cancel.error.message}</p>}
        {!isLoading && !error && registrations.length > 0 && (
          <div className="mt-8 space-y-4">
            {registrations.map(registration => (
              <article key={registration.registrationId} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="flex flex-col justify-between gap-4 sm:flex-row">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{registration.eventTitle}</h2>
                    <p className="mt-1 text-sm text-slate-300">{registration.startDatetime ? new Date(registration.startDatetime).toLocaleString() : 'Date unavailable'}</p>
                    <p className="mt-1 text-sm text-slate-400">{registration.venue}</p>
                    <p className="mt-2 text-xs capitalize text-slate-400">Registration {registration.status}</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <Link to={`/events/${registration.eventId}`} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">View event</Link>
                    {registration.status === 'registered' && <button disabled={cancel.isPending} onClick={() => cancel.mutate(registration.eventId)} className="rounded-lg bg-rose-700 px-3 py-2 text-sm text-white disabled:opacity-50">{cancel.isPending ? 'Cancelling…' : 'Cancel'}</button>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
