import React, { useState } from 'react';

export default function SearchBar({ onSearch }) {
  const [value, setValue] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(value);
  };

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="搜索歌曲、艺人、专辑..."
        value={value}
        onChange={e => setValue(e.target.value)}
      />
    </form>
  );
}
