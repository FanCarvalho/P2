const fs = require('fs');
const { mimeTypes } = require('./config');

// Helpers genéricos para resposta HTTP e validação de pedidos.
function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(payload === undefined ? '' : JSON.stringify(payload, null, 2));
}

function sendNoContent(res) {
  res.writeHead(204);
  res.end();
}

function sendFile(res, filePath) {
  const ext = require('path').extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  const stream = fs.createReadStream(filePath);

  stream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    if (!res.writableEnded) {
      res.end('404 - File not found');
    }
  });

  res.writeHead(200, { 'Content-Type': contentType });
  stream.pipe(res);
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

function badRequest(res, errors, description = 'Validation failed') {
  sendJson(res, 400, { description, errors });
}

function notFound(res, resource = 'Resource') {
  sendJson(res, 404, { description: `${resource} not found` });
}

function conflict(res, errors, description = 'Resource conflict') {
  sendJson(res, 409, { description, errors });
}

module.exports = {
  badRequest,
  conflict,
  getPathParts,
  nextId,
  notFound,
  paginate,
  parseInteger,
  readBody,
  removeById,
  sendFile,
  sendJson,
  sendNoContent,
  validateBody
};
