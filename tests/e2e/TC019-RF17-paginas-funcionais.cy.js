describe('Test 19 - RF17 Frontend functional pages and shared components', () => {
  it('validates login page loads and login module script is present', () => {
    cy.visit('/login.html');
    cy.get('body').should('exist');
    cy.get('#loginForm').should('exist');
    cy.get('#emailInput').should('exist');
    cy.get('#passwordInput').should('exist');
    cy.get('script[src*="auth.js"]').should('exist');
  });

  it('validates application pages load with shared components and module scripts', () => {
    const appPages = ['/dashboard.html', '/mapa.html', '/admin.html', '/market.html', '/perfil.html'];

    appPages.forEach((url) => {
      cy.visit(url, { failOnStatusCode: false });
      cy.document().its('contentType').should('include', 'text/html');
      cy.get('body').should('be.visible');
      cy.get('body').invoke('text').should('not.be.empty');
      cy.get('head script[src*="auth.js"], script[src*="auth.js"]').should('exist');
    });
  });
});
