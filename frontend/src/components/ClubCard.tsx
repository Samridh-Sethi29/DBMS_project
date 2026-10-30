import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Calendar, ArrowRight, ShieldCheck } from 'lucide-react';
import { Club } from '@/lib/store';
import ApiImage from '@/components/ApiImage';

interface ClubCardProps {
  club: Club;
}

export default function ClubCard({ club }: ClubCardProps) {
  return (
    <div className="group rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 overflow-hidden flex flex-col transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1">
      {/* Banner & Logo */}
      <div className="relative h-32 w-full overflow-hidden bg-slate-800">
        <ApiImage src={club.banner} alt={`${club.name} banner`} className="h-full w-full object-cover opacity-70 transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
        
        <span className="absolute top-3 right-3 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-900/80 border border-slate-700 text-indigo-300 backdrop-blur-md">
          {club.category}
        </span>
      </div>

      <div className="px-5 pb-5 pt-0 flex-1 flex flex-col justify-between -mt-8 relative z-10">
        <div>
          <div className="flex items-end justify-between mb-3">
            <div className="w-16 h-16 rounded-2xl border-2 border-slate-950 bg-slate-800 overflow-hidden shadow-lg">
              <ApiImage src={club.logo} alt={`${club.name} logo`} className="h-full w-full object-cover" />
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                <ShieldCheck className="w-3 h-3" />
                Active Club
              </span>
            </div>
          </div>

          <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
            {club.name}
          </h3>
          <p className="text-xs text-indigo-400 font-medium mt-0.5">
            {club.tagline}
          </p>
          <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
            {club.description}
          </p>
        </div>

        <div className="space-y-4 pt-4 mt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <strong className="text-slate-200">{club.memberCount}</strong> members
            </span>
          </div>

          <Link
            to={`/clubs/${club.id}`}
            className="w-full py-2.5 px-4 rounded-xl font-medium text-xs text-center flex items-center justify-center gap-2 bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white border border-slate-700/60 hover:border-transparent transition-all"
          >
            <span>Explore Club & Events</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
