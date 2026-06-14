const { spawnSync } = require('child_process');

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  [
    'jest',
    '--runInBand',
    'tests/performance/TC011-RNF1-performance.js',
    'tests/performance/TC014-RNF4-fiabilidade.js',
    'tests/performance/TC016-RNF6-escalabilidade.js'
  ],
  { stdio: 'inherit', env: process.env }
);

process.exit(result.status ?? 1);
