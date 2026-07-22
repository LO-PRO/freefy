const netease = require('NeteaseCloudMusicApi');
const { saveSong, getLikedSongs, getExcludedSongIds, markBatchShown, markSongHeard } = require('../db');

// Track which playlist page we last used to avoid repetition
let playlistPageOffset = 0;
let songSearchPage = 0;

// --- Helpers ---
async function cloudsearch(keywords, limit = 20, offset = 0) {
  songSearchPage = (songSearchPage + 1) % 10;
  const res = await netease.cloudsearch({ keywords, limit, type: 1, offset: offset + songSearchPage * limit });
  return res.body?.result?.songs || [];
}

async function playlistDetail(id) {
  const res = await netease.playlist_detail({ id });
  return res.body?.playlist?.tracks || [];
}

async function topList(idx) {
  const res = await netease.top_list({ idx });
  return res.body?.playlist?.tracks || [];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function extractTags(name, artists, albumName = '') {
  const text = `${name} ${(artists || []).map(a => (typeof a === 'string' ? a : a.name || '')).join(' ')} ${albumName || ''}`.toLowerCase();
  const tagMap = {
    pop: ['流行', 'pop', '热歌'],
    rock: ['摇滚', 'rock', '乐队', 'beyond'],
    hiphop: ['说唱', 'rap', 'hip', '嘻哈', '饶舌'],
    electronic: ['电子', 'edm', '电音', 'dj', 'remix', '混音'],
    rnb: ['rnb', 'r&b', '蓝调', 'blues', '灵魂'],
    folk: ['民谣', 'folk', '吉他', '弹唱', '独立'],
    classical: ['古典', 'classical', '交响', '钢琴', '小提琴'],
    jazz: ['爵士', 'jazz', '萨克斯'],
    metal: ['金属', 'metal', '重金属'],
    anime: ['动漫', 'anime', '二次元', 'acg', 'vocaloid'],
    kpop: ['kpop', 'k-pop', '韩语', '韩流'],
    jpop: ['jpop', 'j-pop', '日语', '日文'],
    instrumental: ['纯音乐', 'instrumental', 'bgm', 'ost', '配乐', '轻音乐'],
    chill: ['chill', '放松', '治愈', '安静', '舒缓'],
    energetic: ['高燃', '燃曲', '热血', '激烈', '力量'],
    sad: ['伤感', '悲伤', 'emo', '失恋'],
    happy: ['快乐', '开心', '甜蜜', '恋爱', '清新', '甜'],
  };
  const found = [];
  for (const [tag, kws] of Object.entries(tagMap)) {
    if (kws.some(kw => text.includes(kw))) found.push(tag);
  }
  return found.length > 0 ? found : ['pop'];
}

function songToOurFormat(song) {
  const artistName = (song.ar || song.artists || []).map(a => a.name || a).join('/');
  const albumName = (song.al || song.album || {}).name || '';
  const tags = extractTags(song.name || '', song.ar || song.artists || [], albumName);
  return {
    id: String(song.id),
    title: song.name || song.title || '',
    artist: artistName,
    thumbnail: (song.al || song.album || {}).picUrl || '',
    duration: Math.floor((song.dt || song.duration || 0) / 1000),
    tags,
  };
}

function dedupeAdd(targetArr, songs, limit, seen, excludedSet) {
  for (const s of songs) {
    if (targetArr.length >= limit) break;
    const sid = String(s.id);
    if (seen.has(sid)) continue;
    if (excludedSet && excludedSet.has(sid)) continue;
    seen.add(sid);
    const formatted = songToOurFormat(s);
    saveSong(formatted);
    targetArr.push(formatted);
  }
}

async function fetchPlaylistTracks(plId, limit = 50) {
  try {
    const tracks = await playlistDetail(plId);
    // Random slice to get different songs each time
    const start = Math.floor(Math.random() * Math.max(0, tracks.length - limit));
    return tracks.slice(start, start + limit);
  } catch (e) { return []; }
}

async function fetchTopPlaylists(limit = 15) {
  playlistPageOffset = (playlistPageOffset + 7) % 200;
  try {
    const res = await netease.top_playlist({ limit, offset: playlistPageOffset, order: 'hot' });
    return res.body?.playlists || [];
  } catch (e) { return []; }
}

async function fetchHighQualityPlaylists(limit = 20, cat = '全部') {
  const offset = Math.floor(Math.random() * 50);
  try {
    const res = await netease.top_playlist_highquality({ limit, offset, cat });
    return res.body?.playlists || [];
  } catch (e) { return []; }
}

// ==================== MAIN FEED FUNCTIONS ====================

function withExclusion(fn) {
  return async function(limit = 40) {
    const excluded = getExcludedSongIds();
    const songs = await fn(limit, excluded);
    // Mark all returned songs as shown
    if (songs.length > 0) {
      markBatchShown(songs.map(s => s.id));
    }
    return songs;
  };
}

// 1) 新歌速递
async function _getNewSongs(limit = 40) {
  const excluded = getExcludedSongIds();
  const songs = [];
  const seen = new Set();

  try {
    const res = await netease.top_list({ idx: 0 });
    const tracks = res.body?.playlist?.tracks || [];
    dedupeAdd(songs, shuffle(tracks), limit, seen, excluded);
  } catch (e) { /* ignore */ }

  if (songs.length < limit) {
    try {
      const res = await netease.personalized_newsong({ limit: Math.ceil(limit) });
      const items = res.body?.result || [];
      const mapped = items.map(i => ({
        id: i.id, name: i.name,
        ar: i.song?.artists || i.artists || [],
        al: i.song?.album || i.album || {},
        dt: i.song?.duration || i.duration || 0,
      }));
      dedupeAdd(songs, shuffle(mapped), limit, seen, excluded);
    } catch (e) { /* ignore */ }
  }

  if (songs.length > 0) markBatchShown(songs.map(s => s.id));
  return songs.slice(0, limit);
}

// 2) 热门排行
async function _getHotCharts(limit = 40) {
  const excluded = getExcludedSongIds();
  const songs = [];
  const seen = new Set();

  const chartIds = shuffle([0, 1, 2, 3]);
  for (const idx of chartIds) {
    if (songs.length >= limit) break;
    try {
      const tracks = await topList(idx);
      dedupeAdd(songs, shuffle(tracks), limit, seen, excluded);
    } catch (e) { /* skip */ }
  }

  if (songs.length < limit) {
    try {
      const res = await netease.toplist_detail();
      const lists = res.body?.list || [];
      for (const list of shuffle(lists).slice(0, 5)) {
        if (songs.length >= limit) break;
        try {
          const tracks = await fetchPlaylistTracks(list.id, 80);
          dedupeAdd(songs, shuffle(tracks), limit, seen, excluded);
        } catch (e) { /* skip */ }
      }
    } catch (e) { /* ignore */ }
  }

  if (songs.length > 0) markBatchShown(songs.map(s => s.id));
  return songs.slice(0, limit);
}

// 3) 分类精选
const GENRE_CATEGORIES = [
  { cat: '华语', query: '华语热门' },
  { cat: '欧美', query: '欧美流行' },
  { cat: '摇滚', query: '摇滚经典' },
  { cat: '民谣', query: '民谣精选' },
  { cat: '电子', query: '电子音乐' },
  { cat: '说唱', query: '说唱精选' },
  { cat: '古风', query: '古风歌曲' },
  { cat: '轻音乐', query: '轻音乐纯音乐' },
];

async function _getGenreMix(limit = 50) {
  const excluded = getExcludedSongIds();
  const songs = [];
  const seen = new Set();

  try {
    const playlists = await fetchHighQualityPlaylists(30);
    for (const pl of shuffle(playlists)) {
      if (songs.length >= limit) break;
      const tracks = await fetchPlaylistTracks(pl.id, 40);
      dedupeAdd(songs, shuffle(tracks), limit, seen, excluded);
    }
  } catch (e) { /* ignore */ }

  if (songs.length < limit) {
    for (const g of shuffle(GENRE_CATEGORIES)) {
      if (songs.length >= limit) break;
      try {
        const offset = Math.floor(Math.random() * 100);
        const results = await cloudsearch(g.query, 20, offset);
        const tracks = results.map(s => ({
          id: s.id, name: s.name, ar: s.ar || [], al: s.al || {}, dt: s.dt || 0,
        }));
        dedupeAdd(songs, shuffle(tracks), limit, seen, excluded);
      } catch (e) { /* skip */ }
    }
  }

  if (songs.length > 0) markBatchShown(songs.map(s => s.id));
  return songs.slice(0, limit);
}

// 4) 随机发现
async function _getRandomDiscover(limit = 40) {
  const excluded = getExcludedSongIds();
  const songs = [];
  const seen = new Set();

  const randQueries = shuffle([
    '周杰伦', '林俊杰', '陈奕迅', '邓紫棋', '薛之谦', 'Taylor Swift',
    'Ed Sheeran', 'Imagine Dragons', 'Alan Walker', '烟嗓', '治愈系',
    '抖音热歌', '经典老歌', '粤语金曲', '日语歌曲', '韩语歌曲',
    '钢琴曲', '吉他指弹', '后摇', '蒸汽波', 'city pop', '欧美经典',
    'R&B', '独立音乐', '电子音乐', '爵士乐', '说唱', '民谣',
    '古风', '影视原声', '游戏音乐', '沙发音乐', 'lofi', 'Chillhop',
  ]);

  const promises = randQueries.slice(0, 12).map(q =>
    cloudsearch(q, 8, Math.floor(Math.random() * 40)).catch(() => [])
  );

  const results = await Promise.all(promises);
  const allRaw = shuffle(results.flat());

  for (const s of allRaw) {
    if (songs.length >= limit) break;
    const sid = String(s.id);
    if (seen.has(sid) || excluded.has(sid)) continue;
    seen.add(sid);
    const formatted = songToOurFormat({
      id: s.id, name: s.name, ar: s.ar || [], al: s.al || {}, dt: s.dt || 0,
    });
    saveSong(formatted);
    songs.push(formatted);
  }

  if (songs.length > 0) markBatchShown(songs.map(s => s.id));
  return songs;
}

// 5) 相似推荐
async function _getSimilarRecommend(limit = 40) {
  const excluded = getExcludedSongIds();
  const songs = [];
  const seen = new Set();

  const liked = getLikedSongs(30);
  if (liked.length === 0) return [];

  const shuffledLiked = shuffle(liked).slice(0, 8);

  for (const l of shuffledLiked) {
    if (songs.length >= limit) break;
    try {
      const res = await netease.simi_song({ id: l.song_id });
      const similar = res.body?.songs || [];
      dedupeAdd(songs, shuffle(similar), limit, seen, excluded);
    } catch (e) { /* skip */ }
  }

  if (songs.length < limit) {
    try {
      const likedSongsData = [];
      for (const l of shuffledLiked.slice(0, 5)) {
        try {
          const res = await netease.song_detail({ ids: l.song_id });
          if (res.body?.songs?.[0]) likedSongsData.push(res.body.songs[0]);
        } catch (e) { /* ignore */ }
      }
      const artists = [...new Set(likedSongsData.flatMap(s =>
        (s.ar || []).map(a => a.name).filter(Boolean)
      ))].slice(0, 5);

      for (const artist of artists) {
        if (songs.length >= limit) break;
        try {
          const results = await cloudsearch(artist, 15, Math.floor(Math.random() * 20));
          dedupeAdd(songs, shuffle(results), limit, seen, excluded);
        } catch (e) { /* skip */ }
      }
    } catch (e) { /* ignore */ }
  }

  if (songs.length > 0) markBatchShown(songs.map(s => s.id));
  return songs.slice(0, limit);
}

// ==================== SEARCH & MAIN ====================

async function searchMusic(query, limit = 20) {
  try {
    const songs = await cloudsearch(query, limit, 0);
    const results = songs.map(s => {
      const formatted = songToOurFormat({ id: s.id, name: s.name, ar: s.ar || [], al: s.al || {}, dt: s.dt || 0 });
      saveSong(formatted);
      return formatted;
    });
    if (results.length > 0) markBatchShown(results.map(s => s.id));
    return results;
  } catch (e) {
    console.error('Search error:', e.message);
    return [];
  }
}

async function getHomeFeed(limit = 50) {
  const [newSongs, hotCharts, genreMix] = await Promise.all([
    _getNewSongs(Math.ceil(limit * 0.35)),
    _getHotCharts(Math.ceil(limit * 0.35)),
    _getGenreMix(Math.ceil(limit * 0.3)),
  ]);

  const combined = [];
  const maxLen = Math.max(newSongs.length, hotCharts.length, genreMix.length);
  const seen = new Set();
  for (let i = 0; i < maxLen && combined.length < limit; i++) {
    for (const src of [newSongs, hotCharts, genreMix]) {
      if (i < src.length) {
        const s = src[i];
        if (!seen.has(s.id)) {
          seen.add(s.id);
          combined.push(s);
          if (combined.length >= limit) break;
        }
      }
    }
  }

  if (combined.length > 0) markBatchShown(combined.map(s => s.id));
  return combined;
}

// Mark song as fully heard (played to end)
function markHeard(songId) { markSongHeard(songId); }

module.exports = {
  searchMusic,
  getHomeFeed,
  getNewSongs: _getNewSongs,
  getHotCharts: _getHotCharts,
  getGenreMix: _getGenreMix,
  getRandomDiscover: _getRandomDiscover,
  getSimilarRecommend: _getSimilarRecommend,
  markHeard,
  extractTags,
};
