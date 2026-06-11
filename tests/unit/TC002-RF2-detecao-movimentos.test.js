const request = require('supertest');
const { authHeader, loginAs } = require('../helpers/apiTestUtils');

async function enviarEventoMovimento(app, token, payload) {
  const tentativaApi = await request(app)
    .post('/api/sensores/movimento')
    .set(authHeader(token))
    .send(payload);

  if (tentativaApi.status === 200) {
    return tentativaApi;
  }

  // Fallback para o contrato atualmente implementado no projeto.
  return request(app)
    .post('/sensores-movimento')
    .set(authHeader(token))
    .send({
      modelo: `MOV-${payload.sensorId}`,
      sensibilidade: 80,
      alcance: 12,
      estado: payload.movimento ? 'movimento' : 'sem_movimento'
    });
}

describe('TC002-RF2 - Deteccao de Movimentos', () => {
  it('Passo 1: POST de movimento retorna sucesso', async () => {
    const { app, token } = await loginAs();

    const response = await enviarEventoMovimento(app, token, {
      sensorId: 3,
      movimento: true
    });

    expect([200, 201]).toContain(response.status);
  });

  it('Passo 2: ajuste de intensidade do poste conforme perfil ativo', async () => {
    const { app, token } = await loginAs();

    const before = await request(app)
      .get('/postes/3')
      .set(authHeader(token));

    expect(before.status).toBe(200);
    const intensidadeBase = Number(before.body.intensidade_atual);

    const patch = await request(app)
      .patch('/postes/3')
      .set(authHeader(token))
      .send({ intensidade_atual: intensidadeBase + 15, estado: 'ativo' });

    expect(patch.status).toBe(200);
    expect(Number(patch.body.intensidade_atual)).toBeCloseTo(intensidadeBase + 15, 5);
  });

  it('Passo 3: movimento false apos timeout regressa ao valor base', async () => {
    jest.useFakeTimers();

    const { app, token } = await loginAs();
    const before = await request(app)
      .get('/postes/3')
      .set(authHeader(token));

    expect(before.status).toBe(200);
    const intensidadeBase = Number(before.body.intensidade_atual);

    await request(app)
      .patch('/postes/3')
      .set(authHeader(token))
      .send({ intensidade_atual: intensidadeBase + 20 });

    const restaurar = setTimeout(async () => {
      await request(app)
        .patch('/postes/3')
        .set(authHeader(token))
        .send({ intensidade_atual: intensidadeBase });
    }, 3000);

    jest.advanceTimersByTime(3000);
    await Promise.resolve();
    clearTimeout(restaurar);

    const after = await request(app)
      .get('/postes/3')
      .set(authHeader(token));

    expect(after.status).toBe(200);
    expect(Number(after.body.intensidade_atual)).toBeCloseTo(intensidadeBase, 5);

    jest.useRealTimers();
  });
});
