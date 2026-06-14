describe('Test 4 - Dashboard UI Render', () => {
  it('opens dashboard.html and validates charts/tables selectors and /zonas-driven render', () => {
    cy.intercept('GET', '/zonas').as('getZonas');

    cy.visit('/dashboard.html');

    cy.wait('@getZonas').then(({ response }) => {
      expect(response.statusCode).to.eq(200);
      expect(response.body).to.be.an('array');
    });

    cy.get('#consumoEnergiaChart').should('exist');
    cy.get('#distribuicaoAvariasChart').should('exist');
    cy.get('#faultsLegendTableA').should('exist');
    cy.get('#faultsLegendTableB').should('exist');
    cy.get('#faultsTableBody').should('exist');
    cy.get('#maintenanceTableBody').should('exist');

    cy.get('#consumoEnergiaChart').should($el => {
      expect($el[0].tagName.toLowerCase()).to.eq('canvas');
    });
    cy.get('#distribuicaoAvariasChart').should($el => {
      expect($el[0].tagName.toLowerCase()).to.eq('canvas');
    });
  });
});
