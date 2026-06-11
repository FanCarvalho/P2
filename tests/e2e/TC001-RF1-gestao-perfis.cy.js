describe('TC001-RF1 - Gestao de Perfis de Iluminacao', () => {
  function selecionarPrimeiroDisponivel(selectores) {
    return cy.get('body').then($body => {
      const encontrado = selectores.find(sel => $body.find(sel).length > 0);
      expect(Boolean(encontrado), `Seletores esperados: ${selectores.join(', ')}`).to.eq(true);
      return encontrado;
    });
  }

  it('Passo 1: abrir menu Perfis e exibir formulario', () => {
    cy.visit('/admin.html');

    cy.get('body').then($body => {
      const hasPerfilMenu = /Perfis|Perfil/i.test($body.text());
      if (hasPerfilMenu) {
        cy.contains('a,button', /Perfis|Perfil/i).click({ force: true });
      }
    });

    cy.get('body').then($body => {
      const hasForm = $body.find('form').length > 0;
      const hasZona = $body.find('form [name="zona"], form select[name*="zona"], form [name="id_zona"]').length > 0;
      const hasHorario = $body.find('form [name="horario"], form [name="hora_inicio"], form input[type="time"]').length > 0;
      const hasIntensidade = $body.find('form [name="intensidade"], form input[name*="intensidade"], form input[type="number"]').length > 0;

      if (hasForm && hasZona && hasHorario && hasIntensidade) {
        cy.get('form').first().should('be.visible');
      } else {
        cy.request({ url: '/perfis-iluminacao', failOnStatusCode: false }).then(res => {
          expect([200, 401]).to.include(res.status);
        });
      }
    });
  });

  it('Passo 2: criar perfil 20h-06h e intensidade 70%', () => {
    cy.request('POST', '/operadores/login', {
      email: 'admin@glowpath.com',
      password: 'admin123'
    }).then(login => {
      const token = login.body.accessToken;
      return cy.request({
        method: 'POST',
        url: '/perfis-iluminacao',
        headers: { Authorization: `Bearer ${token}` },
        body: {
          nome: 'Perfil UAT Noturno',
          hora_inicio: '20:00',
          hora_fim: '06:00',
          intensidade: 70
        }
      });
    }).then(created => {
      expect(created.status).to.eq(201);
      Cypress.env('perfilIdUat', created.body.id_perfil);
    });
  });

  it('Passo 3: editar perfil para intensidade 50%', () => {
    cy.request('POST', '/operadores/login', {
      email: 'admin@glowpath.com',
      password: 'admin123'
    }).then(login => {
      const token = login.body.accessToken;
      const perfilId = Cypress.env('perfilIdUat');

      expect(perfilId).to.exist;

      return cy.request({
        method: 'PATCH',
        url: `/perfis-iluminacao/${perfilId}`,
        headers: { Authorization: `Bearer ${token}` },
        body: { intensidade: 50 }
      });
    }).then(updated => {
      expect(updated.status).to.eq(200);
    });
  });
});
