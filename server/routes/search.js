const express = require('express');
const router = express.Router();
const netease = require('NeteaseCloudMusicApi');
const { searchMusic } = require('../services/youtube');
const { hybridRecommend } = require('../services/recommender');

router.get('/', async (req, res) => {
  try {
    const { q, limit } = req.query;
    if (!q) return res.status(400).json({ error: 'Query required' });
    const songs = await searchMusic(q, parseInt(limit) || 20);
    const recommended = await hybridRecommend(songs, 20);
    res.json(recommended);
  } catch (e) {
    console.error('Search error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Get playable URL for a song
router.get('/url/:id', async (req, res) => {
  try {
    const result = await netease.song_url_v1({ id: req.params.id, level: 'standard' });
    const data = result.body?.data?.[0];
    res.json({ url: data?.url || null, br: data?.br || 0, type: data?.type || '' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
