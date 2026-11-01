// src/routes/venues.js
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  listVenues, getVenue, createVenue, updateVenue, deleteVenue,
} from '../controllers/venuesController.js';
import { checkVenueConflicts, listAvailableVenues } from '../controllers/clubManagementController.js';

const router = Router();

const venueSchema = z.object({
  name    : z.string().min(2).max(150),
  location: z.string().max(255).optional(),
  capacity: z.number().int().positive(),
});

const venueConflictSchema = z.object({
  clubId: z.coerce.number().int().positive(),
  venueId: z.coerce.number().int().positive(),
  startDatetime: z.string(),
  endDatetime: z.string(),
  excludeEventId: z.coerce.number().int().positive().optional(),
  minCapacity: z.coerce.number().int().nonnegative().optional(),
});

router.get('/', listVenues);
router.get('/available', requireAuth, listAvailableVenues);
router.post('/conflicts/check', requireAuth, validate(venueConflictSchema), checkVenueConflicts);
router.get('/:id', getVenue);
router.post('/', requireAuth, requireRole('admin'), validate(venueSchema), createVenue);
router.put('/:id', requireAuth, requireRole('admin'), validate(venueSchema.partial()), updateVenue);
router.delete('/:id', requireAuth, requireRole('admin'), deleteVenue);

export default router;
