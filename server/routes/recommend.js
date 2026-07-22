const express = require('express');
const router = express.Router();
const { hybridRecommend, trainModel } = require('../services/recommender');
const {
  getHomeFeed, getNewSongs, getHotCharts,
  getGenreMix, getRandomDiscover, getSimilarRecommend
} = require('../services/youtube');

// Home feed — mixed from all sources
router.get('/', async (req, res) => {
  try {
    const feed = await getHomeFeed(50);
    const recommended = await hybridRecommend(feed, 30);
    res.json(recommended);
  } catch (e) {
    console.error('Recommend error:', e);
    res.status(500).json({ error: e.message });
  }
});

// New songs
router.get('/new', async (req, res) => {
  try {
    const songs = await getNewSongs(40);
    const recommended = await hybridRecommend(songs, 30);
    res.json(recommended);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Hot charts
router.get('/hot', async (req, res) => {
  try {
    const songs = await getHotCharts(40);
    const recommended = await hybridRecommend(songs, 30);
    res.json(recommended);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Random discover — shuffled from diverse queries
router.get('/discover', async (req, res) => {
  try {
    const songs = await getRandomDiscover(40);
    const recommended = await hybridRecommend(songs, 30);
    res.json(recommended);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Similar songs based on user likes
router.get('/similar', async (req, res) => {
  try {
    const songs = await getSimilarRecommend(40);
    const recommended = await hybridRecommend(songs, 30);
    res.json(recommended);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Genre mix
router.get('/genre', async (req, res) => {
  try {
    const songs = await getGenreMix(40);
    const recommended = await hybridRecommend(songs, 30);
    res.json(recommended);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/train', async (req, res) => {
  try {
    await trainModel();
    res.json({ ok: true, message: 'Training completed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
