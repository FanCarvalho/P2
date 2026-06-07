const fs = require('fs');
const path = require('path');

const outDir = path.resolve(__dirname, '..', 'postman');

function makeUrl(pathname) {
  return {
    raw: `{{baseUrl}}${pathname}`,
    host: ['{{baseUrl}}'],
    path: pathname.replace(/^\//, '').split('/')
  };
}

function jsonBody(body) {
  return {
    mode: 'raw',
    raw: JSON.stringify(body, null, 2)
  };
}

function statusTest(code, label) {
  return `pm.test('${label}', function () { pm.response.to.have.status(${code}); });`;
}

function assignEnvIfPresent(responseKey, envKey) {
  return `if (json.${responseKey} !== undefined && json.${responseKey} !== null) { pm.environment.set('${envKey}', String(json.${responseKey})); }`;
}

function requestName(method, resourceName, role, code, description) {
  return `${method} ${resourceName} (${role}) - ${code} ${description}`;
}

function makeRequest({
  method,
  resourceName,
  role,
  code,
  description,
  pathName,
  tokenVar,
  body,
  testLines,
  contentType = false
}) {
  const headers = [];
  if (tokenVar) {
    headers.push({ key: 'Authorization', value: `Bearer {{${tokenVar}}}` });
  }
  if (contentType) {
    headers.push({ key: 'Content-Type', value: 'application/json' });
  }

  const request = {
    method,
    header: headers,
    url: makeUrl(pathName)
  };

  if (body !== undefined) {
    request.body = jsonBody(body);
  }

  return {
    name: requestName(method, resourceName, role, code, description),
    request,
    event: [
      {
        listen: 'test',
        script: {
          type: 'text/javascript',
          exec: testLines
        }
      }
    ]
  };
}

function idRequests(config) {
  const {
    folderName,
    resourceLabel,
    basePath,
    createBody,
    invalidBody,
    createIdKey,
    createIdVar,
    patchBody,
    deleteSuccess = true,
    createForbidden = false,
    listTokenVar = 'userToken'
  } = config;

  const itemPath = `${basePath}/{{${createIdVar}}}`;
  const missingPath = `${basePath}/999999`;

  const items = [
    makeRequest({
      method: 'GET',
      resourceName: resourceLabel,
      role: 'Users',
      code: 200,
      description: 'OK',
      pathName: basePath,
      tokenVar: listTokenVar,
      testLines: [statusTest(200, 'Status 200')]
    }),
    makeRequest({
      method: 'GET',
      resourceName: resourceLabel,
      role: 'No token',
      code: 401,
      description: 'Unauthorized',
      pathName: basePath,
      testLines: [statusTest(401, 'Status 401')]
    }),
    makeRequest({
      method: 'POST',
      resourceName: resourceLabel,
      role: 'Admin',
      code: 201,
      description: 'Created',
      pathName: basePath,
      tokenVar: 'adminToken',
      body: createBody,
      contentType: true,
      testLines: [
        statusTest(201, 'Status 201'),
        'const json = pm.response.json();',
        assignEnvIfPresent(createIdKey, createIdVar)
      ]
    }),
    makeRequest({
      method: 'POST',
      resourceName: resourceLabel,
      role: 'No token',
      code: 401,
      description: 'Unauthorized',
      pathName: basePath,
      body: createBody,
      contentType: true,
      testLines: [statusTest(401, 'Status 401')]
    })
  ];

  if (createForbidden) {
    items.push(
      makeRequest({
        method: 'POST',
        resourceName: resourceLabel,
        role: 'Cliente',
        code: 403,
        description: 'Forbidden',
        pathName: basePath,
        tokenVar: 'clientToken',
        body: createBody,
        contentType: true,
        testLines: [statusTest(403, 'Status 403')]
      })
    );
  }

  items.push(
    makeRequest({
      method: 'POST',
      resourceName: resourceLabel,
      role: 'Admin',
      code: 400,
      description: 'Bad Request',
      pathName: basePath,
      tokenVar: 'adminToken',
      body: invalidBody,
      contentType: true,
      testLines: [statusTest(400, 'Status 400')]
    }),
    makeRequest({
      method: 'GET',
      resourceName: resourceLabel,
      role: 'Users',
      code: 200,
      description: 'OK',
      pathName: itemPath,
      tokenVar: 'userToken',
      testLines: [statusTest(200, 'Status 200')]
    }),
    makeRequest({
      method: 'GET',
      resourceName: resourceLabel,
      role: 'No token',
      code: 401,
      description: 'Unauthorized',
      pathName: itemPath,
      testLines: [statusTest(401, 'Status 401')]
    }),
    makeRequest({
      method: 'GET',
      resourceName: resourceLabel,
      role: 'Users',
      code: 404,
      description: 'Not Found',
      pathName: missingPath,
      tokenVar: 'userToken',
      testLines: [statusTest(404, 'Status 404')]
    }),
    makeRequest({
      method: 'PATCH',
      resourceName: resourceLabel,
      role: 'Admin',
      code: 200,
      description: 'OK',
      pathName: itemPath,
      tokenVar: 'adminToken',
      body: patchBody,
      contentType: true,
      testLines: [statusTest(200, 'Status 200')]
    }),
    makeRequest({
      method: 'PATCH',
      resourceName: resourceLabel,
      role: 'No token',
      code: 401,
      description: 'Unauthorized',
      pathName: itemPath,
      body: patchBody,
      contentType: true,
      testLines: [statusTest(401, 'Status 401')]
    }),
    makeRequest({
      method: 'PATCH',
      resourceName: resourceLabel,
      role: 'Admin',
      code: 404,
      description: 'Not Found',
      pathName: missingPath,
      tokenVar: 'adminToken',
      body: patchBody,
      contentType: true,
      testLines: [statusTest(404, 'Status 404')]
    }),
    makeRequest({
      method: 'DELETE',
      resourceName: resourceLabel,
      role: 'Admin',
      code: 404,
      description: 'Not Found',
      pathName: missingPath,
      tokenVar: 'adminToken',
      testLines: [statusTest(404, 'Status 404')]
    })
  );

  if (deleteSuccess) {
    items.push(
      makeRequest({
        method: 'DELETE',
        resourceName: resourceLabel,
        role: 'Admin',
        code: 204,
        description: 'No Content',
        pathName: itemPath,
        tokenVar: 'adminToken',
        testLines: [statusTest(204, 'Status 204')]
      })
    );
  }

  return { name: folderName, item: items };
}

const authFolder = {
  name: 'Auth e Apoio',
  item: [
    makeRequest({
      method: 'POST',
      resourceName: 'Login',
      role: 'Admin',
      code: 200,
      description: 'OK',
      pathName: '/operadores/login',
      body: { email: 'admin@glowpath.com', password: 'admin123' },
      contentType: true,
      testLines: [
        statusTest(200, 'Status 200'),
        'const json = pm.response.json();',
        "pm.environment.set('adminToken', String(json.accessToken));",
        "pm.environment.set('jwtToken', String(json.accessToken));"
      ]
    }),
    makeRequest({
      method: 'POST',
      resourceName: 'Login',
      role: 'Users',
      code: 200,
      description: 'OK',
      pathName: '/operadores/login',
      body: { email: 'carla.pereira.2@empresa.com', password: 'pass8251' },
      contentType: true,
      testLines: [
        statusTest(200, 'Status 200'),
        'const json = pm.response.json();',
        "pm.environment.set('userToken', String(json.accessToken));"
      ]
    }),
    makeRequest({
      method: 'POST',
      resourceName: 'Login',
      role: 'Cliente',
      code: 200,
      description: 'OK',
      pathName: '/operadores/login',
      body: { email: 'bruno.santos.3@empresa.com', password: 'pass4218' },
      contentType: true,
      testLines: [
        statusTest(200, 'Status 200'),
        'const json = pm.response.json();',
        "pm.environment.set('clientToken', String(json.accessToken));"
      ]
    }),
    makeRequest({
      method: 'POST',
      resourceName: 'Login',
      role: 'Credenciais invalidas',
      code: 401,
      description: 'Unauthorized',
      pathName: '/operadores/login',
      body: { email: 'admin@glowpath.com', password: 'errada' },
      contentType: true,
      testLines: [statusTest(401, 'Status 401')]
    }),
    makeRequest({
      method: 'GET',
      resourceName: 'Config',
      role: 'No token',
      code: 200,
      description: 'OK',
      pathName: '/api/config',
      testLines: [statusTest(200, 'Status 200')]
    }),
    makeRequest({
      method: 'GET',
      resourceName: 'Perfil Atual',
      role: 'Users',
      code: 200,
      description: 'OK',
      pathName: '/api/me',
      tokenVar: 'userToken',
      testLines: [statusTest(200, 'Status 200')]
    }),
    makeRequest({
      method: 'GET',
      resourceName: 'Perfil Atual',
      role: 'No token',
      code: 401,
      description: 'Unauthorized',
      pathName: '/api/me',
      testLines: [statusTest(401, 'Status 401')]
    }),
    makeRequest({
      method: 'GET',
      resourceName: 'Utilizador API',
      role: 'Users',
      code: 200,
      description: 'OK',
      pathName: '/api/user',
      tokenVar: 'userToken',
      testLines: [statusTest(200, 'Status 200')]
    }),
    makeRequest({
      method: 'POST',
      resourceName: 'Utilizador API',
      role: 'Admin',
      code: 200,
      description: 'OK',
      pathName: '/api/user',
      tokenVar: 'adminToken',
      body: { bio: 'Updated by Postman collection' },
      contentType: true,
      testLines: [statusTest(200, 'Status 200')]
    }),
    makeRequest({
      method: 'GET',
      resourceName: 'Iluminacao Publica',
      role: 'Users',
      code: 200,
      description: 'OK',
      pathName: '/api/iluminacao-publica',
      tokenVar: 'userToken',
      testLines: [statusTest(200, 'Status 200')]
    })
  ]
};

const operadoresFolder = idRequests({
  folderName: 'Operadores',
  resourceLabel: 'Operadores',
  basePath: '/operadores',
  createBody: { nome: 'Postman Operator', email: 'postman.op.{{$timestamp}}@empresa.com', password: 'password12345', nivel_acesso: 'operador', ativo: true },
  invalidBody: { nome: 'Sem email' },
  createIdKey: 'id_operador',
  createIdVar: 'createdOperatorId',
  patchBody: { nome: 'Postman Operator Updated' },
  createForbidden: true
});
operadoresFolder.item.push(
  makeRequest({
    method: 'GET',
    resourceName: 'Niveis-Acesso/operadores',
    role: 'Users',
    code: 200,
    description: 'OK',
    pathName: '/niveis-acesso/operador/operadores',
    tokenVar: 'userToken',
    testLines: [statusTest(200, 'Status 200')]
  }),
  makeRequest({
    method: 'GET',
    resourceName: 'Niveis-Acesso/operadores',
    role: 'No token',
    code: 401,
    description: 'Unauthorized',
    pathName: '/niveis-acesso/operador/operadores',
    testLines: [statusTest(401, 'Status 401')]
  })
);

const perfisFolder = idRequests({
  folderName: 'Perfis de Iluminação',
  resourceLabel: 'Perfis de Iluminação',
  basePath: '/perfis-iluminacao',
  createBody: { nome: 'Perfil Postman', hora_inicio: '18:00', hora_fim: '06:00', intensidade: 60 },
  invalidBody: {},
  createIdKey: 'id_perfil',
  createIdVar: 'createdProfileId',
  patchBody: { intensidade: 65 }
});
perfisFolder.item.push(
  makeRequest({
    method: 'GET',
    resourceName: 'Perfis de Iluminação',
    role: 'Users',
    code: 200,
    description: 'OK',
    pathName: '/perfis-iluminacao/{{seededProfileId}}/postes',
    tokenVar: 'userToken',
    testLines: [statusTest(200, 'Status 200')]
  }),
  makeRequest({
    method: 'GET',
    resourceName: 'Perfis de Iluminação',
    role: 'No token',
    code: 401,
    description: 'Unauthorized',
    pathName: '/perfis-iluminacao/{{seededProfileId}}/postes',
    testLines: [statusTest(401, 'Status 401')]
  }),
  makeRequest({
    method: 'GET',
    resourceName: 'Perfis de Iluminação',
    role: 'Users',
    code: 404,
    description: 'Not Found',
    pathName: '/perfis-iluminacao/999999/postes',
    tokenVar: 'userToken',
    testLines: [statusTest(404, 'Status 404')]
  })
);

const sensoresFolder = idRequests({
  folderName: 'Sensores de Movimento',
  resourceLabel: 'Sensores de Movimento',
  basePath: '/sensores-movimento',
  createBody: { modelo: 'SM-POSTMAN', sensibilidade: 75, alcance: 11.2, estado: 'ativo' },
  invalidBody: {},
  createIdKey: 'id_sensor',
  createIdVar: 'createdSensorId',
  patchBody: { sensibilidade: 80 }
});
sensoresFolder.item.push(
  makeRequest({
    method: 'GET',
    resourceName: 'Sensores de Movimento',
    role: 'Users',
    code: 200,
    description: 'OK',
    pathName: '/sensores-movimento/{{seededSensorId}}/zonas',
    tokenVar: 'userToken',
    testLines: [statusTest(200, 'Status 200')]
  }),
  makeRequest({
    method: 'GET',
    resourceName: 'Sensores de Movimento',
    role: 'No token',
    code: 401,
    description: 'Unauthorized',
    pathName: '/sensores-movimento/{{seededSensorId}}/zonas',
    testLines: [statusTest(401, 'Status 401')]
  }),
  makeRequest({
    method: 'GET',
    resourceName: 'Sensores de Movimento',
    role: 'Users',
    code: 404,
    description: 'Not Found',
    pathName: '/sensores-movimento/999999/zonas',
    tokenVar: 'userToken',
    testLines: [statusTest(404, 'Status 404')]
  })
);

const zonasFolder = idRequests({
  folderName: 'Zonas',
  resourceLabel: 'Zonas',
  basePath: '/zonas',
  createBody: { nome: 'Zona Postman', rua: 'Rua Postman', codigo_postal: '4000-111', id_sensor: '{{seededSensorId}}' },
  invalidBody: {},
  createIdKey: 'id_zona',
  createIdVar: 'createdZoneId',
  patchBody: { rua: 'Rua Postman 2' }
});
zonasFolder.item.push(
  makeRequest({
    method: 'GET',
    resourceName: 'Zonas',
    role: 'Users',
    code: 200,
    description: 'OK',
    pathName: '/zonas/{{seededZoneId}}/postes',
    tokenVar: 'userToken',
    testLines: [statusTest(200, 'Status 200')]
  }),
  makeRequest({
    method: 'GET',
    resourceName: 'Zonas',
    role: 'No token',
    code: 401,
    description: 'Unauthorized',
    pathName: '/zonas/{{seededZoneId}}/postes',
    testLines: [statusTest(401, 'Status 401')]
  }),
  makeRequest({
    method: 'GET',
    resourceName: 'Zonas',
    role: 'Users',
    code: 404,
    description: 'Not Found',
    pathName: '/zonas/999999/postes',
    tokenVar: 'userToken',
    testLines: [statusTest(404, 'Status 404')]
  })
);

const postesFolder = idRequests({
  folderName: 'Postes',
  resourceLabel: 'Postes',
  basePath: '/postes',
  createBody: { id_zona: '{{seededZoneId}}', id_perfil: '{{seededProfileId}}', latitude: 41.15, longitude: -8.61, altura: 8.7, data_instalacao: '2026-06-06', estado: 'ativo' },
  invalidBody: {},
  createIdKey: 'id_poste',
  createIdVar: 'createdPostId',
  patchBody: { estado: 'manutencao', intensidade_atual: 45 }
});
postesFolder.item.push(
  makeRequest({
    method: 'GET',
    resourceName: 'Postes',
    role: 'Users',
    code: 200,
    description: 'OK',
    pathName: '/postes/{{seededPostId}}/agendamentos-manutencao',
    tokenVar: 'userToken',
    testLines: [statusTest(200, 'Status 200')]
  }),
  makeRequest({
    method: 'GET',
    resourceName: 'Postes',
    role: 'No token',
    code: 401,
    description: 'Unauthorized',
    pathName: '/postes/{{seededPostId}}/agendamentos-manutencao',
    testLines: [statusTest(401, 'Status 401')]
  }),
  makeRequest({
    method: 'GET',
    resourceName: 'Postes',
    role: 'Users',
    code: 404,
    description: 'Not Found',
    pathName: '/postes/999999/agendamentos-manutencao',
    tokenVar: 'userToken',
    testLines: [statusTest(404, 'Status 404')]
  }),
  makeRequest({
    method: 'GET',
    resourceName: 'Postes',
    role: 'Users',
    code: 200,
    description: 'OK',
    pathName: '/postes/{{seededPostId}}/avarias',
    tokenVar: 'userToken',
    testLines: [statusTest(200, 'Status 200')]
  }),
  makeRequest({
    method: 'GET',
    resourceName: 'Postes',
    role: 'No token',
    code: 401,
    description: 'Unauthorized',
    pathName: '/postes/{{seededPostId}}/avarias',
    testLines: [statusTest(401, 'Status 401')]
  }),
  makeRequest({
    method: 'GET',
    resourceName: 'Postes',
    role: 'Users',
    code: 404,
    description: 'Not Found',
    pathName: '/postes/999999/avarias',
    tokenVar: 'userToken',
    testLines: [statusTest(404, 'Status 404')]
  })
);

const lampadasFolder = idRequests({
  folderName: 'Lâmpadas',
  resourceLabel: 'Lâmpadas',
  basePath: '/lampadas',
  createBody: { id_poste: '{{seededPostId}}', modelo: 'LED-POSTMAN', estado: 'ativa', potencia_watts: 50, luminosidade_max: 900, luminosidade_min: 250, tempo_vida_horas: 45000 },
  invalidBody: {},
  createIdKey: 'id_lampada',
  createIdVar: 'createdLampId',
  patchBody: { estado: 'avariada' }
});
lampadasFolder.item.push(
  makeRequest({
    method: 'GET',
    resourceName: 'Lâmpadas',
    role: 'Users',
    code: 200,
    description: 'OK',
    pathName: '/lampadas/{{seededLampId}}/registos',
    tokenVar: 'userToken',
    testLines: [statusTest(200, 'Status 200')]
  }),
  makeRequest({
    method: 'GET',
    resourceName: 'Lâmpadas',
    role: 'No token',
    code: 401,
    description: 'Unauthorized',
    pathName: '/lampadas/{{seededLampId}}/registos',
    testLines: [statusTest(401, 'Status 401')]
  }),
  makeRequest({
    method: 'GET',
    resourceName: 'Lâmpadas',
    role: 'Users',
    code: 404,
    description: 'Not Found',
    pathName: '/lampadas/999999/registos',
    tokenVar: 'userToken',
    testLines: [statusTest(404, 'Status 404')]
  })
);

const registosFolder = idRequests({
  folderName: 'Registos de Lâmpada',
  resourceLabel: 'Registos de Lâmpada',
  basePath: '/registos-lampada',
  createBody: { id_poste: '{{seededPostId}}', modelo: 'LED-POSTMAN', potencia_watts: 50, luminosidade_max: 900, luminosidade_min: 250, estado: 'ativa' },
  invalidBody: {},
  createIdKey: 'id_registo',
  createIdVar: 'createdRecordId',
  patchBody: { luminosidade: 75 },
  deleteSuccess: true
});
registosFolder.item = registosFolder.item.filter(item => !item.name.startsWith('PATCH Registos Lampada'));

const agendamentosFolder = idRequests({
  folderName: 'Agendamentos de Manutenção',
  resourceLabel: 'Agendamentos de Manutenção',
  basePath: '/agendamentos-manutencao',
  createBody: { data_manutencao: '2026-07-01', descricao: 'Revisao Postman', prioridade: 'media', estado: 'pendente', id_poste: '{{seededPostId}}' },
  invalidBody: {},
  createIdKey: 'id_agendamento',
  createIdVar: 'createdAgendaId',
  patchBody: { estado: 'concluido' }
});

const avariasFolder = idRequests({
  folderName: 'Avarias',
  resourceLabel: 'Avarias',
  basePath: '/avarias',
  createBody: { descricao: 'Avaria Postman', severidade: 'media', estado: 'pendente', id_poste: '{{seededPostId}}', id_lampada: '{{seededLampId}}', id_zona: '{{seededZoneId}}' },
  invalidBody: {},
  createIdKey: 'id_avaria',
  createIdVar: 'createdFaultId',
  patchBody: { estado: 'resolvida' }
});

const collection = {
  info: {
    name: 'MODO',
    _postman_id: 'f6635f5c-cf2b-4a69-aed7-0dc302bb36af',
    description: 'Postman collection organized by resource with multiple scenarios per endpoint.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },
  item: [
    authFolder,
    operadoresFolder,
    postesFolder,
    lampadasFolder,
    zonasFolder,
    sensoresFolder,
    perfisFolder,
    registosFolder,
    agendamentosFolder,
    avariasFolder
  ],
  variable: [
    { key: 'baseUrl', value: 'http://127.0.0.1:3000' },
    { key: 'jwtToken', value: '' },
    { key: 'adminToken', value: '' },
    { key: 'userToken', value: '' },
    { key: 'clientToken', value: '' },
    { key: 'seededProfileId', value: '1' },
    { key: 'seededSensorId', value: '1' },
    { key: 'seededZoneId', value: '1' },
    { key: 'seededPostId', value: '1' },
    { key: 'seededLampId', value: '1' },
    { key: 'createdOperatorId', value: '' },
    { key: 'createdProfileId', value: '' },
    { key: 'createdSensorId', value: '' },
    { key: 'createdZoneId', value: '' },
    { key: 'createdPostId', value: '' },
    { key: 'createdLampId', value: '' },
    { key: 'createdRecordId', value: '' },
    { key: 'createdAgendaId', value: '' },
    { key: 'createdFaultId', value: '' }
  ]
};

const environment = {
  id: '0d58c09e-f94e-4514-bb3e-2808d0b4e665',
  name: 'GlowPath Local',
  values: collection.variable.map(variable => ({
    key: variable.key,
    value: variable.value,
    type: variable.key.toLowerCase().includes('token') ? 'secret' : 'default',
    enabled: true
  })),
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
