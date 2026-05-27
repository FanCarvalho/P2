const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnv(path.join(__dirname, '.env'));

const host = '127.0.0.1';
const port = 3000;
const rootDir = __dirname;
const apiDataPath = path.join(rootDir, 'api-data.json');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
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

function loadApiDb() {
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

let apiDb = loadApiDb();
const authTokens = new Map();

function saveApiDb() {
  fs.writeFileSync(apiDataPath, JSON.stringify(apiDb, null, 2));
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(payload === undefined ? '' : JSON.stringify(payload, null, 2));
}

function sendNoContent(res) {
  res.writeHead(204);
  res.end();
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  const stream = fs.createReadStream(filePath);

  stream.on('error', () => {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 - File not found');
  });

  res.writeHead(200, { 'Content-Type': contentType });
  stream.pipe(res);
}

function resolveStaticFile(requestPath) {
  let pathname = decodeURIComponent(requestPath.split('?')[0]);
  if (pathname === '/') pathname = '/login.html';

  const normalizedPath = path.normalize(pathname).replace(/^([.]{2}[\/])+/, '');
  const filePath = path.join(rootDir, normalizedPath);

  if (!filePath.startsWith(rootDir)) return null;
  return filePath;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1_000_000) {
        reject(new Error('Body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function getPathParts(req) {
  const url = new URL(req.url, 'http://127.0.0.1');
  return {
    pathname: url.pathname,
    searchParams: url.searchParams,
    query: Object.fromEntries(url.searchParams.entries())
  };
}

function parseInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function nextId(list, key) {
  return list.reduce((max, item) => Math.max(max, Number(item[key]) || 0), 0) + 1;
}

function operatorPublic(operator) {
  if (!operator) return null;
  return {
    id_operador: operator.id_operador,
    nome: operator.nome,
    email: operator.email,
    nivel_acesso: operator.nivel_acesso,
    ativo: operator.ativo
  };
}

function authHeaders(req) {
  return req.headers.authorization || req.headers.Authorization || '';
}

function requireAuth(req, res) {
  const header = authHeaders(req);
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    sendJson(res, 401, {
      description: 'Authentication failed',
      errors: { authorization: ['Bearer token is required'] }
    });
    return null;
  }

  const token = match[1].trim();
  const operatorId = authTokens.get(token);
  if (!operatorId) {
    sendJson(res, 401, {
      description: 'Authentication failed',
      errors: { authorization: ['Invalid or expired token'] }
    });
    return null;
  }

  const operator = apiDb.operadores.find(item => item.id_operador === operatorId);
  if (!operator || operator.ativo === false) {
    sendJson(res, 401, {
      description: 'Authentication failed',
      errors: { authorization: ['Invalid or inactive user'] }
    });
    return null;
  }

  return operator;
}

function badRequest(res, errors, description = 'Validation failed') {
  sendJson(res, 400, { description, errors });
}

function notFound(res, resource = 'Resource') {
  sendJson(res, 404, { description: `${resource} not found` });
}

function conflict(res, errors, description = 'Resource conflict') {
  sendJson(res, 409, { description, errors });
}

function paginate(list, query, defaultLimit = 20) {
  const limit = Math.max(1, parseInteger(query.limit) || defaultLimit);
  if (query.offset !== undefined) {
    const offset = Math.max(0, parseInteger(query.offset) || 0);
    return list.slice(offset, offset + limit);
  }

  const page = Math.max(1, parseInteger(query.page) || 1);
  const start = (page - 1) * limit;
  return list.slice(start, start + limit);
}

function removeById(list, key, id) {
  const index = list.findIndex(item => Number(item[key]) === Number(id));
  if (index === -1) return null;
  return list.splice(index, 1)[0];
}

function validateBody(requiredFields, body) {
  const errors = {};
  for (const [field, rules] of Object.entries(requiredFields)) {
    const value = body[field];
    const messages = [];

    if (rules.required && (value === undefined || value === null || value === '')) {
      messages.push(`${rules.label || field} is mandatory.`);
    }

    if (value !== undefined && value !== null && value !== '') {
      if (rules.type === 'number' && Number.isNaN(Number(value))) {
        messages.push(`${rules.label || field} must be a valid number.`);
      }
      if (rules.type === 'integer' && !Number.isInteger(Number(value))) {
        messages.push(`${rules.label || field} must be an integer.`);
      }
      if (rules.type === 'boolean' && typeof value !== 'boolean') {
        messages.push(`${rules.label || field} must be a boolean.`);
      }
      if (rules.minLength && String(value).length < rules.minLength) {
        messages.push(`${rules.label || field} must have at least ${rules.minLength} characters.`);
      }
      if (rules.pattern && !rules.pattern.test(String(value))) {
        messages.push(rules.patternMessage || `${rules.label || field} is invalid.`);
      }
      if (rules.enum && !rules.enum.includes(String(value))) {
        messages.push(`${rules.label || field} must be one of: ${rules.enum.join(', ')}.`);
      }
    }

    if (messages.length > 0) {
      errors[field] = messages;
    }
  }

  return errors;
}

function toPublicLamp(lamp) { return lamp; }
function toPublicProfile(profile) { return profile; }
function toPublicZone(zone) { return zone; }
function toPublicSensor(sensor) { return sensor; }
function toPublicPost(post) { return post; }
function toPublicMaintenance(item) { return item; }
function toPublicFault(item) { return item; }

function tokenResponse(operator) {
  const token = crypto.randomBytes(24).toString('hex');
  authTokens.set(token, operator.id_operador);
  return token;
}

function matchesLampFilter(lamp, query) {
  if (query.id_poste !== undefined && Number(lamp.id_poste) !== Number(query.id_poste)) return false;
  return true;
}

function matchesPostFilter(post, query) {
  if (query.id_zona !== undefined && Number(post.id_zona) !== Number(query.id_zona)) return false;
  if (query.id_perfil !== undefined && Number(post.id_perfil) !== Number(query.id_perfil)) return false;
  if (query.estado !== undefined && String(post.estado).toLowerCase() !== String(query.estado).toLowerCase()) return false;
  return true;
}

function matchesSensorFilter(sensor, query) {
  if (query.estado !== undefined && String(sensor.estado).toLowerCase() !== String(query.estado).toLowerCase()) return false;
  return true;
}

function matchesZoneFilter(zone, query) {
  if (query.nome !== undefined && !String(zone.nome).toLowerCase().includes(String(query.nome).toLowerCase())) return false;
  if (query.codigo_postal !== undefined && String(zone.codigo_postal).toLowerCase() !== String(query.codigo_postal).toLowerCase()) return false;
  if (query.id_sensor !== undefined && Number(zone.id_sensor) !== Number(query.id_sensor)) return false;
  return true;
}

function matchesProfileFilter(profile, query) {
  if (query.nome !== undefined && !String(profile.nome).toLowerCase().includes(String(query.nome).toLowerCase())) return false;
  if (query.intensidade !== undefined && Number(profile.intensidade) !== Number(query.intensidade)) return false;
  return true;
}

function matchesOperatorFilter(operator, query) {
  if (query.nome !== undefined && !String(operator.nome).toLowerCase().includes(String(query.nome).toLowerCase())) return false;
  if (query.nivel_acesso !== undefined && String(operator.nivel_acesso).toLowerCase() !== String(query.nivel_acesso).toLowerCase()) return false;
  if (query.ativo !== undefined && String(operator.ativo).toLowerCase() !== String(query.ativo).toLowerCase()) return false;
  return true;
}

function matchesMaintenanceFilter(item, query) {
  if (query.estado !== undefined && String(item.estado).toLowerCase() !== String(query.estado).toLowerCase()) return false;
  if (query.prioridade !== undefined && String(item.prioridade).toLowerCase() !== String(query.prioridade).toLowerCase()) return false;
  if (query.id_poste !== undefined && Number(item.id_poste || 0) !== Number(query.id_poste)) return false;
  if (query.id_lampada !== undefined && Number(item.id_lampada || 0) !== Number(query.id_lampada)) return false;
  if (query.id_zona !== undefined && Number(item.id_zona || 0) !== Number(query.id_zona)) return false;
  return true;
}

function matchesFaultFilter(item, query) {
  if (query.estado !== undefined && String(item.estado).toLowerCase() !== String(query.estado).toLowerCase()) return false;
  if (query.severidade !== undefined && String(item.severidade).toLowerCase() !== String(query.severidade).toLowerCase()) return false;
  if (query.id_poste !== undefined && Number(item.id_poste || 0) !== Number(query.id_poste)) return false;
  if (query.id_lampada !== undefined && Number(item.id_lampada || 0) !== Number(query.id_lampada)) return false;
  if (query.id_zona !== undefined && Number(item.id_zona || 0) !== Number(query.id_zona)) return false;
  return true;
}

function handleLogin(req, res) {
  return readBody(req)
    .then(body => {
      const errors = validateBody(
        {
          email: { required: true, label: 'Email' },
          password: { required: true, label: 'Password' }
        },
        body
      );

      if (body.email && !String(body.email).includes('@')) {
        errors.email = [...(errors.email || []), 'Email must be a valid email address.'];
      }

      if (Object.keys(errors).length > 0) {
        badRequest(res, errors);
        return;
      }

      const operator = apiDb.operadores.find(item => item.email.toLowerCase() === String(body.email).toLowerCase());
      if (!operator || operator.password !== String(body.password)) {
        sendJson(res, 401, {
          description: 'Authentication failed',
          errors: { credentials: ['Invalid email or password'] }
        });
        return;
      }

      const token = tokenResponse(operator);
      sendJson(res, 200, {
        accessToken: token,
        operator: operatorPublic(operator),
        _links: {
          self: { href: `/operadores/${operator.id_operador}` },
          operadores: { href: '/operadores' }
        }
      });
    })
    .catch(error => badRequest(res, { body: [error.message] }));
}

function createOperator(req, res) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  readBody(req)
    .then(body => {
      const errors = validateBody(
        {
          nome: { required: true, label: 'Nome' },
          email: { required: true, label: 'Email' },
          password: { required: true, label: 'Password', minLength: 10 },
          nivel_acesso: { required: true, label: 'Nivel de acesso' }
        },
        body
      );

      if (body.email && !String(body.email).includes('@')) {
        errors.email = [...(errors.email || []), 'Email must be a valid email address.'];
      }

      if (Object.keys(errors).length > 0) {
        badRequest(res, errors);
        return;
      }

      if (apiDb.operadores.some(item => item.email.toLowerCase() === String(body.email).toLowerCase())) {
        conflict(res, { email: ['A user with this email already exists'] });
        return;
      }

      const operador = {
        id_operador: nextId(apiDb.operadores, 'id_operador'),
        nome: String(body.nome),
        email: String(body.email),
        password: String(body.password),
        nivel_acesso: String(body.nivel_acesso),
        ativo: body.ativo === undefined ? true : Boolean(body.ativo)
      };

      apiDb.operadores.push(operador);
      saveApiDb();

      sendJson(res, 201, {
        id_operador: operador.id_operador,
        _links: {
          self: { href: `/operadores/${operador.id_operador}` },
          nivel_acesso: { href: `/niveis-acesso/${encodeURIComponent(operador.nivel_acesso)}/operadores` }
        }
      });
    })
    .catch(error => badRequest(res, { body: [error.message] }));
}

function listOperators(req, res, query) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const operators = paginate(apiDb.operadores.filter(item => matchesOperatorFilter(item, query)).map(operatorPublic), query);
  sendJson(res, 200, operators);
}

