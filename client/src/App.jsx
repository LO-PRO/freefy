import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import SearchBar from './components/SearchBar';
import Feed from './components/Feed';
import Player from './components/Player';
import {
  getRecommendations, getNewSongs, getHotCharts,
  getRandomDiscover, getSimilarSongs, getGenreMix,
  searchSongs, recordInteraction, getLikedSongs
} from './api';

const SUB_TABS = [
  { key: 'recommend', label: '推荐' },
  { key: 'new', label: '新歌' },
  { key: 'hot', label: '热门' },
  { key: 'discover', label: '随机发现' },
  { key: 'similar', label: '相似推荐' },
  { key: 'genre', label: '分类精选' },
];

export default function App() {
  const [tab, setTab] = useState('home');
  const [subTab, setSubTab] = useState('recommend');
  const [songs, setSongs] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [likedIds, setLikedIds] = useState(new Set());
  const [stats, setStats] = useState({ listens: 0, likes: 0 });
  const [shuffleMode, setShuffleMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const playIndexRef = useRef(0);
  const deferredPromptRef = useRef(null);

  const loaders = {
    recommend: getRecommendations,
    new: getNewSongs,
    hot: getHotCharts,
    discover: getRandomDiscover,
    similar: getSimilarSongs,
    genre: getGenreMix,
  };

  const loadSubTab = useCallback(async (st, silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const loader = loaders[st];
      const data = loader ? await loader() : [];
      setSongs(data);
      playIndexRef.current = 0;
    } catch (e) {
      console.error(`Load ${st} error:`, e);
      setSongs([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  const loadLiked = useCallback(async () => {
    setLoading(true);
    try {
      const ids = await getLikedSongs();
      setLikedIds(new Set(ids));
      if (ids.length > 0) {
        setSongs(ids.map(id => ({ id, title: '已收藏歌曲', artist: '', thumbnail: '', duration: 0, tags: [] })));
      } else {
        setSongs([]);
      }
    } catch (e) {
      setSongs([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === 'home') loadSubTab(subTab);
    else if (tab === 'liked') loadLiked();
  }, [tab, subTab, loadSubTab, loadLiked]);

  // PWA install prompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setShowInstallBanner(true);
    };
    const installed = () => {
      setShowInstallBanner(false);
      deferredPromptRef.current = null;
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    const prompt = deferredPromptRef.current;
    if (!prompt) return;
    prompt.prompt();
    const result = await prompt.userChoice;
    if (result.outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    deferredPromptRef.current = null;
  }, []);

  const handleSearch = useCallback(async (query) => {
    setSearchQuery(query);
    setTab('search');
    if (!query.trim()) { setTab('home'); return; }
    setLoading(true);
    try {
      const data = await searchSongs(query);
      setSongs(data);
      playIndexRef.current = 0;
    } catch (e) {
      console.error('Search error:', e);
      setSongs([]);
    }
    setLoading(false);
  }, []);

  const playSong = useCallback((song) => {
    setCurrentSong(song);
    // Track the index in current song list for sequential playback
    const idx = songs.findIndex(s => s.id === song.id);
    if (idx >= 0) playIndexRef.current = idx;
    recordInteraction(song.id, 'play');
    setStats(s => ({ ...s, listens: s.listens + 1 }));
  }, [songs]);

  const getNextSong = useCallback((skipCurrent) => {
    if (queue.length > 0) {
      const next = queue[0];
      setQueue(q => q.slice(1));
      return next;
    }
    if (shuffleMode && songs.length > 0) {
      const available = songs.filter(s => s.id !== (skipCurrent?.id));
      if (available.length === 0) return null;
      return available[Math.floor(Math.random() * available.length)];
    }
    if (songs.length > 0) {
      const nextIdx = playIndexRef.current + 1;
      if (nextIdx >= songs.length) return null; // end of list → trigger auto-refresh
      playIndexRef.current = nextIdx;
      return songs[nextIdx];
    }
    return null;
  }, [queue, shuffleMode, songs]);

  const playNext = useCallback(async () => {
    const next = getNextSong(currentSong);
    if (next) {
      setCurrentSong(next);
      recordInteraction(next.id, 'play');
      setStats(s => ({ ...s, listens: s.listens + 1 }));
    } else if (tab === 'home') {
      // Auto-refresh: load 30 new songs and auto-play the first
      setRefreshing(true);
      try {
        const loader = loaders[subTab];
        const data = loader ? await loader() : [];
        setSongs(data);
        playIndexRef.current = 0;
        if (data.length > 0) {
          setCurrentSong(data[0]);
          recordInteraction(data[0].id, 'play');
          setStats(s => ({ ...s, listens: s.listens + 1 }));
        } else {
          setCurrentSong(null);
        }
      } catch (e) {
        console.error('Auto-refresh error:', e);
        setCurrentSong(null);
      }
      setRefreshing(false);
    } else {
      setCurrentSong(null);
    }
  }, [getNextSong, currentSong, tab, subTab]);

  const addToQueue = useCallback((song) => {
    setQueue(q => [...q, song]);
  }, []);

  const handleLike = useCallback((song) => {
    recordInteraction(song.id, 'like');
    setLikedIds(prev => {
      const next = new Set(prev);
      if (next.has(song.id)) next.delete(song.id);
      else next.add(song.id);
      return next;
    });
    setStats(s => ({ ...s, likes: s.likes + 1 }));
  }, []);

  const handleSkip = useCallback((song) => {
    recordInteraction(song.id, 'skip');
  }, []);

  return (
    <div className="app">
      <Sidebar tab={tab} onTabChange={t => { setTab(t); if (t === 'home') setSubTab('recommend'); }} stats={stats} />
      <div className="main">
        <SearchBar onSearch={handleSearch} />
        {tab !== 'search' && tab !== 'liked' && (
          <div className="sub-tabs">
            {SUB_TABS.map(st => (
              <button
                key={st.key}
                className={`sub-tab-btn ${subTab === st.key ? 'active' : ''}`}
                onClick={() => setSubTab(st.key)}
              >
                {st.label}
              </button>
            ))}
          </div>
        )}
        <div className="content">
          <Feed
            songs={songs}
            loading={loading}
            tab={tab}
            subTab={subTab}
            query={searchQuery}
            onPlay={playSong}
            onLike={handleLike}
            onSkip={handleSkip}
            onAddQueue={addToQueue}
            likedIds={likedIds}
            currentSongId={currentSong?.id}
            onRefresh={() => loadSubTab(subTab)}
          />
        </div>
      </div>
      <BottomNav tab={tab} onTabChange={t => { setTab(t); if (t === 'home') setSubTab('recommend'); }} />
      <Player
        song={currentSong}
        onEnded={playNext}
        onSkip={() => currentSong && handleSkip(currentSong)}
        onLike={() => currentSong && handleLike(currentSong)}
        likedIds={likedIds}
        queue={queue}
        shuffleMode={shuffleMode}
        onToggleShuffle={() => setShuffleMode(s => !s)}
        refreshing={refreshing}
      />
      {showInstallBanner && (
        <div className="install-banner">
          <span>将 Freefy 添加到主屏幕，随时畅听</span>
          <div className="install-banner-actions">
            <button onClick={handleInstall}>安装</button>
            <button onClick={() => setShowInstallBanner(false)}>稍后</button>
          </div>
        </div>
      )}
    </div>
  );
}
