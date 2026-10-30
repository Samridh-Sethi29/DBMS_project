import { useState } from 'react';
import { Search, Users } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ClubCard from '@/components/ClubCard';
import QueryState from '@/components/QueryState';
import { useClubs } from '@/lib/store';

const PAGE_SIZE = 9;

export default function Clubs() {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { clubs, meta, isLoading, error, refetch } = useClubs({
    category: selectedCategory,
    search,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 text-cyan-400 text-xs font-semibold mb-3"><Users className="h-4 w-4" /> Campus communities</div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Student Clubs & Societies</h1>
          <p className="mt-2 text-sm text-slate-400">Browse active clubs and their current member counts.</p>
        </div>
        <div className="mb-8 grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:grid-cols-[1fr_auto]">
          <label className="relative">
            <span className="sr-only">Search clubs</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search clubs" className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-white" />
          </label>
          <label className="text-sm text-slate-400">
            <span className="sr-only">Filter by category</span>
            <input value={selectedCategory} onChange={event => { setSelectedCategory(event.target.value); setPage(1); }} placeholder="Category" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white sm:w-48" />
          </label>
        </div>
        <QueryState loading={isLoading} error={error} empty={!isLoading && !error && clubs.length === 0} onRetry={() => void refetch()} />
        {!isLoading && !error && clubs.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {clubs.map(club => <ClubCard key={club.id} club={club} />)}
            </div>
            <div className="mt-8 flex items-center justify-center gap-4 text-sm text-slate-300">
              <button disabled={page <= 1} onClick={() => setPage(current => current - 1)} className="rounded-lg border border-slate-700 px-4 py-2 disabled:opacity-40">Previous</button>
              <span>Page {meta?.page || page} of {meta?.totalPages || 1}</span>
              <button disabled={page >= (meta?.totalPages || 1)} onClick={() => setPage(current => current + 1)} className="rounded-lg border border-slate-700 px-4 py-2 disabled:opacity-40">Next</button>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
