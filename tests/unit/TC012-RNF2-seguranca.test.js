const request = require('supertest');
const { authHeader, createApp, loginAs } = require('../helpers/apiTestUtils');

describe('Test 16 - Security / Authorization', () => {
  it('Passo 1: request sem Authorization para /api/postes devolve 401', async () => {
    const app = createApp();

    // O endpoint legado equivalente no projeto e /postes.
    const response = await request(app).get('/postes');
    expect(response.status).toBe(401);
  });

  it('Passo 2: token de operador em rota admin devolve 403', async () => {
    const { app, token: adminToken } = await loginAs();
    const emailOperador = `operador.bloqueado.${Date.now()}@glowpath.local`;

    const createOperator = await request(app)
      .post('/operadores')
      .set(authHeader(adminToken))
      .send({
        nome: 'Operador Restrito',
        email: emailOperador,
        password: 'operador1234',
        nivel_acesso: 'operador'
      });

    expect([201, 409]).toContain(createOperator.status);

    const operadorLogin = await request(app)
      .post('/operadores/login')
      .send({ email: emailOperador, password: 'operador1234' });

    expect(operadorLogin.status).toBe(200);

    const response = await request(app)
      .post('/operadores')
      .set(authHeader(operadorLogin.body.accessToken))
      .send({
        nome: 'Tentativa Sem Permissao',
        email: `sem.permissao.${Date.now()}@glowpath.local`,
        password: 'operador1234',
        nivel_acesso: 'operador'
      });

    expect(response.status).toBe(403);
  });

  it('Passo 3: endpoints principais nao aceitam SQL injection', async () => {
    const { app, token } = await loginAs();

    const payloadMalicioso = "' OR 1=1 --";

    const tentativas = await Promise.all([
      request(app).post('/operadores/login').send({ email: payloadMalicioso, password: payloadMalicioso }),
      request(app).get(`/postes?estado=${encodeURIComponent(payloadMalicioso)}`).set(authHeader(token)),
      request(app)
        .post('/avarias')
        .set(authHeader(token))
        .send({ descricao: payloadMalicioso, severidade: 'alta', id_poste: 3 })
    ]);

    tentativas.forEach(res => {
      expect(res.status).not.toBe(500);
    });

    // Nao deve autenticar por bypass.
    expect([400, 401]).toContain(tentativas[0].status);
  });
});
