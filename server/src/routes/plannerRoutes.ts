import { Router } from 'express';
import { plannerController } from '../controllers/plannerController';

export const plannerRouter = Router();

// Study plans
plannerRouter.post('/plans', plannerController.createPlan);
plannerRouter.get('/plans', plannerController.listPlans);
plannerRouter.get('/plans/:id', plannerController.getPlan);
plannerRouter.delete('/plans/:id', plannerController.deletePlan);

// Study sessions within plans
plannerRouter.patch('/plans/sessions/:id', plannerController.updateSession);
plannerRouter.post('/plans/sessions/:id/toggle', plannerController.toggleSessionComplete);
plannerRouter.delete('/plans/sessions/:id', plannerController.deleteSession);
