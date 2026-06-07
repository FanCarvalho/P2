const fs = require('fs');
const path = require('path');

const collectionPath = path.resolve(__dirname, '..', 'postman', 'GlowPath-API.postman_collection.json');
const environmentPath = path.resolve(__dirname, '..', 'postman', 'GlowPath-API.local.postman_environment.json');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function buildEnvironmentMap(environment) {
  const map = new Map();
  for (const entry of environment.values || []) {
    map.set(entry.key, entry.value == null ? '' : String(entry.value));
  }
  map.set('$timestamp', String(Date.now()));
  return map;
}

function updateEnvironmentValue(environment, key, value) {
  const stringValue = value == null ? '' : String(value);
  const existing = (environment.values || []).find(item => item.key === key);
  if (existing) {
    existing.value = stringValue;
    return;
  }

  environment.values = environment.values || [];
  environment.values.push({ key, value: stringValue, type: 'default', enabled: true });
}

function applyVariables(value, environmentMap) {
  if (typeof value === 'string') {
    return value.replace(/{{\s*([^}]+)\s*}}/g, (_, variableName) => environmentMap.get(variableName) || '');
  }

  if (Array.isArray(value)) {
    return value.map(item => applyVariables(item, environmentMap));
  }

  if (value && typeof value === 'object') {
    const result = {};
    for (const [key, entryValue] of Object.entries(value)) {
      result[key] = applyVariables(entryValue, environmentMap);
    }
    return result;
  }

  return value;
}

function flattenItems(items, acc = []) {
  for (const item of items || []) {
    if (Array.isArray(item.item)) {
      flattenItems(item.item, acc);
      continue;
    }

    acc.push(item);
  }
  return acc;
}

function detectPreviewLanguage(headers, body) {
  const contentTypeHeader = headers.find(header => String(header.key || '').toLowerCase() === 'content-type');
  const contentType = String(contentTypeHeader?.value || '').toLowerCase();
  if (contentType.includes('application/json')) {
    return 'json';
  }

  if (body && (body.trim().startsWith('{') || body.trim().startsWith('['))) {
    return 'json';
  }

  return 'text';
}

function updateVariablesFromResponse(environment, environmentMap, json) {
  if (!json || typeof json !== 'object') {
    return;
  }

  if (json.accessToken) {
    updateEnvironmentValue(environment, 'jwtToken', json.accessToken);
    environmentMap.set('jwtToken', String(json.accessToken));
  }

  const idMap = {
    id_operador: 'operatorId',
    id_perfil: 'profileId',
    id_sensor: 'sensorId',
    id_zona: 'zoneId',
    id_poste: 'postId',
    id_lampada: 'lampId',
    id_registo: 'recordId',
    id_agendamento: 'agendaId',
    id_avaria: 'faultId'
  };

  for (const [responseKey, envKey] of Object.entries(idMap)) {
    if (json[responseKey] !== undefined && json[responseKey] !== null) {
      updateEnvironmentValue(environment, envKey, json[responseKey]);
      environmentMap.set(envKey, String(json[responseKey]));
    }
  }
}

async function executeItem(item, environment, environmentMap) {
  const resolvedRequest = applyVariables(item.request, environmentMap);
  const method = resolvedRequest.method || 'GET';
  const headers = {};
  for (const header of resolvedRequest.header || []) {
    headers[header.key] = header.value;
  }

  const requestInit = { method, headers };
  if (resolvedRequest.body?.mode === 'raw') {
    requestInit.body = resolvedRequest.body.raw;
  }

  const response = await fetch(resolvedRequest.url.raw, requestInit);
  const responseText = await response.text();
  const responseHeaders = [];
  response.headers.forEach((value, key) => {
    responseHeaders.push({ key, value });
  });

  let parsedJson = null;
  try {
    parsedJson = JSON.parse(responseText);
  } catch {
    parsedJson = null;
  }

  updateVariablesFromResponse(environment, environmentMap, parsedJson);

  item.response = [
    {
      name: item.name,
      originalRequest: resolvedRequest,
      status: response.statusText,
      code: response.status,
      _postman_previewlanguage: detectPreviewLanguage(responseHeaders, responseText),
      header: responseHeaders,
      cookie: [],
      body: responseText
    }
  ];

  return { name: item.name, status: response.status, statusText: response.statusText };
}

async function main() {
  const collection = loadJson(collectionPath);
  const environment = loadJson(environmentPath);
  const environmentMap = buildEnvironmentMap(environment);
  const items = flattenItems(collection.item);
  const results = [];

  for (const item of items) {
    const result = await executeItem(item, environment, environmentMap);
    results.push(result);
    console.log(`${result.status} ${result.statusText} - ${result.name}`);
  }

  saveJson(collectionPath, collection);
  saveJson(environmentPath, environment);
  console.log(`Saved ${results.length} responses into ${collectionPath}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
