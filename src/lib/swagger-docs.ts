/**
 * @swagger
 * /api/tasks/execute:
 *   post:
 *     summary: Execute a task
 *     description: |
 *       Executes a task with the provided payload.
 *       Requires valid workspace context and authentication.
 *     operationId: executeTask
 *     tags:
 *       - Tasks
 *     parameters:
 *       - in: header
 *         name: X-Request-ID
 *         schema:
 *           type: string
 *         description: Optional request ID for tracing
 *       - in: header
 *         name: Authorization
 *         schema:
 *           type: string
 *         required: true
 *         description: Bearer token for authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - taskPayload
 *               - taskExecutionId
 *               - workspaceId
 *             properties:
 *               taskPayload:
 *                 type: object
 *                 description: Task execution payload
 *               taskExecutionId:
 *                 type: string
 *                 format: uuid
 *                 description: Unique identifier for task execution
 *               workspaceId:
 *                 type: string
 *                 format: uuid
 *                 description: Workspace identifier
 *     responses:
 *       200:
 *         description: Task executed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 result:
 *                   type: object
 *                 requestId:
 *                   type: string
 *       400:
 *         description: Bad request - Invalid payload or workspace not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 retryAfter:
 *                   type: number
 *         headers:
 *           X-RateLimit-Remaining:
 *             schema:
 *               type: integer
 *           X-RateLimit-Reset:
 *             schema:
 *               type: string
 *           Retry-After:
 *             schema:
 *               type: string
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * components:
 *   schemas:
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *         requestId:
 *           type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 *
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       description: Bearer token authentication
 *
 * security:
 *   - BearerAuth: []
 */

// This file contains OpenAPI/Swagger documentation for API endpoints.
// The JSDoc comments above use the swagger-jsdoc format.
//
// To generate Swagger UI:
// 1. Install swagger-ui-express and swagger-jsdoc
// 2. Create a docs route that combines all API documentation
// 3. Mount Swagger UI on /api-docs
//
// Example setup in a route handler:
//
// import swaggerJsdoc from 'swagger-jsdoc';
// import swaggerUi from 'swagger-ui-express';
//
// const swaggerOptions = {
//   definition: {
//     openapi: '3.0.0',
//     info: {
//       title: 'AI Agency API',
//       version: '1.0.0',
//       description: 'API documentation for AI Agency platform',
//     },
//     servers: [
//       {
//         url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
//         description: 'API Server',
//       },
//     ],
//   },
//   apis: ['./src/lib/swagger-docs.ts', './src/app/api/**/route.ts'],
// };
//
// const swaggerSpec = swaggerJsdoc(swaggerOptions);
// export { swaggerUi, swaggerSpec };

export {};
