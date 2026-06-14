describe('Test 24 - RNF06 cross-browser compatibility baseline', () => {
  const pages = ['/login.html', '/dashboard.html', '/mapa.html', '/admin.html', '/perfil.html'];

  pages.forEach((url) => {
    it(`Passo 1/2/3: abre ${url}, valida estrutura base e comportamento essencial`, () => {
      cy.visit(url, { failOnStatusCode: false });

      cy.document().its('contentType').should('include', 'text/html');
      cy.get('body').should('be.visible');
      cy.get('script').its('length').should('be.greaterThan', 0);

      cy.get('body').invoke('text').then((txt) => {
        expect((txt || '').trim().length).to.be.greaterThan(0);
      });
    });
  });
});
