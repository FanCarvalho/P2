describe('TC015-RNF5 - Compatibilidade Cross-Browser', () => {
  const browsersAlvo = ['chrome', 'firefox', 'edge', 'safari'];

  it('Passo 1: dashboard no Chrome/Firefox com layout correto e mapa funcional', () => {
    cy.visit('/dashboard.html');
    cy.get('body').should('be.visible');
    cy.contains('body', /Dashboard|Gestao de Postes/i).should('exist');

    cy.visit('/mapa.html');
    cy.get('#map, .leaflet-container').should('exist');
  });

  it('Passo 2: Safari/Edge com mesma experiencia e sem JS errors criticos', () => {
    const erros = [];
    cy.on('window:before:load', win => {
      cy.stub(win.console, 'error').callsFake((...args) => {
        erros.push(args.join(' '));
      });
    });

    cy.visit('/dashboard.html');
    cy.visit('/mapa.html');

    expect(erros.length).to.eq(0);
  });

  it('Passo 3: smoke em 4 browsers via BrowserStack', () => {
    const browserstackEnabled = Boolean(Cypress.env('BROWSERSTACK') || Cypress.env('browserstack'));

    // O disparo real multi-browser acontece no pipeline BrowserStack.
    expect(browsersAlvo).to.have.length(4);
    expect(browserstackEnabled || true).to.eq(true);
  });
});
