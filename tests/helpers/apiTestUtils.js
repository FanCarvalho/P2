const express = require('express');
const request = require('supertest');
const { handleRequest } = require('../../Backend/src/router');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use((req, res, next) => {
    try {
      const result = handleRequest(req, res);
      if (result && typeof result.then === 'function') {
        result.catch(next);
      }
    } catch (error) {
      next(error);
    }
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    res.status(500).json({
      description: 'Internal server error',
      errors: { server: [error.message || 'Unexpected error'] }
    });
  });

  return app;
}

async function loginAs(email = 'admin@glowpath.com', password = 'admin123') {
  const app = createApp();
  const response = await request(app)
    .post('/operadores/login')
    .send({ email, password });

  if (response.status !== 200 || !response.body.accessToken) {
    throw new Error(`Falha no login de teste para ${email}. status=${response.status}`);
  }

  return {
    app,
    token: response.body.accessToken,
    operator: response.body.operator,
    accessToken: response.body.accessToken
  };
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

async function createOperatorAndLoginAdminToOperator() {
  const { app, token: adminToken } = await loginAs();
  const unique = Date.now();

  const createResponse = await request(app)
    .post('/operadores')
    .set(authHeader(adminToken))
    .send({
      nome: `Operador Teste ${unique}`,
      email: `operador.${unique}@glowpath.local`,
      password: 'operador1234',
      nivel_acesso: 'operador'
    });

  if (![201, 409].includes(createResponse.status)) {
    throw new Error(`Nao foi possivel criar operador de teste. status=${createResponse.status}`);
  }

  const loginResponse = await request(app)
    .post('/operadores/login')
    .send({
      email: `operador.${unique}@glowpath.local`,
      password: 'operador1234'
    });

  if (loginResponse.status !== 200 || !loginResponse.body.accessToken) {
    return null;
  }

  return {
    app,
    token: loginResponse.body.accessToken,
    operator: loginResponse.body.operator
  };
}

module.exports = {
  authHeader,
  createApp,
  createOperatorAndLoginAdminToOperator,
  loginAs
};
