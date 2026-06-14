const fs = require('fs');
const path = require('path');

describe('Test 25 - RNF07 automated testability by layers', () => {
  it('Passo 1: estrutura de pastas de testes por camada existe', () => {
    const root = path.resolve(__dirname, '..');
    const expectedDirs = ['unit', 'e2e', 'quality', 'resilience', 'performance'];

    expectedDirs.forEach((dir) => {
      const full = path.join(root, dir);
      expect(fs.existsSync(full)).toBe(true);
      expect(fs.statSync(full).isDirectory()).toBe(true);
    });
  });

  it('Passo 2: cada camada tem pelo menos um ficheiro de teste', () => {
    const root = path.resolve(__dirname, '..');
    const layerPatterns = {
      unit: /\.test\.js$/i,
      e2e: /\.cy\.js$/i,
      quality: /\.(js|cy\.js)$/i,
      resilience: /\.test\.js$/i,
      performance: /\.js$/i
    };

    Object.entries(layerPatterns).forEach(([layer, pattern]) => {
      const files = fs.readdirSync(path.join(root, layer)).filter((f) => pattern.test(f));
      expect(files.length).toBeGreaterThan(0);
    });
  });

  it('Passo 3: package.json contem scripts para validacao continua de testes', () => {
    const pkgPath = path.resolve(__dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const scripts = pkg.scripts || {};

    expect(typeof scripts['test:unit']).toBe('string');
    expect(typeof scripts['test:e2e']).toBe('string');
    expect(typeof scripts['test:resilience']).toBe('string');
    expect(typeof scripts['test:performance']).toBe('string');

    const scriptText = `${scripts['test:unit']} ${scripts['test:e2e']} ${scripts['test:resilience']} ${scripts['test:performance']}`.toLowerCase();
    expect(scriptText).toContain('jest');
    expect(scriptText).toContain('cypress');
  });
});
