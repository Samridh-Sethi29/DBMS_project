import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import QueryState from '@/components/QueryState';
import { getDepartments } from '@/api/auth.js';
import { useAuth } from '@/auth/AuthContext';

interface Department { department_id: number; name: string }

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [departmentsError, setDepartmentsError] = useState<unknown>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', roll_no: '', department_id: '', year_of_study: '1', phone: '' });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function loadDepartments() {
    setLoadingDepartments(true);
    setDepartmentsError(null);
    try {
      const result = await getDepartments();
      setDepartments(result.data);
    } catch (reason) {
      setDepartmentsError(reason);
    } finally {
      setLoadingDepartments(false);
    }
  }

  useEffect(() => { void loadDepartments(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setFields({});
    setSubmitting(true);
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        roll_no: form.roll_no,
        department_id: Number(form.department_id),
        year_of_study: Number(form.year_of_study),
        ...(form.phone ? { phone: form.phone } : {}),
      });
      navigate('/login', { replace: true, state: { registered: true } });
    } catch (reason) {
      const apiError = reason as Error & { fields?: { field: string; message: string }[] };
      setError(apiError.message);
      setFields(Object.fromEntries((apiError.fields || []).map(field => [field.field, field.message])));
    } finally {
      setSubmitting(false);
    }
  }

  const field = (name: keyof typeof form, label: string, type = 'text') => (
    <label className="block text-sm text-slate-300">
      {label}
      <input type={type} required={name !== 'phone'} value={form[name]} onChange={event => setForm(current => ({ ...current, [name]: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
      {fields[name] && <span className="mt-1 block text-xs text-rose-300">{fields[name]}</span>}
    </label>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-xl mx-auto px-4 py-12 w-full">
        <form onSubmit={submit} className="rounded-3xl border border-slate-800 bg-slate-900 p-8 space-y-4">
          <h1 className="text-2xl font-bold text-white">Create a student account</h1>
          {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
          {field('name', 'Full name')}
          {field('email', 'Email', 'email')}
          {field('password', 'Password', 'password')}
          {field('roll_no', 'Roll number')}
          {field('phone', 'Phone (optional)', 'tel')}
          <QueryState loading={loadingDepartments} error={departmentsError} empty={!loadingDepartments && !departmentsError && departments.length === 0} onRetry={() => void loadDepartments()} />
          {!loadingDepartments && !departmentsError && departments.length > 0 && (
            <label className="block text-sm text-slate-300">
              Department
              <select required value={form.department_id} onChange={event => setForm(current => ({ ...current, department_id: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white">
                <option value="">Select department</option>
                {departments.map(department => <option key={department.department_id} value={department.department_id}>{department.name}</option>)}
              </select>
              {fields.department_id && <span className="mt-1 block text-xs text-rose-300">{fields.department_id}</span>}
            </label>
          )}
          <label className="block text-sm text-slate-300">
            Year of study
            <select value={form.year_of_study} onChange={event => setForm(current => ({ ...current, year_of_study: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white">
              {[1, 2, 3, 4, 5, 6].map(year => <option key={year} value={year}>{year}</option>)}
            </select>
            {fields.year_of_study && <span className="mt-1 block text-xs text-rose-300">{fields.year_of_study}</span>}
          </label>
          <button disabled={submitting || loadingDepartments || departments.length === 0} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white disabled:opacity-50">
            {submitting ? 'Creating account…' : 'Register'}
          </button>
          <p className="text-sm text-slate-400">Already registered? <Link to="/login" className="text-indigo-300">Sign in</Link></p>
        </form>
      </main>
      <Footer />
    </div>
  );
}
