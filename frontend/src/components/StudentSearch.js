import { useState } from "react";

function StudentSearch({ onSearch }) {
  const [keyword, setKeyword] = useState("");

  const handleChange = (e) => {
    const value = e.target.value;

    setKeyword(value);

    onSearch(value);
  };

  const clearSearch = () => {
    setKeyword("");
    onSearch("");
  };

  return (
    <div className="search-container">

      <input
        type="text"
        placeholder="Search by Student Name, Class or Father Name..."
        value={keyword}
        onChange={handleChange}
        className="search-input"
      />

      {keyword && (
        <button
          className="clear-btn"
          onClick={clearSearch}
        >
          Clear
        </button>
      )}

    </div>
  );
}

export default StudentSearch;