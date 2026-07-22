const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'data.json');

function readData() {
  try {
    if (fs.existsSync(DATA_PATH)) {
      return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
    }
  } catch (e) { /* ignore */ }
  return { songs: {}, interactions: [], featureCache: {} };
}

// Atomic read-modify-write lock: serializes all data mutations
let writeLock = Promise.resolve();

function writeData(data) {
  // This is now private — use atomicUpdate instead for safety
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  } catch (e) { console.error('Write data error:', e.message); }
}

// All mutations MUST go through this to avoid race conditions
function atomicUpdate(fn) {
  writeLock = writeLock.then(() => {
    const data = readData();
    const result = fn(data);
    if (result !== undefined) {
      writeData(result);
    }
  });
  return writeLock;
}

function saveSong(song) {
  atomicUpdate(data => {
    data.songs[song.id] = {
      id: song.id,
      title: song.title || '',
      artist: song.artist || '',
      thumbnail: song.thumbnail || '',
      duration: song.duration || 0,
      tags: song.tags || [],
    };
    return data;
  });
}

function saveInteraction(songId, action) {
  atomicUpdate(data => {
    const weights = { play: 1, skip: -0.5, like: 2, dislike: -2 };
    data.interactions.push({
      song_id: songId,
      action,
      weight: weights[action] || 0,
      created_at: Date.now(),
    });
    if (data.interactions.length > 1000) {
      data.interactions = data.interactions.slice(-1000);
    }
    return data;
  });
}

function getRecentInteractions(limit = 200) {
  const data = readData();
  return data.interactions.slice(-limit).reverse();
}

function getLikedSongs(limit = 100) {
  const data = readData();
  const liked = data.interactions
    .filter(i => i.action === 'like')
    .reverse();
  const seen = new Set();
  const unique = [];
  for (const i of liked) {
    if (!seen.has(i.song_id)) {
      seen.add(i.song_id);
      unique.push(i);
      if (unique.length >= limit) break;
    }
  }
  return unique.map(i => ({ song_id: i.song_id }));
}

function getSongFeatures(songId) {
  const data = readData();
  const entry = data.featureCache[songId];
  return entry ? { features: JSON.stringify(entry) } : null;
}

function saveSongFeatures(songId, features) {
  atomicUpdate(data => {
    data.featureCache[songId] = features;
    const keys = Object.keys(data.featureCache);
    if (keys.length > 500) {
      for (const key of keys.slice(0, keys.length - 500)) {
        delete data.featureCache[key];
      }
    }
    return data;
  });
}

function getInteractionWeights() {
  const data = readData();
  const map = {};
  for (const i of data.interactions) {
    map[i.song_id] = (map[i.song_id] || 0) + i.weight;
  }
  return map;
}

function getAllSongs() {
  const data = readData();
  return Object.values(data.songs);
}

function markBatchShown(songIds) {
  atomicUpdate(data => {
    if (!data.shownSongs) data.shownSongs = {};
    const now = Date.now();
    for (const id of songIds) data.shownSongs[id] = now;
    const keys = Object.keys(data.shownSongs);
    if (keys.length > 2000) {
      const sorted = keys.sort((a, b) => data.shownSongs[a] - data.shownSongs[b]);
      for (const k of sorted.slice(0, keys.length - 2000)) delete data.shownSongs[k];
    }
    return data;
  });
}

function getShownSongIds() {
  const data = readData();
  return new Set(Object.keys(data.shownSongs || {}));
}

function markSongHeard(songId) {
  atomicUpdate(data => {
    if (!data.heardSongs) data.heardSongs = {};
    data.heardSongs[songId] = Date.now();
    const keys = Object.keys(data.heardSongs);
    if (keys.length > 1000) {
      const sorted = keys.sort((a, b) => data.heardSongs[a] - data.heardSongs[b]);
      for (const k of sorted.slice(0, keys.length - 1000)) delete data.heardSongs[k];
    }
    return data;
  });
}

function getHeardSongIds() {
  const data = readData();
  return new Set(Object.keys(data.heardSongs || {}));
}

function getExcludedSongIds() {
  const data = readData();
  const excluded = new Set();
  for (const id of Object.keys(data.shownSongs || {})) excluded.add(id);
  for (const id of Object.keys(data.heardSongs || {})) excluded.add(id);
  for (const i of data.interactions) {
    if (i.action === 'dislike' || i.action === 'skip') excluded.add(i.song_id);
  }
  return excluded;
}

module.exports = {
  saveSong, saveInteraction, getRecentInteractions, getLikedSongs,
  getSongFeatures, saveSongFeatures, getInteractionWeights, getAllSongs,
  markBatchShown, getShownSongIds,
  markSongHeard, getHeardSongIds, getExcludedSongIds,
};
