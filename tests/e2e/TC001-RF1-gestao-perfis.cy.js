describe('Test 1 - Login UI + API', () => {
  it('validates login form selectors and POST /operadores/login returns accessToken + operator', () => {
    cy.visit('/login.html');

    cy.get('#emailInput').should('exist').and('be.visible');
    cy.get('#passwordInput').should('exist').and('be.visible');
    cy.get('#loginError').should('exist');

    cy.request('POST', '/operadores/login', {
      email: 'admin@glowpath.com',
      password: 'admin123'
    }).then(response => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property('accessToken').and.to.be.a('string').and.not.to.have.length(0);
      expect(response.body).to.have.property('operator');
      expect(response.body.operator).to.be.an('object');
    });
  });
});
