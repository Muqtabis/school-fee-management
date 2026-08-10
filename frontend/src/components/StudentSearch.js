import { useState } from "react";

function StudentSearch({ onSearch }) {

    const [keyword, setKeyword] = useState("");


    /*
    ====================================================
    HANDLE SEARCH
    ====================================================
    */

    const handleChange = (e) => {

        const value = e.target.value;

        setKeyword(value);

        onSearch(value);

    };


    /*
    ====================================================
    CLEAR SEARCH
    ====================================================
    */

    const clearSearch = () => {

        setKeyword("");

        onSearch("");

    };


    /*
    ====================================================
    RENDER
    ====================================================
    */

    return (

        <div className="student-search">

            <div className="search-input-wrapper">

                {/* Search Icon */}

                <span className="search-icon">
                    🔍
                </span>


                {/* Search Input */}

                <input
                    type="text"
                    value={keyword}
                    onChange={handleChange}
                    placeholder="Search by name, roll number, class, father name or contact..."
                    className="search-input"
                />


                {/* Clear Button */}

                {keyword && (

                    <button
                        type="button"
                        className="clear-search-btn"
                        onClick={clearSearch}
                        title="Clear search"
                    >

                        ✕

                    </button>

                )}

            </div>

        </div>

    );

}

export default StudentSearch;