const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { apiDataPath } = require('./config');
const { mysqlConfig } = require('../db');

// Esta camada tenta usar MySQL e, se isso falhar, mantém o fallback em JSON.
const entityTables = {
  operadores: ['operadores'],
  perfisIluminacao: ['perfis_iluminacao', 'perfisiluminacao', 'perfis'],
  sensoresMovimento: ['sensores_movimento', 'sensores'],
  zonas: ['zonas'],
  postes: ['postes'],
  lampadas: ['lampadas'],
  registosLampada: ['registos_lampada', 'registoslampada'],
  agendamentosManutencao: ['agendamentos_manutencao', 'agendamentos'],
  avarias: ['avarias']
};

function createDefaultApiDb() {
  return {
    operadores: [
      {
        id_operador: 1,
        nome: 'Administrador',
        email: 'admin@glowpath.com',
        password: 'admin123',
        nivel_acesso: 'administrador',
        ativo: true
      },
      {
        id_operador: 8,
        nome: 'Joao Silva',
        email: 'joao@empresa.com',
        password: 'joao123',
        nivel_acesso: 'operador',
        ativo: true
      }
    ],
    perfisIluminacao: [
      {
        id_perfil: 1,
        nome: 'Dia',
        hora_inicio: '07:00',
        hora_fim: '19:00',
        intensidade: 80
      },
      {
        id_perfil: 4,
        nome: 'Noite',
        hora_inicio: '20:00',
        hora_fim: '06:00',
        intensidade: 40
      }
    ],
    sensoresMovimento: [
      {
        id_sensor: 3,
        modelo: 'SM-100',
        sensibilidade: 70,
        alcance: 10.5,
        estado: 'ativo',
        ultimo_calibracao: '2026-03-10'
      },
      {
        id_sensor: 5,
        modelo: 'SM-200',
        sensibilidade: 80,
        alcance: 12.5,
        estado: 'ativo',
        ultimo_calibracao: '2026-03-10'
      }
    ],
    zonas: [
      {
        id_zona: 2,
        nome: 'Zona Central',
        rua: 'Avenida Principal',
        codigo_postal: '4000-001',
        id_sensor: 5
      },
      {
        id_zona: 7,
        nome: 'Zona Norte',
        rua: 'Rua Principal',
        codigo_postal: '4420-123',
        id_sensor: 3
      }
    ],
    postes: [
      {
        id_poste: 3,
        estado: 'ativo',
        intensidade_atual: 55,
        latitude: 41.123456,
        longitude: -8.56789,
        altura: 8.2,
        data_instalacao: '2025-03-10',
        id_zona: 7,
        id_perfil: 4
      },
      {
        id_poste: 15,
        estado: 'ativo',
        intensidade_atual: 70,
        latitude: 41.124321,
        longitude: -8.565432,
        altura: 8.5,
        data_instalacao: '2025-03-10',
        id_zona: 2,
        id_perfil: 1
      }
    ],
    lampadas: [
      {
        id_lampada: 1,
        id_poste: 3,
        modelo: 'LED-XPTO',
        estado: 'ativa',
        potencia_watts: 50,
        luminosidade_max: 800,
        luminosidade_min: 200,
        tempo_vida_horas: 50000
      },
      {
        id_lampada: 12,
        id_poste: 15,
        modelo: 'LED-XPTO',
        estado: 'ativa',
        potencia_watts: 50,
        luminosidade_max: 800,
        luminosidade_min: 200,
        tempo_vida_horas: 50000
      }
    ],
    registosLampada: [
      {
        id_registo: 1,
        id_lampada: 1,
        id_poste: 3,
        modelo: 'LED-XPTO',
        hora_ligar: '2026-05-10T20:00:00.000Z',
        hora_desligar: '2026-05-11T06:00:00.000Z',
        luminosidade: 55.2,
        estado: 'ativa',
        potencia_watts: 50,
        luminosidade_max: 800,
        luminosidade_min: 200,
        tempo_vida_horas: 50000
      }
    ],
    agendamentosManutencao: [
      {
        id_agendamento: 22,
        data_manutencao: '2026-06-10',
        descricao: 'Substituicao de lampada',
        prioridade: 'alta',
        estado: 'pendente',
        id_poste: 15
      }
    ],
    avarias: [
      {
        id_avaria: 31,
        descricao: 'Lampada nao acende',
        severidade: 'alta',
        estado: 'pendente',
        id_lampada: 12
      }
    ]
  };
}

function loadJsonDb() {
  if (!fs.existsSync(apiDataPath)) {
    const initialDb = createDefaultApiDb();
    fs.writeFileSync(apiDataPath, JSON.stringify(initialDb, null, 2));
    return initialDb;
  }

  try {
    return JSON.parse(fs.readFileSync(apiDataPath, 'utf8'));
  } catch {
    const fallbackDb = createDefaultApiDb();
    fs.writeFileSync(apiDataPath, JSON.stringify(fallbackDb, null, 2));
    return fallbackDb;
  }
}

