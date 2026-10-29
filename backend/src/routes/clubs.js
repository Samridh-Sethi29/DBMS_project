// src/routes/clubs.js
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, requireEntityClubRank } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  listClubs, getClub, createClub, updateClub, deleteClub,
} from '../controllers/clubsController.js';

const router = Router();

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

router.get('/',       listClubs);
router.get('/:id',    getClub);
router.post('/',      requireAuth, requireRole('admin'), validate(clubSchema), createClub);
router.put('/:id',    requireAuth, requireEntityClubRank('club', 3), validate(updateClubSchema), updateClub);
router.delete('/:id', requireAuth, requireRole('admin'), deleteClub);

export default router;
