describe('TC008-RF8 - Gestao de Avarias', () => {
  beforeEach(() => {
    cy.request('POST', '/operadores/login', {
      email: 'admin@glowpath.com',
      password: 'admin123'
    }).then(res => {
      Cypress.env('tokenAdmin', res.body.accessToken);
    });
  });

  it('Passo 1: filtrar avarias abertas e listar detalhes', () => {
    const token = Cypress.env('tokenAdmin');

    cy.request({
      method: 'GET',
      url: '/avarias?estado=pendente',
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      expect(res.status).to.eq(200);
      expect(res.body).to.be.an('array');
      res.body.forEach(item => {
        expect(item).to.have.property('descricao');
        expect(item).to.have.property('estado');
      });
    });
  });

  it('Passo 2: atribuir avaria a operador com prioridade alta', () => {
    const token = Cypress.env('tokenAdmin');

    cy.request({
      method: 'POST',
      url: '/avarias',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        descricao: 'Avaria para atribuicao UAT',
        severidade: 'alta',
        estado: 'pendente',
        id_poste: 3
      }
    }).then(created => {
      expect(created.status).to.eq(201);

      return cy.request({
        method: 'PATCH',
        url: `/avarias/${created.body.id_avaria}`,
        headers: { Authorization: `Bearer ${token}` },
        body: {
          estado: 'em_resolucao',
          descricao: 'Avaria atribuida ao operador de turno'
        }
      });
    }).then(updated => {
      expect(updated.status).to.eq(200);
      expect(updated.body.estado).to.eq('em_resolucao');
    });
  });

  it('Passo 3: resolver avaria com descricao e registar tempo total', () => {
    const token = Cypress.env('tokenAdmin');

    const inicio = Date.now();

    cy.request({
      method: 'POST',
      url: '/avarias',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        descricao: 'Avaria para encerramento UAT',
        severidade: 'media',
        estado: 'pendente',
        id_poste: 3
      }
    }).then(created => {
      const fim = Date.now();
      const minutosTotal = Math.max(1, Math.round((fim - inicio) / 60000));

      return cy.request({
        method: 'PATCH',
        url: `/avarias/${created.body.id_avaria}`,
        headers: { Authorization: `Bearer ${token}` },
        body: {
          estado: 'resolvida',
          descricao: `Resolvida com sucesso. Tempo total aproximado: ${minutosTotal} min.`
        }
      });
    }).then(updated => {
      expect(updated.status).to.eq(200);
      expect(updated.body.estado).to.eq('resolvida');
    });
  });
});