function getOperator(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const operator = apiDb.operadores.find(item => item.id_operador === Number(id));
  if (!operator) {
    notFound(res, 'Operador');
    return;
  }

  sendJson(res, 200, operatorPublic(operator));
}

function patchOperator(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  readBody(req)
    .then(body => {
      const operator = apiDb.operadores.find(item => item.id_operador === Number(id));
      if (!operator) {
        notFound(res, 'Operador');
        return;
      }

      if (body.email !== undefined && String(body.email).includes('@') === false) {
        badRequest(res, { email: ['Email must be a valid email address.'] });
        return;
      }

      if (body.email !== undefined) {
        const duplicate = apiDb.operadores.find(item => item.email.toLowerCase() === String(body.email).toLowerCase() && item.id_operador !== operator.id_operador);
        if (duplicate) {
          conflict(res, { email: ['A user with this email already exists'] });
          return;
        }
      }

      if (body.nome !== undefined) operator.nome = String(body.nome);
      if (body.email !== undefined) operator.email = String(body.email);
      if (body.password !== undefined) operator.password = String(body.password);
      if (body.nivel_acesso !== undefined) operator.nivel_acesso = String(body.nivel_acesso);
      if (body.ativo !== undefined) operator.ativo = Boolean(body.ativo);

      saveApiDb();
      sendJson(res, 200, { message: 'Operador atualizado com sucesso' });
    })
    .catch(error => badRequest(res, { body: [error.message] }));
}

