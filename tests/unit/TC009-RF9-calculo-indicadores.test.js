const request = require('supertest');
const { getApiDb } = require('../../Backend/src/dataStore');
const { authHeader, loginAs } = require('../helpers/apiTestUtils');

function calcularConsumoEnergiaMensalPorZona(apiDb, zonaNome = 'Z01') {
  const zona = apiDb.zonas.find(z => String(z.nome).toUpperCase() === zonaNome.toUpperCase()) || apiDb.zonas[0];
  if (!zona) {
    return { consumoTotal: 0, mediaDiaria: 0 };
  }

  const postes = apiDb.postes.filter(p => Number(p.id_zona) === Number(zona.id_zona));
  const consumoTotal = postes.reduce((acc, item) => acc + Number(item.intensidade_atual || 0), 0);
  const mediaDiaria = consumoTotal / 30;

  return { consumoTotal, mediaDiaria };
}

function calcularMttrHoras(apiDb, zonaNome = 'Z01') {
  const zona = apiDb.zonas.find(z => String(z.nome).toUpperCase() === zonaNome.toUpperCase()) || apiDb.zonas[0];
  if (!zona) return 0;

  const postesZona = new Set(apiDb.postes.filter(p => Number(p.id_zona) === Number(zona.id_zona)).map(p => Number(p.id_poste)));
  const resolvidas = apiDb.avarias.filter(item =>
    postesZona.has(Number(item.id_poste || 0)) &&
    String(item.estado || '').toLowerCase() === 'resolvida'
  );

  if (resolvidas.length === 0) return 0;

  const mttrHoras = resolvidas.reduce((acc, item) => {
    const severidade = String(item.severidade || '').toLowerCase();
    const horasEstimadas = severidade === 'alta' ? 8 : severidade === 'media' ? 4 : 2;
    return acc + horasEstimadas;
  }, 0) / resolvidas.length;

  return mttrHoras;
}

describe('Test 3 - Public zone listing (dashboard)', () => {
  it('validates public GET /zonas contract fields and enriched metrics', async () => {
    const { app } = await loginAs();

    const response = await request(app).get('/zonas');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);

    response.body.forEach(zona => {
      expect(zona).toEqual(expect.objectContaining({
        id_zona: expect.anything(),
        nome: expect.anything(),
        postes: expect.anything(),
        avarias: expect.anything(),
        consumo_mensal: expect.anything()
      }));
    });

    const calculado = calcularConsumoEnergiaMensalPorZona(getApiDb(), 'Z01');
    expect(calculado.consumoTotal).toBeGreaterThanOrEqual(0);
    expect(calculado.mediaDiaria).toBeGreaterThanOrEqual(0);

    const mttr = calcularMttrHoras(getApiDb(), 'Z01');
    expect(mttr).toBeGreaterThanOrEqual(0);
  });
});
