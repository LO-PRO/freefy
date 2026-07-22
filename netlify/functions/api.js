// Netlify Function — wraps Express API
const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const netease = require('NeteaseCloudMusicApi');

const app = express();
app.use(cors());
app.use(express.json());

// --- Search ---
app.get('/api/search', async (req, res) => {
  try {
    const { q, limit = 20, offset = 0 } = req.query;
    if (!q) return res.json([]);
    const result = await netease.cloudsearch({ keywords: q, limit: +limit, type: 1, offset: +offset });
    const songs = (result.body?.result?.songs || []).map(formatSong);
    res.json(songs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Song URL ---
app.get('/api/search/url/:id', async (req, res) => {
  try {
    const result = await netease.song_url_v1({ id: req.params.id, level: 'standard' });
    const data = result.body?.data?.[0];
    res.json({ url: data?.url || null, br: data?.br || 0 });
  } catch (e) { res.json({ url: null }); }
});

// --- Recommendations ---
app.get('/api/recommend', async (req, res) => {
  try {
    const [hot, newcomer] = await Promise.allSettled([
      netease.top_list({ idx: 1 }),
      netease.top_list({ idx: 5 }),
    ]);
    const tracks = [];
    if (hot.status === 'fulfilled') tracks.push(...(hot.value.body?.playlist?.tracks || []));
    if (newcomer.status === 'fulfilled') tracks.push(...(newcomer.value.body?.playlist?.tracks || []));
    res.json(shuffle(tracks).slice(0, 30).map(formatSong));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/recommend/new', async (req, res) => {
  try {
    const r = await netease.top_list({ idx: 0 });
    res.json((r.body?.playlist?.tracks || []).slice(0, 30).map(formatSong));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/recommend/hot', async (req, res) => {
  try {
    const r = await netease.top_list({ idx: 1 });
    res.json((r.body?.playlist?.tracks || []).slice(0, 30).map(formatSong));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/recommend/discover', async (req, res) => {
  try {
    const words = ['新歌', '独立音乐', '轻音乐', '英文歌', '日语', '民谣', '古风', '纯音乐', '电子', '爵士'];
    const kw = words[Math.floor(Math.random() * words.length)];
    const r = await netease.cloudsearch({ keywords: kw, limit: 30, type: 1, offset: Math.floor(Math.random() * 3) * 30 });
    res.json(shuffle((r.body?.result?.songs || []).map(formatSong)).slice(0, 30));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/recommend/similar', async (req, res) => {
  try {
    const genres = ['流行', '摇滚', '说唱', '电子', '民谣', '古风'];
    const g = genres[Math.floor(Math.random() * genres.length)];
    const r = await netease.cloudsearch({ keywords: g, limit: 30, type: 1, offset: Math.floor(Math.random() * 5) * 30 });
    res.json(shuffle((r.body?.result?.songs || []).map(formatSong)).slice(0, 30));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/recommend/genre', async (req, res) => {
  try {
    const ids = ['3778678', '3779629', '2884035', '19723756', '71385702'];
    const id = ids[Math.floor(Math.random() * ids.length)];
    const r = await netease.playlist_detail({ id });
    res.json(shuffle((r.body?.playlist?.tracks || []).map(formatSong)).slice(0, 30));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- User (lightweight) ---
app.post('/api/user/interact', (req, res) => { res.json({ ok: true }); });
app.get('/api/user/liked', (req, res) => { res.json([]); });
app.post('/api/recommend/train', (req, res) => { res.json({ ok: true }); });

// Health
app.get('/api/health', (req, res) => res.json({ ok: true, platform: 'netlify' }));

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
  const t = [name, ...artists].join(' ').toLowerCase();
  const tags = [];
  if (/流行|pop|热歌/.test(t)) tags.push('流行');
  if (/摇滚|rock|乐队/.test(t)) tags.push('摇滚');
  if (/说唱|rap|嘻哈|饶舌/.test(t)) tags.push('嘻哈');
  if (/电子|edm|电音|dj|remix/.test(t)) tags.push('电子');
  if (/民谣|folk|吉他/.test(t)) tags.push('民谣');
  if (/古风|中国风|国风/.test(t)) tags.push('古风');
  if (/纯音乐|instrumental|钢琴|小提琴/.test(t)) tags.push('纯音乐');
  if (/轻音乐|chill|轻松/.test(t)) tags.push('轻音乐');
  if (/日语|jpop|日本/.test(t)) tags.push('日语');
  if (/韩语|kpop|韩国/.test(t)) tags.push('韩语');
  if (/英文|english/.test(t)) tags.push('英文');
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

exports.handler = serverless(app);
