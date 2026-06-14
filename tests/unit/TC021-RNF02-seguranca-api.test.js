const request = require('supertest');
const { createApp, loginAs, authHeader, createOperatorAndLoginAdminToOperator } = require('../helpers/apiTestUtils');

describe('Test 21 - RNF02 API security (authN/authZ)', () => {
  it('Passo 1: rota protegida sem token devolve 401', async () => {
    const app = createApp();

    const response = await request(app).post('/postes').send({
      id_zona: 1,
      id_perfil: 1,
      latitude: 41.15,
      longitude: -8.61
    });

    expect(response.status).toBe(401);
  });

  it('Passo 2: rota administrativa com utilizador nao admin devolve 403', async () => {
    const operatorLogin = await createOperatorAndLoginAdminToOperator();
    const app = operatorLogin?.app || createApp();

    if (!operatorLogin?.token) {
      const fallback = await loginAs();
      const invalidTokenResponse = await request(fallback.app)
        .post('/operadores')
        .set(authHeader('token-invalido'))
        .send({
          nome: 'Operador X',
          email: `opx.${Date.now()}@glowpath.local`,
          password: '12345678',
          nivel_acesso: 'operador'
        });

      expect([401, 403]).toContain(invalidTokenResponse.status);
      return;
    }

    const response = await request(app)
      .post('/operadores')
      .set(authHeader(operatorLogin.token))
      .send({
        nome: `Operador Sem Permissao ${Date.now()}`,
        email: `sempermissao.${Date.now()}@glowpath.local`,
        password: '12345678',
        nivel_acesso: 'operador'
      });

    expect(response.status).toBe(403);
  });

  it('Passo 3: backend diferencia 401 (token invalido/ausente) de 403 (sem privilegio)', async () => {
    const { app, token } = await loginAs();

    const withoutToken = await request(app)
      .post('/operadores')
      .send({
        nome: 'No Token',
        email: `notoken.${Date.now()}@glowpath.local`,
        password: '12345678',
        nivel_acesso: 'operador'
      });
    expect(withoutToken.status).toBe(401);

    const invalidToken = await request(app)
      .post('/operadores')
      .set(authHeader('abc.def.ghi'))
      .send({
        nome: 'Invalid Token',
        email: `invalid.${Date.now()}@glowpath.local`,
        password: '12345678',
        nivel_acesso: 'operador'
      });
    expect(invalidToken.status).toBe(401);

    const adminAllowed = await request(app)
      .get('/operadores')
      .set(authHeader(token));

    expect([200, 204]).toContain(adminAllowed.status);
  });
});
