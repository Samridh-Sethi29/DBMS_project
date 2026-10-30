import { useMemo, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ApiImage from '@/components/ApiImage';
import QueryState from '@/components/QueryState';
import { useMemories } from '@/lib/store';

export default function Memories() {
  const { memories, isLoading, error, refetch } = useMemories();
  const [selectedYear, setSelectedYear] = useState('All');
  const years = useMemo(() => ['All', ...Array.from(new Set(memories.map(memory => memory.year).filter(Boolean))).sort().reverse()], [memories]);
  const filtered = selectedYear === 'All' ? memories : memories.filter(memory => memory.year === selectedYear);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 text-fuchsia-300"><ImageIcon className="h-4 w-4" /> Event gallery</div>
          <h1 className="text-3xl font-bold text-white">Past-event memories</h1>
          <p className="mt-2 text-sm text-slate-400">Photos and recaps are loaded from completed or past events.</p>
        </div>
        <QueryState loading={isLoading} error={error} empty={!isLoading && !error && memories.length === 0} onRetry={() => void refetch()} />
        {!isLoading && !error && memories.length > 0 && <>
          <div className="mb-6 flex flex-wrap gap-2">
            {years.map(year => <button key={year} onClick={() => setSelectedYear(year)} className={`rounded-lg px-3 py-1.5 text-sm ${selectedYear === year ? 'bg-fuchsia-600 text-white' : 'border border-slate-800 bg-slate-900 text-slate-300'}`}>{year}</button>)}
          </div>
          {filtered.length === 0 ? <p className="py-8 text-center text-slate-400">No memories for this year.</p> : <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(memory => <article key={memory.id} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              <ApiImage src={memory.imageUrl} alt={memory.title} className="h-64 w-full object-cover" />
              <div className="p-5">
                <p className="text-xs font-semibold text-indigo-300">{memory.event} · {memory.year}</p>
                <h2 className="mt-1 text-lg font-bold text-white">{memory.title}</h2>
                {memory.recapText && <p className="mt-3 text-sm leading-6 text-slate-300">{memory.recapText}</p>}
              </div>
            </article>)}
          </div>}
        </>}
      </main>
      <Footer />
    </div>
  );
}
