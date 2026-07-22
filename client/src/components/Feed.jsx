import React from 'react';
import SongCard from './SongCard';

const SUB_LABELS = {
  recommend: '为你推荐',
  new: '新歌速递',
  hot: '热门排行',
  discover: '随机发现',
  similar: '相似推荐',
  genre: '分类精选',
};

export default function Feed({ songs, loading, tab, subTab, query, onPlay, onLike, onSkip, onAddQueue, likedIds, currentSongId, onRefresh }) {
  if (loading) {
    return <div className="loading-indicator">正在加载...</div>;
  }

  if (!songs || songs.length === 0) {
    return (
      <div className="empty-state">
        <h3>{tab === 'search' ? `没有找到 "${query}" 相关的结果` : '暂无内容'}</h3>
        <p>{tab === 'home' ? '试试其他分类或点刷新' : '试试其他关键词'}</p>
      </div>
    );
  }

  const titles = {
    home: SUB_LABELS[subTab] || '推荐',
    search: `搜索 "${query}"`,
    liked: '我的收藏',
  };

  return (
    <div>
      <div className="feed-header">
        <h2>{titles[tab] || '音乐'}</h2>
        <button className="refresh-btn" onClick={onRefresh}>
          刷新
        </button>
      </div>
      <div className="song-grid">
        {songs.map(song => (
          <SongCard
            key={song.id}
            song={song}
            onPlay={onPlay}
            onLike={onLike}
            onSkip={onSkip}
            onAddQueue={onAddQueue}
            isLiked={likedIds.has(song.id)}
            isPlaying={currentSongId === song.id}
          />
        ))}
      </div>
    </div>
  );
}
