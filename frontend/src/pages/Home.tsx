import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Search, 
  Sparkles, 
  Calendar, 
  Users, 
  Trophy, 
  ArrowRight, 
  Flame, 
  Compass, 
  CheckCircle2, 
  Award,
  Zap,
  TrendingUp
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import EventCard from '@/components/EventCard';
import ClubCard from '@/components/ClubCard';
import { useEvents, useClubs, useMemories } from '@/lib/store';

export default function Home() {
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const { events } = useEvents();
  const { clubs } = useClubs();
  const { memories } = useMemories();

  const featuredEvents = events.filter(e => e.featured || e.registeredCount > 150).slice(0, 3);
  const topClubs = clubs.slice(0, 3);
  const recentMemories = memories.slice(0, 4);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/events?search=${encodeURIComponent(searchTerm.trim())}`);
    } else {
      navigate('/events');
    }
  };

  const categories = [
    { name: 'Technical', icon: Zap, count: '12+ Events' },
    { name: 'Cultural', icon: Sparkles, count: '8+ Events' },
    { name: 'Sports', icon: Trophy, count: '6+ Leagues' },
    { name: 'Workshops', icon: Award, count: '10+ Bootcamps' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28">
        {/* Glow ambient background lights */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-indigo-600/20 via-purple-600/15 to-cyan-500/10 blur-[130px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-6 shadow-sm">
            <Flame className="w-4 h-4 text-amber-400" />
            <span>Discover What's Happening on Campus Today</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-[1.15] max-w-4xl mx-auto">
            Experience College Life with{' '}
            <span className="gradient-text">CampusHub</span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            The all-in-one portal for university fests, hackathons, club recruitment, sports tournaments, and verifiable QR event passes.
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="mt-8 max-w-2xl mx-auto">
            <div className="relative flex items-center shadow-2xl">
              <div className="absolute left-4 text-slate-400">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                placeholder="Search hackathons, music gigs, robotics, sports, clubs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-32 py-4 rounded-2xl bg-slate-900/90 border border-slate-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white placeholder-slate-400 text-sm md:text-base outline-none backdrop-blur-md transition-all"
              />
              <button
                type="submit"
                className="absolute right-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-sm font-semibold shadow-md shadow-indigo-600/30 transition-all"
              >
                Find Events
              </button>
            </div>
          </form>

          {/* Quick Categories Bar */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {categories.map((cat) => (
              <Link
                key={cat.name}
                to={`/events?category=${cat.name}`}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-all"
              >
                <cat.icon className="w-3.5 h-3.5 text-indigo-400" />
                <span>{cat.name}</span>
                <span className="text-[10px] text-slate-500 ml-1">({cat.count})</span>
              </Link>
            ))}
          </div>

          {/* Stats Bar */}
          <div className="mt-14 max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-2xl glass-panel border border-slate-800 text-left">
            <div className="p-2">
              <p className="text-2xl sm:text-3xl font-extrabold text-white">50+</p>
              <p className="text-xs text-slate-400 mt-1">Live Campus Events</p>
            </div>
            <div className="p-2 border-l border-slate-800">
              <p className="text-2xl sm:text-3xl font-extrabold text-indigo-400">25+</p>
              <p className="text-xs text-slate-400 mt-1">Active Student Clubs</p>
            </div>
            <div className="p-2 border-l border-slate-800">
              <p className="text-2xl sm:text-3xl font-extrabold text-cyan-400">4.5K+</p>
              <p className="text-xs text-slate-400 mt-1">Registered Students</p>
            </div>
            <div className="p-2 border-l border-slate-800">
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400">100%</p>
              <p className="text-xs text-slate-400 mt-1">QR Verified Access</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Events Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Happening Soon</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Featured Campus Events
            </h2>
          </div>
          <Link
            to="/events"
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <span>Explore All Events</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </section>

      {/* Student Clubs Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1">
              <Users className="w-3.5 h-3.5" />
              <span>Campus Communities</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Spotlight on Student Societies
            </h2>
          </div>
          <Link
            to="/clubs"
            className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <span>View All Clubs</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {topClubs.map((club) => (
            <ClubCard key={club.id} club={club} />
          ))}
        </div>
      </section>

      {/* Campus Memories Showcase */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-fuchsia-400 uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Flashbacks</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Campus Memories & Recaps
            </h2>
          </div>
          <Link
            to="/memories"
            className="flex items-center gap-1.5 text-xs font-semibold text-fuchsia-400 hover:text-fuchsia-300 transition-colors"
          >
            <span>Browse Full Gallery</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {recentMemories.map((mem) => (
            <div 
              key={mem.id} 
              className="group relative h-48 sm:h-60 rounded-2xl overflow-hidden bg-slate-800 border border-slate-800 hover:border-slate-700 shadow-md"
            >
              <img
                src={mem.imageUrl}
                alt={mem.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />
              <div className="absolute bottom-3 left-3 right-3 text-left">
                <span className="text-[10px] font-semibold text-indigo-300 uppercase tracking-wider">
                  {mem.event}
                </span>
                <p className="text-xs font-bold text-white truncate mt-0.5">{mem.title}</p>
                <p className="text-[10px] text-slate-400">{mem.likes} cheers</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Host Event / Organizer Banner */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="rounded-3xl bg-gradient-to-r from-indigo-900/60 via-purple-900/50 to-slate-900 p-8 sm:p-12 border border-indigo-500/30 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-8 relative overflow-hidden">
          <div className="relative z-10 max-w-xl">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
              Leading a Club or Organizing a College Fest?
            </h3>
            <p className="mt-3 text-sm text-slate-300 leading-relaxed">
              Publish events in seconds, track student attendance with instant QR scanning, manage venue slots, and download participant rosters.
            </p>
            <div className="mt-6 flex flex-wrap gap-4 justify-center sm:justify-start">
              <Link
                to="/admin"
                className="px-6 py-3 rounded-xl bg-white text-slate-950 text-sm font-bold hover:bg-slate-100 shadow-lg transition-all"
              >
                Access Admin Portal
              </Link>
              <Link
                to="/clubs"
                className="px-6 py-3 rounded-xl bg-slate-800/80 text-white text-sm font-semibold hover:bg-slate-800 border border-slate-700 transition-all"
              >
                Register Your Club
              </Link>
            </div>
          </div>
          <div className="w-24 h-24 sm:w-36 sm:h-36 rounded-full bg-indigo-500/10 border border-indigo-400/20 flex items-center justify-center shrink-0">
            <Award className="w-12 h-12 sm:w-16 sm:h-16 text-indigo-400" />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
