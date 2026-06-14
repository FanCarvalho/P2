const request = require('supertest');
const { authHeader, loginAs } = require('../helpers/apiTestUtils');


describe('Test 10 - Pole Management CRUD', () => {
  it('validates POST/GET/:id/PATCH /postes and FK checks for id_zona/id_perfil', async () => {
    const { app, token } = await loginAs();

    const zonas = await request(app).get('/zonas');
    expect(zonas.status).toBe(200);
    const zonaValida = zonas.body[0];
    expect(zonaValida).toBeDefined();

    const perfis = await request(app)
      .get('/perfis-iluminacao')
      .set(authHeader(token));
    expect(perfis.status).toBe(200);
    const perfilValido = perfis.body[0];
    expect(perfilValido).toBeDefined();

    const invalidFk = await request(app)
      .post('/postes')
      .set(authHeader(token))
      .send({
        id_zona: 999999,
        id_perfil: 999999,
        latitude: 41.15,
        longitude: -8.61,
        altura: 9,
        data_instalacao: '2026-06-15',
        intensidade_atual: 30
      });

    expect([400, 404, 409]).toContain(invalidFk.status);

    const create = await request(app)
      .post('/postes')
      .set(authHeader(token))
      .send({
        id_zona: zonaValida.id_zona,
        id_perfil: perfilValido.id_perfil,
        latitude: 41.16,
        longitude: -8.62,
        altura: 10,
        data_instalacao: '2026-06-15',
        intensidade_atual: 40
      });

    expect(create.status).toBe(201);
    expect(create.body).toHaveProperty('id_poste');

    const list = await request(app)
      .get('/postes')
      .set(authHeader(token));
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);

    const getById = await request(app)
      .get(`/postes/${create.body.id_poste}`)
      .set(authHeader(token));
    expect(getById.status).toBe(200);

    const update = await request(app)
      .patch(`/postes/${create.body.id_poste}`)
      .set(authHeader(token))
      .send({ intensidade_atual: 55, estado: 'ativo' });

    expect(update.status).toBe(200);
    expect(Number(update.body.intensidade_atual)).toBe(55);
  });
});
