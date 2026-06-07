const fs = require('fs');
const path = require('path');
const { getApiDb, saveApiDb } = require('./dataStore');
const {
  badRequest,
  conflict,
  nextId,
  notFound,
  paginate,
  readBody,
  removeById,
  sendJson,
  sendNoContent,
  validateBody
} = require('./httpHelpers');
const {
  matchesFaultFilter,
  matchesLampFilter,
  matchesMaintenanceFilter,
  matchesOperatorFilter,
  matchesPostFilter,
  matchesProfileFilter,
  matchesSensorFilter,
  matchesZoneFilter
} = require('./filters');
const { operatorPublic, requireAuth, tokenResponse } = require('./auth');

const zonasTxtCandidates = [
  path.resolve(__dirname, '..', '..', 'zonas.txt'),
  path.resolve(__dirname, '..', 'zonas.txt')
];

function matchesEmailFormat(value) {
  return String(value).includes('@');
}

function isAdminOperator(operator) {
  return String(operator?.nivel_acesso || '').trim().toLowerCase() === 'administrador';
}

function normalizeZoneFromTxt(entry, key, index) {
  if (!entry || typeof entry !== 'object') return null;

  const lat = Number(entry.lat);
  const lon = Number(entry.lon);

  return {
    id_zona: index + 1,
    nome: entry.nome || String(key),
    rua: entry.rua || `Zona ${entry.nome || String(key)}`,
    codigo_postal: entry.codigo_postal || '',
    id_sensor: entry.id_sensor !== undefined && entry.id_sensor !== null ? Number(entry.id_sensor) : null,
    postes: Number.isFinite(Number(entry.postes)) ? Number(entry.postes) : 0,
    avarias: Number.isFinite(Number(entry.avarias)) ? Number(entry.avarias) : 0,
    status: entry.status || 'Operacional',
    consumo: entry.consumo || null,
    consumo_mensal: Array.isArray(entry.consumo_mensal) ? entry.consumo_mensal : [],
    vencimento: Number.isFinite(Number(entry.vencimento)) ? Number(entry.vencimento) : 0,
    substituicao: entry.substituicao || null,
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null
  };
}

function loadZonesFromTxt() {
  try {
    const zonasTxtPath = zonasTxtCandidates.find(candidatePath => fs.existsSync(candidatePath));
    if (!zonasTxtPath) return null;

    const raw = fs.readFileSync(zonasTxtPath, 'utf8');
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return parsed
        .map((entry, index) => normalizeZoneFromTxt(entry, entry?.nome || `zona-${index + 1}`, index))
        .filter(Boolean);
    }

    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed)
        .map(([key, value], index) => normalizeZoneFromTxt(value, key, index))
        .filter(Boolean);
    }
  } catch {
    // Fallback silencioso para a base local/API.
  }

  return null;
}

// Projecta apenas os campos que o frontend deve ver em listas simples.
function toPublicLamp(lamp) { return lamp; }
function toPublicProfile(profile) { return profile; }
function toPublicZone(zone) { return zone; }
function toPublicSensor(sensor) { return sensor; }
function toPublicPost(post) { return post; }
function toPublicMaintenance(item) { return item; }
function toPublicFault(item) { return item; }

