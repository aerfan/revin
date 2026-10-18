// High-speed, zero-dependency assembler for Revin's modular UI layer.
// Assembles focused modules from src/ui/ into src/app.js.
const fs = require('fs');
const path = require('path');

const UI_MODULES = [
  'header.js',
  'icons.js',
  'telemetry.js',
  'helpers.js',
  'components.js',
  'files.js',
  'navigation.js',
  'views/estimates.js',
  'views/editor.js',
  'views/advanced.js',
  'views/library.js',
  'views/settings.js',
  'app-core.js',
  'boot.js'
];

function assembleApp(root = path.join(__dirname, '..')) {
  const uiDir = path.join(root, 'src', 'ui');
  const code = UI_MODULES.map(f => {
    const fullPath = path.join(uiDir, f);
    if (!fs.existsSync(fullPath)) throw new Error(`Missing required UI module: ${fullPath}`);
    return fs.readFileSync(fullPath, 'utf8').trim();
  }).join('\n\n');

  const appPath = path.join(root, 'src', 'app.js');
  fs.writeFileSync(appPath, code + '\n');
  return code;
}

if (require.main === module) {
  const code = assembleApp();
  console.log(`Bundled src/app.js (${(code.length / 1024).toFixed(1)} KB) from ${UI_MODULES.length} UI modules.`);
}

module.exports = { assembleApp, UI_MODULES };
