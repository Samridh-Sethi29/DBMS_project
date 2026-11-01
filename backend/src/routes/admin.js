import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  listAdminStudents,
  createAdminClubMember,
  listAdminClubs,
} from '../controllers/clubManagementController.js';

const router = Router();

const studentSearchSchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const adminClubMemberSchema = z.object({
  studentId: z.coerce.number().int().positive(),
  role: z.enum(['member', 'core_member', 'vice_chair', 'chair']),
});

router.get('/students', requireAuth, requireRole('admin'), validate(studentSearchSchema, 'query'), listAdminStudents);
router.post('/clubs/:clubId/members', requireAuth, requireRole('admin'), validate(adminClubMemberSchema), createAdminClubMember);
router.get('/clubs', requireAuth, requireRole('admin'), listAdminClubs);

export default router;