// Autenticação e conta corrente.
function handleLogin(req, res) {
  const apiDb = getApiDb();
  return readBody(req)
    .then(body => {
      const errors = validateBody(
        {
          email: { required: true, label: 'Email' },
          password: { required: true, label: 'Password' }
        },
        body
      );

      if (body.email && !matchesEmailFormat(body.email)) {
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
          errors: { credentials: ['Email ou password incorretos'] }
        });
        return;
      }

      if (operator.ativo === false) {
        sendJson(res, 403, {
          description: 'Authentication failed',
          errors: { credentials: ['Esta conta esta inativa'] }
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

// Operadores.
function createOperator(req, res) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  if (!isAdminOperator(currentUser)) {
    sendJson(res, 403, {
      description: 'Forbidden',
      errors: { authorization: ['Only administrators can create accounts'] }
    });
    return;
  }

  const apiDb = getApiDb();
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

      if (body.email && !matchesEmailFormat(body.email)) {
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

  const apiDb = getApiDb();
  const operators = paginate(apiDb.operadores.filter(item => matchesOperatorFilter(item, query)).map(operatorPublic), query);
  sendJson(res, 200, operators);
}

function getOperator(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
  readBody(req)
    .then(body => {
      const operator = apiDb.operadores.find(item => item.id_operador === Number(id));
      if (!operator) {
        notFound(res, 'Operador');
        return;
      }

      if (body.email !== undefined && !matchesEmailFormat(body.email)) {
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

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
  const operators = apiDb.operadores.filter(item => String(item.nivel_acesso).toLowerCase() === String(nivel).toLowerCase()).map(operatorPublic);
  sendJson(res, 200, operators);
}

// Perfis de iluminação.
function createProfile(req, res) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
  const profiles = paginate(apiDb.perfisIluminacao.filter(item => matchesProfileFilter(item, query)), query);
  sendJson(res, 200, profiles.map(toPublicProfile));
}

function getProfile(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
  const profile = apiDb.perfisIluminacao.find(item => item.id_perfil === Number(id));
  if (!profile) {
    notFound(res, 'Perfil');
    return;
  }

  const posts = apiDb.postes.filter(post => Number(post.id_perfil) === Number(id)).map(post => ({ id_poste: post.id_poste, estado: post.estado, intensidade_atual: post.intensidade_atual }));
  sendJson(res, 200, posts);
}

// Sensores.
function createSensor(req, res) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
  const sensors = paginate(apiDb.sensoresMovimento.filter(item => matchesSensorFilter(item, query)), query);
  sendJson(res, 200, sensors.map(toPublicSensor));
}

function getSensor(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
  const sensor = apiDb.sensoresMovimento.find(item => item.id_sensor === Number(id));
  if (!sensor) {
    notFound(res, 'Sensor');
    return;
  }

  const zones = apiDb.zonas.filter(zone => Number(zone.id_sensor) === Number(id)).map(zone => ({ id_zona: zone.id_zona, nome: zone.nome }));
  sendJson(res, 200, zones);
}

// Zonas.
function createZone(req, res) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const apiDb = getApiDb();
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
  const zonesFromTxt = loadZonesFromTxt();
  if (zonesFromTxt && zonesFromTxt.length) {
    const zones = paginate(zonesFromTxt.filter(item => matchesZoneFilter(item, query)), query);
    sendJson(res, 200, zones.map(toPublicZone));
    return;
  }

  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const apiDb = getApiDb();
  const zones = paginate(apiDb.zonas.filter(item => matchesZoneFilter(item, query)), query);
  sendJson(res, 200, zones.map(toPublicZone));
}

function getZone(req, res, id) {
  const zonesFromTxt = loadZonesFromTxt();
  if (zonesFromTxt && zonesFromTxt.length) {
    const zone = zonesFromTxt.find(item => item.id_zona === Number(id));
    if (!zone) {
      notFound(res, 'Zona');
      return;
    }

    sendJson(res, 200, toPublicZone(zone));
    return;
  }

  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
  const zone = apiDb.zonas.find(item => item.id_zona === Number(id));
  if (!zone) {
    notFound(res, 'Zona');
    return;
  }

  const posts = apiDb.postes.filter(post => Number(post.id_zona) === Number(id)).map(post => ({ id_poste: post.id_poste, estado: post.estado, intensidade_atual: post.intensidade_atual }));
  sendJson(res, 200, posts);
}

// Postes.
function createPost(req, res) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
  const posts = paginate(apiDb.postes.filter(item => matchesPostFilter(item, query)), query);
  sendJson(res, 200, posts.map(toPublicPost));
}

function getPost(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
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

// Lâmpadas.
function createLamp(req, res) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
  const lamps = paginate(apiDb.lampadas.filter(item => matchesLampFilter(item, query)), query);
  sendJson(res, 200, lamps.map(toPublicLamp));
}

function getLamp(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
  const lamp = apiDb.lampadas.find(item => item.id_lampada === Number(id));
  if (!lamp) {
    notFound(res, 'Lampada');
    return;
  }

  const records = paginate(apiDb.registosLampada.filter(item => Number(item.id_lampada) === Number(id)), query, 20);
  sendJson(res, 200, records);
}

// Registos de lâmpadas.
function createLampRecord(req, res) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
  const records = paginate(apiDb.registosLampada, query, 20);
  sendJson(res, 200, records);
}

function getLampRecord(req, res, id) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
  const removed = removeById(apiDb.registosLampada, 'id_registo', id);
  if (!removed) {
    notFound(res, 'Registo de lampada');
    return;
  }

  saveApiDb();
  sendNoContent(res);
}

// Agendamentos de manutenção.
function listAgendamentos(req, res, query) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const apiDb = getApiDb();
  const items = paginate(apiDb.agendamentosManutencao.filter(item => matchesMaintenanceFilter(item, query)), query);
  sendJson(res, 200, items.map(toPublicMaintenance));
}

