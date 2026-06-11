const { defineConfig } = require('cypress');

module.exports = defineConfig({
  video: false,
  screenshotOnRunFailure: true,
  e2e: {
    baseUrl: 'http://127.0.0.1:3000',
    specPattern: ['tests/e2e/**/*.cy.js', 'tests/quality/**/*.cy.js'],
    supportFile: false
  }
});
