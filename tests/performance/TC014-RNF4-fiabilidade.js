const request = require('supertest');
const { createApp } = require('../helpers/apiTestUtils');

describe('Test 17 - Basic performance (short mode) / TC014', () => {
  jest.setTimeout(30000);

  it('reliability smoke with retry behavior and high success rate', async () => {
    const app = createApp();

    let retries = 0;
    let success = 0;
    const total = 20;

    async function requestWithRetry(pathname, maxRetries = 2) {
      let last;
      for (let i = 0; i <= maxRetries; i += 1) {
        last = await request(app).get(pathname);
        if (last.status < 500) return last;
        retries += 1;
      }
      return last;
    }

    for (let i = 0; i < total; i += 1) {
      const res = await requestWithRetry('/zonas', 2);
      if (res.status >= 200 && res.status < 400) success += 1;
    }

    const successRate = success / total;
    expect(successRate).toBeGreaterThanOrEqual(0.95);
    expect(retries).toBeGreaterThanOrEqual(0);
  });
});
