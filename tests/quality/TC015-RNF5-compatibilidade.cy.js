describe('Test 2 - Session check / api/me', () => {
  it('validates GET /api/me with token and authenticated session persistence', () => {
    cy.request('POST', '/operadores/login', {
      email: 'admin@glowpath.com',
      password: 'admin123'
    }).then(login => {
      expect(login.status).to.eq(200);
      expect(login.body).to.have.property('accessToken');
      expect(login.body).to.have.property('operator');

      const token = login.body.accessToken;
      const operator = login.body.operator;

      cy.visit('/login.html');

      cy.window().then(win => {
        win.localStorage.setItem('token', token);
        win.localStorage.setItem('operator', JSON.stringify(operator));
      });

      cy.request({
        method: 'GET',
        url: '/api/me',
        headers: { Authorization: `Bearer ${token}` }
      }).then(me => {
        expect(me.status).to.eq(200);
        expect(me.body).to.have.property('operator');
      });

      cy.visit('/dashboard.html');
      cy.window().then(win => {
        const storedToken = win.localStorage.getItem('token') || win.sessionStorage.getItem('token');
        expect(storedToken).to.be.a('string').and.not.to.have.length(0);
      });
    });
  });
});