function deleteOperator(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const removed = removeById(apiDb.operadores, 'id_operador', id);
  if (!removed) {
    notFound(res, 'Operador');
    return;
  }

  saveApiDb();
  sendNoContent(res);
}

function listOperatorsByLevel(req, res, nivel) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const operators = apiDb.operadores.filter(item => String(item.nivel_acesso).toLowerCase() === String(nivel).toLowerCase()).map(operatorPublic);
  sendJson(res, 200, operators);
}

function createProfile(req, res) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  readBody(req)
    .then(body => {
      const errors = validateBody(
        {
          nome: { required: true, label: 'Nome' },
          hora_inicio: { required: true, label: 'Hora inicio' },
          hora_fim: { required: true, label: 'Hora fim' },
          intensidade: { required: true, label: 'Intensidade', type: 'number' }
        },
        body
      );

      if (Object.keys(errors).length > 0) {
        badRequest(res, errors);
        return;
      }

      const perfil = {
        id_perfil: nextId(apiDb.perfisIluminacao, 'id_perfil'),
        nome: String(body.nome),
        hora_inicio: String(body.hora_inicio),
        hora_fim: String(body.hora_fim),
        intensidade: Number(body.intensidade)
      };

      apiDb.perfisIluminacao.push(perfil);
      saveApiDb();

      sendJson(res, 201, {
        id_perfil: perfil.id_perfil,
        _links: { self: { href: `/perfis-iluminacao/${perfil.id_perfil}` } }
      });
    })
    .catch(error => badRequest(res, { body: [error.message] }));
}

function listProfiles(req, res, query) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const profiles = paginate(apiDb.perfisIluminacao.filter(item => matchesProfileFilter(item, query)), query);
  sendJson(res, 200, profiles.map(toPublicProfile));
}

function getProfile(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const profile = apiDb.perfisIluminacao.find(item => item.id_perfil === Number(id));
  if (!profile) {
    notFound(res, 'Perfil');
    return;
  }

  sendJson(res, 200, toPublicProfile(profile));
}

function patchProfile(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  readBody(req)
    .then(body => {
      const profile = apiDb.perfisIluminacao.find(item => item.id_perfil === Number(id));
      if (!profile) {
        notFound(res, 'Perfil');
        return;
      }

      if (body.nome !== undefined) profile.nome = String(body.nome);
      if (body.hora_inicio !== undefined) profile.hora_inicio = String(body.hora_inicio);
      if (body.hora_fim !== undefined) profile.hora_fim = String(body.hora_fim);
      if (body.intensidade !== undefined) profile.intensidade = Number(body.intensidade);

      saveApiDb();
      sendJson(res, 200, { message: 'Perfil atualizado com sucesso' });
    })
    .catch(error => badRequest(res, { body: [error.message] }));
}

function deleteProfile(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const inUse = apiDb.postes.some(post => Number(post.id_perfil) === Number(id));
  if (inUse) {
    conflict(res, { id_perfil: ['Perfil em uso'] });
    return;
  }

  const removed = removeById(apiDb.perfisIluminacao, 'id_perfil', id);
  if (!removed) {
    notFound(res, 'Perfil');
    return;
  }

  saveApiDb();
  sendNoContent(res);
}

function listProfilePosts(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const profile = apiDb.perfisIluminacao.find(item => item.id_perfil === Number(id));
  if (!profile) {
    notFound(res, 'Perfil');
    return;
  }

  const posts = apiDb.postes.filter(post => Number(post.id_perfil) === Number(id)).map(post => ({ id_poste: post.id_poste, estado: post.estado, intensidade_atual: post.intensidade_atual }));
  sendJson(res, 200, posts);
}

function createSensor(req, res) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  readBody(req)
    .then(body => {
      const errors = validateBody(
        {
          modelo: { required: true, label: 'Modelo' },
          sensibilidade: { required: true, label: 'Sensibilidade', type: 'number' },
          alcance: { required: true, label: 'Alcance', type: 'number' }
        },
        body
      );

      if (Object.keys(errors).length > 0) {
        badRequest(res, errors);
        return;
      }

      const sensor = {
        id_sensor: nextId(apiDb.sensoresMovimento, 'id_sensor'),
        modelo: String(body.modelo),
        sensibilidade: Number(body.sensibilidade),
        alcance: Number(body.alcance),
        estado: body.estado !== undefined ? String(body.estado) : 'ativo',
        ultimo_calibracao: body.ultimo_calibracao !== undefined ? String(body.ultimo_calibracao) : new Date().toISOString().slice(0, 10)
      };

      apiDb.sensoresMovimento.push(sensor);
      saveApiDb();

      sendJson(res, 201, {
        id_sensor: sensor.id_sensor,
        _links: { self: { href: `/sensores-movimento/${sensor.id_sensor}` } }
      });
    })
    .catch(error => badRequest(res, { body: [error.message] }));
}

function listSensors(req, res, query) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const sensors = paginate(apiDb.sensoresMovimento.filter(item => matchesSensorFilter(item, query)), query);
  sendJson(res, 200, sensors.map(toPublicSensor));
}

function getSensor(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const sensor = apiDb.sensoresMovimento.find(item => item.id_sensor === Number(id));
  if (!sensor) {
    notFound(res, 'Sensor');
    return;
  }

  sendJson(res, 200, toPublicSensor(sensor));
}

function patchSensor(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  readBody(req)
    .then(body => {
      const sensor = apiDb.sensoresMovimento.find(item => item.id_sensor === Number(id));
      if (!sensor) {
        notFound(res, 'Sensor');
        return;
      }

      if (body.modelo !== undefined) sensor.modelo = String(body.modelo);
      if (body.sensibilidade !== undefined) sensor.sensibilidade = Number(body.sensibilidade);
      if (body.alcance !== undefined) sensor.alcance = Number(body.alcance);
      if (body.estado !== undefined) sensor.estado = String(body.estado);
      if (body.ultimo_calibracao !== undefined) sensor.ultimo_calibracao = String(body.ultimo_calibracao);

      saveApiDb();
      sendJson(res, 200, { message: 'Sensor atualizado com sucesso' });
    })
    .catch(error => badRequest(res, { body: [error.message] }));
}

function deleteSensor(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const inUse = apiDb.zonas.some(zone => Number(zone.id_sensor) === Number(id));
  if (inUse) {
    conflict(res, { id_sensor: ['Sensor associado a uma zona'] });
    return;
  }

  const removed = removeById(apiDb.sensoresMovimento, 'id_sensor', id);
  if (!removed) {
    notFound(res, 'Sensor');
    return;
  }

  saveApiDb();
  sendNoContent(res);
}