let mysqlLoadSnapshot = null;

function runMySqlWorker(mode, payload = null) {
  const workerScript = `
const fs = require('fs');
const mysql = require('mysql2/promise');

  const mode = process.argv[1];
  const config = JSON.parse(process.argv[2]);

const entityTables = ${JSON.stringify(entityTables)};
const entityOrder = ['operadores', 'perfisIluminacao', 'sensoresMovimento', 'zonas', 'postes', 'lampadas', 'registosLampada', 'agendamentosManutencao', 'avarias'];

  const systemDatabases = new Set(['information_schema', 'mysql', 'performance_schema', 'sys']);

function pickTable(existingTables, candidates) {
  const normalized = new Map(existingTables.map(name => [name.toLowerCase(), name]));
  for (const candidate of candidates) {
    const found = normalized.get(candidate.toLowerCase());
    if (found) return found;
  }
  return null;
}

function normalizeValue(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

function normalizeRows(rows) {
  return rows.map(row => {
    const normalized = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[key] = normalizeValue(value);
    }
    return normalized;
  });
}

async function listTableNames(connection) {
  try {
    const [tableRows] = await connection.query('SHOW TABLES');
    return tableRows.map(row => Object.values(row)[0]);
  } catch {
    const [tableRows] = await connection.query('SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()');
    return tableRows.map(row => row.table_name || row.TABLE_NAME || Object.values(row)[0]);
  }
}

async function listColumnNames(connection, table) {
  try {
    const [columns] = await connection.query('SHOW COLUMNS FROM ??', [table]);
    return columns.map(column => column.Field);
  } catch {
    const [columns] = await connection.query(
      'SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ordinal_position',
      [table]
    );
    return columns.map(column => column.column_name || column.COLUMN_NAME || Object.values(column)[0]);
  }
}

async function resolveDatabaseConnection() {
  return mysql.createConnection(config);
}

(async () => {
  const connection = await resolveDatabaseConnection();

  if (mode === 'load') {
    const tableNames = await listTableNames(connection);
    const db = {};

    for (const entity of entityOrder) {
      const table = pickTable(tableNames, entityTables[entity]);
      if (!table) {
        db[entity] = [];
        continue;
      }
      const [rows] = await connection.query('SELECT * FROM ??', [table]);
      db[entity] = normalizeRows(rows);
    }

    process.stdout.write(JSON.stringify(db));
    await connection.end();
    return;
  }

  if (mode === 'save') {
    const db = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
    const tableNames = await listTableNames(connection);

    const tableMap = {};
    for (const entity of entityOrder) {
      tableMap[entity] = pickTable(tableNames, entityTables[entity]);
      if (!tableMap[entity]) {
        throw new Error('Tabela em falta para a entidade: ' + entity);
      }
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const entity of [...entityOrder].reverse()) {
      await connection.query('TRUNCATE TABLE ??', [tableMap[entity]]);
    }

    for (const entity of entityOrder) {
      const table = tableMap[entity];
      const rows = Array.isArray(db[entity]) ? db[entity] : [];
      if (!rows.length) continue;

      const columnNames = await listColumnNames(connection, table);
      const values = rows.map(row => columnNames.map(columnName => normalizeValue(row[columnName])));
      await connection.query('INSERT INTO ?? (??) VALUES ?', [table, columnNames, values]);
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    await connection.end();
    process.stdout.write('ok');
    return;
  }

  throw new Error('Modo desconhecido');
})().catch(error => {
  console.error(error.message);
  process.exit(1);
});
`;

  const result = spawnSync(process.execPath, ['-e', workerScript, mode, JSON.stringify(mysqlConfig)], {
    input: payload === null ? '' : JSON.stringify(payload),
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    cwd: path.resolve(__dirname, '..')
  });

  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || '').trim();
    throw new Error(message || 'MySQL worker failed');
  }

  return result.stdout.trim();
}

function loadApiDb() {
  try {
    if (dbConfig.host && dbConfig.user) {
      const output = runMySqlWorker('load');
      if (output) {
        mysqlLoadSnapshot = output;
        return JSON.parse(output);
      }
    }
  } catch {
    // Se a ligação MySQL falhar, mantemos o comportamento local em JSON.
  }

  return loadJsonDb();
}

let apiDb = loadApiDb();
const usingMySql = Boolean(mysqlLoadSnapshot);

function saveJsonDb() {
  fs.writeFileSync(apiDataPath, JSON.stringify(apiDb, null, 2));
}

function saveApiDb() {
  if (usingMySql) {
    try {
      runMySqlWorker('save', apiDb);
      saveJsonDb();
      return;
    } catch {
      // Se a gravação no MySQL falhar, guardamos localmente para não perder dados.
    }
  }

  saveJsonDb();
}

function getApiDb() {
  return apiDb;
}

function isUsingMySql() {
  return usingMySql;
}

module.exports = {
  createDefaultApiDb,
  getApiDb,
  isUsingMySql,
  saveApiDb
};
