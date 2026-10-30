import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-800 bg-slate-950 px-4 py-8 text-slate-400 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 text-sm sm:flex-row">
        <p>CampusHub · Campus clubs and events</p>
        <nav className="flex flex-wrap gap-5">
          <Link to="/events" className="hover:text-white">Events</Link>
          <Link to="/clubs" className="hover:text-white">Clubs</Link>
          <Link to="/memories" className="hover:text-white">Memories</Link>
          <Link to="/login" className="hover:text-white">Sign in</Link>
        </nav>
      </div>
    </footer>
  );
}
