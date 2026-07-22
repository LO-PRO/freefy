import React from 'react';

export default function BottomNav({ tab, onTabChange }) {
  return (
    <div className="bottom-nav">
      <button
        className={`bottom-nav-btn ${tab === 'home' ? 'active' : ''}`}
        onClick={() => onTabChange('home')}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        发现
      </button>
      <button
        className={`bottom-nav-btn ${tab === 'search' ? 'active' : ''}`}
        onClick={() => onTabChange('search')}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        搜索
      </button>
      <button
        className={`bottom-nav-btn ${tab === 'liked' ? 'active' : ''}`}
        onClick={() => onTabChange('liked')}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        收藏
      </button>
    </div>
  );
}
