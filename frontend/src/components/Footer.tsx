import React from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Heart, Github, Twitter, Instagram, Mail, MapPin, Phone } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950 text-slate-400 py-12 px-4 sm:px-6 lg:px-8 mt-20">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Brand */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center text-white">
              <GraduationCap className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              Campus<span className="text-indigo-400">Hub</span>
            </span>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">
            The central digital hub for college events, student societies, live hackathons, sports leagues, and cultural festivals.
          </p>
          <div className="flex items-center gap-3 pt-2 text-slate-400">
            <a href="#" className="hover:text-indigo-400 transition-colors"><Instagram className="w-4 h-4" /></a>
            <a href="#" className="hover:text-indigo-400 transition-colors"><Twitter className="w-4 h-4" /></a>
            <a href="#" className="hover:text-indigo-400 transition-colors"><Github className="w-4 h-4" /></a>
            <a href="#" className="hover:text-indigo-400 transition-colors"><Mail className="w-4 h-4" /></a>
          </div>
        </div>

        {/* Explore Links */}
        <div>
          <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Explore</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/events" className="hover:text-white transition-colors">All Upcoming Events</Link></li>
            <li><Link to="/clubs" className="hover:text-white transition-colors">Clubs & Student Bodies</Link></li>
            <li><Link to="/memories" className="hover:text-white transition-colors">Campus Memories & Gallery</Link></li>
            <li><Link to="/my-registrations" className="hover:text-white transition-colors">Event Tickets & QR Passes</Link></li>
            <li><Link to="/admin" className="hover:text-white transition-colors">Organizers Dashboard</Link></li>
          </ul>
        </div>

        {/* Event Categories */}
        <div>
          <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Categories</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/events?category=Technical" className="hover:text-white transition-colors">Hackathons & Coding</Link></li>
            <li><Link to="/events?category=Cultural" className="hover:text-white transition-colors">Festivals & Live Music</Link></li>
            <li><Link to="/events?category=Sports" className="hover:text-white transition-colors">Inter-College Sports</Link></li>
            <li><Link to="/events?category=Workshops" className="hover:text-white transition-colors">AI & Tech Workshops</Link></li>
            <li><Link to="/events?category=Arts" className="hover:text-white transition-colors">Photography & Arts</Link></li>
          </ul>
        </div>

        {/* Contact info */}
        <div>
          <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Campus Desk</h4>
          <div className="space-y-3 text-sm">
            <p className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>Student Activities Center (SAC), Main Campus Quad, Tech Block</span>
            </p>
            <p className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>campushub@college.edu</span>
            </p>
            <p className="flex items-center gap-2.5">
              <Phone className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>+91 (0) 123-456-7890</span>
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto pt-8 mt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
        <p>© 2026 CampusHub Platform. All rights reserved.</p>
        <p className="flex items-center gap-1">
          Designed for vibrant college campuses with <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
        </p>
      </div>
    </footer>
  );
}
