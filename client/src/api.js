const BASE = '/api';

export async function searchSongs(query) {
  const res = await fetch(`${BASE}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

export async function getRecommendations() {
  const res = await fetch(`${BASE}/recommend`);
  if (!res.ok) throw new Error('Failed to load recommendations');
  return res.json();
}

export async function getNewSongs() {
  const res = await fetch(`${BASE}/recommend/new`);
  if (!res.ok) throw new Error('Failed to load new songs');
  return res.json();
}

export async function getHotCharts() {
  const res = await fetch(`${BASE}/recommend/hot`);
  if (!res.ok) throw new Error('Failed to load hot charts');
  return res.json();
}

export async function getRandomDiscover() {
  const res = await fetch(`${BASE}/recommend/discover`);
  if (!res.ok) throw new Error('Failed to discover');
  return res.json();
}

export async function getSimilarSongs() {
  const res = await fetch(`${BASE}/recommend/similar`);
  if (!res.ok) return [];
  return res.json();
}

export async function getGenreMix() {
  const res = await fetch(`${BASE}/recommend/genre`);
  if (!res.ok) throw new Error('Failed to load genre mix');
  return res.json();
}

export async function recordInteraction(songId, action) {
  await fetch(`${BASE}/user/interact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ songId, action }),
  });
}

export async function getLikedSongs() {
  const res = await fetch(`${BASE}/user/liked`);
  if (!res.ok) return [];
  return res.json();
}

export async function getSongUrl(songId) {
  const res = await fetch(`${BASE}/search/url/${songId}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.url;
}

export async function trainModel() {
  const res = await fetch(`${BASE}/recommend/train`, { method: 'POST' });
  return res.json();
}
