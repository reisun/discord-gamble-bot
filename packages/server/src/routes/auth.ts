import { Router, Request, Response } from 'express';
import { isAdmin } from '../middleware/auth';

const router = Router();

// GET /api/auth/verify
router.get('/verify', (req: Request, res: Response) => {
  res.json({ data: { isAdmin: isAdmin(req) } });
});

export default router;