function createAgendamento(req, res) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
  const removed = removeById(apiDb.agendamentosManutencao, 'id_agendamento', id);
  if (!removed) {
    notFound(res, 'Agendamento');
    return;
  }

  saveApiDb();
  sendNoContent(res);
}

// Avarias.
function listFaults(req, res, query) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const apiDb = getApiDb();
  const items = paginate(apiDb.avarias.filter(item => matchesFaultFilter(item, query)), query);
  sendJson(res, 200, items.map(toPublicFault));
}

function createFault(req, res) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
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

  const apiDb = getApiDb();
  const removed = removeById(apiDb.avarias, 'id_avaria', id);
  if (!removed) {
    notFound(res, 'Avaria');
    return;
  }

  saveApiDb();
  sendNoContent(res);
}

// Endpoints de apoio do frontend.
function handleApiConfig(req, res) {
  sendJson(res, 200, {
    host: process.env.HOST || '',
    port: process.env.PORT || '',
    user: process.env.USER || '',
    passwordDefined: Boolean(process.env.PASSWORD)
  });
}

function handleApiMe(req, res) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  sendJson(res, 200, { operator: operatorPublic(currentUser) });
}

function findUserProfileIndex(users, operator) {
  if (!Array.isArray(users) || !operator) return -1;

  const operatorId = Number(operator.id_operador);
  const operatorEmail = String(operator.email || '').toLowerCase();

  return users.findIndex(user => {
    const userIdOperador = Number(user.id_operador);
    const userId = Number(user.id);
    const userEmail = String(user.email || '').toLowerCase();

    if (Number.isFinite(operatorId) && Number.isFinite(userIdOperador) && userIdOperador === operatorId) {
      return true;
    }

    if (Number.isFinite(operatorId) && Number.isFinite(userId) && userId === operatorId) {
      return true;
    }

    return operatorEmail && userEmail && operatorEmail === userEmail;
  });
}

function splitOperatorName(operator) {
  const fullName = String(operator?.nome || '').trim();
  if (!fullName) {
    return { firstName: 'Utilizador', lastName: '' };
  }

  const parts = fullName.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || 'Utilizador',
    lastName: parts.slice(1).join(' ')
  };
}

function buildDefaultUserProfile(operator, users = []) {
  const { firstName, lastName } = splitOperatorName(operator);
  const maxId = users.reduce((currentMax, user) => {
    const numericId = Number(user.id);
    return Number.isFinite(numericId) ? Math.max(currentMax, numericId) : currentMax;
  }, 0);

  return {
    id: maxId + 1,
    id_operador: operator.id_operador,
    firstName,
    lastName,
    email: operator.email || '',
    phone: '',
    bio: `Conta ${String(operator.nivel_acesso || 'utilizador').toLowerCase()} da Glowpath.`
  };
}

