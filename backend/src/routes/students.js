// src/routes/students.js
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  listStudents, getStudent, createStudent, updateStudent, deleteStudent,
} from '../controllers/studentsController.js';

const router = Router();

const studentSchema = z.object({
  name         : z.string().min(2).max(150),
  email        : z.string().email(),
  password_hash: z.string().min(8),   // caller must pre-hash or pass raw (hashed in register flow)
  roll_no      : z.string().min(2).max(20),
  department_id: z.number().int().positive(),
  year_of_study: z.number().int().min(1).max(6),
  phone        : z.string().max(20).optional(),
});

const updateStudentSchema = studentSchema.partial().omit({ password_hash: true });

router.get('/',    requireAuth, listStudents);
router.get('/:id', requireAuth, getStudent);
router.post('/',   requireAuth, requireRole('admin'), validate(studentSchema), createStudent);
router.put('/:id', requireAuth, requireRole('admin','student'), validate(updateStudentSchema), updateStudent);
router.delete('/:id', requireAuth, requireRole('admin'), deleteStudent);

export default router;
