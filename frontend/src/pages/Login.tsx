import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, GraduationCap, ShieldCheck, UserCheck, Sparkles } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useUser, User } from '@/lib/store';

export default function Login() {
  const navigate = useNavigate();
  const { user, login } = useUser();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [role, setRole] = useState<'student' | 'admin' | 'club_lead'>('student');
  const [department, setDepartment] = useState('Computer Science');
  const [year, setYear] = useState('3rd Year');

  const demoAccounts: User[] = [
    {
      name: 'Shriyanshi V.',
      email: 'shriyanshi@campus.edu',
      rollNumber: 'CS23B1042',
      role: 'student',
      department: 'Computer Science & Engineering',
      year: '3rd Year'
    },
    {
      name: 'Aarav Sharma (Club Lead)',
      email: 'aarav.sharma@campus.edu',
      rollNumber: 'CS22B1008',
      role: 'club_lead',
      department: 'Computer Science',
      year: '4th Year'
    },
    {
      name: 'Prof. Rajesh K. (Admin)',
      email: 'admin.affairs@campus.edu',
      rollNumber: 'FAC-901',
      role: 'admin',
      department: 'Dean Student Affairs',
      year: 'Faculty'
    }
  ];

  const handleDemoLogin = (demo: User) => {
    login(demo);
    if (demo.role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/my-registrations');
    }
  };

  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) {
      alert('Please fill in required fields');
      return;
    }

    login({
      name,
      email,
      rollNumber: rollNumber || 'GEN-' + Math.floor(1000 + Math.random() * 9000),
      role,
      department,
      year
    });

    if (role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/my-registrations');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-12 w-full flex items-center justify-center">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
          {/* Quick Demo Switcher */}
          <div className="p-6 sm:p-8 rounded-3xl glass-panel border border-slate-800 space-y-6">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>One-Click Testing</span>
              </div>
              <h2 className="text-xl font-bold text-white">Select a Demo Profile</h2>
              <p className="text-xs text-slate-400 mt-1">
                Switch instantly between Student, Club Lead, and College Admin roles.
              </p>
            </div>

            <div className="space-y-3">
              {demoAccounts.map((demo) => (
                <div
                  key={demo.email}
                  onClick={() => handleDemoLogin(demo)}
                  className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-850 cursor-pointer transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-sm group-hover:scale-105 transition-transform">
                      {demo.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                        {demo.name}
                      </p>
                      <p className="text-[11px] text-slate-400 capitalize">
                        {demo.role.replace('_', ' ')} • {demo.rollNumber}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    Login →
                  </span>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 space-y-1">
              <p className="font-semibold">Role Features:</p>
              <p className="text-[11px] text-slate-400">
                • <strong>Student:</strong> Register for events, view ticket QR codes, like memories.
              </p>
              <p className="text-[11px] text-slate-400">
                • <strong>Admin:</strong> Create & edit events, manage attendees, view analytics.
              </p>
            </div>
          </div>

          {/* Custom Login Form */}
          <div className="p-6 sm:p-8 rounded-3xl glass-panel border border-slate-800 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-white">Custom Authentication</h2>
              <p className="text-xs text-slate-400 mt-1">
                Enter your university roll number to access your portal.
              </p>
            </div>

            <form onSubmit={handleCustomLogin} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shriyanshi Verma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">College Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="yourname@college.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Roll / Student ID</label>
                  <input
                    type="text"
                    placeholder="e.g. CS23B1042"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Account Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white outline-none focus:border-indigo-500"
                  >
                    <option value="student">Student</option>
                    <option value="club_lead">Club Organizer</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Department</label>
                <input
                  type="text"
                  placeholder="Computer Science & Engineering"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold uppercase tracking-wider shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>Enter CampusHub</span>
              </button>
            </form>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
