import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, Camera, ShieldCheck, Users } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import QueryState from '@/components/QueryState';
import ApiImage from '@/components/ApiImage';
import { useAuth } from '@/auth/AuthContext';
import { ApiError } from '@/api/client.js';
import {
  assignClubLeadership,
  checkVenueConflicts,
  createClubEvent,
  getClub,
  getClubMembers,
  getMyMemberships,
  listManageEvents,
  updateClubProfile,
  updateMemberStatus,
  uploadClubLogo,
  uploadEventPhoto,
} from '@/api/clubs.js';

export default function ClubManagement() {
  const { clubId = '' } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: club, isLoading: clubLoading, error: clubError, refetch: refetchClub } = useQuery({
    queryKey: ['club', clubId],
    queryFn: async () => (await getClub(clubId)).data,
    enabled: !!clubId,
  });

  const { data: memberships = [], isLoading: membershipLoading, error: membershipError, refetch: refetchMemberships } = useQuery({
    queryKey: ['my-memberships'],
    queryFn: async () => (await getMyMemberships()).data,
    enabled: !!user,
  });

  const membership = useMemo(
    () => memberships.find(member => String(member.clubId) === String(clubId) && !['left'].includes(member.status)),
    [clubId, memberships],
  );

  const { data: membersPage, isLoading: membersLoading, error: membersError, refetch: refetchMembers } = useQuery({
    queryKey: ['club-members', clubId],
    queryFn: async () => (await getClubMembers(clubId, { page: 1, pageSize: 100 })).data,
    enabled: !!clubId,
  });

  const { data: events = [], isLoading: eventsLoading, error: eventsError, refetch: refetchEvents } = useQuery({
    queryKey: ['club-manage-events', clubId],
    queryFn: async () => (await listManageEvents(clubId, 'all')).data,
    enabled: !!clubId,
  });

  const [form, setForm] = useState({
    venueId: '1',
    title: '',
    description: '',
    startDatetime: '',
    endDatetime: '',
    maxParticipants: '',
  });
  const [profileForm, setProfileForm] = useState({ tagline: '', description: '', websiteUrl: '' });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoCaption, setPhotoCaption] = useState('');
  const [selectedPhotoEventId, setSelectedPhotoEventId] = useState('');
  const [conflictMessage, setConflictMessage] = useState('');
  const [leadershipEmail, setLeadershipEmail] = useState('');
  const [leadershipRole, setLeadershipRole] = useState<'member' | 'core_member' | 'vice_chair' | 'chair'>('member');
  const [notice, setNotice] = useState('');

  const eligibleEvents = useMemo(
    () => (events || []).filter(event => event.status !== 'cancelled'),
    [events],
  );

  const canManage = user?.role === 'admin' || Boolean(membership && membership.rank >= 2);

  const createEvent = useMutation<unknown, Error, Record<string, any>>({
    mutationFn: payload => createClubEvent(clubId, payload),
    onSuccess: (response: any) => {
      const softConflict = Boolean(response?.data?.softConflict || response?.data?.softConflicts?.length);
      setNotice(softConflict
        ? 'Event created successfully, but it overlaps another event in a different venue at the same time.'
        : 'Event created successfully.');
      setForm({
        venueId: '1',
        title: '',
        description: '',
        startDatetime: '',
        endDatetime: '',
        maxParticipants: '',
      });
      queryClient.invalidateQueries({ queryKey: ['club-manage-events', clubId] });
      setConflictMessage('');
    },
    onError: error => {
      const apiError = error as ApiError & { details?: { conflicts?: Array<{ title?: string | null; club?: string | null; venueName?: string | null }> } };
      const conflictDetails = Array.isArray(apiError?.details?.conflicts) ? apiError.details.conflicts : [];
      const formatted = conflictDetails.map((item: any) => `${item.title || 'Event'}${item.club ? ` (${item.club})` : ''}${item.venueName ? ` @ ${item.venueName}` : ''}`).join(', ');
      setNotice(formatted
        ? `Event creation blocked because it conflicts with ${formatted}.`
        : (apiError?.message || 'Unable to save the event.'));
    },
  });

  const saveProfile = useMutation({
    mutationFn: () => updateClubProfile(clubId, {
      tagline: profileForm.tagline || null,
      description: profileForm.description || null,
      websiteUrl: profileForm.websiteUrl || null,
    }),
    onSuccess: () => {
      setNotice('Club details saved.');
      queryClient.invalidateQueries({ queryKey: ['club', clubId] });
    },
    onError: error => {
      setNotice(error instanceof Error ? error.message : 'Unable to save the club profile.');
    },
  });

  const uploadLogo = useMutation({
    mutationFn: () => {
      if (!logoFile) throw new Error('Select a logo file first.');
      return uploadClubLogo(clubId, logoFile);
    },
    onSuccess: () => {
      setNotice('Club logo updated.');
      setLogoFile(null);
      queryClient.invalidateQueries({ queryKey: ['club', clubId] });
    },
    onError: error => {
      setNotice(error instanceof Error ? error.message : 'Unable to upload the club logo.');
    },
  });

  const uploadPhotos = useMutation({
    mutationFn: () => {
      if (!selectedPhotoEventId || !photoFile) throw new Error('Choose a club event and a photo file to upload.');
      return uploadEventPhoto(clubId, Number(selectedPhotoEventId), photoFile, photoCaption);
    },
    onMutate: () => {
      setNotice('Uploading photo to the event gallery…');
    },
    onSuccess: () => {
      setNotice('Event photo uploaded successfully and is now visible in the memories gallery.');
      setPhotoFile(null);
      setPhotoCaption('');
      setSelectedPhotoEventId('');
      queryClient.invalidateQueries({ queryKey: ['club-manage-events', clubId] });
      queryClient.invalidateQueries({ queryKey: ['memories'] });
    },
    onError: error => {
      setNotice(error instanceof Error ? error.message : 'Unable to upload the event photo.');
    },
  });

  const checkConflicts = async () => {
    if (!form.venueId || !form.startDatetime || !form.endDatetime) {
      setConflictMessage('Please choose a venue and both dates before checking availability.');
      return;
    }
    try {
      const { data } = await checkVenueConflicts({
        clubId: Number(clubId),
        venueId: Number(form.venueId),
        startDatetime: form.startDatetime,
        endDatetime: form.endDatetime,
      });

      const formatConflicts = (items: Array<{ title?: string | null; club?: string | null; venueName?: string | null; eventId?: number | null }>) =>
        items.filter(item => item.title || item.club).map(item => `${item.title || 'Event'}${item.club ? ` (${item.club})` : ''}${item.venueName ? ` @ ${item.venueName}` : ''}`).join(', ');

      if (data.hardConflict) {
        const details = formatConflicts(data.conflicts || []);
        setConflictMessage(details
          ? `Hard conflict detected with ${details}. Same venue is already booked for this time slot.`
          : `Hard conflict detected: ${data.conflicts.length} same-venue schedule conflict(s).`);
        return;
      }
      if (data.softConflict) {
        const details = formatConflicts(data.softConflicts || []);
        setConflictMessage(details
          ? `Soft conflict detected with ${details}. This overlaps another event at the same time in a different venue.`
          : `Soft conflict detected: this overlaps another event at the same time in a different venue. ${data.softConflicts.length} event(s) affected.`);
        return;
      }
      setConflictMessage('No venue conflicts detected for this slot.');
    } catch (error) {
      setConflictMessage(error instanceof Error ? error.message : 'Unable to check venue availability.');
    }
  };

  const members = Array.isArray(membersPage) ? membersPage : (membersPage?.data || []);
  const pendingMembers = members.filter(member => member.status === 'pending');
  const approvedMembers = members.filter(member => member.status === 'approved' || member.status === 'left');

  const updateMembershipStatus = useMutation({
    mutationFn: ({ studentId, status }: { studentId: number; status: 'approved' | 'left' }) => updateMemberStatus(clubId, studentId, status),
    onSuccess: (_, variables) => {
      const actionLabel = variables.status === 'approved' ? 'approved' : 'rejected';
      setNotice(`Membership request ${actionLabel}.`);
      queryClient.invalidateQueries({ queryKey: ['club-members', clubId] });
      queryClient.invalidateQueries({ queryKey: ['my-memberships'] });
    },
    onError: error => {
      setNotice(error instanceof Error ? error.message : 'Unable to update membership status.');
    },
  });

  const assignLeadership = useMutation({
    mutationFn: () => assignClubLeadership(clubId, {
      email: leadershipEmail.trim(),
      role: leadershipRole,
    }),
    onSuccess: () => {
      setNotice(`Assigned leadership role: ${leadershipRole.replace('_', ' ')}.`);
      setLeadershipEmail('');
      setLeadershipRole('member');
      queryClient.invalidateQueries({ queryKey: ['club-members', clubId] });
      queryClient.invalidateQueries({ queryKey: ['my-memberships'] });
    },
    onError: error => {
      setNotice(error instanceof Error ? error.message : 'Unable to assign leadership role.');
    },
  });

  useEffect(() => {
    if (club) {
      setProfileForm({
        tagline: club.tagline || '',
        description: club.description || '',
        websiteUrl: club.websiteUrl || '',
      });
    }
  }, [club]);

  const showQueryError = clubError || membershipError || membersError || eventsError;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <Navbar />
        <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4 py-12">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center">
            <h1 className="text-2xl font-bold text-white">Club management</h1>
            <p className="mt-3 text-slate-300">Please log in to manage membership and events.</p>
            <Link to="/login" className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Go to login</Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <Link to={`/clubs/${clubId}`} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to club
        </Link>

        <div className="mt-6 flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <ApiImage src={club?.logoUrl} alt={`${club?.name || 'Club'} logo`} className="h-16 w-16 rounded-2xl object-cover" />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">Club dashboard</p>
              <h1 className="mt-1 text-3xl font-bold text-white">{club?.name || 'Club dashboard'}</h1>
            </div>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300">
            {membership ? `Your role: ${membership.role} (${membership.status})` : 'Not a member yet'}
          </div>
        </div>

        {(clubLoading || membershipLoading || membersLoading || eventsLoading) && (
          <QueryState loading={true} />
        )}

        {showQueryError && (
          <div className="mt-8"><QueryState loading={false} error={showQueryError} onRetry={() => { void refetchClub(); void refetchMemberships(); void refetchMembers(); void refetchEvents(); }} /></div>
        )}

        {!showQueryError && !clubLoading && !membershipLoading && !membersLoading && !eventsLoading && (
          <div className="mt-8 space-y-8">
            {!membership && user?.role !== 'admin' && (
              <div className="rounded-2xl border border-amber-900/50 bg-amber-500/5 p-5 text-sm text-amber-200">
                You are not currently part of this club. Join to request membership and unlock the management tools.
              </div>
            )}

            {membership && membership.status === 'pending' && (
              <div className="rounded-2xl border border-blue-900/50 bg-blue-500/5 p-5 text-sm text-blue-200">
                Your membership request is pending review by the club leadership.
              </div>
            )}

            {canManage ? (
              <>
                <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                    <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                      <ShieldCheck className="h-5 w-5 text-indigo-300" /> Club sign-up check
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="text-sm text-slate-300">
                        Venue
                        <select value={form.venueId} onChange={event => setForm(current => ({ ...current, venueId: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white">
                          <option value="1">Main Auditorium</option>
                          <option value="2">Innovation Hall</option>
                        </select>
                      </label>
                      <label className="text-sm text-slate-300">
                        Max participants
                        <input type="number" value={form.maxParticipants} onChange={event => setForm(current => ({ ...current, maxParticipants: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white" placeholder="Optional" />
                      </label>
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className="text-sm text-slate-300">
                        Start
                        <input type="datetime-local" value={form.startDatetime} onChange={event => setForm(current => ({ ...current, startDatetime: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
                      </label>
                      <label className="text-sm text-slate-300">
                        End
                        <input type="datetime-local" value={form.endDatetime} onChange={event => setForm(current => ({ ...current, endDatetime: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
                      </label>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button type="button" onClick={checkConflicts} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">Check availability</button>
                      <button type="button" onClick={() => setForm(current => ({ ...current, startDatetime: '', endDatetime: '' }))} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300">Clear timing</button>
                    </div>
                    {conflictMessage && <p className="mt-4 text-sm text-slate-300">{conflictMessage}</p>}
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                    <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                      <CalendarClock className="h-5 w-5 text-cyan-300" /> Event setup
                    </div>
                    <div className="space-y-3">
                      <label className="block text-sm text-slate-300">
                        Event title
                        <input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white" placeholder="Annual hack night" />
                      </label>
                      <label className="block text-sm text-slate-300">
                        Description
                        <textarea value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} className="mt-2 min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white" placeholder="Describe the event, goal, and audience." />
                      </label>
                    </div>
                    <button
                      type="button"
                      disabled={createEvent.isPending || !form.title || !form.startDatetime || !form.endDatetime}
                      onClick={() => {
                        const payload = {
                          venueId: Number(form.venueId),
                          title: form.title,
                          description: form.description,
                          startDatetime: form.startDatetime,
                          endDatetime: form.endDatetime,
                          maxParticipants: form.maxParticipants ? Number(form.maxParticipants) : undefined,
                          eventType: 'workshop',
                          signupMode: form.maxParticipants ? 'internal' : 'none',
                          isTentative: false,
                        };
                        createEvent.mutate(payload);
                      }}
                      className="mt-5 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {createEvent.isPending ? 'Creating event…' : 'Create event'}
                    </button>
                    {notice && <p className="mt-4 text-sm text-emerald-300">{notice}</p>}
                    {createEvent.error && <p className="mt-2 text-sm text-rose-300">{createEvent.error instanceof Error ? createEvent.error.message : 'Unable to create the event.'}</p>}
                  </div>
                </section>

                <section className="grid gap-6 xl:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                    <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                      <Users className="h-5 w-5 text-violet-300" /> Pending requests
                    </div>
                    {pendingMembers.length === 0 ? (
                      <p className="text-sm text-slate-400">No pending requests right now.</p>
                    ) : (
                      <div className="space-y-3">
                        {pendingMembers.map(member => (
                          <div key={`${member.studentId}-${member.rollNo}`} className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-white">{member.name}</span>
                              <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-blue-200">{member.status}</span>
                            </div>
                            <p className="mt-1 text-slate-400">Roll no: {member.rollNo}</p>
                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                disabled={updateMembershipStatus.isPending && updateMembershipStatus.variables?.studentId === member.studentId}
                                onClick={() => updateMembershipStatus.mutate({ studentId: member.studentId, status: 'approved' })}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {updateMembershipStatus.isPending && updateMembershipStatus.variables?.studentId === member.studentId && updateMembershipStatus.variables?.status === 'approved' ? 'Approving…' : 'Approve'}
                              </button>
                              <button
                                type="button"
                                disabled={updateMembershipStatus.isPending && updateMembershipStatus.variables?.studentId === member.studentId}
                                onClick={() => updateMembershipStatus.mutate({ studentId: member.studentId, status: 'left' })}
                                className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {updateMembershipStatus.isPending && updateMembershipStatus.variables?.studentId === member.studentId && updateMembershipStatus.variables?.status === 'left' ? 'Rejecting…' : 'Reject'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                    <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                      <Users className="h-5 w-5 text-emerald-300" /> Club member roster
                    </div>
                    {user?.role === 'admin' && (
                      <div className="mb-5 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-3">
                        <p className="mb-3 text-sm font-medium text-white">Assign leadership role by email</p>
                        <div className="space-y-3">
                          <input
                            type="email"
                            value={leadershipEmail}
                            onChange={event => setLeadershipEmail(event.target.value)}
                            placeholder="student@example.edu"
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                          />
                          <div className="flex gap-2">
                            <select
                              value={leadershipRole}
                              onChange={event => setLeadershipRole(event.target.value as 'member' | 'core_member' | 'vice_chair' | 'chair')}
                              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                            >
                              <option value="member">Member</option>
                              <option value="core_member">Core Member</option>
                              <option value="vice_chair">Vice Chair</option>
                              <option value="chair">Chair</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                if (!leadershipEmail.trim()) {
                                  setNotice('Please enter a student email.');
                                  return;
                                }
                                assignLeadership.mutate();
                              }}
                              disabled={assignLeadership.isPending}
                              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {assignLeadership.isPending ? 'Assigning…' : 'Assign role'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    {approvedMembers.length === 0 ? (
                      <p className="text-sm text-slate-400">No approved members yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {approvedMembers.map(member => (
                          <div key={`${member.studentId}-${member.rollNo}`} className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-white">{member.name}</span>
                              <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-indigo-200">{member.role}</span>
                            </div>
                            <p className="mt-1 text-slate-400">Roll no: {member.rollNo}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <h2 className="mb-4 text-xl font-bold text-white">Upcoming club events</h2>
                  {events.length === 0 ? (
                    <p className="text-sm text-slate-400">No events have been added for this club yet.</p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {events.map(event => (
                        <article key={event.eventId} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="font-semibold text-white">{event.title}</h3>
                            <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">{event.status}</span>
                          </div>
                          <p className="mt-2 text-sm text-slate-400">
                            {event.startDatetime ? new Date(event.startDatetime).toLocaleString() : 'Date TBD'}
                          </p>
                          <p className="mt-2 text-sm text-slate-300">Registrations: {event.registrationCount}</p>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <section className="grid gap-6 xl:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                    <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                      <ShieldCheck className="h-5 w-5 text-cyan-300" /> Club profile setup
                    </div>
                    <div className="space-y-4">
                      <label className="block text-sm text-slate-300">
                        Tagline
                        <input value={profileForm.tagline} onChange={event => setProfileForm(current => ({ ...current, tagline: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white" placeholder="Short club summary" />
                      </label>
                      <label className="block text-sm text-slate-300">
                        Description
                        <textarea value={profileForm.description} onChange={event => setProfileForm(current => ({ ...current, description: event.target.value }))} className="mt-2 min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white" placeholder="What makes this club unique?" />
                      </label>
                      <label className="block text-sm text-slate-300">
                        Website URL
                        <input value={profileForm.websiteUrl} onChange={event => setProfileForm(current => ({ ...current, websiteUrl: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white" placeholder="https://example.com" />
                      </label>
                    </div>
                    <button type="button" disabled={saveProfile.isPending} onClick={() => saveProfile.mutate()} className="mt-5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                      {saveProfile.isPending ? 'Saving…' : 'Save profile'}
                    </button>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                    <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                      <Camera className="h-5 w-5 text-amber-300" /> Media library
                    </div>
                    <div className="space-y-4">
                      <label className="block text-sm text-slate-300">
                        Club logo
                        <input type="file" accept="image/*" onChange={event => setLogoFile(event.target.files?.[0] || null)} className="mt-2 block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:text-sm file:text-white" />
                      </label>
                      <button type="button" disabled={uploadLogo.isPending || !logoFile} onClick={() => uploadLogo.mutate()} className="w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
                        {uploadLogo.isPending ? 'Uploading logo…' : 'Upload logo'}
                      </button>

                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Event memories</p>
                        <label className="block text-sm text-slate-300">
                          Event
                          <select value={selectedPhotoEventId} onChange={event => setSelectedPhotoEventId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white">
                            <option value="">Select an event</option>
                            {eligibleEvents.length === 0 ? <option value="" disabled>No available events yet</option> : eligibleEvents.map(event => (
                              <option key={event.eventId} value={String(event.eventId)}>{event.title}</option>
                            ))}
                          </select>
                        </label>
                        <label className="mt-3 block text-sm text-slate-300">
                          Photo caption
                          <input value={photoCaption} onChange={event => setPhotoCaption(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white" placeholder="Memory caption" />
                        </label>
                        <label className="mt-3 block text-sm text-slate-300">
                          Photo file
                          <input type="file" accept="image/*" onChange={event => setPhotoFile(event.target.files?.[0] || null)} className="mt-2 block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:text-sm file:text-white" />
                        </label>
                        <button type="button" disabled={uploadPhotos.isPending || !selectedPhotoEventId || !photoFile || eligibleEvents.length === 0} onClick={() => uploadPhotos.mutate()} className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                          {uploadPhotos.isPending ? 'Uploading photo…' : 'Upload event photo'}
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-300">
                This club needs a core member or leadership role to open the management dashboard.
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
