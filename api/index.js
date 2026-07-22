// Vercel-compatible API handler
// Stays within 50MB function limit, no TF.js, no local DB writes
const express = require('express');
const cors = require('cors');
const netease = require('NeteaseCloudMusicApi');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory cache for Vercel (non-persistent across invocations)
const cache = {};

// --- Search ---
app.get('/api/search', async (req, res) => {
  try {
    const { q, limit = 20, offset = 0 } = req.query;
    if (!q) return res.json([]);
    const result = await netease.cloudsearch({ keywords: q, limit: +limit, type: 1, offset: +offset });
    const songs = (result.body?.result?.songs || []).map(s => ({
      id: String(s.id),
      title: s.name || '',
      artist: (s.ar || []).map(a => a.name).join('/'),
      thumbnail: (s.al?.picUrl || '').replace('http://', 'https://'),
      duration: (s.dt || 0) / 1000,
      tags: detectTags(s.name, (s.ar || []).map(a => a.name)),
    }));
    res.json(songs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Song URL ---
app.get('/api/search/url/:id', async (req, res) => {
  try {
    const result = await netease.song_url_v1({ id: req.params.id, level: 'standard' });
    const data = result.body?.data?.[0];
    res.json({ url: data?.url || null, br: data?.br || 0, type: data?.type || '' });
  } catch (e) { res.json({ url: null }); }
});

// --- Recommendations (from top lists) ---
app.get('/api/recommend', async (req, res) => {
  try {
    const [hot, newcomer] = await Promise.allSettled([
      netease.top_list({ idx: 1 }),
      netease.top_list({ idx: 5 }),
    ]);
    const allTracks = [];
    if (hot.status === 'fulfilled') allTracks.push(...(hot.value.body?.playlist?.tracks || []));
    if (newcomer.status === 'fulfilled') allTracks.push(...(newcomer.value.body?.playlist?.tracks || []));
    const songs = shuffle(allTracks).slice(0, 30).map(formatSong);
    res.json(songs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/recommend/new', async (req, res) => {
  try {
    const result = await netease.top_list({ idx: 0 });
    const songs = (result.body?.playlist?.tracks || []).slice(0, 30).map(formatSong);
    res.json(songs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/recommend/hot', async (req, res) => {
  try {
    const result = await netease.top_list({ idx: 1 });
    const songs = (result.body?.playlist?.tracks || []).slice(0, 30).map(formatSong);
    res.json(songs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/recommend/discover', async (req, res) => {
  try {
    const keywords = ['新歌推荐', '独立音乐', '小众', '轻音乐', '英文歌', '日语', '韩语', '纯音乐', '民谣', '古风'];
    const keyword = keywords[Math.floor(Math.random() * keywords.length)];
    const result = await netease.cloudsearch({ keywords: keyword, limit: 30, type: 1, offset: Math.floor(Math.random() * 3) * 30 });
    const songs = (result.body?.result?.songs || []).map(formatSong);
    res.json(shuffle(songs).slice(0, 30));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/recommend/similar', async (req, res) => {
  try {
    const genres = ['流行', '摇滚', '说唱', '电子', '民谣', '古风'];
    const genre = genres[Math.floor(Math.random() * genres.length)];
    const result = await netease.cloudsearch({ keywords: genre, limit: 30, type: 1, offset: Math.floor(Math.random() * 5) * 30 });
    const songs = (result.body?.result?.songs || []).map(formatSong);
    res.json(shuffle(songs).slice(0, 30));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/recommend/genre', async (req, res) => {
  try {
    const playlists = ['3778678', '3779629', '2884035', '19723756', '71385702'];
    const id = playlists[Math.floor(Math.random() * playlists.length)];
    const result = await netease.playlist_detail({ id });
    const songs = (result.body?.playlist?.tracks || []).map(formatSong);
    res.json(shuffle(songs).slice(0, 30));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- User (lightweight, no persistence on Vercel) ---
app.post('/api/user/interact', (req, res) => { res.json({ ok: true }); });
app.get('/api/user/liked', (req, res) => { res.json([]); });

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true, vercel: true }));

// --- Helpers ---
function formatSong(s) {
  return {
    id: String(s.id),
    title: s.name || s.title || '',
    artist: (s.ar || s.artists || []).map(a => typeof a === 'string' ? a : a.name).join('/'),
    thumbnail: ((s.al || s.album || {}).picUrl || '').replace('http://', 'https://'),
    duration: (s.dt || s.duration || 0) / 1000,
    tags: detectTags(s.name, (s.ar || s.artists || []).map(a => typeof a === 'string' ? a : a.name)),
  };
}

function detectTags(name, artists = []) {
  const text = [name, ...artists].join(' ').toLowerCase();
  const tags = [];
  if (/流行|pop|热歌/.test(text)) tags.push('流行');
  if (/摇滚|rock|乐队/.test(text)) tags.push('摇滚');
  if (/说唱|rap|嘻哈|饶舌/.test(text)) tags.push('嘻哈');
  if (/电子|edm|电音|dj|remix/.test(text)) tags.push('电子');
  if (/民谣|folk|吉他/.test(text)) tags.push('民谣');
  if (/古风|中国风|国风/.test(text)) tags.push('古风');
  if (/纯音乐|instrumental|钢琴|小提琴/.test(text)) tags.push('纯音乐');
  if (/轻音乐|chill|轻松/.test(text)) tags.push('轻音乐');
  if (/日语|jpop|日本/.test(text)) tags.push('日语');
  if (/韩语|kpop|韩国/.test(text)) tags.push('韩语');
  if (/英文|english/.test(text)) tags.push('英文');
  if (tags.length === 0) tags.push('流行');
  return tags.slice(0, 2);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

module.exports = app;
