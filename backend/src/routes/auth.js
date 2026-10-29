// src/routes/auth.js
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { register, login } from '../controllers/authController.js';

const router = Router();

const registerSchema = z.object({
  name    : z.string().min(2).max(100),
  email   : z.string().email().max(120),
  password: z.string().min(8),
  role    : z.enum(['user','admin']).optional().default('user'),
});

const loginSchema = z.object({
  email   : z.string().email(),
  password: z.string().min(1),
});

router.post('/register', validate(registerSchema), register);
router.post('/login',    validate(loginSchema),    login);

export default router;
