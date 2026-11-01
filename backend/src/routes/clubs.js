// src/routes/clubs.js
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth, requireRole, requireEntityClubRank, requireClubRank } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createClub, updateClub, deleteClub,
} from '../controllers/clubsController.js';
import {
  joinClub,
  leaveClub,
  getMyMemberships,
  listClubMembers,
  updateMemberStatus,
  updateMemberRole,
  createClubEvent,
  updateClubEvent,
  cancelClubEvent,
  checkVenueConflicts,
  listAvailableVenues,
  listManageEvents,
  getEventRegistrations,
  markEventAttendance,
  issueEventCertificates,
  updateClubProfile,
  uploadClubLogo,
  createEventPhoto,
  patchEventPhoto,
  deleteEventPhoto,
} from '../controllers/clubManagementController.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image files are allowed.'));
  },
});

const httpUrl = z.string().url().refine(
  u => u.startsWith('http://') || u.startsWith('https://'),
  { message: 'URL must start with http:// or https://' },
);

const clubSchema = z.object({
  name              : z.string().min(2).max(100),
  tagline           : z.string().max(160).optional().nullable(),
  description       : z.string().optional().nullable(),
  logo_url          : z.string().max(255).optional().nullable(),
  website_url       : httpUrl.optional().nullable(),
  category_id       : z.number().int().positive(),
  faculty_advisor_id: z.number().int().positive().optional().nullable(),
});

const updateClubSchema = clubSchema.partial().extend({
  status: z.enum(['active','inactive']).optional(),
});

const memberStatusSchema = z.object({
  status: z.enum(['approved', 'left']),
});

const memberRoleSchema = z.object({
  role: z.enum(['member', 'core_member', 'vice_chair', 'chair']),
  positionTitle: z.string().max(60).optional(),
  displayOrder: z.coerce.number().int().min(1).max(1000).optional(),
});

const eventCreateSchema = z.object({
  venueId: z.coerce.number().int().positive(),
  title: z.string().min(3).max(150),
  description: z.string().optional().nullable(),
  eventType: z.enum(['technical', 'cultural', 'academic', 'sports', 'workshop', 'other']).optional(),
  startDatetime: z.string(),
  endDatetime: z.string(),
  isTentative: z.boolean().optional(),
  posterUrl: z.string().url().optional().nullable(),
  signupMode: z.enum(['none', 'internal', 'external']).optional(),
  externalSignupUrl: z.string().url().optional().nullable(),
  registrationDeadline: z.string().optional().nullable(),
  maxParticipants: z.coerce.number().int().positive().optional().nullable(),
  isPlaceholder: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (new Date(data.endDatetime) <= new Date(data.startDatetime)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDatetime'], message: 'endDatetime must be after startDatetime' });
  }
  if (data.registrationDeadline && new Date(data.registrationDeadline) > new Date(data.startDatetime)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['registrationDeadline'], message: 'registrationDeadline must be on or before startDatetime' });
  }
  if (data.signupMode === 'external' && (!data.externalSignupUrl || !/^https?:\/\//.test(data.externalSignupUrl))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['externalSignupUrl'], message: 'externalSignupUrl is required when signupMode is external' });
  }
  if (data.signupMode === 'internal' && (data.maxParticipants === undefined || data.maxParticipants === null || Number(data.maxParticipants) <= 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['maxParticipants'], message: 'maxParticipants is required when signupMode is internal' });
  }
});

// GET / and GET /:clubId are handled by publicClubsRoutes (mounted first in app.js).
// This router handles authenticated mutations only.
router.post('/', requireAuth, requireRole('admin'), validate(clubSchema), createClub);
router.put('/:clubId', requireAuth, requireClubRank(2, req => req.params.clubId), updateClubProfile);
router.put('/:id', requireAuth, requireEntityClubRank('club', 3), validate(updateClubSchema), updateClub);
router.delete('/:id', requireAuth, requireRole('admin'), deleteClub);

router.post('/:clubId/join', requireAuth, joinClub);
router.delete('/:clubId/join', requireAuth, leaveClub);
router.get('/:clubId/members', requireAuth, requireClubRank(3, req => req.params.clubId), listClubMembers);
router.patch('/:clubId/members/:studentId/status', requireAuth, requireClubRank(3, req => req.params.clubId), validate(memberStatusSchema), updateMemberStatus);
router.put('/:clubId/members/:studentId/role', requireAuth, requireClubRank(3, req => req.params.clubId), validate(memberRoleSchema), updateMemberRole);
router.post('/:clubId/events', requireAuth, requireClubRank(2, req => req.params.clubId), validate(eventCreateSchema), createClubEvent);
router.put('/:clubId/events/:eventId', requireAuth, requireEntityClubRank('event', 2), updateClubEvent);
router.delete('/:clubId/events/:eventId', requireAuth, requireEntityClubRank('event', 2), cancelClubEvent);
router.get('/:clubId/events/manage', requireAuth, requireClubRank(2, req => req.params.clubId), listManageEvents);
router.get('/:clubId/events/:eventId/registrations', requireAuth, requireClubRank(2, req => req.params.clubId), getEventRegistrations);
router.post('/:clubId/events/:eventId/attendance', requireAuth, requireClubRank(2, req => req.params.clubId), markEventAttendance);
router.post('/:clubId/events/:eventId/certificates', requireAuth, requireClubRank(2, req => req.params.clubId), issueEventCertificates);
router.post('/:clubId/logo', requireAuth, requireClubRank(2, req => req.params.clubId), upload.single('logo'), uploadClubLogo);
router.post('/:clubId/events/:eventId/photos', requireAuth, requireClubRank(2, req => req.params.clubId), upload.array('photos', 10), createEventPhoto);
router.patch('/:clubId/events/:eventId/photos/:photoId', requireAuth, requireClubRank(2, req => req.params.clubId), patchEventPhoto);
router.delete('/:clubId/events/:eventId/photos/:photoId', requireAuth, requireClubRank(2, req => req.params.clubId), deleteEventPhoto);

export default router;
