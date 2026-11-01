import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getMyRegistrations } from '@/api/auth.js';
import { cancelEventRegistration, registerForEvent } from '@/api/events.js';
import { useAuth } from '@/auth/AuthContext';
import type { CampusEvent } from '@/lib/store';

interface EventRegistrationButtonProps {
  event: Pick<CampusEvent, 'id' | 'signupMode' | 'externalSignupUrl' | 'title'>;
  className?: string;
  compact?: boolean;
}

export default function EventRegistrationButton({ event, className = '', compact = false }: EventRegistrationButtonProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: registrations = [] } = useQuery({
    queryKey: ['my-registrations'],
    queryFn: async () => (await getMyRegistrations()).data,
    enabled: Boolean(user),
  });

  const isRegistered = useMemo(
    () => registrations.some(registration => String(registration.eventId) === String(event.id) && registration.status === 'registered'),
    [event.id, registrations],
  );

  const register = useMutation({
    mutationFn: () => registerForEvent(Number(event.id)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-registrations'] });
    },
  });

  const cancel = useMutation({
    mutationFn: () => cancelEventRegistration(Number(event.id)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-registrations'] });
    },
  });

  if (event.signupMode === 'external' && event.externalSignupUrl) {
    return (
      <a href={event.externalSignupUrl} target="_blank" rel="noreferrer" className={`block text-center text-xs text-cyan-300 underline ${className}`}>
        External sign-up
      </a>
    );
  }

  if (event.signupMode !== 'internal') {
    return null;
  }

  if (user && isRegistered) {
    return (
      <div className={`flex gap-2 ${compact ? 'flex-col' : 'flex-col sm:flex-row'} ${className}`}>
        <button
          type="button"
          disabled
          className="flex-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-center text-xs font-semibold text-emerald-300"
        >
          You are registered
        </button>
        <button
          type="button"
          onClick={() => void cancel.mutateAsync()}
          disabled={cancel.isPending}
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-center text-xs font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
        >
          {cancel.isPending ? 'Removing…' : 'Remove registration'}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (!user) {
          navigate('/login');
          return;
        }
        void register.mutateAsync();
      }}
      disabled={register.isPending || cancel.isPending}
      className={`w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-center text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50 ${className}`}
    >
      {register.isPending ? 'Registering…' : 'Register'}
    </button>
  );
}
