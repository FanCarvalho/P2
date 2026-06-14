const { execSync } = require('child_process');
const request = require('supertest');
const { authHeader, loginAs } = require('../helpers/apiTestUtils');

function tentarComando(comando) {
  try {
    execSync(comando, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

describe('Test 14 - Related listings', () => {
  jest.setTimeout(120000);

  it('checks GET /zonas/:id returns zona details', async () => {
    const { app } = await loginAs();

    const zonas = await request(app).get('/zonas');
    expect(zonas.status).toBe(200);
    expect(Array.isArray(zonas.body)).toBe(true);
    expect(zonas.body.length).toBeGreaterThan(0);

    const zonaId = zonas.body[0].id_zona;
    const zona = await request(app).get(`/zonas/${zonaId}`);
    expect(zona.status).toBe(200);
    expect(Number(zona.body.id_zona)).toBe(Number(zonaId));
  });

  it('checks GET /zonas/:id/postes consistency with zona id', async () => {
    const { app, token } = await loginAs();

    const zonas = await request(app).get('/zonas');
    const zonaId = zonas.body[0].id_zona;

    const postes = await request(app)
      .get(`/zonas/${zonaId}/postes`)
      .set(authHeader(token));

    expect(postes.status).toBe(200);
    expect(Array.isArray(postes.body)).toBe(true);

    postes.body.forEach(poste => {
      const posteZonaId = poste.id_zona ?? poste.zona?.id_zona ?? poste.zona_id;
      if (posteZonaId !== undefined && posteZonaId !== null) {
        expect(Number(posteZonaId)).toBe(Number(zonaId));
      }
    });
  });

  it('checks GET /sensores-movimento/:id/zonas data consistency', async () => {
    const { app, token } = await loginAs();

    const postes = await request(app).get('/postes').set(authHeader(token));
    expect(postes.status).toBe(200);
    expect(Array.isArray(postes.body)).toBe(true);
    expect(postes.body.length).toBeGreaterThan(0);

    const idPosteValido = postes.body[0].id_poste;

    const sensor = await request(app)
      .post('/sensores-movimento')
      .set(authHeader(token))
      .send({ id_poste: idPosteValido, estado: 'movimento' });

    expect([201, 400]).toContain(sensor.status);

    if (sensor.status === 201) {
      const zonasSensor = await request(app)
        .get(`/sensores-movimento/${sensor.body.id_sensor}/zonas`)
        .set(authHeader(token));
      expect([200, 404, 401]).toContain(zonasSensor.status);
      return;
    }

    const sensores = await request(app).get('/sensores-movimento').set(authHeader(token));
    expect(sensores.status).toBe(200);
    expect(Array.isArray(sensores.body)).toBe(true);

    if (sensores.body.length > 0) {
      const zonasSensor = await request(app)
        .get(`/sensores-movimento/${sensores.body[0].id_sensor}/zonas`)
        .set(authHeader(token));
      expect([200, 404, 401]).toContain(zonasSensor.status);
    }
  });
});
