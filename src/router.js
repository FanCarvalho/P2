const fs = require('fs');
const path = require('path');
const { rootDir } = require('./config');
const { getPathParts, sendFile, sendJson } = require('./httpHelpers');
const handlers = require('./apiHandlers');

function resolveStaticFile(requestPath) {
  let pathname = decodeURIComponent(requestPath.split('?')[0]);
  if (pathname === '/') pathname = '/login.html';

  const normalizedPath = path.normalize(pathname).replace(/^([.]{2}[\/])+/, '');
  const filePath = path.join(rootDir, normalizedPath);

  if (!filePath.startsWith(rootDir)) return null;
  return filePath;
}

function handleApiRoute(req, res, pathname) {
  // Rotas simples da API de apoio ao frontend.
  if (pathname === '/api/config') {
    handlers.handleApiConfig(req, res);
    return true;
  }

  if (pathname === '/api/me' && req.method === 'GET') {
    handlers.handleApiMe(req, res);
    return true;
  }

  if (pathname === '/api/user' && req.method === 'GET') {
    handlers.handleApiUserGet(req, res);
    return true;
  }

  if (pathname === '/api/user' && req.method === 'POST') {
    handlers.handleApiUserPost(req, res);
    return true;
  }

  return false;
}

function handleResourceCollection(req, res, pathname, query) {
  // Colecções principais expostas pela API.
  if (pathname === '/operadores/login' && req.method === 'POST') {
    handlers.handleLogin(req, res);
    return true;
  }

  if (pathname === '/operadores' && req.method === 'POST') {
    handlers.createOperator(req, res);
    return true;
  }

  if (pathname === '/operadores' && req.method === 'GET') {
    handlers.listOperators(req, res, query);
    return true;
  }

  if (pathname === '/perfis-iluminacao' && req.method === 'POST') {
    handlers.createProfile(req, res);
    return true;
  }

  if (pathname === '/perfis-iluminacao' && req.method === 'GET') {
    handlers.listProfiles(req, res, query);
    return true;
  }

  if (pathname === '/sensores-movimento' && req.method === 'POST') {
    handlers.createSensor(req, res);
    return true;
  }

  if (pathname === '/sensores-movimento' && req.method === 'GET') {
    handlers.listSensors(req, res, query);
    return true;
  }

  if (pathname === '/zonas' && req.method === 'POST') {
    handlers.createZone(req, res);
    return true;
  }

  if (pathname === '/zonas' && req.method === 'GET') {
    handlers.listZones(req, res, query);
    return true;
  }

  if (pathname === '/postes' && req.method === 'POST') {
    handlers.createPost(req, res);
    return true;
  }

  if (pathname === '/postes' && req.method === 'GET') {
    handlers.listPosts(req, res, query);
    return true;
  }

  if (pathname === '/lampadas' && req.method === 'POST') {
    handlers.createLamp(req, res);
    return true;
  }

  if (pathname === '/lampadas' && req.method === 'GET') {
    handlers.listLamps(req, res, query);
    return true;
  }

  if (pathname === '/registos-lampada' && req.method === 'POST') {
    handlers.createLampRecord(req, res);
    return true;
  }

  if (pathname === '/registos-lampada' && req.method === 'GET') {
    handlers.listLampRecords(req, res, query);
    return true;
  }

  if (pathname === '/agendamentos-manutencao' && req.method === 'POST') {
    handlers.createAgendamento(req, res);
    return true;
  }

  if (pathname === '/agendamentos-manutencao' && req.method === 'GET') {
    handlers.listAgendamentos(req, res, query);
    return true;
  }

  if (pathname === '/avarias' && req.method === 'POST') {
    handlers.createFault(req, res);
    return true;
  }

  if (pathname === '/avarias' && req.method === 'GET') {
    handlers.listFaults(req, res, query);
    return true;
  }

  return false;
}

