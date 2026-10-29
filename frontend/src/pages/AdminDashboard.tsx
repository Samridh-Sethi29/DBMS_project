import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Calendar, 
  Users, 
  Ticket, 
  Trash2, 
  Edit, 
  Download, 
  Search, 
  CheckCircle, 
  TrendingUp,
  Sparkles,
  Award
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useEvents, useClubs, useRegistrations, useUser, CampusEvent } from '@/lib/store';

export default function AdminDashboard() {
  const { events, addEvent, deleteEvent } = useEvents();
  const { clubs } = useClubs();
  const { registrations } = useRegistrations();
  const { user } = useUser();

  const [activeTab, setActiveTab] = useState<'events' | 'attendees'>('events');
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [attendeeFilter, setAttendeeFilter] = useState<string>('all');
  const [searchAttendee, setSearchAttendee] = useState<string>('');

  // New Event Form State
  const [title, setTitle] = useState('');
  const [clubId, setClubId] = useState(clubs[0]?.id || '');
  const [category, setCategory] = useState<'Technical' | 'Cultural' | 'Sports' | 'Workshops' | 'Management' | 'Arts'>('Technical');
  const [date, setDate] = useState('2026-11-30');
  const [time, setTime] = useState('10:00 AM - 04:00 PM');
  const [venue, setVenue] = useState('');
  const [capacity, setCapacity] = useState(100);
  const [fee, setFee] = useState(0);
  const [description, setDescription] = useState('');
  const [prizes, setPrizes] = useState('');
  const [image, setImage] = useState('');
  const [coordName, setCoordName] = useState(user?.name || '');
  const [coordContact, setCoordContact] = useState('+91 98765 43210');

  // Stats
  const totalRegistrations = registrations.filter(r => r.status === 'confirmed').length;
  const totalCapacity = events.reduce((sum, e) => sum + e.capacity, 0);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !venue || !description) {
      alert('Please fill out required fields');
      return;
    }

    const selectedClub = clubs.find(c => c.id === clubId);

    addEvent({
      title,
      clubId: clubId || 'code-nexus',
      clubName: selectedClub?.name || 'Code Nexus',
      category,
      date,
      time,
      venue,
      capacity: Number(capacity) || 100,
      registrationFee: Number(fee) || 0,
      description,
      longDescription: description,
      image: image.trim() || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80',
      featured: false,
      status: 'upcoming',
      prizes: prizes || undefined,
      coordinatorName: coordName || 'Event Coordinator',
      coordinatorContact: coordContact,
      tags: [category, 'Campus2026']
    });

    // Reset
    setTitle('');
    setVenue('');
    setDescription('');
    setPrizes('');
    setImage('');
    setShowCreateModal(false);
  };

  const handleExportCSV = () => {
    const headers = ['Ticket Number', 'Event Name', 'Student Name', 'Roll Number', 'Email', 'Department', 'Date', 'Status'];
    const rows = registrations.map(r => [
      r.ticketNumber,
      `"${r.eventTitle}"`,
      `"${r.userName}"`,
      r.userRoll,
      r.userEmail,
      `"${r.userDepartment}"`,
      r.eventDate,
      r.status
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `campus_hub_registrations_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredRegistrations = registrations.filter(r => {
    if (attendeeFilter !== 'all' && r.eventId !== attendeeFilter) return false;
    if (searchAttendee.trim()) {
      const q = searchAttendee.toLowerCase();
      return r.userName.toLowerCase().includes(q) || r.userRoll.toLowerCase().includes(q) || r.ticketNumber.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-3">
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Organizer & Admin Control</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Event Management Portal
            </h1>
            <p className="text-sm text-slate-400 mt-2 max-w-2xl">
              Oversee live registrations, approve society proposals, broadcast event schedules, and export attendee rosters.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold transition-all"
            >
              <Download className="w-4 h-4 text-indigo-400" />
              <span>Export Roster CSV</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Host New Event</span>
            </button>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="p-5 rounded-2xl glass-panel border border-slate-800">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400 font-medium">Total Events</p>
              <Calendar className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-2xl font-extrabold text-white mt-2">{events.length}</p>
          </div>

          <div className="p-5 rounded-2xl glass-panel border border-slate-800">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400 font-medium">Confirmed Attendees</p>
              <Ticket className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-extrabold text-emerald-400 mt-2">{totalRegistrations}</p>
          </div>

          <div className="p-5 rounded-2xl glass-panel border border-slate-800">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400 font-medium">Active Societies</p>
              <Users className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-2xl font-extrabold text-cyan-400 mt-2">{clubs.length}</p>
          </div>

          <div className="p-5 rounded-2xl glass-panel border border-slate-800">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400 font-medium">Capacity Booked</p>
              <TrendingUp className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-extrabold text-amber-400 mt-2">
              {totalCapacity > 0 ? Math.round((totalRegistrations / totalCapacity) * 100) : 0}%
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-6">
          <button
            onClick={() => setActiveTab('events')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'events'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            Manage Events ({events.length})
          </button>
          <button
            onClick={() => setActiveTab('attendees')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'attendees'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            Attendee Registrations ({registrations.length})
          </button>
        </div>

        {/* Tab 1: Manage Events */}
        {activeTab === 'events' && (
          <div className="space-y-4">
            <div className="rounded-3xl glass-panel border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-4">Event</th>
                      <th className="p-4">Organizer Club</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Date & Venue</th>
                      <th className="p-4">Bookings</th>
                      <th className="p-4">Fee</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {events.map((ev) => (
                      <tr key={ev.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <img src={ev.image} alt={ev.title} className="w-10 h-10 rounded-xl object-cover" />
                            <div>
                              <p className="font-bold text-white line-clamp-1">{ev.title}</p>
                              <p className="text-[10px] text-slate-400">ID: {ev.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 font-medium text-indigo-300">{ev.clubName}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[10px]">
                            {ev.category}
                          </span>
                        </td>
                        <td className="p-4">
                          <p className="font-medium text-white">{ev.date}</p>
                          <p className="text-[10px] text-slate-400 truncate max-w-[150px]">{ev.venue}</p>
                        </td>
                        <td className="p-4">
                          <span className="font-bold text-white">{ev.registeredCount}</span>
                          <span className="text-slate-400"> / {ev.capacity}</span>
                        </td>
                        <td className="p-4 font-bold text-emerald-400">
                          {ev.registrationFee === 0 ? 'FREE' : `₹${ev.registrationFee}`}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              to={`/events/${ev.id}`}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 text-[11px]"
                            >
                              View
                            </Link>
                            <button
                              onClick={() => {
                                if (confirm(`Delete event "${ev.title}"?`)) deleteEvent(ev.id);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Attendee Registrations */}
        {activeTab === 'attendees' && (
          <div className="space-y-4">
            {/* Filter tools */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between p-4 rounded-2xl glass-panel border border-slate-800">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search student name, roll number, or ticket code..."
                  value={searchAttendee}
                  onChange={(e) => setSearchAttendee(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-white text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={attendeeFilter}
                onChange={(e) => setAttendeeFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-white outline-none"
              >
                <option value="all">All Events ({registrations.length})</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.title}</option>
                ))}
              </select>
            </div>

            {/* Attendees Table */}
            <div className="rounded-3xl glass-panel border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-4">Ticket Pass</th>
                      <th className="p-4">Student Attendee</th>
                      <th className="p-4">Roll / Dept</th>
                      <th className="p-4">Event Booked</th>
                      <th className="p-4">Registered Date</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredRegistrations.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="p-4 font-mono font-bold text-indigo-400">{r.ticketNumber}</td>
                        <td className="p-4">
                          <p className="font-bold text-white">{r.userName}</p>
                          <p className="text-[10px] text-slate-400">{r.userEmail}</p>
                        </td>
                        <td className="p-4">
                          <p className="font-mono text-slate-200">{r.userRoll}</p>
                          <p className="text-[10px] text-slate-400">{r.userDepartment} • {r.userYear}</p>
                        </td>
                        <td className="p-4 font-medium text-white max-w-[200px] truncate">{r.eventTitle}</td>
                        <td className="p-4 text-slate-400">{r.registeredAt}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.status === 'confirmed'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Host New Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-indigo-400" />
                <span>Publish New Campus Event</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Event Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AI Prompting Olympiad 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Host Club</label>
                  <select
                    value={clubId}
                    onChange={(e) => setClubId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500"
                  >
                    {clubs.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500"
                  >
                    <option value="Technical">Technical</option>
                    <option value="Cultural">Cultural</option>
                    <option value="Sports">Sports</option>
                    <option value="Workshops">Workshops</option>
                    <option value="Management">Management</option>
                    <option value="Arts">Arts</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Event Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Timings</label>
                  <input
                    type="text"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-slate-400 font-medium mb-1">Venue Location</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Auditorium Hall A"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Max Capacity</label>
                  <input
                    type="number"
                    min="1"
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Registration Fee (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0 for free"
                    value={fee}
                    onChange={(e) => setFee(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Prizes / Perks</label>
                  <input
                    type="text"
                    placeholder="e.g. ₹20,000 + Medals"
                    value={prizes}
                    onChange={(e) => setPrizes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Event Banner Image URL</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/... (or blank for default)"
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Event Overview & Schedule</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detailed agenda, rules, and participant instructions"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Lead Coordinator</label>
                  <input
                    type="text"
                    value={coordName}
                    onChange={(e) => setCoordName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={coordContact}
                    onChange={(e) => setCoordContact(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  Publish Live
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
