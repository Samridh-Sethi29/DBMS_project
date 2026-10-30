import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/auth/AuthContext';

export default function MyRegistrations() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16">
        <h1 className="text-3xl font-bold text-white">My registrations</h1>
        <p className="mt-3 text-slate-300">Signed in as {user?.name}.</p>
        <div className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm leading-6 text-amber-100" role="status">
          The current API supports creating and cancelling an event registration, but does not expose an endpoint to list a student’s registrations or retrieve ticket details. This page will show passes when that API endpoint is available.
        </div>
      </main>
      <Footer />
    </div>
  );
}
