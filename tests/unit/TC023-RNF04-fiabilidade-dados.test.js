const request = require('supertest');
const { loginAs, authHeader } = require('../helpers/apiTestUtils');

describe('Test 23 - RNF04 data reliability and referential consistency', () => {
  it('Passo 1: rejeita insercao com referencia invalida', async () => {
    const { app, token } = await loginAs();

    const invalid = await request(app)
      .post('/postes')
      .set(authHeader(token))
      .send({
        id_zona: 99999999,
        id_perfil: 99999999,
        latitude: 41.15,
        longitude: -8.61,
        altura: 9,
        data_instalacao: '2026-01-01',
        intensidade_atual: 30
      });

    expect([400, 404, 409]).toContain(invalid.status);
  });

  it('Passo 2: aceita fluxo consistente com FKs validas', async () => {
    const { app, token } = await loginAs();

    const zonas = await request(app).get('/zonas');
    expect(zonas.status).toBe(200);
    expect(Array.isArray(zonas.body)).toBe(true);
    expect(zonas.body.length).toBeGreaterThan(0);

    const perfis = await request(app)
      .get('/perfis-iluminacao')
      .set(authHeader(token));

    expect(perfis.status).toBe(200);
    expect(Array.isArray(perfis.body)).toBe(true);
    expect(perfis.body.length).toBeGreaterThan(0);

    const ok = await request(app)
      .post('/postes')
      .set(authHeader(token))
      .send({
        id_zona: zonas.body[0].id_zona,
        id_perfil: perfis.body[0].id_perfil,
        latitude: 41.151,
        longitude: -8.611,
        altura: 10,
        data_instalacao: '2026-01-01',
        intensidade_atual: 45
      });

    expect([201, 409]).toContain(ok.status);
  });

  it('Passo 3: dados relacionados mantem consistencia em leitura', async () => {
    const { app, token } = await loginAs();

    const postes = await request(app)
      .get('/postes')
      .set(authHeader(token));

    expect(postes.status).toBe(200);
    expect(Array.isArray(postes.body)).toBe(true);

    if (postes.body.length > 0) {
      const post = postes.body[0];
      const byId = await request(app)
        .get(`/postes/${post.id_poste}`)
        .set(authHeader(token));

      expect(byId.status).toBe(200);
      expect(Number(byId.body.id_poste)).toBe(Number(post.id_poste));
    }
  });
});
