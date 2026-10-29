import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Ticket, 
  Calendar, 
  MapPin, 
  Clock, 
  User as UserIcon, 
  QrCode, 
  Download, 
  Trash2, 
  ArrowRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import QRCode from 'qrcode';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useRegistrations, useUser, Registration } from '@/lib/store';

export default function MyRegistrations() {
  const { registrations, cancelRegistration } = useRegistrations();
  const { user } = useUser();
  const [selectedTicket, setSelectedTicket] = useState<Registration | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Filter registrations for current student roll number, or show all if demo
  const userTickets = registrations.filter((r) => {
    if (!user) return true;
    return r.userRoll.toLowerCase() === user.rollNumber.toLowerCase() || r.userEmail === user.email;
  });

  useEffect(() => {
    if (selectedTicket) {
      QRCode.toDataURL(selectedTicket.qrCodeData, {
        width: 260,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error(err));
    }
  }, [selectedTicket]);

  const handleOpenPass = (ticket: Registration) => {
    setSelectedTicket(ticket);
  };

  const handleCancel = (id: string, title: string) => {
    if (confirm(`Are you sure you want to cancel your registration for "${title}"?`)) {
      cancelRegistration(id);
      if (selectedTicket?.id === id) {
        setSelectedTicket(null);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-3">
            <Ticket className="w-3.5 h-3.5" />
            <span>Digital Event Wallet</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            My Event Passes
          </h1>
          <p className="text-sm text-slate-400 mt-2 max-w-2xl">
            Present your scannable QR ticket at the venue check-in desk for entry.
          </p>
        </div>

        {/* Tickets Grid */}
        {userTickets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userTickets.map((ticket) => {
              const isCancelled = ticket.status === 'cancelled';
              return (
                <div
                  key={ticket.id}
                  className={`rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between border transition-all ${
                    isCancelled
                      ? 'bg-slate-900/40 border-slate-800 opacity-60'
                      : 'bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950/40 border-slate-800 hover:border-indigo-500/40 shadow-xl'
                  }`}
                >
                  {/* Decorative Ticket punch holes */}
                  <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-950 border border-slate-800" />
                  <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-950 border border-slate-800" />

                  <div>
                    {/* Header: Ticket Number & Status */}
                    <div className="flex items-center justify-between border-b border-dashed border-slate-800 pb-4 mb-4">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                          Pass Number
                        </span>
                        <p className="text-sm font-bold font-mono text-indigo-300">
                          {ticket.ticketNumber}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                          isCancelled
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {isCancelled ? 'Cancelled' : 'Confirmed'}
                      </span>
                    </div>

                    {/* Event Info */}
                    <h3 className="text-lg font-bold text-white mb-3 line-clamp-1">
                      {ticket.eventTitle}
                    </h3>

                    <div className="space-y-2 text-xs text-slate-300 mb-6">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span>{ticket.eventDate}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span>{ticket.eventTime}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate">{ticket.eventVenue}</span>
                      </div>
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60 text-slate-400">
                        <UserIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>Attendee: {ticket.userName} ({ticket.userRoll})</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-dashed border-slate-800 flex items-center gap-2">
                    {!isCancelled ? (
                      <>
                        <button
                          onClick={() => handleOpenPass(ticket)}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-indigo-600/25 transition-all"
                        >
                          <QrCode className="w-4 h-4" />
                          <span>Show QR Pass</span>
                        </button>
                        <button
                          onClick={() => handleCancel(ticket.id, ticket.eventTitle)}
                          title="Cancel ticket"
                          className="p-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-700/60 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500 italic py-2 text-center w-full">
                        Registration was cancelled
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-20 text-center rounded-3xl border border-dashed border-slate-800 bg-slate-900/30">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Ticket className="w-8 h-8 opacity-60" />
            </div>
            <h3 className="text-lg font-bold text-white">No active event registrations</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              You haven't registered for any events yet. Check out the campus event schedule!
            </p>
            <Link
              to="/events"
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors"
            >
              <span>Explore Events</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </main>

      {/* QR Code Pass Modal */}
      {selectedTicket && (
        <div 
          onClick={() => setSelectedTicket(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="max-w-sm w-full bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl relative"
          >
            {/* Top Pass Brand Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 p-5 text-center text-white relative">
              <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-200">
                Official Campus Admission Pass
              </span>
              <h3 className="text-lg font-extrabold mt-1">{selectedTicket.eventTitle}</h3>
              <p className="text-xs text-indigo-100 mt-0.5">{selectedTicket.eventVenue}</p>
            </div>

            {/* QR Section */}
            <div className="p-6 bg-white text-slate-900 text-center flex flex-col items-center">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code" className="w-48 h-48 rounded-xl shadow-md border border-slate-200" />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center bg-slate-100 rounded-xl">
                  <span className="text-xs text-slate-400">Generating QR...</span>
                </div>
              )}
              <p className="text-xs font-mono font-bold text-slate-800 mt-3 tracking-wider">
                {selectedTicket.ticketNumber}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Scan with Organizer Scanner app</p>
            </div>

            {/* Bottom Pass Details */}
            <div className="p-5 bg-slate-900 border-t border-slate-800 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Attendee:</span>
                <span className="font-bold text-white">{selectedTicket.userName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Roll Number:</span>
                <span className="font-mono text-indigo-400">{selectedTicket.userRoll}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Date & Time:</span>
                <span className="text-slate-200">{selectedTicket.eventDate} at {selectedTicket.eventTime}</span>
              </div>
              
              <div className="pt-3">
                <button
                  onClick={() => window.print()}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download / Print Pass</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