function readUsersFile(usersDbPath, callback) {
  fs.readFile(usersDbPath, 'utf8', (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        callback(null, []);
        return;
      }
      callback(err);
      return;
    }

    try {
      const users = JSON.parse(data);
      if (!Array.isArray(users)) {
        callback(new Error('Invalid users data format'));
        return;
      }
      callback(null, users);
    } catch {
      callback(new Error('Invalid users data format'));
    }
  });
}

function handleApiUserGet(req, res) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const { usersDbPath } = require('./config');

  readUsersFile(usersDbPath, (err, users) => {
    if (err) {
      return sendJson(res, 500, { message: 'Error reading user data' });
    }

    const profileIndex = findUserProfileIndex(users, currentUser);
    if (profileIndex === -1) {
      const defaultProfile = buildDefaultUserProfile(currentUser, users);
      users.push(defaultProfile);
      fs.writeFile(usersDbPath, JSON.stringify(users, null, 2), writeErr => {
        if (writeErr) {
          return sendJson(res, 500, { message: 'Error saving user data' });
        }
        sendJson(res, 200, defaultProfile);
      });
      return;
    }

    sendJson(res, 200, users[profileIndex]);
  });
}

function handleApiUserPost(req, res) {
  const currentUser = requireAuth(req, res);
  if (!currentUser) return;

  const { usersDbPath } = require('./config');

  return readBody(req)
    .then(body => {
      readUsersFile(usersDbPath, (err, users) => {
        if (err) {
          return sendJson(res, 500, { message: 'Error reading user data' });
        }

        let profileIndex = findUserProfileIndex(users, currentUser);
        if (profileIndex === -1) {
          users.push(buildDefaultUserProfile(currentUser, users));
          profileIndex = users.length - 1;
        }

        const existing = users[profileIndex];
        users[profileIndex] = {
          ...existing,
          ...body,
          id: existing.id,
          id_operador: existing.id_operador !== undefined ? existing.id_operador : currentUser.id_operador,
          email: currentUser.email || existing.email
        };

        fs.writeFile(usersDbPath, JSON.stringify(users, null, 2), writeErr => {
          if (writeErr) {
            return sendJson(res, 500, { message: 'Error saving user data' });
          }
          sendJson(res, 200, { message: 'Changes saved successfully!' });
        });
      });
    })
    .catch(error => badRequest(res, { body: [error.message] }));
}

async function getPublicLighting(req, res) {
  const { publicLightingPath } = require('./config');

  try {
    const data = await fs.promises.readFile(publicLightingPath, 'utf8');
    sendJson(res, 200, JSON.parse(data));
  } catch (error) {
    sendJson(res, 500, { message: 'Error reading public lighting data' });
  }
}

module.exports = {
  createAgendamento,
  createFault,
  createLamp,
  createLampRecord,
  createOperator,
  createPost,
  createProfile,
  createSensor,
  createZone,
  deleteAgendamento,
  deleteFault,
  deleteLamp,
  deleteLampRecord,
  deleteOperator,
  deletePost,
  deleteProfile,
  deleteSensor,
  deleteZone,
  getAgendamento,
  getFault,
  getLamp,
  getLampRecord,
  getOperator,
  getPost,
  getProfile,
  getSensor,
  getZone,
  handleApiConfig,
  handleApiMe,
  handleApiUserGet,
  handleApiUserPost,
  getPublicLighting,
  handleLogin,
  listAgendamentos,
  listFaults,
  listLampRecords,
  listLampRegistos,
  listLamps,
  listOperators,
  listOperatorsByLevel,
  listPostAgendamentos,
  listPostFaultsById,
  listPosts,
  listProfilePosts,
  listProfiles,
  listLampRegistos,
  listSensorZones,
  listSensors,
  listZonePosts,
  listZones,
  patchAgendamento,
  patchFault,
  patchLamp,
  patchOperator,
  patchPost,
  patchProfile,
  patchSensor,
  patchZone
};
