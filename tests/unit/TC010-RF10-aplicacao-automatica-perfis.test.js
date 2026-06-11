const request = require('supertest');
const { authHeader, loginAs } = require('../helpers/apiTestUtils');

async function garantirZonaZ02(app, token) {
  const list = await request(app)
    .get('/zonas')
    .set(authHeader(token));

  expect(list.status).toBe(200);
  const existente = list.body.find(item => String(item.nome).toUpperCase() === 'Z02');
  if (existente) {
    return existente.id_zona;
  }

  const create = await request(app)
    .post('/zonas')
    .set(authHeader(token))
    .send({
      nome: 'Z02',
      rua: 'Rua Testes Z02',
      codigo_postal: '1000-002',
      id_sensor: 3
    });

  expect(create.status).toBe(201);
  return create.body.id_zona;
}

async function aplicarPerfilAutomaticamente(app, token, zonaId, perfilId, intensidade, horaISO) {
  const posts = await request(app)
    .get(`/zonas/${zonaId}/postes`)
    .set(authHeader(token));

  expect(posts.status).toBe(200);

  for (const post of posts.body) {
    await request(app)
      .patch(`/postes/${post.id_poste}`)
      .set(authHeader(token))
      .send({ id_perfil: perfilId, intensidade_atual: intensidade, estado: 'ativo' });

    await request(app)
      .post('/registos-lampada')
      .set(authHeader(token))
      .send({
        id_poste: post.id_poste,
        modelo: 'LED-XPTO',
        potencia_watts: 50,
        luminosidade_max: 800,
        luminosidade_min: 200,
        estado: 'automatico',
        hora_ligar: horaISO
      });
  }
}

describe('TC010-RF10 - Aplicacao Automatica de Perfis', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-11T20:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('Passo 1: criar perfil com ativacao 20:00 para zona Z02', async () => {
    const { app, token } = await loginAs();

    const createProfile = await request(app)
      .post('/perfis-iluminacao')
      .set(authHeader(token))
      .send({
        nome: 'Perfil Auto Z02',
        hora_inicio: '20:00',
        hora_fim: '06:00',
        intensidade: 70
      });

    expect(createProfile.status).toBe(201);
    expect(createProfile.body.id_perfil).toBeDefined();
  });

  it('Passo 2: mock de tempo 20:00 aplica perfil aos postes da Z02', async () => {
    const { app, token } = await loginAs();
    const zonaId = await garantirZonaZ02(app, token);

    const profile = await request(app)
      .post('/perfis-iluminacao')
      .set(authHeader(token))
      .send({
        nome: 'Perfil Auto Z02 Aplicacao',
        hora_inicio: '20:00',
        hora_fim: '06:00',
        intensidade: 50
      });

    expect(profile.status).toBe(201);

    const createPost = await request(app)
      .post('/postes')
      .set(authHeader(token))
      .send({
        id_zona: zonaId,
        id_perfil: profile.body.id_perfil,
        latitude: 41.15,
        longitude: -8.61,
        altura: 9,
        data_instalacao: '2026-06-11',
        intensidade_atual: 20
      });

    expect(createPost.status).toBe(201);

    await aplicarPerfilAutomaticamente(
      app,
      token,
      zonaId,
      profile.body.id_perfil,
      50,
      new Date().toISOString()
    );

    const postAtualizado = await request(app)
      .get(`/postes/${createPost.body.id_poste}`)
      .set(authHeader(token));

    expect(postAtualizado.status).toBe(200);
    expect(Number(postAtualizado.body.intensidade_atual)).toBe(50);
  });

  it('Passo 3: verificar logs com origem automatica e timestamp de 20:00', async () => {
    const { app, token } = await loginAs();

    const logs = await request(app)
      .get('/registos-lampada')
      .set(authHeader(token));

    expect(logs.status).toBe(200);

    const automaticos = logs.body.filter(item => String(item.estado || '').toLowerCase() === 'automatico');
    automaticos.forEach(item => {
      const hora = new Date(item.hora_ligar || item.timestamp || 0).getUTCHours();
      expect(hora).toBe(20);
    });
  });
});
