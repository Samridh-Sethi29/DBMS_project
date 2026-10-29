// src/routes/clubs.js
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  listClubs, getClub, createClub, updateClub, deleteClub,
} from '../controllers/clubsController.js';

const router = Router();

const clubSchema = z.object({
  name          : z.string().min(2).max(150),
  description   : z.string().optional(),
  category_id   : z.number().int().positive(),
  coordinator_id: z.number().int().positive(),
});

const updateClubSchema = clubSchema.partial().extend({
  status: z.enum(['active','inactive']).optional(),
});

router.get('/',    listClubs);
router.get('/:id', getClub);
router.post('/',   requireAuth, requireRole('admin'), validate(clubSchema), createClub);
router.put('/:id', requireAuth, requireRole('admin','coordinator'), validate(updateClubSchema), updateClub);
router.delete('/:id', requireAuth, requireRole('admin'), deleteClub);

export default router;