function listSensorZones(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const sensor = apiDb.sensoresMovimento.find(item => item.id_sensor === Number(id));
  if (!sensor) {
    notFound(res, 'Sensor');
    return;
  }

  const zones = apiDb.zonas.filter(zone => Number(zone.id_sensor) === Number(id)).map(zone => ({ id_zona: zone.id_zona, nome: zone.nome }));
  sendJson(res, 200, zones);
}

function createZone(req, res) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  readBody(req)
    .then(body => {
      const errors = validateBody(
        {
          nome: { required: true, label: 'Nome' },
          rua: { required: true, label: 'Rua' },
          codigo_postal: { required: true, label: 'Codigo postal' }
        },
        body
      );

      if (Object.keys(errors).length > 0) {
        badRequest(res, errors);
        return;
      }

      if (body.id_sensor !== undefined && !apiDb.sensoresMovimento.some(item => item.id_sensor === Number(body.id_sensor))) {
        badRequest(res, { id_sensor: ['Referenced sensor does not exist.'] });
        return;
      }

      const zone = {
        id_zona: nextId(apiDb.zonas, 'id_zona'),
        nome: String(body.nome),
        rua: String(body.rua),
        codigo_postal: String(body.codigo_postal),
        id_sensor: body.id_sensor !== undefined ? Number(body.id_sensor) : null
      };

      apiDb.zonas.push(zone);
      saveApiDb();

      sendJson(res, 201, {
        id_zona: zone.id_zona,
        _links: {
          self: { href: `/zonas/${zone.id_zona}` },
          sensor: zone.id_sensor ? { href: `/sensores-movimento/${zone.id_sensor}` } : null
        }
      });
    })
    .catch(error => badRequest(res, { body: [error.message] }));
}

function listZones(req, res, query) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const zones = paginate(apiDb.zonas.filter(item => matchesZoneFilter(item, query)), query);
  sendJson(res, 200, zones.map(toPublicZone));
}

function getZone(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const zone = apiDb.zonas.find(item => item.id_zona === Number(id));
  if (!zone) {
    notFound(res, 'Zona');
    return;
  }

  sendJson(res, 200, toPublicZone(zone));
}

function patchZone(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  readBody(req)
    .then(body => {
      const zone = apiDb.zonas.find(item => item.id_zona === Number(id));
      if (!zone) {
        notFound(res, 'Zona');
        return;
      }

      if (body.id_sensor !== undefined && body.id_sensor !== null && !apiDb.sensoresMovimento.some(item => item.id_sensor === Number(body.id_sensor))) {
        badRequest(res, { id_sensor: ['Referenced sensor does not exist.'] });
        return;
      }

      if (body.nome !== undefined) zone.nome = String(body.nome);
      if (body.rua !== undefined) zone.rua = String(body.rua);
      if (body.codigo_postal !== undefined) zone.codigo_postal = String(body.codigo_postal);
      if (body.id_sensor !== undefined) zone.id_sensor = Number(body.id_sensor);

      saveApiDb();
      sendJson(res, 200, { message: 'Zona atualizada com sucesso' });
    })
    .catch(error => badRequest(res, { body: [error.message] }));
}

function deleteZone(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const removed = removeById(apiDb.zonas, 'id_zona', id);
  if (!removed) {
    notFound(res, 'Zona');
    return;
  }

  saveApiDb();
  sendNoContent(res);
}

function listZonePosts(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const zone = apiDb.zonas.find(item => item.id_zona === Number(id));
  if (!zone) {
    notFound(res, 'Zona');
    return;
  }

  const posts = apiDb.postes.filter(post => Number(post.id_zona) === Number(id)).map(post => ({ id_poste: post.id_poste, estado: post.estado, intensidade_atual: post.intensidade_atual }));
  sendJson(res, 200, posts);
}

function createPost(req, res) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  readBody(req)
    .then(body => {
      const errors = validateBody(
        {
          id_zona: { required: true, label: 'Id zona', type: 'integer' },
          id_perfil: { required: true, label: 'Id perfil', type: 'integer' },
          latitude: { required: true, label: 'Latitude', type: 'number' },
          longitude: { required: true, label: 'Longitude', type: 'number' },
          altura: { required: true, label: 'Altura', type: 'number' },
          data_instalacao: { required: true, label: 'Data instalacao' }
        },
        body
      );

      if (Object.keys(errors).length > 0) {
        badRequest(res, errors);
        return;
      }

      const zone = apiDb.zonas.find(item => item.id_zona === Number(body.id_zona));
      const profile = apiDb.perfisIluminacao.find(item => item.id_perfil === Number(body.id_perfil));
      if (!zone) {
        badRequest(res, { id_zona: ['Referenced zone does not exist.'] });
        return;
      }
      if (!profile) {
        badRequest(res, { id_perfil: ['Referenced profile does not exist.'] });
        return;
      }

      const post = {
        id_poste: nextId(apiDb.postes, 'id_poste'),
        estado: body.estado !== undefined ? String(body.estado) : 'ativo',
        intensidade_atual: body.intensidade_atual !== undefined ? Number(body.intensidade_atual) : Number(profile.intensidade),
        latitude: Number(body.latitude),
        longitude: Number(body.longitude),
        altura: Number(body.altura),
        data_instalacao: String(body.data_instalacao),
        id_zona: Number(body.id_zona),
        id_perfil: Number(body.id_perfil)
      };

      apiDb.postes.push(post);
      saveApiDb();

      sendJson(res, 201, {
        id_poste: post.id_poste,
        _links: {
          self: { href: `/postes/${post.id_poste}` },
          zona: { href: `/zonas/${post.id_zona}` },
          perfil: { href: `/perfis-iluminacao/${post.id_perfil}` }
        }
      });
    })
    .catch(error => badRequest(res, { body: [error.message] }));
}

function listPosts(req, res, query) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const posts = paginate(apiDb.postes.filter(item => matchesPostFilter(item, query)), query);
  sendJson(res, 200, posts.map(toPublicPost));
}

function getPost(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const post = apiDb.postes.find(item => item.id_poste === Number(id));
  if (!post) {
    notFound(res, 'Poste');
    return;
  }

  sendJson(res, 200, toPublicPost(post));
}

