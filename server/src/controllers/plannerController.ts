import { Request, Response } from 'express';
import { plannerService, PlannerValidationError } from '../services/planner/plannerService';
import { CreatePlanRequest, UpdateSessionRequest } from 'studymate-shared';

export const plannerController = {
  createPlan(req: Request, res: Response): void {
    try {
      const body = req.body as CreatePlanRequest;
      const plan = plannerService.generatePlan(body);
      res.status(201).json(plan);
    } catch (err: unknown) {
      if (err instanceof PlannerValidationError) {
        res.status(400).json({ error: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : 'Failed to generate study plan';
      res.status(500).json({ error: message });
    }
  },

  listPlans(_req: Request, res: Response): void {
    try {
      const plans = plannerService.listPlans();
      res.json(plans);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to list study plans';
      res.status(500).json({ error: message });
    }
  },

  getPlan(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const plan = plannerService.getPlan(id);
      if (!plan) {
        res.status(404).json({ error: `Study plan '${id}' was not found.` });
        return;
      }
      res.json(plan);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to get study plan';
      res.status(500).json({ error: message });
    }
  },

  deletePlan(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const deleted = plannerService.deletePlan(id);
      if (!deleted) {
        res.status(404).json({ error: `Study plan '${id}' was not found.` });
        return;
      }
      res.json({ message: 'Study plan deleted successfully.', id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete study plan';
      res.status(500).json({ error: message });
    }
  },

  updateSession(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const body = req.body as UpdateSessionRequest;
      const updated = plannerService.updateSession(id, body);
      if (!updated) {
        res.status(404).json({ error: `Study session '${id}' was not found.` });
        return;
      }
      res.json(updated);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update study session';
      res.status(500).json({ error: message });
    }
  },

  toggleSessionComplete(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const explicitState = req.body.isCompleted !== undefined ? Boolean(req.body.isCompleted) : undefined;
      const updated = plannerService.toggleSessionComplete(id, explicitState);
      if (!updated) {
        res.status(404).json({ error: `Study session '${id}' was not found.` });
        return;
      }
      res.json(updated);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to toggle session completion';
      res.status(500).json({ error: message });
    }
  },

  deleteSession(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const deleted = plannerService.deleteSession(id);
      if (!deleted) {
        res.status(404).json({ error: `Study session '${id}' was not found.` });
        return;
      }
      res.json({ message: 'Session deleted successfully.', id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete session';
      res.status(500).json({ error: message });
    }
  },
};
