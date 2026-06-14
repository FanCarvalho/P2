const fs = require('fs');
const path = require('path');

describe('Test 27 - RNF09 modular architecture separation', () => {
  it('Passo 1: backend modular possui router/handlers/auth/filters/datastore', () => {
    const backendSrc = path.resolve(__dirname, '../../Backend/src');
    const expected = ['router.js', 'apiHandlers.js', 'auth.js', 'filters.js', 'dataStore.js'];

    expected.forEach((file) => {
      const target = path.join(backendSrc, file);
      expect(fs.existsSync(target)).toBe(true);
    });
  });

  it('Passo 2: frontend separado por dominios HTML/CSS/JS', () => {
    const frontendRoot = path.resolve(__dirname, '../../public');
    const htmlDir = path.join(frontendRoot, 'html');
    const cssDir = path.join(frontendRoot, 'css');
    const jsDir = path.join(frontendRoot, 'js');

    expect(fs.existsSync(htmlDir)).toBe(true);
    expect(fs.existsSync(cssDir)).toBe(true);
    expect(fs.existsSync(jsDir)).toBe(true);

    const htmlFiles = fs.readdirSync(htmlDir).filter((f) => f.endsWith('.html'));
    const cssFiles = fs.readdirSync(cssDir).filter((f) => f.endsWith('.css'));
    const jsFiles = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js'));

    expect(htmlFiles.length).toBeGreaterThan(0);
    expect(cssFiles.length).toBeGreaterThan(0);
    expect(jsFiles.length).toBeGreaterThan(0);
  });

  it('Passo 3: componentes partilhados existem para reutilizacao UI', () => {
    const componentsDir = path.resolve(__dirname, '../../public/components');
    const expectedComponents = ['sidebar.html', 'topbar.html', 'footer.html'];

    expectedComponents.forEach((file) => {
      const target = path.join(componentsDir, file);
      expect(fs.existsSync(target)).toBe(true);
    });
  });
});
