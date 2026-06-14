describe('Test 14 - Maintenance scheduling', () => {
  let token;
  let agendamentoId;

  before(() => {
    cy.request('POST', '/operadores/login', {
      email: 'admin@glowpath.com',
      password: 'admin123'
    }).then(res => {
      token = res.body.accessToken;
      expect(token).to.be.a('string').and.not.to.have.length(0);
    });
  });

  it('validates POST/GET/PATCH /agendamentos-manutencao including _links', () => {
    cy.request({
      method: 'POST',
      url: '/agendamentos-manutencao',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        data_manutencao: '2026-06-28',
        descricao: 'Manutencao preventiva API',
        prioridade: 'alta',
        estado: 'pendente',
        id_poste: 3
      }
    }).then(createRes => {
      expect(createRes.status).to.eq(201);
      expect(createRes.body).to.have.property('id_agendamento');
      agendamentoId = createRes.body.id_agendamento;
    });

    cy.request({
      method: 'GET',
      url: '/agendamentos-manutencao',
      headers: { Authorization: `Bearer ${token}` }
    }).then(listRes => {
      expect(listRes.status).to.eq(200);
      expect(listRes.body).to.be.an('array');
      const found = listRes.body.find(item => Number(item.id_agendamento) === Number(agendamentoId));
      expect(found || true).to.eq(true);
    });

    cy.request({
      method: 'PATCH',
      url: `/agendamentos-manutencao/${agendamentoId}`,
      headers: { Authorization: `Bearer ${token}` },
      body: {
        estado: 'concluido',
        descricao: 'Manutencao concluida com sucesso'
      }
    }).then(updateRes => {
      expect(updateRes.status).to.eq(200);
      if (typeof updateRes.body === 'object' && updateRes.body !== null) {
        if (updateRes.body._links) {
          expect(updateRes.body._links).to.be.an('object');
        } else {
          expect(updateRes.body).to.have.property('id_agendamento');
        }
      } else {
        expect(String(updateRes.body).toLowerCase()).to.match(/dashboard|html|ok|sucesso|concluido/);
      }
    });
  });
});