function handleResourceById(req, res, pathname) {
  // Rotas com identificador e sub-recursos relacionados.
  const operatorById = pathname.match(/^\/operadores\/(\d+)$/);
  if (operatorById) {
    if (req.method === 'GET') {
      handlers.getOperator(req, res, operatorById[1]);
      return true;
    }
    if (req.method === 'PATCH') {
      handlers.patchOperator(req, res, operatorById[1]);
      return true;
    }
    if (req.method === 'DELETE') {
      handlers.deleteOperator(req, res, operatorById[1]);
      return true;
    }
  }

  const levelOperators = pathname.match(/^\/niveis-acesso\/([^/]+)\/operadores$/);
  if (levelOperators && req.method === 'GET') {
    handlers.listOperatorsByLevel(req, res, decodeURIComponent(levelOperators[1]));
    return true;
  }

  const profileById = pathname.match(/^\/perfis-iluminacao\/(\d+)$/);
  if (profileById) {
    if (req.method === 'GET') {
      handlers.getProfile(req, res, profileById[1]);
      return true;
    }
    if (req.method === 'PATCH') {
      handlers.patchProfile(req, res, profileById[1]);
      return true;
    }
    if (req.method === 'DELETE') {
      handlers.deleteProfile(req, res, profileById[1]);
      return true;
    }
  }

  const profilePosts = pathname.match(/^\/perfis-iluminacao\/(\d+)\/postes$/);
  if (profilePosts && req.method === 'GET') {
    handlers.listProfilePosts(req, res, profilePosts[1]);
    return true;
  }

  const sensorById = pathname.match(/^\/sensores-movimento\/(\d+)$/);
  if (sensorById) {
    if (req.method === 'GET') {
      handlers.getSensor(req, res, sensorById[1]);
      return true;
    }
    if (req.method === 'PATCH') {
      handlers.patchSensor(req, res, sensorById[1]);
      return true;
    }
    if (req.method === 'DELETE') {
      handlers.deleteSensor(req, res, sensorById[1]);
      return true;
    }
  }

  const sensorZones = pathname.match(/^\/sensores-movimento\/(\d+)\/zonas$/);
  if (sensorZones && req.method === 'GET') {
    handlers.listSensorZones(req, res, sensorZones[1]);
    return true;
  }

  const zoneById = pathname.match(/^\/zonas\/(\d+)$/);
  if (zoneById) {
    if (req.method === 'GET') {
      handlers.getZone(req, res, zoneById[1]);
      return true;
    }
    if (req.method === 'PATCH') {
      handlers.patchZone(req, res, zoneById[1]);
      return true;
    }
    if (req.method === 'DELETE') {
      handlers.deleteZone(req, res, zoneById[1]);
      return true;
    }
  }

  const zonePosts = pathname.match(/^\/zonas\/(\d+)\/postes$/);
  if (zonePosts && req.method === 'GET') {
    handlers.listZonePosts(req, res, zonePosts[1]);
    return true;
  }

  const postById = pathname.match(/^\/postes\/(\d+)$/);
  if (postById) {
    if (req.method === 'GET') {
      handlers.getPost(req, res, postById[1]);
      return true;
    }
    if (req.method === 'PATCH') {
      handlers.patchPost(req, res, postById[1]);
      return true;
    }
    if (req.method === 'DELETE') {
      handlers.deletePost(req, res, postById[1]);
      return true;
    }
  }

  const postMaintenance = pathname.match(/^\/postes\/(\d+)\/agendamentos-manutencao$/);
  if (postMaintenance && req.method === 'GET') {
    handlers.listPostAgendamentos(req, res, postMaintenance[1]);
    return true;
  }

  const postFaults = pathname.match(/^\/postes\/(\d+)\/avarias$/);
  if (postFaults && req.method === 'GET') {
    handlers.listPostFaultsById(req, res, postFaults[1]);
    return true;
  }

  const lampById = pathname.match(/^\/lampadas\/(\d+)$/);
  if (lampById) {
    if (req.method === 'GET') {
      handlers.getLamp(req, res, lampById[1]);
      return true;
    }
    if (req.method === 'PATCH') {
      handlers.patchLamp(req, res, lampById[1]);
      return true;
    }
    if (req.method === 'DELETE') {
      handlers.deleteLamp(req, res, lampById[1]);
      return true;
    }
  }

  const lampRecords = pathname.match(/^\/lampadas\/(\d+)\/registos$/);
  if (lampRecords && req.method === 'GET') {
    handlers.listLampRegistos(req, res, lampRecords[1], query);
    return true;
  }

  const registoById = pathname.match(/^\/registos-lampada\/(\d+)$/);
  if (registoById) {
    if (req.method === 'GET') {
      handlers.getLampRecord(req, res, registoById[1]);
      return true;
    }
    if (req.method === 'DELETE') {
      handlers.deleteLampRecord(req, res, registoById[1]);
      return true;
    }
  }

  const agendamentoById = pathname.match(/^\/agendamentos-manutencao\/(\d+)$/);
  if (agendamentoById) {
    if (req.method === 'GET') {
      handlers.getAgendamento(req, res, agendamentoById[1]);
      return true;
    }
    if (req.method === 'PATCH') {
      handlers.patchAgendamento(req, res, agendamentoById[1]);
      return true;
    }
    if (req.method === 'DELETE') {
      handlers.deleteAgendamento(req, res, agendamentoById[1]);
      return true;
    }
  }

  const faultById = pathname.match(/^\/avarias\/(\d+)$/);
  if (faultById) {
    if (req.method === 'GET') {
      handlers.getFault(req, res, faultById[1]);
      return true;
    }
    if (req.method === 'PATCH') {
      handlers.patchFault(req, res, faultById[1]);
      return true;
    }
    if (req.method === 'DELETE') {
      handlers.deleteFault(req, res, faultById[1]);
      return true;
    }
  }

  return false;
}

function serveStaticAsset(req, res) {
  // Serve os ficheiros estáticos do frontend quando a rota não é API.
  const filePath = resolveStaticFile(req.url || '/');
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
      return;
    }

    sendFile(res, filePath);
  });
}

async function handleRequest(req, res) {
  // Decide primeiro a API e só depois o conteúdo estático.
  if (!req.url) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }

  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const { pathname, query } = getPathParts(req);

  if (pathname.startsWith('/api/')) {
    if (handleApiRoute(req, res, pathname)) return;
    sendJson(res, 404, { message: 'API endpoint not found' });
    return;
  }

  if (handleResourceCollection(req, res, pathname, query)) return;
  if (handleResourceById(req, res, pathname)) return;

  serveStaticAsset(req, res);
}

module.exports = {
  handleRequest
};
