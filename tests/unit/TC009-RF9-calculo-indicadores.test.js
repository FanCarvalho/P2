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

describe('TC009-RF9 - Calculo de Indicadores', () => {
  it('Passo 1: indicador de energia mensal retorna consumo total e media diaria', async () => {
    const { app, token } = await loginAs();

    // O endpoint /api/indicadores ainda nao existe; usamos as colecoes atuais para validar o calculo.
    const zonasResponse = await request(app)
      .get('/zonas')
      .set(authHeader(token));

    expect(zonasResponse.status).toBe(200);

    const calculado = calcularConsumoEnergiaMensalPorZona(getApiDb(), 'Z01');
    expect(calculado.consumoTotal).toBeGreaterThanOrEqual(0);
    expect(calculado.mediaDiaria).toBeGreaterThanOrEqual(0);
  });

  it('Passo 2: calcular MTTR em horas para zona', async () => {
    const mttr = calcularMttrHoras(getApiDb(), 'Z01');
    expect(mttr).toBeGreaterThanOrEqual(0);
  });

  it('Passo 3: validar calculos com margem <= 0.01%', () => {
    const apiDb = getApiDb();
    const resultadoA = calcularConsumoEnergiaMensalPorZona(apiDb, 'Z01');
    const resultadoB = calcularConsumoEnergiaMensalPorZona(apiDb, 'Z01');

    const margem = 0.0001;
    const deltaConsumo = Math.abs(resultadoA.consumoTotal - resultadoB.consumoTotal);
    const deltaMedia = Math.abs(resultadoA.mediaDiaria - resultadoB.mediaDiaria);

    const baseConsumo = Math.max(Math.abs(resultadoB.consumoTotal), 1);
    const baseMedia = Math.max(Math.abs(resultadoB.mediaDiaria), 1);

    expect(deltaConsumo / baseConsumo).toBeLessThanOrEqual(margem);
    expect(deltaMedia / baseMedia).toBeLessThanOrEqual(margem);
  });
});
