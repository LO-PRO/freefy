const express = require('express');
const router = express.Router();
const { saveInteraction, getLikedSongs, getInteractionWeights } = require('../db');
const { markHeard } = require('../services/youtube');

router.post('/interact', (req, res) => {
  try {
    const { songId, action } = req.body;
    if (!songId || !['play', 'skip', 'like', 'dislike', 'heard'].includes(action)) {
      return res.status(400).json({ error: 'Invalid params' });
    }
    if (action === 'heard') {
      markHeard(songId);
    } else {
      saveInteraction(songId, action);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/liked', (req, res) => {
  try {
    const liked = getLikedSongs(200);
    res.json(liked.map(l => l.song_id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/stats', (req, res) => {
  try {
    const weights = getInteractionWeights();
    res.json({
      totalInteractions: Object.keys(weights).length,
      likedCount: Object.values(weights).filter(w => w > 0).length,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
