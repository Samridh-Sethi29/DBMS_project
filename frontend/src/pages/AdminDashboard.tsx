import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import QueryState from '@/components/QueryState';
import { useEvents, useClubs } from '@/lib/store';

export default function AdminDashboard() {
  const eventsQuery = useEvents();
  const clubsQuery = useClubs({ page: 1, pageSize: 100 });

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-10 px-4 py-10 sm:px-6 lg:px-8">
        <header><p className="text-sm text-indigo-300">Administrator access</p><h1 className="mt-1 text-3xl font-bold text-white">Campus overview</h1></header>
        <section>
          <h2 className="mb-4 text-xl font-bold text-white">Clubs</h2>
          <QueryState loading={clubsQuery.isLoading} error={clubsQuery.error} empty={!clubsQuery.isLoading && !clubsQuery.error && clubsQuery.clubs.length === 0} onRetry={() => void clubsQuery.refetch()} />
          {!clubsQuery.isLoading && !clubsQuery.error && clubsQuery.clubs.length > 0 && <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-sm"><thead className="bg-slate-900 text-slate-300"><tr><th className="p-3">Club</th><th className="p-3">Category</th><th className="p-3">Members</th></tr></thead><tbody>
              {clubsQuery.clubs.map(club => <tr key={club.id} className="border-t border-slate-800 text-slate-200"><td className="p-3">{club.name}</td><td className="p-3">{club.category}</td><td className="p-3">{club.memberCount}</td></tr>)}
            </tbody></table>
          </div>}
        </section>
        <section>
          <h2 className="mb-4 text-xl font-bold text-white">Events</h2>
          <QueryState loading={eventsQuery.isLoading} error={eventsQuery.error} empty={!eventsQuery.isLoading && !eventsQuery.error && eventsQuery.events.length === 0} onRetry={() => void eventsQuery.refetch()} />
          {!eventsQuery.isLoading && !eventsQuery.error && eventsQuery.events.length > 0 && <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-sm"><thead className="bg-slate-900 text-slate-300"><tr><th className="p-3">Event</th><th className="p-3">Club</th><th className="p-3">Starts</th><th className="p-3">Status</th></tr></thead><tbody>
              {eventsQuery.events.map(event => <tr key={event.id} className="border-t border-slate-800 text-slate-200"><td className="p-3">{event.title}</td><td className="p-3">{event.clubName}</td><td className="p-3">{event.date}</td><td className="p-3">{event.isTentative ? 'Tentative' : event.status}</td></tr>)}
            </tbody></table>
          </div>}
        </section>
        <p className="text-sm text-slate-400">Event editing, attendance rosters, and registration management are not exposed by the currently documented API.</p>
      </main>
      <Footer />
    </div>
  );
}
