const request = require('supertest');
const { createApp } = require('../helpers/apiTestUtils');

describe('Test 17 - Basic performance (short mode) / TC016', () => {
  jest.setTimeout(30000);

  it('scalability short ramp simulation with mixed endpoints', async () => {
    const app = createApp();
    const endpoints = ['/zonas', '/api/config', '/dashboard.html'];

    const durations = [];
    let failures = 0;

    for (let i = 0; i < 30; i += 1) {
      const endpoint = endpoints[i % endpoints.length];
      const started = Date.now();
      const res = await request(app).get(endpoint);
      const elapsed = Date.now() - started;
      durations.push(elapsed);

      if (!(res.status >= 200 && res.status < 500)) {
        failures += 1;
      }
    }

    const sorted = [...durations].sort((a, b) => a - b);
    const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
    const p95 = sorted[p95Index];
    const failRate = failures / durations.length;

    expect(p95).toBeLessThanOrEqual(3000);
    expect(failRate).toBeLessThan(0.01);
  });
});
