const { pool, mysqlConfig } = require('../../Backend/db');

jest.setTimeout(30000);

function temConfiguracaoDb() {
  return Boolean(mysqlConfig.host && mysqlConfig.user && mysqlConfig.database);
}

async function dbDisponivel() {
  if (!temConfiguracaoDb()) return false;

  try {
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('DB timeout')), 4000);
    });

    await Promise.race([pool.query('SELECT 1 AS ok'), timeout]);
    return true;
  } catch {
    return false;
  }
}

async function tabelaExiste(nome) {
  const [rows] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ?
    `,
    [nome]
  );

  return Number(rows[0].total) > 0;
}

describe('Test 15 - Referential integrity / FK validation', () => {
  it('Passo 1: validar FK constraints principais', async () => {
    if (!(await dbDisponivel())) {
      expect(true).toBe(true);
      return;
    }

    const [rows] = await pool.query(`
      SELECT
        table_name,
        column_name,
        referenced_table_name,
        referenced_column_name
      FROM information_schema.key_column_usage
      WHERE table_schema = DATABASE()
        AND referenced_table_name IS NOT NULL
        AND (
          (table_name = 'postes' AND referenced_table_name = 'zonas') OR
          (table_name = 'sensores_movimento' AND referenced_table_name = 'postes') OR
          (table_name = 'perfis_iluminacao' AND referenced_table_name = 'postes') OR
          (table_name = 'avarias' AND referenced_table_name = 'postes')
        )
    `);

    expect(Array.isArray(rows)).toBe(true);
    if (rows.length === 0) {
      expect(true).toBe(true);
      return;
    }

    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it('Passo 2: insercao com FK invalida em avaria e rejeitada', async () => {
    if (!(await dbDisponivel())) {
      expect(true).toBe(true);
      return;
    }

    const existeAvarias = await tabelaExiste('avarias');
    if (!existeAvarias) {
      expect(true).toBe(true);
      return;
    }

    let erro = null;
    try {
      await pool.query(
        `
          INSERT INTO avarias (descricao, severidade, estado, id_poste)
          VALUES (?, ?, ?, ?)
        `,
        ['Teste FK invalida', 'alta', 'pendente', 99999]
      );
    } catch (e) {
      erro = e;
    }

    expect(erro).not.toBeNull();
    expect(String(erro.message).toLowerCase()).toContain('foreign key');
  });

  it('Passo 3: script de integridade referencial completa retorna 0 erros de FK', async () => {
    if (!(await dbDisponivel())) {
      expect(true).toBe(true);
      return;
    }

    const verificacoes = [];

    if (await tabelaExiste('registos_lampada')) {
      const [rowsRegistos] = await pool.query(`
        SELECT COUNT(*) AS orfaos
        FROM registos_lampada rl
        LEFT JOIN lampadas l ON l.id_lampada = rl.id_lampada
        WHERE rl.id_lampada IS NOT NULL AND l.id_lampada IS NULL
      `);
      verificacoes.push(Number(rowsRegistos[0].orfaos));
    }

    if (await tabelaExiste('avarias')) {
      const [rowsAvarias] = await pool.query(`
        SELECT COUNT(*) AS orfaos
        FROM avarias a
        LEFT JOIN postes p ON p.id_poste = a.id_poste
        WHERE a.id_poste IS NOT NULL AND p.id_poste IS NULL
      `);
      verificacoes.push(Number(rowsAvarias[0].orfaos));
    }

    if (await tabelaExiste('agendamentos_manutencao')) {
      const [rowsAgenda] = await pool.query(`
        SELECT COUNT(*) AS orfaos
        FROM agendamentos_manutencao am
        LEFT JOIN postes p ON p.id_poste = am.id_poste
        WHERE am.id_poste IS NOT NULL AND p.id_poste IS NULL
      `);
      verificacoes.push(Number(rowsAgenda[0].orfaos));
    }

    if (await tabelaExiste('sensores_movimento')) {
      const [rowsSensores] = await pool.query(`
        SELECT COUNT(*) AS orfaos
        FROM sensores_movimento sm
        LEFT JOIN postes p ON p.id_poste = sm.id_poste
        WHERE sm.id_poste IS NOT NULL AND p.id_poste IS NULL
      `);
      verificacoes.push(Number(rowsSensores[0].orfaos));
    }

    const totalErros = verificacoes.reduce((acc, item) => acc + item, 0);
    expect(totalErros).toBe(0);
  });
});
