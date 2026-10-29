import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Trophy, 
  Share2, 
  CheckCircle, 
  ArrowLeft, 
  Phone, 
  Sparkles,
  Ticket,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useEvents, useRegistrations, useUser, CampusEvent } from '@/lib/store';

export default function EventDetails() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { events } = useEvents();
  const { registrations, registerForEvent } = useRegistrations();
  const { user } = useUser();

  const event = events.find((e) => e.id === eventId);

  // Form states for non-logged-in or custom details
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [roll, setRoll] = useState(user?.rollNumber || '');
  const [dept, setDept] = useState(user?.department || 'Computer Science');
  const [year, setYear] = useState(user?.year || '3rd Year');
  const [registeredSuccess, setRegisteredSuccess] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // Check if currently registered
  const existingRegistration = registrations.find(
    (r) => r.eventId === eventId && r.status === 'confirmed'
  );

  if (!event) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <Navbar />
        <div className="flex-1 max-w-xl mx-auto px-4 py-20 text-center">
          <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white">Event Not Found</h2>
          <p className="text-slate-400 text-sm mt-2">The requested event ID could not be found or may have been removed.</p>
          <Link to="/events" className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold">
            <ArrowLeft className="w-4 h-4" /> Back to Events
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const isSoldOut = event.registeredCount >= event.capacity;
  const percentFull = Math.min(100, Math.round((event.registeredCount / event.capacity) * 100));

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !roll) {
      alert('Please fill out all required fields');
      return;
    }

    const regUser = {
      name,
      email,
      rollNumber: roll,
      department: dept,
      year: year,
      role: 'student' as const
    };

    const newTicket = registerForEvent(event, regUser);
    setRegisteredSuccess(newTicket);

    // Fire celebratory confetti!
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Back Link */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/events"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Events</span>
          </Link>

          <button
            onClick={handleShare}
            className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{copied ? 'Link Copied!' : 'Share Event'}</span>
          </button>
        </div>

        {/* Main Grid: Left Details, Right Registration Box */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Event Specs */}
          <div className="lg:col-span-2 space-y-8">
            {/* Banner Image */}
            <div className="relative rounded-3xl overflow-hidden h-72 sm:h-96 bg-slate-900 border border-slate-800 shadow-2xl">
              <img
                src={event.image}
                alt={event.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
              
              <div className="absolute top-4 left-4 flex gap-2">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-600/90 text-white backdrop-blur-md">
                  {event.category}
                </span>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-900/80 text-cyan-300 border border-slate-700 backdrop-blur-md">
                  By {event.clubName}
                </span>
              </div>
            </div>

            {/* Title & Info Header */}
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                {event.title}
              </h1>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                {event.description}
              </p>
            </div>

            {/* Quick Metadata Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl glass-panel border border-slate-800 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Date & Schedule</p>
                  <p className="text-xs font-bold text-white mt-0.5">{event.date}</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl glass-panel border border-slate-800 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Timings</p>
                  <p className="text-xs font-bold text-white mt-0.5">{event.time}</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl glass-panel border border-slate-800 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Location Venue</p>
                  <p className="text-xs font-bold text-white mt-0.5 truncate">{event.venue}</p>
                </div>
              </div>
            </div>

            {/* Comprehensive Description */}
            <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>About this Event</span>
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                {event.longDescription}
              </p>

              {event.prizes && (
                <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20">
                  <p className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <Trophy className="w-4 h-4" />
                    <span>Prizes & Recognition</span>
                  </p>
                  <p className="text-sm font-semibold text-slate-200">{event.prizes}</p>
                </div>
              )}

              {/* Tags */}
              <div className="pt-2 flex flex-wrap gap-2">
                {event.tags.map((tag) => (
                  <span key={tag} className="text-xs px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Coordinator Info Box */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Student Coordinator</p>
                <p className="text-sm font-bold text-white mt-0.5">{event.coordinatorName}</p>
              </div>
              <a
                href={`tel:${event.coordinatorContact}`}
                className="flex items-center gap-2 text-xs px-3.5 py-2 rounded-xl bg-slate-800 text-indigo-300 hover:text-white border border-slate-700 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{event.coordinatorContact}</span>
              </a>
            </div>
          </div>

          {/* Right Column: Registration Box */}
          <div className="space-y-6">
            <div className="sticky top-24 p-6 rounded-3xl glass-panel border border-indigo-500/30 shadow-2xl shadow-indigo-950/40">
              {/* Spots bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between text-xs font-semibold mb-2">
                  <span className="text-slate-300">Registration Status</span>
                  <span className={percentFull >= 90 ? 'text-rose-400' : 'text-emerald-400'}>
                    {isSoldOut ? 'Sold Out' : `${event.capacity - event.registeredCount} spots remaining`}
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      percentFull >= 90 ? 'bg-rose-500' : 'bg-gradient-to-r from-indigo-500 to-cyan-400'
                    }`}
                    style={{ width: `${percentFull}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Total Capacity: {event.capacity} seats • Fee: {event.registrationFee === 0 ? 'Free Entry' : `₹${event.registrationFee}`}
                </p>
              </div>

              {/* Success Screen if just registered */}
              {registeredSuccess || existingRegistration ? (
                <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-white">You're Registered!</h4>
                  <p className="text-xs text-slate-300">
                    Ticket Pass:{' '}
                    <strong className="text-emerald-300">
                      {registeredSuccess?.ticketNumber || existingRegistration?.ticketNumber}
                    </strong>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    A confirmation pass with a dynamic QR code has been saved to your account.
                  </p>
                  <div className="pt-2">
                    <Link
                      to="/my-registrations"
                      className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all"
                    >
                      <Ticket className="w-4 h-4" />
                      <span>View & Download QR Ticket</span>
                    </Link>
                  </div>
                </div>
              ) : isSoldOut ? (
                <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center">
                  <p className="text-sm font-bold text-rose-400">Event is at Full Capacity</p>
                  <p className="text-xs text-slate-400 mt-1">Registrations for this event are currently closed.</p>
                </div>
              ) : (
                /* Registration Form */
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <h4 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
                    Confirm Registration Details
                  </h4>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Shriyanshi Verma"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">College Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@college.edu"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Roll / ID Number</label>
                      <input
                        type="text"
                        required
                        value={roll}
                        onChange={(e) => setRoll(e.target.value)}
                        placeholder="CS23B1042"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Study Year</label>
                      <select
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:border-indigo-500 outline-none"
                      >
                        <option value="1st Year">1st Year</option>
                        <option value="2nd Year">2nd Year</option>
                        <option value="3rd Year">3rd Year</option>
                        <option value="4th Year">4th Year</option>
                        <option value="Postgraduate">Postgraduate</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Department</label>
                    <input
                      type="text"
                      value={dept}
                      onChange={(e) => setDept(e.target.value)}
                      placeholder="Computer Science & Engg."
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
                  >
                    <span>Instant Register • {event.registrationFee === 0 ? 'FREE' : `₹${event.registrationFee}`}</span>
                  </button>

                  <p className="text-[10px] text-center text-slate-500">
                    By registering you agree to campus event guidelines and venue rules.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
