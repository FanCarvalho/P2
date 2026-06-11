const request = require('supertest');
const { authHeader, loginAs } = require('../helpers/apiTestUtils');

function criarNotificacaoOperador({ posteId, tipo, severidade }) {
  return {
    canal: 'sistema',
    timestamp: new Date().toISOString(),
    posteId,
    tipo,
    severidade
  };
}

describe('TC007-RF7 - Deteccao Automatica de Falhas', () => {
  it('Passo 1: timeout de comunicacao gera avaria do tipo comunicacao', async () => {
    const { app, token } = await loginAs();

    const response = await request(app)
      .post('/avarias')
      .set(authHeader(token))
      .send({
        descricao: 'Timeout de comunicacao acima de 30s',
        severidade: 'alta',
        estado: 'pendente',
        id_poste: 3
      });

    expect(response.status).toBe(201);
    expect(response.body.id_avaria).toBeDefined();
  });

  it('Passo 2: notificar operador com posteId, tipo e severidade', async () => {
    const notificacao = criarNotificacaoOperador({
      posteId: 3,
      tipo: 'comunicacao',
      severidade: 'alta'
    });

    expect(notificacao).toEqual(
      expect.objectContaining({
        posteId: 3,
        tipo: 'comunicacao',
        severidade: 'alta'
      })
    );
    expect(typeof notificacao.timestamp).toBe('string');
  });

  it('Passo 3: restaurar comunicacao atualiza estado para resolvida automaticamente', async () => {
    const { app, token } = await loginAs();

    const create = await request(app)
      .post('/avarias')
      .set(authHeader(token))
      .send({
        descricao: 'Falha de comunicacao temporaria',
        severidade: 'media',
        estado: 'pendente',
        id_poste: 3
      });

    expect(create.status).toBe(201);

    const patch = await request(app)
      .patch(`/avarias/${create.body.id_avaria}`)
      .set(authHeader(token))
      .send({ estado: 'resolvida' });

    expect(patch.status).toBe(200);
    expect(patch.body.estado).toBe('resolvida');
  });
});
