const request = require('supertest');
const { createApp } = require('../helpers/apiTestUtils');

describe('Test 20 - RF18 Operational config endpoint', () => {
  it('returns operational config via GET /api/config with stable structure', async () => {
    const app = createApp();

    const response = await request(app).get('/api/config');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        host: expect.any(String),
        port: expect.any(String),
        user: expect.any(String),
        passwordDefined: expect.any(Boolean)
      })
    );
  });

  it('keeps config endpoint available for frontend execution flow', async () => {
    const app = createApp();

    const response = await request(app).get('/api/config');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
  });
});
