const tf = require('@tensorflow/tfjs');
const { getRecentInteractions, getLikedSongs, getSongFeatures, saveSongFeatures, getInteractionWeights } = require('../db');

const ALL_TAGS = [
  'pop', 'rock', 'hiphop', 'electronic', 'rnb', 'folk',
  'classical', 'jazz', 'metal', 'anime', 'kpop', 'jpop',
  'instrumental', 'chill', 'energetic', 'sad', 'happy',
];

function songToFeatureVector(song) {
  const tags = song.tags || [];
  const vec = new Array(ALL_TAGS.length).fill(0);
  for (const tag of tags) {
    const idx = ALL_TAGS.indexOf(tag);
    if (idx >= 0) vec[idx] = 1;
  }
  const durBucket = Math.min(Math.floor((song.duration || 200) / 60), 10);
  vec.push(durBucket / 10);
  return vec;
}

function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function contentBasedRecommend(candidates, likedFeatures, topK = 50) {
  if (likedFeatures.length === 0) return candidates;
  const avgFeature = new Array(likedFeatures[0].length).fill(0);
  for (const f of likedFeatures) {
    for (let i = 0; i < f.length; i++) avgFeature[i] += f[i];
  }
  for (let i = 0; i < avgFeature.length; i++) avgFeature[i] /= likedFeatures.length;

  return candidates
    .map(s => ({ ...s, score: cosineSimilarity(songToFeatureVector(s), avgFeature) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ---- TF.js Lightweight Model ----
let model = null;
let isTraining = false;

function createModel(numFeatures) {
  const input = tf.input({ shape: [numFeatures], name: 'song_features' });
  let x = tf.layers.dense({ units: 64, activation: 'relu' }).apply(input);
  x = tf.layers.dropout({ rate: 0.3 }).apply(x);
  x = tf.layers.dense({ units: 32, activation: 'relu' }).apply(x);
  x = tf.layers.dropout({ rate: 0.2 }).apply(x);
  const output = tf.layers.dense({ units: 1, activation: 'sigmoid' }).apply(x);

  const m = tf.model({ inputs: input, outputs: output });
  m.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy'],
  });
  return m;
}

async function initModel() {
  const numFeatures = ALL_TAGS.length + 1;
  if (model) model.dispose();
  model = createModel(numFeatures);
  return model;
}

async function trainModel() {
  if (isTraining) return;
  isTraining = true;
  let xTensor, yTensor;
  try {
    const interactions = getRecentInteractions(500);
    if (interactions.length < 20) { isTraining = false; return; }

    const weights = getInteractionWeights();
    const X = [], y = [];

    for (const inter of interactions) {
      const featCache = getSongFeatures(inter.song_id);
      if (!featCache) continue;
      const features = JSON.parse(featCache.features);
      X.push(features);
      const totalW = weights[inter.song_id] || 0;
      y.push(totalW > 0 ? 1 : 0);
    }

    if (X.length < 10) { isTraining = false; return; }

    xTensor = tf.tensor2d(X);
    yTensor = tf.tensor2d(y.map(v => [v]));

    if (!model) await initModel();

    await model.fit(xTensor, yTensor, {
      epochs: 10,
      batchSize: 16,
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 5 === 0) console.log(`Training epoch ${epoch}: loss=${logs.loss.toFixed(4)}`);
        },
      },
    });

    console.log('Model trained');
  } catch (e) {
    console.error('Training error:', e.message);
  } finally {
    if (xTensor) xTensor.dispose();
    if (yTensor) yTensor.dispose();
  }
  isTraining = false;
}

async function mlPredict(songs) {
  if (!model) {
    try { await initModel(); } catch (e) { return songs; }
    if (!model) return songs;
  }

  const features = songs.map(s => {
    const f = songToFeatureVector(s);
    saveSongFeatures(s.id, f);
    return f;
  });

  const xTensor = tf.tensor2d(features);
  const predictions = model.predict(xTensor);
  const scores = await predictions.data();
  xTensor.dispose();
  predictions.dispose();

  return songs.map((s, i) => ({ ...s, mlScore: scores[i] }));
}

async function hybridRecommend(candidates, topK = 30) {
  if (candidates.length === 0) return [];

  for (const s of candidates) {
    const f = songToFeatureVector(s);
    saveSongFeatures(s.id, f);
  }

  // Content-based scoring
  const likedSongs = getLikedSongs(100);
  const likedFeatures = [];
  for (const ls of likedSongs) {
    const fc = getSongFeatures(ls.song_id);
    if (fc) likedFeatures.push(JSON.parse(fc.features));
  }

  let scored = contentBasedRecommend(candidates, likedFeatures, candidates.length);

  // ML re-ranking
  try {
    scored = await mlPredict(scored);
    scored = scored.map(s => ({
      ...s,
      finalScore: (s.score || 0) * 0.4 + (s.mlScore || 0.5) * 0.6,
    }));
  } catch (e) {
    console.error('ML predict error, using content-based only:', e.message);
    scored = scored.map(s => ({ ...s, finalScore: s.score || 0.5 }));
  }

  // Interaction weight boost
  const interWeights = getInteractionWeights();
  scored = scored.map(s => {
    const w = interWeights[s.id] || 0;
    const boost = Math.tanh(w * 0.5) * 0.3;
    return { ...s, finalScore: Math.max(0, Math.min(1, s.finalScore + boost)) };
  });

  // Diversity: penalize duplicate artists
  const seenArtists = new Set();
  const diverse = [];
  for (const s of scored.sort((a, b) => b.finalScore - a.finalScore)) {
    const artistKey = s.artist?.toLowerCase() || s.id;
    const penalty = seenArtists.has(artistKey) ? -0.15 : 0;
    seenArtists.add(artistKey);
    diverse.push({ ...s, finalScore: s.finalScore + penalty });
  }

  return diverse.sort((a, b) => b.finalScore - a.finalScore).slice(0, topK);
}

module.exports = { hybridRecommend, trainModel, initModel, songToFeatureVector, ALL_TAGS };
