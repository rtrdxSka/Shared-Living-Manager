import { Router } from 'express';
import { taskController } from '../controllers/task.controller';
import { addTaskValidation, taskIdValidation, setRotationValidation, assignTaskValidation } from '../validators/task.validator';
import { param } from 'express-validator';
import { handleValidationErrors } from '../middleware/validate';
import { authMiddleware } from '../middleware/auth';

const router = Router({ mergeParams: true }); // exposes :id from household router

// POST /api/households/:id/tasks
router.post(
  '/',
  authMiddleware,
  addTaskValidation,
  handleValidationErrors,
  taskController.addTask.bind(taskController)
);

// GET /api/households/:id/tasks
router.get(
  '/',
  authMiddleware,
  [param('id').isMongoId().withMessage('Invalid household ID')],
  handleValidationErrors,
  taskController.listTasks.bind(taskController)
);

// PATCH /api/households/:id/tasks/rotation — must be before /:taskId routes
router.patch(
  '/rotation',
  authMiddleware,
  setRotationValidation,
  handleValidationErrors,
  taskController.setRotation.bind(taskController)
);

// PATCH /api/households/:id/tasks/:taskId/assign
router.patch(
  '/:taskId/assign',
  authMiddleware,
  assignTaskValidation,
  handleValidationErrors,
  taskController.assignTask.bind(taskController)
);

// PATCH /api/households/:id/tasks/:taskId/complete
router.patch(
  '/:taskId/complete',
  authMiddleware,
  taskIdValidation,
  handleValidationErrors,
  taskController.toggleComplete.bind(taskController)
);

// DELETE /api/households/:id/tasks/:taskId
router.delete(
  '/:taskId',
  authMiddleware,
  taskIdValidation,
  handleValidationErrors,
  taskController.deleteTask.bind(taskController)
);

export default router;
