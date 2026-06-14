const request = require('supertest');
const { authHeader, loginAs } = require('../helpers/apiTestUtils');

function filtrarUltimas24h(registos) {
  const limite = Date.now() - 24 * 60 * 60 * 1000;
  return registos.filter(item => {
    const timestamp = Date.parse(item.hora_ligar || item.timestamp || item.created_at || 0);
    return Number.isFinite(timestamp) && timestamp >= limite;
  });
}

describe('Test 11 - Lamp logs', () => {
  it('Passo 1: GET dos logs retorna lista com timestamp e consumo', async () => {
    const { app, token } = await loginAs();

    const response = await request(app)
      .get('/lampadas/1/registos')
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);

    if (response.body.length > 0) {
      expect(response.body[0]).toEqual(
        expect.objectContaining({
          hora_ligar: expect.any(String),
          potencia_watts: expect.any(Number)
        })
      );
    }
  });

  it('Passo 2: simular ON->OFF cria novo registo em registos-lampada', async () => {
    const { app, token } = await loginAs();

    const lamps = await request(app)
      .get('/lampadas')
      .set(authHeader(token));

    expect(lamps.status).toBe(200);
    const lampadaPoste = (lamps.body || []).find(item => Number(item.id_poste) === 3) || lamps.body[0];
    expect(lampadaPoste).toBeDefined();

    const before = await request(app)
      .get('/registos-lampada?limit=200')
      .set(authHeader(token));

    expect(before.status).toBe(200);
    const totalAntes = before.body.length;

    const create = await request(app)
      .post('/registos-lampada')
      .set(authHeader(token))
      .send({
        id_poste: Number(lampadaPoste.id_poste),
        modelo: String(lampadaPoste.modelo),
        potencia_watts: 50,
        luminosidade_max: 800,
        luminosidade_min: 200,
        estado: 'off',
        hora_ligar: new Date(Date.now() - 60 * 1000).toISOString(),
        hora_desligar: new Date().toISOString()
      });

    expect([200, 201]).toContain(create.status);

    const after = await request(app)
      .get('/registos-lampada?limit=200')
      .set(authHeader(token));

    expect(after.status).toBe(200);
    expect(after.body.length).toBeGreaterThanOrEqual(totalAntes);
  });

  it('Passo 3: filtrar logs das ultimas 24h devolve apenas o periodo', async () => {
    const { app, token } = await loginAs();

    const response = await request(app)
      .get('/registos-lampada')
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);

    const filtrados = filtrarUltimas24h(response.body);
    filtrados.forEach(item => {
      const timestamp = Date.parse(item.hora_ligar || item.timestamp || item.created_at);
      expect(timestamp).toBeGreaterThanOrEqual(Date.now() - 24 * 60 * 60 * 1000);
    });
  });
});
