// src/routes/students.js
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, requireSelfOrAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  listStudents, getStudent, createStudent, updateStudent, deleteStudent,
} from '../controllers/studentsController.js';

const router = Router();

const studentSchema = z.object({
  name         : z.string().min(2).max(100),
  email        : z.string().email().max(120),
  password_hash: z.string().min(8),
  roll_no      : z.string().min(2).max(30),
  department_id: z.number().int().positive(),
  year_of_study: z.number().int().min(1).max(6),
  phone        : z.string().max(15).optional(),
});

const updateStudentSchema = studentSchema.partial().omit({ password_hash: true });

router.get('/',    requireAuth, requireRole('admin'), listStudents);
router.get('/:id', requireAuth, requireSelfOrAdmin, getStudent);
router.post('/',   requireAuth, requireRole('admin'), validate(studentSchema), createStudent);
router.put('/:id', requireAuth, requireSelfOrAdmin, validate(updateStudentSchema), updateStudent);
router.delete('/:id', requireAuth, requireRole('admin'), deleteStudent);

export default router;