function patchPost(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  readBody(req)
    .then(body => {
      const post = apiDb.postes.find(item => item.id_poste === Number(id));
      if (!post) {
        notFound(res, 'Poste');
        return;
      }

      if (body.id_perfil !== undefined && !apiDb.perfisIluminacao.some(item => item.id_perfil === Number(body.id_perfil))) {
        badRequest(res, { id_perfil: ['Referenced profile does not exist.'] });
        return;
      }

      if (body.estado !== undefined) post.estado = String(body.estado);
      if (body.intensidade_atual !== undefined) post.intensidade_atual = Number(body.intensidade_atual);
      if (body.id_perfil !== undefined) post.id_perfil = Number(body.id_perfil);

      saveApiDb();
      sendJson(res, 200, {
        id_poste: post.id_poste,
        estado: post.estado,
        intensidade_atual: post.intensidade_atual,
        _links: { self: { href: `/postes/${post.id_poste}` } }
      });
    })
    .catch(error => badRequest(res, { body: [error.message] }));
}

function deletePost(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const hasDependencies = apiDb.lampadas.some(item => Number(item.id_poste) === Number(id)) || apiDb.agendamentosManutencao.some(item => Number(item.id_poste || 0) === Number(id)) || apiDb.avarias.some(item => Number(item.id_poste || 0) === Number(id));
  if (hasDependencies) {
    conflict(res, { id_poste: ['Poste has dependent resources'] });
    return;
  }

  const removed = removeById(apiDb.postes, 'id_poste', id);
  if (!removed) {
    notFound(res, 'Poste');
    return;
  }

  saveApiDb();
  sendNoContent(res);
}

function listPostAgendamentos(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const post = apiDb.postes.find(item => item.id_poste === Number(id));
  if (!post) {
    notFound(res, 'Poste');
    return;
  }

  const items = apiDb.agendamentosManutencao
    .filter(item => Number(item.id_poste || 0) === Number(id))
    .map(item => ({
      id_agendamento: item.id_agendamento,
      data_manutencao: item.data_manutencao,
      descricao: item.descricao,
      prioridade: item.prioridade,
      estado: item.estado
    }));

  sendJson(res, 200, items);
}

function listPostFaultsById(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const post = apiDb.postes.find(item => item.id_poste === Number(id));
  if (!post) {
    notFound(res, 'Poste');
    return;
  }

  const items = apiDb.avarias
    .filter(item => Number(item.id_poste || 0) === Number(id))
    .map(item => ({ id_avaria: item.id_avaria, descricao: item.descricao, severidade: item.severidade, estado: item.estado }));

  sendJson(res, 200, items);
}

function createLamp(req, res) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  readBody(req)
    .then(body => {
      const errors = validateBody(
        {
          id_poste: { required: true, label: 'Id poste', type: 'integer' },
          modelo: { required: true, label: 'Modelo' },
          potencia_watts: { required: true, label: 'Potencia watts', type: 'number' },
          luminosidade_max: { required: true, label: 'Luminosidade max', type: 'number' },
          luminosidade_min: { required: true, label: 'Luminosidade min', type: 'number' }
        },
        body
      );

      if (Object.keys(errors).length > 0) {
        badRequest(res, errors);
        return;
      }

      if (!apiDb.postes.some(item => item.id_poste === Number(body.id_poste))) {
        badRequest(res, { id_poste: ['Referenced post does not exist.'] });
        return;
      }

      const lamp = {
        id_lampada: nextId(apiDb.lampadas, 'id_lampada'),
        id_poste: Number(body.id_poste),
        modelo: String(body.modelo),
        estado: body.estado !== undefined ? String(body.estado) : 'ativa',
        potencia_watts: Number(body.potencia_watts),
        luminosidade_max: Number(body.luminosidade_max),
        luminosidade_min: Number(body.luminosidade_min),
        tempo_vida_horas: body.tempo_vida_horas !== undefined ? Number(body.tempo_vida_horas) : null
      };

      apiDb.lampadas.push(lamp);
      saveApiDb();

      sendJson(res, 201, {
        id_lampada: lamp.id_lampada,
        _links: {
          self: { href: `/lampadas/${lamp.id_lampada}` },
          poste: { href: `/postes/${lamp.id_poste}` }
        }
      });
    })
    .catch(error => badRequest(res, { body: [error.message] }));
}

function listLamps(req, res, query) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const lamps = paginate(apiDb.lampadas.filter(item => matchesLampFilter(item, query)), query);
  sendJson(res, 200, lamps.map(toPublicLamp));
}

function getLamp(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const lamp = apiDb.lampadas.find(item => item.id_lampada === Number(id));
  if (!lamp) {
    notFound(res, 'Lampada');
    return;
  }

  sendJson(res, 200, toPublicLamp(lamp));
}

function patchLamp(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  readBody(req)
    .then(body => {
      const lamp = apiDb.lampadas.find(item => item.id_lampada === Number(id));
      if (!lamp) {
        notFound(res, 'Lampada');
        return;
      }

      if (body.estado !== undefined) lamp.estado = String(body.estado);
      if (body.potencia_watts !== undefined) lamp.potencia_watts = Number(body.potencia_watts);
      if (body.luminosidade_max !== undefined) lamp.luminosidade_max = Number(body.luminosidade_max);
      if (body.luminosidade_min !== undefined) lamp.luminosidade_min = Number(body.luminosidade_min);

      saveApiDb();
      sendJson(res, 200, {
        id_lampada: lamp.id_lampada,
        estado: lamp.estado,
        _links: { self: { href: `/lampadas/${lamp.id_lampada}` } }
      });
    })
    .catch(error => badRequest(res, { body: [error.message] }));
}

function deleteLamp(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const removed = removeById(apiDb.lampadas, 'id_lampada', id);
  if (!removed) {
    notFound(res, 'Lampada');
    return;
  }

  apiDb.registosLampada = apiDb.registosLampada.filter(item => Number(item.id_lampada) !== Number(id));
  saveApiDb();
  sendNoContent(res);
}

function listLampRegistos(req, res, id, query) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const lamp = apiDb.lampadas.find(item => item.id_lampada === Number(id));
  if (!lamp) {
    notFound(res, 'Lampada');
    return;
  }

  const records = paginate(apiDb.registosLampada.filter(item => Number(item.id_lampada) === Number(id)), query, 20);
  sendJson(res, 200, records);
}

