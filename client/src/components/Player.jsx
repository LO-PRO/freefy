import React, { useEffect, useRef, useState } from 'react';
import { getSongUrl, recordInteraction } from '../api';

export default function Player({ song, onEnded, onSkip, onLike, likedIds, queue, shuffleMode, onToggleShuffle, refreshing }) {
  const [playing, setPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!song?.id) {
      setAudioUrl(null);
      setPlaying(false);
      setError(false);
      return;
    }

    setLoading(true);
    setError(false);
    setPlaying(false);
    setAudioUrl(null);

    let cancelled = false;

    getSongUrl(song.id).then(url => {
      if (cancelled) return;
      if (url) {
        setAudioUrl(url);
        setLoading(false);
      } else {
        setError(true);
        setLoading(false);
        setTimeout(() => onEnded(), 2000);
      }
    }).catch(() => {
      if (cancelled) return;
      setError(true);
      setLoading(false);
      setTimeout(() => onEnded(), 2000);
    });

    return () => { cancelled = true; };
  }, [song?.id]);

  useEffect(() => {
    if (!audioUrl || !audioRef.current) return;

    const audio = audioRef.current;
    audio.src = audioUrl;
    audio.load();
    audio.play().then(() => setPlaying(true)).catch(e => console.log('Autoplay prevented:', e.message));

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnd = () => { setPlaying(false); recordInteraction(song.id, 'heard'); onEnded(); };
    const onErr = () => { setError(true); setPlaying(false); onEnded(); };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnd);
    audio.addEventListener('error', onErr);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('error', onErr);
      audio.pause();
      audio.src = '';
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current || !audioUrl) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
  };

  const handleNext = () => {
    if (audioRef.current) audioRef.current.pause();
    onEnded();
  };

  if (refreshing) {
    return (
      <div className="player player-empty">
        正在为你加载新一批歌曲...
      </div>
    );
  }

  if (!song) {
    return (
      <div className="player player-empty">
        选择一首歌曲开始播放
      </div>
    );
  }

  const isLiked = likedIds.has(song.id);

  return (
    <div className="player">
      <div className="player-info">
        {song.thumbnail ? (
          <img className="thumb-sm" src={song.thumbnail} alt="" />
        ) : (
          <div className="thumb-sm" style={{ background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🎵</div>
        )}
        <div>
          <div className="title-sm" title={song.title}>
            {loading ? '加载中...' : error ? '播放失败' : (song.title || '未知歌曲')}
          </div>
          <div className="artist-sm">{song.artist || '未知艺人'}</div>
        </div>
      </div>
      <div className="player-controls">
        <button onClick={() => onSkip(song)} title="不感兴趣">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <button className="btn-play" onClick={togglePlay} title={playing ? '暂停' : '播放'} disabled={loading || error}>
          {loading ? '…' : playing ? '⏸' : '▶'}
        </button>
        <button onClick={handleNext} title="下一首">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>
          </svg>
        </button>
        <button
          onClick={onToggleShuffle}
          title={shuffleMode ? '随机播放中' : '顺序播放'}
          style={{ color: shuffleMode ? 'var(--accent2)' : 'var(--text2)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="16 3 21 3 21 8"/>
            <line x1="4" y1="20" x2="21" y2="3"/>
            <polyline points="21 16 21 21 16 21"/>
            <line x1="15" y1="15" x2="21" y2="21"/>
            <line x1="4" y1="4" x2="9" y2="9"/>
          </svg>
        </button>
        <button onClick={() => onLike(song)} title={isLiked ? '取消收藏' : '收藏'} style={{ color: isLiked ? 'var(--accent2)' : 'var(--text2)' }}>
          {isLiked ? '♥' : '♡'}
        </button>
      </div>
      {queue.length > 0 && (
        <div className="queue-indicator">队列 {queue.length} 首</div>
      )}
      <audio ref={audioRef} preload="auto" />
    </div>
  );
}
