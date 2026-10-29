import React, { useState } from 'react';
import { Sparkles, Heart, Plus, Camera, Image as ImageIcon, Calendar, X } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useMemories, useUser } from '@/lib/store';

export default function Memories() {
  const { memories, toggleLike, addMemory } = useMemories();
  const { user } = useUser();
  const [selectedYear, setSelectedYear] = useState<string>('All');
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [activePhoto, setActivePhoto] = useState<any | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [eventName, setEventName] = useState('');
  const [year, setYear] = useState('2026');
  const [imageUrl, setImageUrl] = useState('');

  const years = ['All', '2026', '2025', '2024'];

  const filteredMemories = memories.filter((m) => {
    if (selectedYear !== 'All' && m.year !== selectedYear) return false;
    return true;
  });

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !eventName) {
      alert('Please fill in required fields');
      return;
    }

    const finalImage = imageUrl.trim() || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80';
    addMemory(title, eventName, year, finalImage, user?.name || 'Campus Student');

    setTitle('');
    setEventName('');
    setImageUrl('');
    setShowUploadModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Campus Wall & Visual Flashbacks</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Campus Memories
            </h1>
            <p className="text-sm text-slate-400 mt-2 max-w-2xl">
              Relive the electric concerts, grueling hackathon nights, championship trophy lifts, and everyday collegiate joy.
            </p>
          </div>

          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-fuchsia-600/20 transition-all shrink-0"
          >
            <Camera className="w-4 h-4" />
            <span>Post a Campus Photo</span>
          </button>
        </div>

        {/* Year Filter Tabs */}
        <div className="flex items-center gap-2 mb-8 border-b border-slate-800 pb-4">
          <span className="text-xs text-slate-400 font-medium mr-2">Filter by Year:</span>
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedYear === y
                  ? 'bg-fuchsia-600 text-white shadow-md shadow-fuchsia-600/25'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {y}
            </button>
          ))}
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMemories.map((mem) => (
            <div
              key={mem.id}
              className="group rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-fuchsia-500/40 overflow-hidden flex flex-col transition-all duration-300 hover:shadow-xl hover:shadow-fuchsia-500/10"
            >
              <div 
                onClick={() => setActivePhoto(mem)}
                className="relative h-64 w-full overflow-hidden bg-slate-800 cursor-pointer"
              >
                <img
                  src={mem.imageUrl}
                  alt={mem.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                
                <span className="absolute top-3 right-3 text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-950/80 text-fuchsia-300 border border-slate-700 backdrop-blur-md">
                  {mem.year}
                </span>

                <div className="absolute bottom-3 left-3 right-3">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                    {mem.event}
                  </span>
                  <h3 className="text-base font-bold text-white truncate mt-0.5">
                    {mem.title}
                  </h3>
                </div>
              </div>

              <div className="p-4 flex items-center justify-between text-xs border-t border-slate-800/80 bg-slate-900/90">
                <span className="text-slate-400">By {mem.uploadedBy}</span>
                <button
                  onClick={() => toggleLike(mem.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
                    mem.isLiked
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${mem.isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                  <span className="font-semibold">{mem.likes}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Lightbox Modal */}
      {activePhoto && (
        <div 
          onClick={() => setActivePhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="max-w-3xl w-full bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl relative"
          >
            <button
              onClick={() => setActivePhoto(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-950/80 text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={activePhoto.imageUrl} alt={activePhoto.title} className="w-full max-h-[70vh] object-cover" />
            <div className="p-6">
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">{activePhoto.event} • {activePhoto.year}</span>
              <h3 className="text-xl font-bold text-white mt-1">{activePhoto.title}</h3>
              <p className="text-xs text-slate-400 mt-1">Uploaded by {activePhoto.uploadedBy} • {activePhoto.likes} cheers</p>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-fuchsia-400" />
                <span>Upload a Campus Flashback</span>
              </h3>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Memory Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hackathon Winners Stage Moment"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-fuchsia-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Associated Event</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Utkarsh Fest 2026 / HackNova"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-fuchsia-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Year</label>
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-fuchsia-500"
                >
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Photo Image URL</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/... (or leave blank for campus default)"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-fuchsia-500"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white font-bold"
                >
                  Publish Photo
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
