const request = require('supertest');
const { authHeader, loginAs } = require('../helpers/apiTestUtils');

describe('Test 8/9 - Motion sensors and sensor event reaction', () => {
  it('creates sensor, lists sensors and gets sensor by id with valid estado', async () => {
    const { app, token } = await loginAs();

    const create = await request(app)
      .post('/sensores-movimento')
      .set(authHeader(token))
      .send({
        modelo: `MOV-${Date.now()}`,
        sensibilidade: 80,
        alcance: 12,
        estado: 'movimento'
      });

    expect(create.status).toBe(201);
    expect(create.body).toHaveProperty('id_sensor');

    const list = await request(app)
      .get('/sensores-movimento')
      .set(authHeader(token));

    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);

    const getById = await request(app)
      .get(`/sensores-movimento/${create.body.id_sensor}`)
      .set(authHeader(token));

    expect(getById.status).toBe(200);
    expect(['movimento', 'sem_movimento']).toContain(String(getById.body.estado));
  });

  it('reacts to motion event with poste intensity PATCH and restores after timeout', async () => {
    jest.useFakeTimers();
    const { app, token } = await loginAs();

    const before = await request(app)
      .get('/postes/3')
      .set(authHeader(token));

    expect(before.status).toBe(200);
    const intensidadeBase = Number(before.body.intensidade_atual || 0);

    const increased = await request(app)
      .patch('/postes/3')
      .set(authHeader(token))
      .send({ intensidade_atual: intensidadeBase + 20, estado: 'ativo' });

    expect(increased.status).toBe(200);
    expect(Number(increased.body.intensidade_atual)).toBeCloseTo(intensidadeBase + 20, 5);

    const timer = setTimeout(async () => {
      await request(app)
        .patch('/postes/3')
        .set(authHeader(token))
        .send({ intensidade_atual: intensidadeBase });
    }, 3000);

    jest.advanceTimersByTime(3000);
    await Promise.resolve();
    clearTimeout(timer);

    const after = await request(app)
      .get('/postes/3')
      .set(authHeader(token));

    expect(after.status).toBe(200);
    expect(Number(after.body.intensidade_atual)).toBeCloseTo(intensidadeBase, 5);
    jest.useRealTimers();
  });
});
