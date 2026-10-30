// src/routes/query.js
// Mounts all Section A dynamic query endpoints on their respective paths.

import { Router } from 'express';
import { aggregate }  from '../controllers/aggregateController.js';
import { join }       from '../controllers/joinController.js';
import { subquery }   from '../controllers/subqueryController.js';
import { correlated } from '../controllers/correlatedController.js';
import { dashboard }  from '../controllers/dashboardController.js';
import { participation, membership, studentHistory } from '../controllers/reportsController.js';
import { requireAuth, requireRole, requireSelfOrAdmin } from '../middleware/auth.js';

const router = Router();

// Q3
router.get('/aggregate', requireAuth, requireRole('admin'), aggregate);
// Q5
router.get('/join',      requireAuth, requireRole('admin'), join);
// Q6
router.get('/subquery',  requireAuth, requireRole('admin'), subquery);
// Q7
router.get('/correlated', requireAuth, requireRole('admin'), correlated);

// Dashboard
router.get('/dashboard', requireAuth, dashboard);

// Reports (views)
router.get('/reports/participation',  requireAuth, participation);
router.get('/reports/membership',     requireAuth, membership);
router.get('/reports/student/:id',    requireAuth, requireSelfOrAdmin, studentHistory);

export default router;
