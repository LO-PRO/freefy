const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { initModel } = require('./services/recommender');

const app = express();
const PORT = process.env.PORT || 3456;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/search', require('./routes/search'));
app.use('/api/recommend', require('./routes/recommend'));
app.use('/api/user', require('./routes/user'));

// Serve static frontend
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientDist, 'index.html'));
  }
});

// Read SSL certificate
const certPath = path.join(__dirname, 'certs', 'cert.pem');
const keyPath = path.join(__dirname, 'certs', 'key.pem');

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  const sslOptions = {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
  };

  // HTTPS server
  https.createServer(sslOptions, app).listen(HTTPS_PORT, () => {
    console.log(`Freefy HTTPS server running on https://localhost:${HTTPS_PORT}`);
    console.log(`Access from phone: https://YOUR_IP:${HTTPS_PORT}`);
  });

  // HTTP redirect to HTTPS
  http.createServer((req, res) => {
    const host = req.headers.host?.replace(`:${PORT}`, `:${HTTPS_PORT}`) || `localhost:${HTTPS_PORT}`;
    res.writeHead(301, { Location: `https://${host}${req.url}` });
    res.end();
  }).listen(PORT, () => {
    console.log(`HTTP redirect on http://localhost:${PORT} -> https://localhost:${HTTPS_PORT}`);
  });

  // Init model
  initModel().then(() => {
    console.log('TF.js recommendation model ready');
  }).catch(e => {
    console.log('TF.js model init skipped:', e.message);
  });
} else {
  // Fallback: HTTP only (no certs found)
  app.listen(PORT, async () => {
    console.log(`Freefy server running on http://localhost:${PORT}`);
    try {
      await initModel();
      console.log('TF.js recommendation model ready');
    } catch (e) {
      console.log('TF.js model init skipped:', e.message);
    }
  });
}