function createLampRecord(req, res) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  readBody(req)
    .then(body => {
      const errors = validateBody(
        {
          id_poste: { required: true, label: 'Id poste', type: 'integer' },
          modelo: { required: true, label: 'Modelo' },
          potencia_watts: { required: true, label: 'Potencia watts', type: 'number' },
          luminosidade_max: { required: true, label: 'Luminosidade max', type: 'number' },
          luminosidade_min: { required: true, label: 'Luminosidade min', type: 'number' }
        },
        body
      );

      if (Object.keys(errors).length > 0) {
        badRequest(res, errors);
        return;
      }

      const lamp = apiDb.lampadas.find(item => Number(item.id_poste) === Number(body.id_poste) && String(item.modelo).toLowerCase() === String(body.modelo).toLowerCase());
      if (!lamp) {
        badRequest(res, { id_lampada: ['No matching lamp found for the provided post and model.'] });
        return;
      }

      const registo = {
        id_registo: nextId(apiDb.registosLampada, 'id_registo'),
        id_lampada: lamp.id_lampada,
        id_poste: Number(body.id_poste),
        modelo: String(body.modelo),
        hora_ligar: body.hora_ligar !== undefined ? String(body.hora_ligar) : new Date().toISOString(),
        hora_desligar: body.hora_desligar !== undefined ? String(body.hora_desligar) : null,
        luminosidade: body.luminosidade !== undefined ? Number(body.luminosidade) : (Number(body.luminosidade_max) + Number(body.luminosidade_min)) / 2,
        estado: body.estado !== undefined ? String(body.estado) : lamp.estado,
        potencia_watts: Number(body.potencia_watts),
        luminosidade_max: Number(body.luminosidade_max),
        luminosidade_min: Number(body.luminosidade_min),
        tempo_vida_horas: body.tempo_vida_horas !== undefined ? Number(body.tempo_vida_horas) : null
      };

      apiDb.registosLampada.push(registo);
      saveApiDb();

      sendJson(res, 201, {
        id_registo: registo.id_registo,
        _links: { lampada: `/lampadas/${lamp.id_lampada}` }
      });
    })
    .catch(error => badRequest(res, { body: [error.message] }));
}

function listLampRecords(req, res, query) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const records = paginate(apiDb.registosLampada, query, 20);
  sendJson(res, 200, records);
}

function getLampRecord(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const record = apiDb.registosLampada.find(item => item.id_registo === Number(id));
  if (!record) {
    notFound(res, 'Registo de lampada');
    return;
  }

  sendJson(res, 200, record);
}

function deleteLampRecord(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const removed = removeById(apiDb.registosLampada, 'id_registo', id);
  if (!removed) {
    notFound(res, 'Registo de lampada');
    return;
  }

  saveApiDb();
  sendNoContent(res);
}

function listAgendamentos(req, res, query) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const items = paginate(apiDb.agendamentosManutencao.filter(item => matchesMaintenanceFilter(item, query)), query);
  sendJson(res, 200, items.map(toPublicMaintenance));
}

function createAgendamento(req, res) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  readBody(req)
    .then(body => {
      const errors = validateBody(
        {
          data_manutencao: { required: true, label: 'Data manutencao' },
          descricao: { required: true, label: 'Descricao' }
        },
        body
      );

      if (Object.keys(errors).length > 0) {
        badRequest(res, errors);
        return;
      }

      const hasTarget = body.id_poste !== undefined || body.id_lampada !== undefined || body.id_zona !== undefined;
      if (!hasTarget) {
        badRequest(res, { target: ['At least one target id is required.'] });
        return;
      }

      const agendamento = {
        id_agendamento: nextId(apiDb.agendamentosManutencao, 'id_agendamento'),
        data_manutencao: String(body.data_manutencao),
        descricao: String(body.descricao),
        prioridade: body.prioridade !== undefined ? String(body.prioridade) : 'media',
        estado: body.estado !== undefined ? String(body.estado) : 'pendente',
        id_poste: body.id_poste !== undefined ? Number(body.id_poste) : null,
        id_lampada: body.id_lampada !== undefined ? Number(body.id_lampada) : null,
        id_zona: body.id_zona !== undefined ? Number(body.id_zona) : null
      };

      apiDb.agendamentosManutencao.push(agendamento);
      saveApiDb();

      sendJson(res, 201, {
        id_agendamento: agendamento.id_agendamento,
        _links: { self: { href: `/agendamentos-manutencao/${agendamento.id_agendamento}` } }
      });
    })
    .catch(error => badRequest(res, { body: [error.message] }));
}

function getAgendamento(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const agendamento = apiDb.agendamentosManutencao.find(item => item.id_agendamento === Number(id));
  if (!agendamento) {
    notFound(res, 'Agendamento');
    return;
  }

  sendJson(res, 200, agendamento);
}

function patchAgendamento(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  readBody(req)
    .then(body => {
      const agendamento = apiDb.agendamentosManutencao.find(item => item.id_agendamento === Number(id));
      if (!agendamento) {
        notFound(res, 'Agendamento');
        return;
      }

      if (body.data_manutencao !== undefined) agendamento.data_manutencao = String(body.data_manutencao);
      if (body.descricao !== undefined) agendamento.descricao = String(body.descricao);
      if (body.prioridade !== undefined) agendamento.prioridade = String(body.prioridade);
      if (body.estado !== undefined) agendamento.estado = String(body.estado);
      if (body.id_poste !== undefined) agendamento.id_poste = Number(body.id_poste);
      if (body.id_lampada !== undefined) agendamento.id_lampada = Number(body.id_lampada);
      if (body.id_zona !== undefined) agendamento.id_zona = Number(body.id_zona);

      saveApiDb();
      sendJson(res, 200, { message: 'Agendamento atualizado com sucesso' });
    })
    .catch(error => badRequest(res, { body: [error.message] }));
}

function deleteAgendamento(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const removed = removeById(apiDb.agendamentosManutencao, 'id_agendamento', id);
  if (!removed) {
    notFound(res, 'Agendamento');
    return;
  }

  saveApiDb();
  sendNoContent(res);
}

function listPostAgendamentos(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const post = apiDb.postes.find(item => item.id_poste === Number(id));
  if (!post) {
    notFound(res, 'Poste');
    return;
  }

  const items = apiDb.agendamentosManutencao
    .filter(item => Number(item.id_poste || 0) === Number(id))
    .map(item => ({
      id_agendamento: item.id_agendamento,
      data_manutencao: item.data_manutencao,
      descricao: item.descricao,
      prioridade: item.prioridade,
      estado: item.estado
    }));

  sendJson(res, 200, items);
}

function listFaults(req, res, query) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const items = paginate(apiDb.avarias.filter(item => matchesFaultFilter(item, query)), query);
  sendJson(res, 200, items.map(toPublicFault));
}

