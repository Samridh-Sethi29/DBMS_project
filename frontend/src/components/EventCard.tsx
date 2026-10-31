import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, MapPin, ArrowRight } from 'lucide-react';
import { CampusEvent } from '@/lib/store';
import ApiImage from '@/components/ApiImage';

interface EventCardProps {
  event: CampusEvent;
}

export default function EventCard({ event }: EventCardProps) {
  const categoryColors: Record<string, string> = {
    Technical: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    Cultural: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
    Sports: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Workshops: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    Management: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    Arts: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  const badgeColor = categoryColors[event.category] || 'bg-slate-500/10 text-slate-300 border-slate-500/20';

  return (
    <div className="group rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 overflow-hidden flex flex-col transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1">
      {/* Event banner */}
      <div className="relative h-48 w-full overflow-hidden bg-slate-800">
        <ApiImage src={event.image} alt={`${event.title} poster`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
        
        {/* Category tag */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border backdrop-blur-md ${badgeColor}`}>
            {event.category}
          </span>
          {event.isTentative && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Tentative
            </span>
          )}
        </div>

        {/* Date badge on bottom-left */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2 text-xs font-medium text-slate-200 bg-slate-900/80 px-2.5 py-1 rounded-md backdrop-blur-sm border border-slate-800">
          <Calendar className="w-3.5 h-3.5 text-indigo-400" />
          <span>{event.isPlaceholder ? 'Date to be announced' : event.date}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <p className="text-xs font-medium text-indigo-400 mb-1 flex items-center gap-1.5">
            <span>By {event.clubName}</span>
          </p>
          <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
            {event.title}
          </h3>
          <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
            {event.description}
          </p>
        </div>

        {/* Metadata */}
        <div className="space-y-2.5 pt-2 border-t border-slate-800/80 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="truncate">{event.time}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="truncate">{event.venue}</span>
          </div>

        </div>

        {/* CTA */}
        <div className="pt-2">
          {event.signupMode === 'external' && event.externalSignupUrl ? (
            <a href={event.externalSignupUrl} target="_blank" rel="noreferrer" className="mb-2 block text-center text-xs text-cyan-300 underline">External sign-up</a>
          ) : null}
          <Link
            to={`/events/${event.id}`}
            className="w-full py-2.5 px-4 rounded-xl font-medium text-xs text-center flex items-center justify-center gap-2 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 hover:border-transparent transition-all"
          >
            <span>View event details</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
