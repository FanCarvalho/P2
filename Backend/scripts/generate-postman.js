const fs = require('fs');
const path = require('path');

const outDir = path.resolve(__dirname, '..', 'postman');

function authHeader(useAuth = true) {
  return useAuth ? [{ key: 'Authorization', value: 'Bearer {{jwtToken}}' }] : [];
}

function jsonBody(body) {
  return {
    mode: 'raw',
    raw: JSON.stringify(body, null, 2)
  };
}

function url(pathname) {
  return {
    raw: `{{baseUrl}}${pathname}`,
    host: ['{{baseUrl}}'],
    path: pathname.replace(/^\//, '').split('/')
  };
}

function testScript(lines) {
  return [{
    listen: 'test',
    script: { type: 'text/javascript', exec: lines }
  }];
}

function makeRequest({ name, method, pathName, useAuth = true, body, tests, contentType = false }) {
  const headers = [...authHeader(useAuth)];
  if (contentType) {
    headers.push({ key: 'Content-Type', value: 'application/json' });
  }

  const request = {
    method,
    header: headers,
    url: url(pathName)
  };

  if (body !== undefined) {
    request.body = jsonBody(body);
  }

  return {
    name,
    request,
    event: testScript(tests)
  };
}

const folders = [
  {
    name: 'Auth & Support',
    item: [
      makeRequest({
        name: 'POST /operadores/login (success)',
        method: 'POST',
        pathName: '/operadores/login',
        useAuth: false,
        contentType: true,
        body: { email: 'admin@glowpath.com', password: 'admin123' },
        tests: [
          "pm.test('Status 200', () => pm.response.to.have.status(200));",
          'const j = pm.response.json();',
          "pm.test('Token exists', () => pm.expect(j.accessToken).to.be.a('string').and.not.empty);",
          "pm.environment.set('jwtToken', j.accessToken);"
        ]
      }),
      makeRequest({
        name: 'POST /operadores/login (error)',
        method: 'POST',
        pathName: '/operadores/login',
        useAuth: false,
        contentType: true,
        body: { email: 'admin@glowpath.com', password: 'invalid' },
        tests: ["pm.test('Status 401', () => pm.response.to.have.status(401));"]
      }),
      makeRequest({
        name: 'GET /api/config',
        method: 'GET',
        pathName: '/api/config',
        useAuth: false,
        tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"]
      }),
      makeRequest({
        name: 'GET /api/me (success)',
        method: 'GET',
        pathName: '/api/me',
        tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"]
      }),
      makeRequest({
        name: 'GET /api/me (error)',
        method: 'GET',
        pathName: '/api/me',
        useAuth: false,
        tests: ["pm.test('Status 401/403', () => pm.expect([401, 403]).to.include(pm.response.code));"]
      }),
      makeRequest({
        name: 'GET /api/user',
        method: 'GET',
        pathName: '/api/user',
        tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"]
      }),
      makeRequest({
        name: 'POST /api/user',
        method: 'POST',
        pathName: '/api/user',
        contentType: true,
        body: { bio: 'Updated by Postman collection' },
        tests: ["pm.test('Status success', () => pm.expect([200, 204]).to.include(pm.response.code));"]
      }),
      makeRequest({
        name: 'GET /api/iluminacao-publica',
        method: 'GET',
        pathName: '/api/iluminacao-publica',
        tests: ["pm.test('Status success', () => pm.expect([200, 204]).to.include(pm.response.code));"]
      })
    ]
  },
  {
    name: 'Operadores',
    item: [
      makeRequest({ name: 'GET /operadores', method: 'GET', pathName: '/operadores', tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"] }),
      makeRequest({ name: 'GET /operadores (error no token)', method: 'GET', pathName: '/operadores', useAuth: false, tests: ["pm.test('Status 401/403', () => pm.expect([401,403]).to.include(pm.response.code));"] }),
      makeRequest({
        name: 'POST /operadores',
        method: 'POST',
        pathName: '/operadores',
        contentType: true,
        body: { nome: 'Postman Operator', email: 'postman.op.{{$timestamp}}@empresa.com', password: 'password12345', nivel_acesso: 'operador', ativo: true },
        tests: ["pm.test('Status 201', () => pm.response.to.have.status(201));", 'const j = pm.response.json();', "if (j.id_operador) pm.environment.set('operatorId', j.id_operador);"]
      }),
      makeRequest({ name: 'POST /operadores (error)', method: 'POST', pathName: '/operadores', contentType: true, body: { nome: 'Missing fields' }, tests: ["pm.test('Status 400/409', () => pm.expect([400,409]).to.include(pm.response.code));"] }),
      makeRequest({ name: 'GET /operadores/:id', method: 'GET', pathName: '/operadores/{{operatorId}}', tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"] }),
      makeRequest({ name: 'PATCH /operadores/:id', method: 'PATCH', pathName: '/operadores/{{operatorId}}', contentType: true, body: { nome: 'Postman Operator Updated' }, tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"] }),
      makeRequest({ name: 'GET /niveis-acesso/:nivel/operadores', method: 'GET', pathName: '/niveis-acesso/operador/operadores', tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"] })
    ]
  },
  {
    name: 'Perfis Iluminacao',
    item: [
      makeRequest({ name: 'GET /perfis-iluminacao', method: 'GET', pathName: '/perfis-iluminacao', tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"] }),
      makeRequest({ name: 'POST /perfis-iluminacao', method: 'POST', pathName: '/perfis-iluminacao', contentType: true, body: { nome: 'Perfil Postman', hora_inicio: '18:00', hora_fim: '06:00', intensidade: 60 }, tests: ["pm.test('Status 201', () => pm.response.to.have.status(201));", 'const j = pm.response.json();', "if (j.id_perfil) pm.environment.set('profileId', j.id_perfil);"] }),
      makeRequest({ name: 'POST /perfis-iluminacao (error)', method: 'POST', pathName: '/perfis-iluminacao', contentType: true, body: {}, tests: ["pm.test('Status 400', () => pm.response.to.have.status(400));"] }),
      makeRequest({ name: 'GET /perfis-iluminacao/:id', method: 'GET', pathName: '/perfis-iluminacao/{{profileId}}', tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"] }),
      makeRequest({ name: 'PATCH /perfis-iluminacao/:id', method: 'PATCH', pathName: '/perfis-iluminacao/{{profileId}}', contentType: true, body: { intensidade: 65 }, tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"] }),
      makeRequest({ name: 'GET /perfis-iluminacao/:id/postes', method: 'GET', pathName: '/perfis-iluminacao/{{profileId}}/postes', tests: ["pm.test('Status success', () => pm.expect([200,404]).to.include(pm.response.code));"] })
    ]
  },
  {
    name: 'Sensores Movimento',
    item: [
      makeRequest({ name: 'GET /sensores-movimento', method: 'GET', pathName: '/sensores-movimento', tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"] }),
      makeRequest({ name: 'POST /sensores-movimento', method: 'POST', pathName: '/sensores-movimento', contentType: true, body: { modelo: 'SM-POSTMAN', sensibilidade: 75, alcance: 11.2, estado: 'ativo' }, tests: ["pm.test('Status 201', () => pm.response.to.have.status(201));", 'const j = pm.response.json();', "if (j.id_sensor) pm.environment.set('sensorId', j.id_sensor);"] }),
      makeRequest({ name: 'POST /sensores-movimento (error)', method: 'POST', pathName: '/sensores-movimento', contentType: true, body: {}, tests: ["pm.test('Status 400', () => pm.response.to.have.status(400));"] }),
      makeRequest({ name: 'GET /sensores-movimento/:id', method: 'GET', pathName: '/sensores-movimento/{{sensorId}}', tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"] }),
      makeRequest({ name: 'PATCH /sensores-movimento/:id', method: 'PATCH', pathName: '/sensores-movimento/{{sensorId}}', contentType: true, body: { sensibilidade: 80 }, tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"] }),
      makeRequest({ name: 'GET /sensores-movimento/:id/zonas', method: 'GET', pathName: '/sensores-movimento/{{sensorId}}/zonas', tests: ["pm.test('Status success', () => pm.expect([200,404]).to.include(pm.response.code));"] })
    ]
  },
  {
    name: 'Zonas',
    item: [
      makeRequest({ name: 'GET /zonas', method: 'GET', pathName: '/zonas', tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"] }),
      makeRequest({ name: 'POST /zonas', method: 'POST', pathName: '/zonas', contentType: true, body: { nome: 'Zona Postman', rua: 'Rua Postman', codigo_postal: '4000-111', id_sensor: '{{sensorId}}' }, tests: ["pm.test('Status 201', () => pm.response.to.have.status(201));", 'const j = pm.response.json();', "if (j.id_zona) pm.environment.set('zoneId', j.id_zona);"] }),
      makeRequest({ name: 'POST /zonas (error)', method: 'POST', pathName: '/zonas', contentType: true, body: {}, tests: ["pm.test('Status 400', () => pm.response.to.have.status(400));"] }),
      makeRequest({ name: 'GET /zonas/:id', method: 'GET', pathName: '/zonas/{{zoneId}}', tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"] }),
      makeRequest({ name: 'PATCH /zonas/:id', method: 'PATCH', pathName: '/zonas/{{zoneId}}', contentType: true, body: { rua: 'Rua Postman 2' }, tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"] }),
      makeRequest({ name: 'GET /zonas/:id/postes', method: 'GET', pathName: '/zonas/{{zoneId}}/postes', tests: ["pm.test('Status success', () => pm.expect([200,404]).to.include(pm.response.code));"] })
    ]
  },
  {
    name: 'Postes',
    item: [
      makeRequest({ name: 'GET /postes', method: 'GET', pathName: '/postes', tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"] }),
      makeRequest({ name: 'POST /postes', method: 'POST', pathName: '/postes', contentType: true, body: { id_zona: '{{zoneId}}', id_perfil: '{{profileId}}', latitude: 41.15, longitude: -8.61, altura: 8.7, data_instalacao: '2026-06-06', estado: 'ativo' }, tests: ["pm.test('Status 201', () => pm.response.to.have.status(201));", 'const j = pm.response.json();', "if (j.id_poste) pm.environment.set('postId', j.id_poste);"] }),
      makeRequest({ name: 'POST /postes (error)', method: 'POST', pathName: '/postes', contentType: true, body: {}, tests: ["pm.test('Status 400', () => pm.response.to.have.status(400));"] }),
      makeRequest({ name: 'GET /postes/:id', method: 'GET', pathName: '/postes/{{postId}}', tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"] }),
      makeRequest({ name: 'PATCH /postes/:id', method: 'PATCH', pathName: '/postes/{{postId}}', contentType: true, body: { estado: 'manutencao', intensidade_atual: 45 }, tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"] }),
      makeRequest({ name: 'GET /postes/:id/agendamentos-manutencao', method: 'GET', pathName: '/postes/{{postId}}/agendamentos-manutencao', tests: ["pm.test('Status success', () => pm.expect([200,404]).to.include(pm.response.code));"] }),
      makeRequest({ name: 'GET /postes/:id/avarias', method: 'GET', pathName: '/postes/{{postId}}/avarias', tests: ["pm.test('Status success', () => pm.expect([200,404]).to.include(pm.response.code));"] })
    ]
  },
  {
    name: 'Lampadas',
    item: [
      makeRequest({ name: 'GET /lampadas', method: 'GET', pathName: '/lampadas', tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"] }),
      makeRequest({ name: 'POST /lampadas', method: 'POST', pathName: '/lampadas', contentType: true, body: { id_poste: '{{postId}}', modelo: 'LED-POSTMAN', estado: 'ativa', potencia_watts: 50, luminosidade_max: 900, luminosidade_min: 250, tempo_vida_horas: 45000 }, tests: ["pm.test('Status 201', () => pm.response.to.have.status(201));", 'const j = pm.response.json();', "if (j.id_lampada) pm.environment.set('lampId', j.id_lampada);"] }),
      makeRequest({ name: 'POST /lampadas (error)', method: 'POST', pathName: '/lampadas', contentType: true, body: {}, tests: ["pm.test('Status 400', () => pm.response.to.have.status(400));"] }),
      makeRequest({ name: 'GET /lampadas/:id', method: 'GET', pathName: '/lampadas/{{lampId}}', tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"] }),
      makeRequest({ name: 'PATCH /lampadas/:id', method: 'PATCH', pathName: '/lampadas/{{lampId}}', contentType: true, body: { estado: 'avariada' }, tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"] }),
      makeRequest({ name: 'GET /lampadas/:id/registos', method: 'GET', pathName: '/lampadas/{{lampId}}/registos', tests: ["pm.test('Status success', () => pm.expect([200,404]).to.include(pm.response.code));"] })
    ]
  },
  {
    name: 'Registos Lampada',
    item: [
      makeRequest({ name: 'GET /registos-lampada', method: 'GET', pathName: '/registos-lampada', tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"] }),
      makeRequest({ name: 'POST /registos-lampada', method: 'POST', pathName: '/registos-lampada', contentType: true, body: { id_poste: '{{postId}}', modelo: 'LED-POSTMAN', potencia_watts: 50, luminosidade_max: 900, luminosidade_min: 250, estado: 'ativa' }, tests: ["pm.test('Status 201', () => pm.response.to.have.status(201));", 'const j = pm.response.json();', "if (j.id_registo) pm.environment.set('recordId', j.id_registo);"] }),
      makeRequest({ name: 'POST /registos-lampada (error)', method: 'POST', pathName: '/registos-lampada', contentType: true, body: {}, tests: ["pm.test('Status 400', () => pm.response.to.have.status(400));"] }),
      makeRequest({ name: 'GET /registos-lampada/:id', method: 'GET', pathName: '/registos-lampada/{{recordId}}', tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"] })
    ]
  },
  {
    name: 'Agendamentos Manutencao',
    item: [
      makeRequest({ name: 'GET /agendamentos-manutencao', method: 'GET', pathName: '/agendamentos-manutencao', tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"] }),
      makeRequest({ name: 'POST /agendamentos-manutencao', method: 'POST', pathName: '/agendamentos-manutencao', contentType: true, body: { data_manutencao: '2026-07-01', descricao: 'Revisao Postman', prioridade: 'media', estado: 'pendente', id_poste: '{{postId}}' }, tests: ["pm.test('Status 201', () => pm.response.to.have.status(201));", 'const j = pm.response.json();', "if (j.id_agendamento) pm.environment.set('agendaId', j.id_agendamento);"] }),
      makeRequest({ name: 'POST /agendamentos-manutencao (error)', method: 'POST', pathName: '/agendamentos-manutencao', contentType: true, body: {}, tests: ["pm.test('Status 400', () => pm.response.to.have.status(400));"] }),
      makeRequest({ name: 'GET /agendamentos-manutencao/:id', method: 'GET', pathName: '/agendamentos-manutencao/{{agendaId}}', tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"] }),
      makeRequest({ name: 'PATCH /agendamentos-manutencao/:id', method: 'PATCH', pathName: '/agendamentos-manutencao/{{agendaId}}', contentType: true, body: { estado: 'concluido' }, tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"] })
    ]
  },
  {
    name: 'Avarias',
    item: [
      makeRequest({ name: 'GET /avarias', method: 'GET', pathName: '/avarias', tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"] }),
      makeRequest({ name: 'POST /avarias', method: 'POST', pathName: '/avarias', contentType: true, body: { descricao: 'Avaria Postman', severidade: 'media', estado: 'pendente', id_poste: '{{postId}}', id_lampada: '{{lampId}}', id_zona: '{{zoneId}}' }, tests: ["pm.test('Status 201', () => pm.response.to.have.status(201));", 'const j = pm.response.json();', "if (j.id_avaria) pm.environment.set('faultId', j.id_avaria);"] }),
      makeRequest({ name: 'POST /avarias (error)', method: 'POST', pathName: '/avarias', contentType: true, body: {}, tests: ["pm.test('Status 400', () => pm.response.to.have.status(400));"] }),
      makeRequest({ name: 'GET /avarias/:id', method: 'GET', pathName: '/avarias/{{faultId}}', tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"] }),
      makeRequest({ name: 'PATCH /avarias/:id', method: 'PATCH', pathName: '/avarias/{{faultId}}', contentType: true, body: { estado: 'resolvida' }, tests: ["pm.test('Status 200', () => pm.response.to.have.status(200));"] })
    ]
  },
  {
    name: 'Cleanup',
    item: [
      makeRequest({ name: 'DELETE /avarias/:id', method: 'DELETE', pathName: '/avarias/{{faultId}}', tests: ["pm.test('Status delete', () => pm.expect([200,204,404]).to.include(pm.response.code));"] }),
      makeRequest({ name: 'DELETE /agendamentos-manutencao/:id', method: 'DELETE', pathName: '/agendamentos-manutencao/{{agendaId}}', tests: ["pm.test('Status delete', () => pm.expect([200,204,404]).to.include(pm.response.code));"] }),
      makeRequest({ name: 'DELETE /registos-lampada/:id', method: 'DELETE', pathName: '/registos-lampada/{{recordId}}', tests: ["pm.test('Status delete', () => pm.expect([200,204,404]).to.include(pm.response.code));"] }),
      makeRequest({ name: 'DELETE /lampadas/:id', method: 'DELETE', pathName: '/lampadas/{{lampId}}', tests: ["pm.test('Status delete', () => pm.expect([200,204,404]).to.include(pm.response.code));"] }),
      makeRequest({ name: 'DELETE /postes/:id', method: 'DELETE', pathName: '/postes/{{postId}}', tests: ["pm.test('Status delete', () => pm.expect([200,204,404]).to.include(pm.response.code));"] }),
      makeRequest({ name: 'DELETE /zonas/:id', method: 'DELETE', pathName: '/zonas/{{zoneId}}', tests: ["pm.test('Status delete', () => pm.expect([200,204,404]).to.include(pm.response.code));"] }),
      makeRequest({ name: 'DELETE /sensores-movimento/:id', method: 'DELETE', pathName: '/sensores-movimento/{{sensorId}}', tests: ["pm.test('Status delete', () => pm.expect([200,204,404]).to.include(pm.response.code));"] }),
      makeRequest({ name: 'DELETE /perfis-iluminacao/:id', method: 'DELETE', pathName: '/perfis-iluminacao/{{profileId}}', tests: ["pm.test('Status delete', () => pm.expect([200,204,404]).to.include(pm.response.code));"] }),
      makeRequest({ name: 'DELETE /operadores/:id', method: 'DELETE', pathName: '/operadores/{{operatorId}}', tests: ["pm.test('Status delete', () => pm.expect([200,204,404]).to.include(pm.response.code));"] })
    ]
  }
];

const collection = {
  info: {
    name: 'GlowPath API',
    _postman_id: 'c1a0df0a-4c17-4838-a35e-c30b25021e90',
    description: 'Colecao com todos os endpoints da API, organizada por recurso, com testes de sucesso e erro.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },
  item: folders,
  variable: [
    { key: 'baseUrl', value: 'http://127.0.0.1:3000' },
    { key: 'jwtToken', value: '' },
    { key: 'operatorId', value: '' },
    { key: 'profileId', value: '' },
    { key: 'sensorId', value: '' },
    { key: 'zoneId', value: '' },
    { key: 'postId', value: '' },
    { key: 'lampId', value: '' },
    { key: 'recordId', value: '' },
    { key: 'agendaId', value: '' },
    { key: 'faultId', value: '' }
  ]
};

const environment = {
  id: '0d58c09e-f94e-4514-bb3e-2808d0b4e665',
  name: 'GlowPath Local',
  values: [
    { key: 'baseUrl', value: 'http://127.0.0.1:3000', type: 'default', enabled: true },
    { key: 'jwtToken', value: '', type: 'secret', enabled: true },
    { key: 'operatorId', value: '', type: 'default', enabled: true },
    { key: 'profileId', value: '', type: 'default', enabled: true },
    { key: 'sensorId', value: '', type: 'default', enabled: true },
    { key: 'zoneId', value: '', type: 'default', enabled: true },
    { key: 'postId', value: '', type: 'default', enabled: true },
    { key: 'lampId', value: '', type: 'default', enabled: true },
    { key: 'recordId', value: '', type: 'default', enabled: true },
    { key: 'agendaId', value: '', type: 'default', enabled: true },
    { key: 'faultId', value: '', type: 'default', enabled: true }
  ],
  _postman_variable_scope: 'environment',
  _postman_exported_at: new Date().toISOString(),
  _postman_exported_using: 'GitHub Copilot'
};

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(path.join(outDir, 'GlowPath-API.postman_collection.json'), JSON.stringify(collection, null, 2));
fs.writeFileSync(path.join(outDir, 'GlowPath-API.local.postman_environment.json'), JSON.stringify(environment, null, 2));

console.log('Postman files generated in', outDir);