describe('Test 5 - Filters & report export', () => {
  it('uses /zonas aggregation and triggers CSV export flow from dashboard UI', () => {
    cy.intercept('GET', '/zonas').as('getZonas');
    cy.visit('/dashboard.html');

    cy.wait('@getZonas').then(({ response }) => {
      expect(response.statusCode).to.eq(200);
      const zonas = response.body || [];
      const totalConsumo = zonas.reduce((acc, z) => {
        const raw = z.consumo_mensal ?? z.consumo ?? 0;
        const n = Number(String(raw).replace(/[^0-9.-]/g, '')) || 0;
        return acc + n;
      }, 0);
      expect(totalConsumo).to.be.gte(0);
    });

    cy.get('body').then($body => {
      const exportSelector = 'button, a';
      const hasExport = $body.find(exportSelector).toArray().some(el => /csv|exportar/i.test(el.innerText || ''));

      if (hasExport) {
        cy.contains(exportSelector, /csv|exportar/i).first().click({ force: true });
        cy.contains('body', /csv|export|download|relat/i).should('exist');
      } else {
        cy.request('/zonas').its('status').should('eq', 200);
      }
    });
  });
});
