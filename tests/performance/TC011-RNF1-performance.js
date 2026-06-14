const request = require('supertest');
const { createApp } = require('../helpers/apiTestUtils');

describe('Test 17 - Basic performance (short mode) / TC011', () => {
  jest.setTimeout(30000);

  it('smoke for /dashboard.html, /zonas, /api/config with response-time thresholds', async () => {
    const app = createApp();
    const endpoints = ['/dashboard.html', '/zonas', '/api/config'];

    const durations = [];
    let errors = 0;
    const runsPerEndpoint = 5;

    for (const endpoint of endpoints) {
      for (let i = 0; i < runsPerEndpoint; i += 1) {
        const started = Date.now();
        const res = await request(app).get(endpoint);
        const elapsed = Date.now() - started;

        durations.push(elapsed);
        if (res.status >= 500) errors += 1;
      }
    }

    const sorted = [...durations].sort((a, b) => a - b);
    const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
    const p95 = sorted[p95Index];
    const errorRate = errors / durations.length;

    expect(p95).toBeLessThanOrEqual(3000);
    expect(errorRate).toBeLessThan(0.01);
  });
});
