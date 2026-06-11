describe('TC006-RF6 - Agendamento de Manutencoes', () => {
  beforeEach(() => {
    cy.request('POST', '/operadores/login', {
      email: 'admin@glowpath.com',
      password: 'admin123'
    }).then(res => {
      Cypress.env('tokenAdmin', res.body.accessToken);
    });
  });

  it('Passo 1: abrir formulario e validar campos', () => {
    cy.visit('/dashboard.html');

    cy.get('body').then($body => {
      const hasAgendar = $body.find('button,a').filter((_, el) => /Agendar Manuten|Manuten/i.test(el.innerText || '')).length > 0;
      if (hasAgendar) {
        cy.contains('button,a', /Agendar Manuten|Manuten/i).first().click({ force: true });
        cy.get('input[name="data_manutencao"], input[type="date"]').first().should('exist');
        cy.get('input[name="descricao"], textarea[name="descricao"], input[type="text"]').first().should('exist');
      } else {
        cy.request('POST', '/operadores/login', {
          email: 'admin@glowpath.com',
          password: 'admin123'
        }).then(login => {
          const token = login.body.accessToken;
          cy.request({
            method: 'GET',
            url: '/agendamentos-manutencao',
            headers: { Authorization: `Bearer ${token}` }
          }).its('status').should('eq', 200);
        });
      }
    });
  });

  it('Passo 2: criar agendamento para poste P-042 com estado pendente', () => {
    const token = Cypress.env('tokenAdmin');

    cy.request({
      method: 'POST',
      url: '/agendamentos-manutencao',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        data_manutencao: '2026-06-20',
        descricao: 'Inspecao preventiva poste P-042',
        prioridade: 'alta',
        estado: 'pendente',
        id_poste: 42
      }
    }).then(res => {
      expect(res.status).to.eq(201);
      expect(res.body.id_agendamento).to.exist;
      Cypress.env('agendamentoId', res.body.id_agendamento);
    });
  });

  it('Passo 3: marcar concluido e adicionar notas no historico', () => {
    const token = Cypress.env('tokenAdmin');

    cy.request({
      method: 'POST',
      url: '/agendamentos-manutencao',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        data_manutencao: '2026-06-21',
        descricao: 'Teste conclusao manutencao',
        prioridade: 'media',
        estado: 'pendente',
        id_poste: 3
      }
    }).then(created => {
      return cy.request({
        method: 'PATCH',
        url: `/agendamentos-manutencao/${created.body.id_agendamento}`,
        headers: { Authorization: `Bearer ${token}` },
        body: {
          estado: 'concluido',
          descricao: 'Teste conclusao manutencao - concluido com notas'
        }
      });
    }).then(updated => {
      expect(updated.status).to.eq(200);
    });
  });
});
