const request = require('supertest');
const { createApp, loginAs, authHeader } = require('../helpers/apiTestUtils');

describe('Test 28 - RNF10 consistent response contracts', () => {
  it('Passo 1: respostas de sucesso mantem estrutura previsivel', async () => {
    const app = createApp();

    const zonas = await request(app).get('/zonas');
    expect(zonas.status).toBe(200);
    expect(Array.isArray(zonas.body)).toBe(true);

    if (zonas.body.length > 0) {
      expect(zonas.body[0]).toEqual(
        expect.objectContaining({
          id_zona: expect.anything(),
          nome: expect.any(String)
        })
      );
    }
  });

  it('Passo 2: erros de validacao retornam payload de erro estruturado', async () => {
    const { app, token } = await loginAs();

    const invalid = await request(app)
      .post('/perfis-iluminacao')
      .set(authHeader(token))
      .send({});

    expect([400, 422]).toContain(invalid.status);
    expect(invalid.body).toBeDefined();
    expect(typeof invalid.body).toBe('object');
  });

  it('Passo 3: erros de autenticacao mantem contrato previsivel', async () => {
    const app = createApp();

    const unauthorized = await request(app).get('/operadores');
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.body).toBeDefined();
    expect(typeof unauthorized.body).toBe('object');
    expect(JSON.stringify(unauthorized.body).length).toBeGreaterThan(2);
  });
});
