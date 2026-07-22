const express = require('express');
const cors = require('cors');
const path = require('path');
const { initModel } = require('./services/recommender');

const app = express();
const PORT = process.env.PORT || 8765;

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

app.listen(PORT, async () => {
  console.log(`Freefy HTTP server on http://localhost:${PORT}`);
  try {
    await initModel();
    console.log('TF.js ready');
  } catch (e) {
    console.log('TF.js skipped:', e.message);
  }
});
