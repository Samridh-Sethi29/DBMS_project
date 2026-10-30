import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/auth/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setFields({});
    setSubmitting(true);
    try {
      const user = await login(email, password);
      const destination = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(destination || (user.role === 'admin' ? '/admin' : '/'), { replace: true });
    } catch (reason) {
      const apiError = reason as Error & { fields?: { field: string; message: string }[] };
      setError(apiError.message);
      setFields(Object.fromEntries((apiError.fields || []).map(field => [field.field, field.message])));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-md mx-auto px-4 py-16 w-full">
        <form onSubmit={submit} className="rounded-3xl border border-slate-800 bg-slate-900 p-8 space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-white">Sign in</h1>
            <p className="mt-2 text-sm text-slate-400">Use your campus account credentials.</p>
          </div>
          {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
          <label className="block text-sm text-slate-300">
            Email
            <input value={email} onChange={event => setEmail(event.target.value)} type="email" autoComplete="email" required className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
            {fields.email && <span className="mt-1 block text-xs text-rose-300">{fields.email}</span>}
          </label>
          <label className="block text-sm text-slate-300">
            Password
            <input value={password} onChange={event => setPassword(event.target.value)} type="password" autoComplete="current-password" required className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
            {fields.password && <span className="mt-1 block text-xs text-rose-300">{fields.password}</span>}
          </label>
          <button disabled={submitting} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white disabled:opacity-50">
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="text-sm text-slate-400">New here? <Link to="/register" className="text-indigo-300 hover:text-indigo-200">Create an account</Link></p>
        </form>
      </main>
      <Footer />
    </div>
  );
}