function createFault(req, res) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  readBody(req)
    .then(body => {
      const errors = validateBody(
        {
          descricao: { required: true, label: 'Descricao' },
          severidade: { required: true, label: 'Severidade' }
        },
        body
      );

      if (body.severidade && !['baixa', 'media', 'alta'].includes(String(body.severidade).toLowerCase())) {
        errors.severidade = [...(errors.severidade || []), 'Severidade must be baixa, media, or alta.'];
      }

      if (body.estado && !['pendente', 'em_resolucao', 'resolvida'].includes(String(body.estado).toLowerCase())) {
        errors.estado = [...(errors.estado || []), 'Estado must be pendente, em_resolucao, or resolvida.'];
      }

      if (Object.keys(errors).length > 0) {
        badRequest(res, errors);
        return;
      }

      const hasTarget = body.id_poste !== undefined || body.id_lampada !== undefined || body.id_zona !== undefined;
      if (!hasTarget) {
        badRequest(res, { target: ['At least one target id is required.'] });
        return;
      }

      const avaria = {
        id_avaria: nextId(apiDb.avarias, 'id_avaria'),
        descricao: String(body.descricao),
        severidade: String(body.severidade).toLowerCase(),
        estado: body.estado !== undefined ? String(body.estado).toLowerCase() : 'pendente',
        id_poste: body.id_poste !== undefined ? Number(body.id_poste) : null,
        id_lampada: body.id_lampada !== undefined ? Number(body.id_lampada) : null,
        id_zona: body.id_zona !== undefined ? Number(body.id_zona) : null
      };

      apiDb.avarias.push(avaria);
      saveApiDb();

      sendJson(res, 201, {
        id_avaria: avaria.id_avaria,
        _links: { self: { href: `/avarias/${avaria.id_avaria}` } }
      });
    })
    .catch(error => badRequest(res, { body: [error.message] }));
}

function getFault(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const avaria = apiDb.avarias.find(item => item.id_avaria === Number(id));
  if (!avaria) {
    notFound(res, 'Avaria');
    return;
  }

  sendJson(res, 200, avaria);
}

function patchFault(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  readBody(req)
    .then(body => {
      const avaria = apiDb.avarias.find(item => item.id_avaria === Number(id));
      if (!avaria) {
        notFound(res, 'Avaria');
        return;
      }

      if (body.descricao !== undefined) avaria.descricao = String(body.descricao);
      if (body.severidade !== undefined) avaria.severidade = String(body.severidade).toLowerCase();
      if (body.estado !== undefined) avaria.estado = String(body.estado).toLowerCase();
      if (body.id_poste !== undefined) avaria.id_poste = Number(body.id_poste);
      if (body.id_lampada !== undefined) avaria.id_lampada = Number(body.id_lampada);
      if (body.id_zona !== undefined) avaria.id_zona = Number(body.id_zona);

      saveApiDb();
      sendJson(res, 200, { id_avaria: avaria.id_avaria, estado: avaria.estado, _links: { self: { href: `/avarias/${avaria.id_avaria}` } } });
    })
    .catch(error => badRequest(res, { body: [error.message] }));
}

