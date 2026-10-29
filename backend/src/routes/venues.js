// src/routes/venues.js
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  listVenues, getVenue, createVenue, updateVenue, deleteVenue,
} from '../controllers/venuesController.js';

const router = Router();

const venueSchema = z.object({
  name    : z.string().min(2).max(150),
  location: z.string().max(255).optional(),
  capacity: z.number().int().positive(),
});

router.get('/',    listVenues);
router.get('/:id', getVenue);
router.post('/',   requireAuth, requireRole('admin'), validate(venueSchema), createVenue);
router.put('/:id', requireAuth, requireRole('admin'), validate(venueSchema.partial()), updateVenue);
router.delete('/:id', requireAuth, requireRole('admin'), deleteVenue);

export default router;
