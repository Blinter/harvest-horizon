import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from './app.js';

/**
 * Tests for the Express application setup. Ensures that the core Express app
 * configuration, including middleware for handling not-found routes and basic
 * API route accessibility, functions as expected.
 *
 * @module server/app.test
 */

describe('Express App', () => {
  /**
   * Test the 404 handler.
   * @name shouldReturn404ForNonExistentRoutes
   * @function it
   * @memberof ExpressApp
   * @async
   */
  it('should return 404 for non-existent routes', async () => {
    const response = await request(app).get('/api/non-existent-route');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toHaveProperty('message', 'Not Found');
    expect(response.body.error).toHaveProperty('status', 404);
  });

  /**
   * Test that API routes are accessible.
   * @name shouldAllowAccessToApiRoutes
   * @function it
   * @memberof ExpressApp
   * @async
   */
  it('should allow access to API routes', async () => {
    // This test just verifies that the route exists and returns something
    // It doesn't test the actual functionality of the route
    const response = await request(app).post('/api/auth/login').send({
      username: 'nonexistent',
      password: 'wrongpassword',
    });

    // We expect a 401 (Unauthorized) rather than a 404 (Not Found)
    // This confirms the route exists but authentication failed
    expect(response.status).toBe(401);
  });
});