function deleteFault(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const removed = removeById(apiDb.avarias, 'id_avaria', id);
  if (!removed) {
    notFound(res, 'Avaria');
    return;
  }

  saveApiDb();
  sendNoContent(res);
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }

  const { pathname, query } = getPathParts(req);

  if (pathname.startsWith('/api/')) {
    if (pathname === '/api/config') {
      sendJson(res, 200, {
        host: process.env.HOST || '',
        port: process.env.PORT || '',
        user: process.env.USER || '',
        passwordDefined: Boolean(process.env.PASSWORD)
      });
      return;
    }

    if (pathname === '/api/user' && req.method === 'GET') {
      const usersDbPath = path.join(rootDir, 'users.json');
      fs.readFile(usersDbPath, 'utf8', (err, data) => {
        if (err) {
          return sendJson(res, 500, { message: 'Error reading user data' });
        }
        const users = JSON.parse(data);
        const currentUser = users[0];
        sendJson(res, 200, currentUser);
      });
      return;
    }

    if (pathname === '/api/user' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const usersDbPath = path.join(rootDir, 'users.json');

        fs.readFile(usersDbPath, 'utf8', (err, data) => {
          if (err) {
            return sendJson(res, 500, { message: 'Error reading user data' });
          }
          let users = JSON.parse(data);
          if (users.length > 0) {
            users[0] = { ...users[0], ...body };
          }
          fs.writeFile(usersDbPath, JSON.stringify(users, null, 2), writeErr => {
            if (writeErr) {
              return sendJson(res, 500, { message: 'Error saving user data' });
            }
            sendJson(res, 200, { message: 'Changes saved successfully!' });
          });
        });
      } catch (error) {
        badRequest(res, { body: [error.message] });
      }
      return;
    }

  }

  if (pathname === '/operadores/login' && req.method === 'POST') {
    await handleLogin(req, res);
    return;
  }

  if (pathname === '/operadores' && req.method === 'POST') {
    createOperator(req, res);
    return;
  }

  if (pathname === '/operadores' && req.method === 'GET') {
    listOperators(req, res, query);
    return;
  }

  if (pathname === '/perfis-iluminacao' && req.method === 'POST') {
    createProfile(req, res);
    return;
  }

  if (pathname === '/perfis-iluminacao' && req.method === 'GET') {
    listProfiles(req, res, query);
    return;
  }

  if (pathname === '/sensores-movimento' && req.method === 'POST') {
    createSensor(req, res);
    return;
  }

  if (pathname === '/sensores-movimento' && req.method === 'GET') {
    listSensors(req, res, query);
    return;
  }

  if (pathname === '/zonas' && req.method === 'POST') {
    createZone(req, res);
    return;
  }

  if (pathname === '/zonas' && req.method === 'GET') {
    listZones(req, res, query);
    return;
  }

  if (pathname === '/postes' && req.method === 'POST') {
    createPost(req, res);
    return;
  }

  if (pathname === '/postes' && req.method === 'GET') {
    listPosts(req, res, query);
    return;
  }

  if (pathname === '/lampadas' && req.method === 'POST') {
    createLamp(req, res);
    return;
  }

  if (pathname === '/lampadas' && req.method === 'GET') {
    listLamps(req, res, query);
    return;
  }

  if (pathname === '/registos-lampada' && req.method === 'POST') {
    createLampRecord(req, res);
    return;
  }

  if (pathname === '/registos-lampada' && req.method === 'GET') {
    listLampRecords(req, res, query);
    return;
  }

  if (pathname === '/agendamentos-manutencao' && req.method === 'POST') {
    createAgendamento(req, res);
    return;
  }

  if (pathname === '/agendamentos-manutencao' && req.method === 'GET') {
    listAgendamentos(req, res, query);
    return;
  }

  if (pathname === '/avarias' && req.method === 'POST') {
    createFault(req, res);
    return;
  }

  if (pathname === '/avarias' && req.method === 'GET') {
    listFaults(req, res, query);
    return;
  }

  const operatorById = pathname.match(/^\/operadores\/(\d+)$/);
  if (operatorById) {
    if (req.method === 'GET') {
      getOperator(req, res, operatorById[1]);
      return;
    }
    if (req.method === 'PATCH') {
      patchOperator(req, res, operatorById[1]);
      return;
    }
    if (req.method === 'DELETE') {
      deleteOperator(req, res, operatorById[1]);
      return;
    }
  }

  const levelOperators = pathname.match(/^\/niveis-acesso\/([^/]+)\/operadores$/);
  if (levelOperators && req.method === 'GET') {
    listOperatorsByLevel(req, res, decodeURIComponent(levelOperators[1]));
    return;
  }

  const profileById = pathname.match(/^\/perfis-iluminacao\/(\d+)$/);
  if (profileById) {
    if (req.method === 'GET') {
      getProfile(req, res, profileById[1]);
      return;
    }
    if (req.method === 'PATCH') {
      patchProfile(req, res, profileById[1]);
      return;
    }
    if (req.method === 'DELETE') {
      deleteProfile(req, res, profileById[1]);
      return;
    }
  }

  const profilePosts = pathname.match(/^\/perfis-iluminacao\/(\d+)\/postes$/);
  if (profilePosts && req.method === 'GET') {
    listProfilePosts(req, res, profilePosts[1]);
    return;
  }

  const sensorById = pathname.match(/^\/sensores-movimento\/(\d+)$/);
  if (sensorById) {
    if (req.method === 'GET') {
      getSensor(req, res, sensorById[1]);
      return;
    }
    if (req.method === 'PATCH') {
      patchSensor(req, res, sensorById[1]);
      return;
    }
    if (req.method === 'DELETE') {
      deleteSensor(req, res, sensorById[1]);
      return;
    }
  }

  const sensorZones = pathname.match(/^\/sensores-movimento\/(\d+)\/zonas$/);
  if (sensorZones && req.method === 'GET') {
    listSensorZones(req, res, sensorZones[1]);
    return;
  }

  const zoneById = pathname.match(/^\/zonas\/(\d+)$/);
  if (zoneById) {
    if (req.method === 'GET') {
      getZone(req, res, zoneById[1]);
      return;
    }
    if (req.method === 'PATCH') {
      patchZone(req, res, zoneById[1]);
      return;
    }
    if (req.method === 'DELETE') {
      deleteZone(req, res, zoneById[1]);
      return;
    }
  }

  const zonePosts = pathname.match(/^\/zonas\/(\d+)\/postes$/);
  if (zonePosts && req.method === 'GET') {
    listZonePosts(req, res, zonePosts[1]);
    return;
  }

  const postById = pathname.match(/^\/postes\/(\d+)$/);
  if (postById) {
    if (req.method === 'GET') {
      getPost(req, res, postById[1]);
      return;
    }
    if (req.method === 'PATCH') {
      patchPost(req, res, postById[1]);
      return;
    }
    if (req.method === 'DELETE') {
      deletePost(req, res, postById[1]);
      return;
    }
  }

  const postMaintenance = pathname.match(/^\/postes\/(\d+)\/agendamentos-manutencao$/);
  if (postMaintenance && req.method === 'GET') {
    listPostAgendamentos(req, res, postMaintenance[1]);
    return;
  }

  const postFaults = pathname.match(/^\/postes\/(\d+)\/avarias$/);
  if (postFaults && req.method === 'GET') {
    listPostFaultsById(req, res, postFaults[1]);
    return;
  }

  const lampById = pathname.match(/^\/lampadas\/(\d+)$/);
  if (lampById) {
    if (req.method === 'GET') {
      getLamp(req, res, lampById[1]);
      return;
    }
    if (req.method === 'PATCH') {
      patchLamp(req, res, lampById[1]);
      return;
    }
    if (req.method === 'DELETE') {
      deleteLamp(req, res, lampById[1]);
      return;
    }
  }

  const lampRecords = pathname.match(/^\/lampadas\/(\d+)\/registos$/);
  if (lampRecords && req.method === 'GET') {
    listLampRegistos(req, res, lampRecords[1], query);
    return;
  }

  const registoById = pathname.match(/^\/registos-lampada\/(\d+)$/);
  if (registoById) {
    if (req.method === 'GET') {
      getLampRecord(req, res, registoById[1]);
      return;
    }
    if (req.method === 'DELETE') {
      deleteLampRecord(req, res, registoById[1]);
      return;
    }
  }

  const agendamentoById = pathname.match(/^\/agendamentos-manutencao\/(\d+)$/);
  if (agendamentoById) {
    if (req.method === 'GET') {
      getAgendamento(req, res, agendamentoById[1]);
      return;
    }
    if (req.method === 'PATCH') {
      patchAgendamento(req, res, agendamentoById[1]);
      return;
    }
    if (req.method === 'DELETE') {
      deleteAgendamento(req, res, agendamentoById[1]);
      return;
    }
  }

  const faultById = pathname.match(/^\/avarias\/(\d+)$/);
  if (faultById) {
    if (req.method === 'GET') {
      getFault(req, res, faultById[1]);
      return;
    }
    if (req.method === 'PATCH') {
      patchFault(req, res, faultById[1]);
      return;
    }
    if (req.method === 'DELETE') {
      deleteFault(req, res, faultById[1]);
      return;
    }
  }

  if (pathname === '/operadores/login' && req.method === 'POST') {
    await handleLogin(req, res);
    return;
  }

  sendJson(res, 404, { message: 'API endpoint not found' });
  return;

  const filePath = resolveStaticFile(req.url);
  if (!filePath) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const fallbackFile = path.join(rootDir, 'login.html');
      if (req.url === '/' || req.url === '/login.html') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 - Not Found');
      } else {
        sendFile(res, fallbackFile);
      }
    } else {
      sendFile(res, filePath);
    }
  });
});

server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
  console.log(`Using env: HOST=${process.env.HOST || ''} PORT=${process.env.PORT || ''} USER=${process.env.USER || ''}`);
});