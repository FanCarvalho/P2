const request = require('supertest');
const { createApp, loginAs, authHeader } = require('../helpers/apiTestUtils');

describe('Test 26 - RNF08 backend resilience with fallback behavior', () => {
  it('Passo 1: endpoint /api/config responde mesmo com fallback ativo', async () => {
    const app = createApp();
    const response = await request(app).get('/api/config');
    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
  });

  it('Passo 2: endpoint essencial /zonas continua funcional', async () => {
    const app = createApp();
    const response = await request(app).get('/zonas');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('Passo 3: fluxo autenticado continua operacional para leitura', async () => {
    const { app, token } = await loginAs();

    const response = await request(app)
      .get('/perfis-iluminacao')
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});
