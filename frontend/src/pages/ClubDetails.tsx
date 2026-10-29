import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Users, 
  Calendar, 
  Mail, 
  Instagram, 
  Linkedin, 
  ArrowLeft, 
  CheckCircle, 
  ShieldCheck, 
  Sparkles,
  Award,
  AlertCircle
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import EventCard from '@/components/EventCard';
import { useClubs, useEvents, useUser } from '@/lib/store';

export default function ClubDetails() {
  const { clubId } = useParams<{ clubId: string }>();
  const { clubs } = useClubs();
  const { events } = useEvents();
  const { user } = useUser();

  const [joined, setJoined] = useState(false);

  const club = clubs.find((c) => c.id === clubId);
  const clubEvents = events.filter((e) => e.clubId === clubId);

  if (!club) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <Navbar />
        <div className="flex-1 max-w-xl mx-auto px-4 py-20 text-center">
          <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white">Club Not Found</h2>
          <p className="text-slate-400 text-sm mt-2">The requested society ID does not exist.</p>
          <Link to="/clubs" className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold">
            <ArrowLeft className="w-4 h-4" /> Back to Clubs
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Back Link */}
        <div className="mb-6">
          <Link
            to="/clubs"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Clubs</span>
          </Link>
        </div>

        {/* Hero Banner Header */}
        <div className="relative rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl mb-8">
          <div className="h-48 sm:h-64 w-full overflow-hidden bg-slate-800 relative">
            <img src={club.banner} alt={club.name} className="w-full h-full object-cover opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
          </div>

          <div className="px-6 sm:px-10 pb-8 pt-0 relative -mt-16 sm:-mt-20 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl border-4 border-slate-950 bg-slate-800 overflow-hidden shadow-2xl shrink-0">
                <img src={club.logo} alt={club.name} className="w-full h-full object-cover" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {club.category}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Verified Campus Body
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                  {club.name}
                </h1>
                <p className="text-xs sm:text-sm text-indigo-400 font-medium">
                  {club.tagline}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={() => setJoined(!joined)}
                className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  joined
                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25'
                }`}
              >
                {joined ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Member of Club</span>
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4" />
                    <span>Join Society</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-8">
            <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>About {club.name}</span>
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                {club.description}
              </p>
            </div>

            {/* Events organized by this club */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  <span>Events by {club.name}</span>
                </h3>
                <span className="text-xs text-slate-400">{clubEvents.length} active listings</span>
              </div>

              {clubEvents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {clubEvents.map((ev) => (
                    <EventCard key={ev.id} event={ev} />
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-400">
                  No upcoming events scheduled right now. Check back soon!
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar: Leadership & Details */}
          <div className="space-y-6">
            <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4">
              <h4 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
                Society Highlights
              </h4>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Active Members</span>
                  <span className="font-bold text-white">{club.memberCount + (joined ? 1 : 0)} Students</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Lead Coordinator</span>
                  <span className="font-bold text-indigo-300">{club.leadCoordinator}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Total Events Hosted</span>
                  <span className="font-bold text-white">{club.eventsCount} events</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-400">Affiliation</span>
                  <span className="font-bold text-emerald-400">Student Affairs Council</span>
                </div>
              </div>

              <div className="pt-2">
                <p className="text-[11px] font-medium text-slate-400 mb-2">Connect & Inquiries</p>
                <div className="space-y-2 text-xs">
                  <a
                    href={`mailto:${club.socialLinks.email}`}
                    className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="truncate">{club.socialLinks.email}</span>
                  </a>
                  {club.socialLinks.instagram && (
                    <a
                      href="#"
                      className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      <Instagram className="w-3.5 h-3.5 text-fuchsia-400" />
                      <span>{club.socialLinks.instagram}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
