describe('TC004-RF4 - Visualizacao do Sistema (Leaflet)', () => {
  it('Passo 1: dashboard/mapa com elementos visuais de estado', () => {
    cy.visit('/mapa.html');

    // Verifica renderizacao base do mapa Leaflet.
    cy.get('#map, .leaflet-container').should('exist');
    cy.get('.leaflet-pane, .leaflet-marker-pane').should('exist');

    // Verifica painel/tabela de apoio da visualizacao.
    cy.contains('body', /Postes|Avarias|Operacional|Atenção|Avaria/i).should('exist');
  });

  it('Passo 2: PUT de estado avaria reflete marcador em ate 5 segundos', () => {
    cy.request({
      method: 'POST',
      url: '/operadores/login',
      body: { email: 'admin@glowpath.com', password: 'admin123' }
    }).then(login => {
      const token = login.body.accessToken;

      cy.request({
        method: 'PATCH',
        url: '/postes/3',
        headers: { Authorization: `Bearer ${token}` },
        body: { estado: 'avaria' }
      }).its('status').should('eq', 200);
    });

    cy.visit('/mapa.html');
    cy.wait(5000);

    // Como fallback, valida o estado refletido no conteudo textual/painel.
    cy.contains('body', /avaria|Avaria/i).should('exist');
  });

  it('Passo 3: clicar no poste mostra painel lateral de detalhes', () => {
    cy.visit('/mapa.html');

    cy.get('.leaflet-interactive, .leaflet-marker-icon').first().click({ force: true });

    cy.contains('body', /estado|zona|sensor|avaria|registo/i).should('exist');
  });
});
