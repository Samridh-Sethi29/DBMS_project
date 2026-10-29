import React, { useState, useMemo } from 'react';
import { Search, Users, Sparkles, Filter, PlusCircle, ShieldCheck } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ClubCard from '@/components/ClubCard';
import { useClubs } from '@/lib/store';

export default function Clubs() {
  const { clubs, addClub } = useClubs();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [search, setSearch] = useState<string>('');
  const [showModal, setShowModal] = useState<boolean>(false);

  // New club form state
  const [newClubName, setNewClubName] = useState('');
  const [newTagline, setNewTagline] = useState('');
  const [newCategory, setNewCategory] = useState<'Technical' | 'Cultural' | 'Sports' | 'Arts' | 'Social'>('Technical');
  const [newDescription, setNewDescription] = useState('');
  const [newLead, setNewLead] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const categories = ['All', 'Technical', 'Cultural', 'Sports', 'Arts', 'Social'];

  const filteredClubs = useMemo(() => {
    return clubs.filter((c) => {
      if (selectedCategory !== 'All' && c.category.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        return c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.tagline.toLowerCase().includes(q);
      }
      return true;
    });
  }, [clubs, selectedCategory, search]);

  const handleCreateClub = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClubName || !newDescription || !newLead) {
      alert('Please fill out all required fields');
      return;
    }

    addClub({
      name: newClubName,
      category: newCategory,
      tagline: newTagline || 'Empowering students to innovate',
      description: newDescription,
      leadCoordinator: newLead,
      logo: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80',
      banner: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1200&auto=format&fit=crop&q=80',
      socialLinks: {
        email: newEmail || `${newClubName.toLowerCase().replace(/\s+/g, '')}@campus.edu`
      }
    });

    // Reset and close
    setNewClubName('');
    setNewTagline('');
    setNewDescription('');
    setNewLead('');
    setNewEmail('');
    setShowModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold mb-3">
              <Users className="w-3.5 h-3.5" />
              <span>Campus Communities</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Student Clubs & Societies
            </h1>
            <p className="text-sm text-slate-400 mt-2 max-w-2xl">
              Connect with fellow peers, learn cutting-edge skills, organize flagship events, and discover your passions.
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Register New Society</span>
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 rounded-2xl glass-panel border border-slate-800 space-y-4 mb-8">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search club name, domain or focus..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-white placeholder-slate-400 text-sm focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
            <span className="text-xs text-slate-400 font-medium mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Filter by:
            </span>
            {categories.map((cat) => {
              const active = selectedCategory.toLowerCase() === cat.toLowerCase();
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    active
                      ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                      : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Club Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClubs.map((club) => (
            <ClubCard key={club.id} club={club} />
          ))}
        </div>
      </main>

      {/* Modal to Register a Club */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <span>Register a Student Society</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateClub} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Club Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AI & Quantum Society"
                  value={newClubName}
                  onChange={(e) => setNewClubName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500"
                >
                  <option value="Technical">Technical</option>
                  <option value="Cultural">Cultural</option>
                  <option value="Sports">Sports</option>
                  <option value="Arts">Arts</option>
                  <option value="Social">Social</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Tagline</label>
                <input
                  type="text"
                  placeholder="A short punchy mission statement"
                  value={newTagline}
                  onChange={(e) => setNewTagline(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Description</label>
                <textarea
                  rows={3}
                  required
                  placeholder="What does your club do? What workshops/events do you plan?"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Lead Student Lead</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Samarth Jain"
                    value={newLead}
                    onChange={(e) => setNewLead(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Official Email</label>
                  <input
                    type="email"
                    placeholder="club@campus.edu"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  Submit for Approval
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
