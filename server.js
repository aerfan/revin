const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const HARNESS_PATH = path.join(ROOT, 'dev', 'break-ui', 'break-ui.html');

// Build the application and harness on startup
console.log('Building Design Hours Estimator...');
try {
  execSync('node build.js && node dev/break-ui/build-harness.js', { stdio: 'inherit', cwd: ROOT });
} catch (e) {
  console.error('Build failed:', e.message);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  // Route root and index to the interactive dev harness
  let filePath;
  if (urlPath === '/' || urlPath === '/index.html') {
    filePath = HARNESS_PATH;
  } else if (urlPath.startsWith('/web') || urlPath.startsWith('/dist-web')) {
    filePath = path.join(ROOT, 'dist-web', 'index.html');
  } else {
    filePath = path.join(ROOT, urlPath);
  }

  // Security check to avoid directory traversal
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Access denied');
    return;
  }

  fs.stat(resolved, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to break-ui for SPA routes if file not found
      if (fs.existsSync(HARNESS_PATH)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(HARNESS_PATH).pipe(res);
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found: ' + urlPath);
      return;
    }

    const ext = path.extname(resolved).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(resolved).pipe(res);
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n🚀 Revin (Design Hours Estimator) local server running!`);
  console.log(`👉 Open: ${url}\n`);
  
  // Auto-open in user's browser on macOS
  if (process.platform === 'darwin') {
    exec(`open "${url}"`);
  }
});
