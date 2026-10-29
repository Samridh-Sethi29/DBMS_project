import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Calendar, 
  Users, 
  Image as ImageIcon, 
  Ticket, 
  LayoutDashboard, 
  LogIn, 
  LogOut, 
  Menu, 
  X, 
  Sparkles,
  GraduationCap
} from 'lucide-react';
import { useUser } from '@/lib/store';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useUser();

  const navLinks = [
    { label: 'Home', path: '/' },
    { label: 'Events', path: '/events', icon: Calendar },
    { label: 'Clubs & Societies', path: '/clubs', icon: Users },
    { label: 'Memories', path: '/memories', icon: ImageIcon },
    { label: 'My Tickets', path: '/my-registrations', icon: Ticket, authRequired: true },
    { label: 'Admin Portal', path: '/admin', icon: LayoutDashboard, adminOnly: true }
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="sticky top-0 z-50 glass-panel border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                Campus<span className="text-indigo-400">Hub</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  Live
                </span>
              </span>
              <p className="text-[10px] text-slate-400 font-medium">Events & Societies</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              if (link.adminOnly && user?.role !== 'admin') return null;
              if (link.authRequired && !user) return null;
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    active
                      ? 'text-white bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {link.icon && <link.icon className="w-4 h-4 opacity-75" />}
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* User actions */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
                <Link to="/my-registrations" className="flex items-center gap-2 group">
                  <div className="w-8 h-8 rounded-full bg-indigo-950 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-300">
                    {user.name.charAt(0)}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors">
                      {user.name}
                    </p>
                    <p className="text-[10px] text-slate-400 capitalize">
                      {user.role} {user.rollNumber && `• ${user.rollNumber}`}
                    </p>
                  </div>
                </Link>
                <button
                  onClick={logout}
                  title="Sign out"
                  className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all"
              >
                <LogIn className="w-4 h-4" />
                Student Login
              </Link>
            )}
          </div>

          {/* Mobile hamburger button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden bg-slate-900/95 border-b border-slate-800 px-4 pt-2 pb-6 space-y-2 backdrop-blur-xl">
          {navLinks.map((link) => {
            if (link.adminOnly && user?.role !== 'admin') return null;
            if (link.authRequired && !user) return null;
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileOpen(false)}
                className={`block px-3 py-2.5 rounded-lg text-base font-medium ${
                  isActive(link.path)
                    ? 'text-white bg-indigo-600/20 border border-indigo-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            {user ? (
              <div className="flex items-center justify-between w-full">
                <div>
                  <p className="text-sm font-medium text-slate-200">{user.name}</p>
                  <p className="text-xs text-slate-400 capitalize">{user.role}</p>
                </div>
                <button
                  onClick={() => { logout(); setMobileOpen(false); }}
                  className="px-3 py-1.5 text-xs text-rose-400 bg-rose-500/10 rounded-lg hover:bg-rose-500/20"
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="w-full text-center py-2.5 bg-indigo-600 text-white rounded-lg font-medium"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
