const crypto = require('crypto');
const { getApiDb } = require('./dataStore');
const { sendJson } = require('./httpHelpers');

const authTokens = new Map();

// Aqui fica a autenticação por token e a projeção pública dos operadores.
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

function tokenResponse(operator) {
  const token = crypto.randomBytes(24).toString('hex');
  authTokens.set(token, operator.id_operador);
  return token;
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

  const apiDb = getApiDb();
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

module.exports = {
  authTokens,
  authHeaders,
  operatorPublic,
  requireAuth,
  tokenResponse
};
