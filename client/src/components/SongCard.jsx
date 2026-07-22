import React from 'react';

const TAG_LABELS = {
  pop: '流行', rock: '摇滚', hiphop: '嘻哈', electronic: '电子',
  rnb: 'R&B', folk: '民谣', classical: '古典', jazz: '爵士',
  metal: '金属', anime: '动漫', kpop: 'K-Pop', jpop: 'J-Pop',
  instrumental: '纯音乐', chill: '治愈', energetic: '高燃',
  sad: '伤感', happy: '快乐',
};

function formatDuration(seconds) {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SongCard({ song, onPlay, onLike, onSkip, onAddQueue, isLiked, isPlaying }) {
  return (
    <div className={`song-card ${isPlaying ? 'playing' : ''}`} onClick={() => onPlay(song)}>
      {song.thumbnail ? (
        <img className="thumb" src={song.thumbnail} alt="" loading="lazy" />
      ) : (
        <div className="thumb-placeholder">🎵</div>
      )}
      <div className="title" title={song.title}>{song.title || '未知歌曲'}</div>
      <div className="artist" title={song.artist}>{song.artist || '未知艺人'}</div>
      <div className="tags">
        {song.tags?.slice(0, 3).map(t => (
          <span key={t} className="tag">{TAG_LABELS[t] || t}</span>
        ))}
        {song.duration > 0 && (
          <span className="tag">{formatDuration(song.duration)}</span>
        )}
      </div>
      <div className="actions">
        <button
          className={`action-btn ${isLiked ? 'liked' : ''}`}
          onClick={e => { e.stopPropagation(); onLike(song); }}
          title={isLiked ? '取消收藏' : '收藏'}
        >
          {isLiked ? '♥' : '♡'}
        </button>
        <button
          className="action-btn"
          onClick={e => { e.stopPropagation(); onAddQueue(song); }}
          title="加入队列"
        >
          +
        </button>
        <button
          className="action-btn"
          onClick={e => { e.stopPropagation(); onSkip(song); }}
          title="不感兴趣"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
