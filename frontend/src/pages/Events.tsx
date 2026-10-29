import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Calendar, 
  SlidersHorizontal, 
  Sparkles, 
  Zap, 
  Trophy, 
  Award, 
  RotateCcw,
  Tag
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import EventCard from '@/components/EventCard';
import { useEvents } from '@/lib/store';

export default function Events() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || 'All';
  const initialSearch = searchParams.get('search') || '';

  const [category, setCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch);
  const [freeOnly, setFreeOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'date' | 'popular'>('date');

  const { events } = useEvents();

  const categories = ['All', 'Technical', 'Cultural', 'Sports', 'Workshops', 'Arts', 'Management'];

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      // Category filter
      if (category !== 'All' && ev.category.toLowerCase() !== category.toLowerCase()) {
        return false;
      }
      // Free only filter
      if (freeOnly && ev.registrationFee > 0) {
        return false;
      }
      // Search term filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = ev.title.toLowerCase().includes(query);
        const matchesClub = ev.clubName.toLowerCase().includes(query);
        const matchesVenue = ev.venue.toLowerCase().includes(query);
        const matchesDesc = ev.description.toLowerCase().includes(query);
        const matchesTags = ev.tags.some(t => t.toLowerCase().includes(query));
        if (!matchesTitle && !matchesClub && !matchesVenue && !matchesDesc && !matchesTags) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'popular') {
        return b.registeredCount - a.registeredCount;
      }
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }, [events, category, searchQuery, freeOnly, sortBy]);

  const handleCategorySelect = (cat: string) => {
    setCategory(cat);
    if (cat === 'All') {
      searchParams.delete('category');
    } else {
      searchParams.set('category', cat);
    }
    setSearchParams(searchParams);
  };

  const handleReset = () => {
    setCategory('All');
    setSearchQuery('');
    setFreeOnly(false);
    setSortBy('date');
    setSearchParams({});
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Campus Schedule & Timeline</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            All Campus Events
          </h1>
          <p className="text-sm text-slate-400 mt-2 max-w-2xl">
            Explore and register for upcoming departmental fests, hackathons, sports championships, workshops, and guest lectures.
          </p>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 rounded-2xl glass-panel border border-slate-800 space-y-4 mb-8">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search event title, club, venue, or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-white placeholder-slate-400 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Quick toggles */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-300 cursor-pointer px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={freeOnly}
                  onChange={(e) => setFreeOnly(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span>Free Entry Only</span>
              </label>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 outline-none cursor-pointer hover:border-slate-700"
              >
                <option value="date">Sort: Upcoming Dates</option>
                <option value="popular">Sort: Most Popular</option>
              </select>

              {(category !== 'All' || searchQuery || freeOnly) && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
            <span className="text-xs text-slate-400 font-medium mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Category:
            </span>
            {categories.map((cat) => {
              const active = category.toLowerCase() === cat.toLowerCase();
              return (
                <button
                  key={cat}
                  onClick={() => handleCategorySelect(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    active
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results Info */}
        <div className="flex items-center justify-between mb-6 text-xs text-slate-400">
          <span>Showing <strong className="text-white">{filteredEvents.length}</strong> events</span>
          {category !== 'All' && (
            <span className="text-indigo-400 font-medium">Filtering by: {category}</span>
          )}
        </div>

        {/* Events Grid */}
        {filteredEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center rounded-3xl border border-dashed border-slate-800 bg-slate-900/30">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Calendar className="w-8 h-8 opacity-60" />
            </div>
            <h3 className="text-lg font-bold text-white">No matching events found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              We couldn't find any events matching your selected filter criteria or search query.
            </p>
            <button
              onClick={handleReset}
              className="mt-5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
