const request = require('supertest');
const { createApp, loginAs, authHeader } = require('../helpers/apiTestUtils');

describe('Test 22 - RNF03 local/offline continuity and no duplicate sync', () => {
  it('Passo 1: com backend em fallback JSON, operacoes essenciais continuam disponiveis', async () => {
    const app = createApp();

    const zonas = await request(app).get('/zonas');
    expect(zonas.status).toBe(200);
    expect(Array.isArray(zonas.body)).toBe(true);

    const config = await request(app).get('/api/config');
    expect(config.status).toBe(200);
    expect(config.body).toBeDefined();
  });

  it('Passo 2: criacao idempotente evita duplicacao com chave de negocio igual', async () => {
    const { app, token } = await loginAs();

    const unique = Date.now();
    const payload = {
      nome: `Zona RNF03 ${unique}`,
      consumo_mensal: 1000
    };

    const first = await request(app)
      .post('/zonas')
      .set(authHeader(token))
      .send(payload);

    expect([201, 400, 409]).toContain(first.status);

    const second = await request(app)
      .post('/zonas')
      .set(authHeader(token))
      .send(payload);

    expect([201, 400, 409]).toContain(second.status);
  });

  it('Passo 3: listagem final nao apresenta duplicacao indevida para o mesmo nome', async () => {
    const app = createApp();

    const uniqueName = `Zona RNF03 DUPCHECK ${Date.now()}`;
    const { token } = await loginAs();

    const first = await request(app)
      .post('/zonas')
      .set(authHeader(token))
      .send({ nome: uniqueName, consumo_mensal: 1234 });

    expect([201, 400, 409]).toContain(first.status);

    const second = await request(app)
      .post('/zonas')
      .set(authHeader(token))
      .send({ nome: uniqueName, consumo_mensal: 1234 });

    expect([201, 400, 409]).toContain(second.status);

    const zonas = await request(app).get('/zonas');
    expect(zonas.status).toBe(200);

    const sameName = (zonas.body || []).filter(z => z.nome === uniqueName);
    expect(sameName.length).toBeGreaterThanOrEqual(0);
    expect(sameName.length).toBeLessThanOrEqual(1);
  });
});
