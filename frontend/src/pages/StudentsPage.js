import { toast, confirmDialog } from "../services/notify";
import { useEffect, useMemo, useState, useRef, Fragment, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import StudentForm from "../components/StudentForm";
import StudentSearch from "../components/StudentSearch";
import OverlayDialog from "../components/OverlayDialog";
import PromptDialog from "../components/PromptDialog";
import api from "../services/api";
import { printReceipt } from "../utils/receipt";

const formatClass = (c) => {
    if (c.name) return c.name;
    const cName = c.className || "";
    const cSec = c.section || "";
    return cSec ? `${cName} ${cSec}`.trim() : cName.trim();
};

function StudentsPage() {
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [showForm, setShowForm] = useState(false);
    
    const [classes, setClasses] = useState([]);
    
    const [selectedClass, setSelectedClass] = useState("All");
    const [selectedCategory, setSelectedCategory] = useState(() => {
        try { return localStorage.getItem("students-filter-category") || "All"; } catch (e) { return "All"; }
    });
    const [searchKeyword, setSearchKeyword] = useState(() => {
        try { return localStorage.getItem("students-filter-search") || ""; } catch (e) { return ""; }
    });
    const [sortBy, setSortBy] = useState(() => {
        try { return localStorage.getItem("students-filter-sort") || "roll"; } catch (e) { return "roll"; }
    });
    useEffect(() => {
        try {
            localStorage.setItem("students-filter-category", selectedCategory);
            localStorage.setItem("students-filter-search", searchKeyword);
            localStorage.setItem("students-filter-sort", sortBy);
        } catch (e) { /* optional */ }
    }, [selectedCategory, searchKeyword, sortBy]);
    // Unified detail view: { studentId, tab } — tab is "overview" | "fees" | "results".
    // Only the id is kept; the student object is derived from the live list so the
    // modal always shows fresh data after any refresh.
    const [detailState, setDetailState] = useState(null);
    const [showArchived, setShowArchived] = useState(false);

    // ---- UI polish: bulk select, column visibility, saved filters, inline edit ----
    const [selectedIds, setSelectedIds] = useState([]);
    const [hiddenCols, setHiddenCols] = useState(() => {
        try { return JSON.parse(localStorage.getItem("students-hidden-cols") || "[]"); } catch (e) { return []; }
    });
    const [showCols, setShowCols] = useState(false);
    const [inlineEdit, setInlineEdit] = useState(null); // { id, field, value }
    const COLUMNS = ["Adm No.", "SATS No.", "Roll No.", "Student Name", "Class", "Category", "Contact", "Status"];
    const toggleCol = (col) => {
        const next = hiddenCols.includes(col) ? hiddenCols.filter((c) => c !== col) : [...hiddenCols, col];
        setHiddenCols(next);
        try { localStorage.setItem("students-hidden-cols", JSON.stringify(next)); } catch (e) { /* optional */ }
    };
    const saveInline = async () => {
        if (!inlineEdit) return;
        try {
            await api.put(`/students/${inlineEdit.id}`, { [inlineEdit.field]: inlineEdit.value });
            toast("Student updated.");
            setInlineEdit(null);
            fetchStudents();
        } catch (e) { toast(e.response?.data?.message || "Unable to update."); }
    };
    const bulkArchive = async () => {
        if (!selectedIds.length) return;
        if (!(await confirmDialog({ message: `Archive ${selectedIds.length} student(s)?`, confirmLabel: "Archive" }))) return;
        try {
            await Promise.all(selectedIds.map((id) => api.post(`/students/${id}/archive`, { reason: "Bulk archive" })));
            toast(`${selectedIds.length} student(s) archived.`);
            setSelectedIds([]);
            fetchStudents();
            fetchCounts();
        } catch (e) { toast(e.response?.data?.message || "Bulk archive failed."); }
    };
    const bulkExport = () => {
        const rows = students.filter((s) => selectedIds.includes(s.id));
        const cols = ["admissionNumber", "studentName", "className", "rollNumber", "contact1"];
        const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        const a = document.createElement("a");
        a.href = url; a.download = "students.csv"; a.click();
        URL.revokeObjectURL(url);
        toast("Exported selected students.");
    };

    // Tab badge totals (Active / Archived) — refreshed with the roster.
    const [counts, setCounts] = useState({ active: 0, archived: 0 });
    const [byClass, setByClass] = useState([]);   // [{ className, active, archived }]
    const [countsLoaded, setCountsLoaded] = useState(false);

    // The student shown in the detail modal, derived live from the list —
    // after every refresh the modal re-renders with the latest data.
    const detailStudent = detailState
        ? students.find((s) => Number(s.id) === Number(detailState.studentId)) || null
        : null;

    // EXCEL IMPORT STATES & REFS
    const fileInputRef = useRef(null);
    const [isImporting, setIsImporting] = useState(false);

    useEffect(() => {
        fetchStudents();
        fetchClasses();
        fetchCounts();
    }, [showArchived]);

    // Real-time refresh: refetch when the window regains focus and on a gentle
    // timer, so edits made anywhere show up without a manual page refresh.
    // The filtered list re-applies itself (derived below), so the view never
    // jumps back to the unfiltered roster.
    useEffect(() => {
        const refresh = () => {
            fetchStudents();
            fetchCounts();
        };
        window.addEventListener("focus", refresh);
        const timer = setInterval(refresh, 30000);
        return () => {
            window.removeEventListener("focus", refresh);
            clearInterval(timer);
        };
    }, [showArchived]);

    const fetchStudents = async () => {
        try {
            const res = await api.get("/students", {
                params: { status: showArchived ? "archived" : "active" }
            });
            const data = Array.isArray(res.data) ? res.data : [];
            setStudents(data);
        } catch (error) {
            console.error("Unable to fetch students:", error);
            setStudents([]);
        }
    };

    const fetchClasses = async () => {
        try {
            const res = await api.get("/classes");
            setClasses(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error("Unable to fetch classes:", error);
            setClasses([]);
        }
    };

    // Tab badge totals — one cheap aggregate call, independent of
    // the current tab / filters.
    const fetchCounts = async () => {
        try {
            const res = await api.get("/students/counts");
            if (res.data?.counts) setCounts(res.data.counts);
            setByClass(Array.isArray(res.data?.byClass) ? res.data.byClass : []);
            setCountsLoaded(true);
        } catch (error) {
            console.error("Unable to fetch student counts:", error);
        }
    };

    // students.className -> per-class counts, for the class dropdown labels.
    const byClassMap = useMemo(() => {
        const map = {};
        byClass.forEach((r) => {
            if (r.className) map[r.className] = r;
        });
        return map;
    }, [byClass]);

    // Class-wise gender strength table (active students only).
    const classRank = (name) => {
        const s = String(name || "").toLowerCase();
        if (s.startsWith("lkg")) return 0;
        if (s.startsWith("ukg")) return 1;
        return 10 + (parseInt(String(name).match(/\d+/)?.[0] || "999", 10) || 999);
    };
    const sortedByClass = useMemo(
        () => [...byClass].sort((a, b) => classRank(a.className) - classRank(b.className) || String(a.className).localeCompare(String(b.className), undefined, { numeric: true })),
        [byClass]
    );
    const boysTotal = byClass.reduce((sum, r) => sum + Number(r.boys || 0), 0);
    const girlsTotal = byClass.reduce((sum, r) => sum + Number(r.girls || 0), 0);

    // Which per-class number to show depends on the selected tab —
    // archived counts while viewing the archived tab.
    const classCount = (displayClass) => {
        const info = byClassMap[displayClass];
        if (!info) return 0;
        return showArchived ? (info.archived || 0) : (info.active || 0);
    };

    const allClassesCount = showArchived ? counts.archived : counts.active;

    // Sort a list of students by roll (numeric) or name.
    const sortStudents = (list, mode) => {
        const copy = [...list];
        if (mode === "name") {
            copy.sort((a, b) => String(a.studentName || "").localeCompare(String(b.studentName || "")));
        } else {
            // Numeric roll sort, matching the backend ordering.
            copy.sort((a, b) => {
                const ra = parseInt(a.rollNumber, 10);
                const rb = parseInt(b.rollNumber, 10);
                const aNum = Number.isNaN(ra) ? Infinity : ra;
                const bNum = Number.isNaN(rb) ? Infinity : rb;
                if (aNum !== bNum) return aNum - bNum;
                return String(a.rollNumber || "").localeCompare(String(b.rollNumber || ""));
            });
        }
        return copy;
    };

    // Derived filtered list — the filters live in state and are re-applied
    // automatically on EVERY refresh (save, archive, import, timer). This is
    // what keeps the page returning to the same class/category view instead
    // of falling back to the full roster.
    const filteredStudents = useMemo(() => {
        const keyword = String(searchKeyword || "").toLowerCase().trim();
        const result = students.filter((student) => {
            console.log("Filtering student:", student.studentName, "keyword:", keyword, "class:", selectedClass, "category:", selectedCategory);
            const matchesSearch =
                !keyword ||
                student.studentName?.toLowerCase().includes(keyword) ||
                student.rollNumber?.toLowerCase().includes(keyword) ||
                student.admissionNumber?.toLowerCase().includes(keyword) ||
                student.satsNumber?.toLowerCase().includes(keyword) ||
                student.fatherName?.toLowerCase().includes(keyword) ||
                student.contact1?.toLowerCase().includes(keyword) ||
                student.contact2?.toLowerCase().includes(keyword);

            const matchesClass = selectedClass === "All" || student.className === selectedClass;
            const matchesCategory =
                selectedCategory === "All" || (student.studentCategory || "general") === selectedCategory;
            return matchesSearch && matchesClass && matchesCategory;
        });
        console.log("Filtered result:", result.length, "of", students.length);
        return sortStudents(result, sortBy);
    }, [students, searchKeyword, selectedClass, selectedCategory, sortBy]);

    // Plain setters — the actual filtering is derived above.
    const handleSearch = (value) => setSearchKeyword(value);

    const handleClassChange = (e) => setSelectedClass(e.target.value);

    const handleCategoryChange = (e) => setSelectedCategory(e.target.value);

    const handleSortChange = (e) => setSortBy(e.target.value);

    // Toggling Active/Archived keeps the class/category/search filters, so the
    // user lands back in the same view they came from.
    const handleStatusToggle = (archived) => setShowArchived(archived);

    const handleEdit = (student) => {
        if (student.status === "archived") {
            toast("Archived students cannot be edited. Restore the student first.");
            return;
        }
        setSelectedStudent(student);
        setShowForm(true);
    };

    // Archive flow: centered PromptDialog replaces the old
    // window.prompt + window.confirm pair.
    const [archiveTarget, setArchiveTarget] = useState(null);
    const [archiving, setArchiving] = useState(false);

    const handleArchive = (student) => {
        if (student.status === "archived") return;
        setArchiveTarget(student);
    };

    const confirmArchive = async (reason) => {
        if (!archiveTarget) return;
        setArchiving(true);
        try {
            await api.post(`/students/${archiveTarget.id}/archive`, { reason });
            setArchiveTarget(null);
            toast("Student archived successfully.");
            fetchStudents();
            fetchCounts();
        } catch (error) {
            toast(error.response?.data?.message || "Unable to archive student.");
        } finally {
            setArchiving(false);
        }
    };

    const handleRestore = async (student) => {
        if (!(await confirmDialog({ message: `Restore ${student.studentName}? Their fee history and active status will be available again.`, confirmLabel: "Restore" }))) return;
        try {
            await api.post(`/students/${student.id}/restore`);
            toast("Student restored successfully.");
            fetchStudents();
            fetchCounts();
        } catch (error) {
            toast(error.response?.data?.message || "Unable to restore student.");
        }
    };

    const handleAddStudent = () => {
        setSelectedStudent(null);
        setShowForm(true);
    };

    // =====================================================
    // EXCEL IMPORT HANDLER
    // =====================================================
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        setIsImporting(true);
        try {
            const res = await api.post("/students/import", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            toast(res.data.message || "Import successful!");
            
            // AUTOMATICALLY REFRESH BOTH TABLES AFTER IMPORT
            fetchStudents(); 
            fetchCounts(); 
            fetchClasses(); // <--- ADDED: This guarantees the dropdown populates immediately
            
        } catch (error) {
            console.error("Import error:", error);
            toast(error.response?.data?.message || "Failed to import students.");
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = ""; // Reset the input
        }
    };

    return (
        <div className="dashboard p-cta-page">
            <Sidebar />

            <div className="main-content">
                <Navbar />

                <div className="page-content">
                    <div className="page-header">
                        <div>
                            <h2>Students</h2>
                            <p>Manage students, complete profiles, and fee accounts.</p>
                        </div>
                        {!showArchived && (
                            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                                {/* HIDDEN FILE INPUT */}
                                <input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    style={{ display: "none" }}
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                />
                                
                                {/* IMPORT BUTTON */}
                                <button 
                                    className="primary-btn" 
                                    style={{ backgroundColor: "#10B981", borderColor: "#059669", color: "white" }}
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isImporting}
                                >
                                    {isImporting ? "⏳ Importing..." : "📥 Import Excel"}
                                </button>
                                
                                <button className="primary-btn" onClick={handleAddStudent}>
                                    + Add Student
                                </button>
                            </div>
                        )}
                    </div>

                    {/* TOP ROW — strength table (left) + search & filters (right) */}
                    <div className="students-top-row">
                    <div className="settings-card strength-card">
                        <div style={{ marginBottom: 10 }}>
                            <strong style={{ fontSize: 14 }}>Class-wise Student Strength</strong>
                            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                                <span className="strength-chip">Classes: {sortedByClass.length}</span>
                                <span className="strength-chip" style={{ color: "#1D4ED8" }}>Boys: {boysTotal}</span>
                                <span className="strength-chip" style={{ color: "#BE185D" }}>Girls: {girlsTotal}</span>
                                <span className="strength-chip">On roll: {counts.active}</span>
                            </div>
                        </div>
                        <div className="table-container">
                            <table className="stack-sm strength-table">
                                <thead>
                                    <tr>
                                        <th>Class</th>
                                        <th className="num">Boys</th>
                                        <th className="num">Girls</th>
                                        <th className="num">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedByClass.length === 0 ? (
                                        <tr><td colSpan="4"><div className="empty-state"><strong>No class data</strong><span>Add students to see class strength.</span></div></td></tr>
                                    ) : sortedByClass.map((r) => (
                                        <tr key={r.className}>
                                            <td data-label="Class"><strong>{r.className}</strong></td>
                                            <td data-label="Boys" className="num boys">{r.boys || 0}</td>
                                            <td data-label="Girls" className="num girls">{r.girls || 0}</td>
                                            <td data-label="Total" className="num"><strong>{Number(r.boys || 0) + Number(r.girls || 0)}</strong></td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td data-label="Class"><strong>TOTAL</strong></td>
                                        <td data-label="Boys" className="num"><strong>{boysTotal}</strong></td>
                                        <td data-label="Girls" className="num"><strong>{girlsTotal}</strong></td>
                                        <td data-label="Total" className="num"><strong>{boysTotal + girlsTotal}</strong></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <small style={{ display: "block", marginTop: 8, fontSize: 11, color: "#64748B" }}>
                            Active students only. {counts.active - boysTotal - girlsTotal} student(s) have no gender recorded and are not counted in Boys/Girls.
                        </small>
                    </div>

                    <div className="students-side-col">

                    {/* Class-wise gender chart (desktop only) */}
                    <div className="settings-card gender-chart-card">
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                            <strong style={{ fontSize: 14 }}>Class-wise Gender Chart</strong>
                            <span className="strength-chip" style={{ color: "#1D4ED8" }}>■ Boys {boysTotal}</span>
                            <span className="strength-chip" style={{ color: "#BE185D" }}>■ Girls {girlsTotal}</span>
                        </div>
                        <div className="gender-chart-v">
                            {sortedByClass.map((r) => {
                                const b = Number(r.boys || 0), g = Number(r.girls || 0);
                                const scale = Math.max(b, g, 1);
                                const ticks = [0, Math.round(scale / 2), scale];
                                return (
                                    <div className="gender-chart-col" key={r.className} title={`${r.className} — Boys ${b}, Girls ${g}`}>
                                        <div className="gender-chart-col-values">
                                            <span className="v boys">{b}</span><span className="v girls">{g}</span>
                                        </div>
                                        <div className="gender-chart-col-bars">
                                            <span className="grid-line" />
                                            <span className="vbar boys" style={{ "--pct": (b / scale * 100) + "%" }} />
                                            <span className="vbar girls" style={{ "--pct": (g / scale * 100) + "%" }} />
                                        </div>
                                        <span className="gender-chart-col-label">{r.className}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Search & filters */}
                    <div className="settings-card filters-card">
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                            <strong style={{ fontSize: 14 }}>Search &amp; Filter</strong>
                            <span className="strength-chip">Showing: {filteredStudents.length}</span>
                        </div>
                    <div className="student-filters" style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: "200px" }}>
                            <StudentSearch onSearch={handleSearch} />
                        </div>

                        <select className="filter-select" value={selectedClass} onChange={handleClassChange} style={{ minWidth: "150px" }}>
                            <option value="All">All Classes{countsLoaded ? ` (${allClassesCount})` : ""}</option>
                            {classes.map((c) => {
                                const displayClass = formatClass(c);
                                return (
                                    <option key={c.id} value={displayClass}>
                                        {displayClass}{countsLoaded ? ` (${classCount(displayClass)})` : ""}
                                    </option>
                                );
                            })}
                        </select>

                        <select className="filter-select" value={selectedCategory} onChange={handleCategoryChange} style={{ minWidth: "150px" }}>
                            <option value="All">All Categories</option>
                            <option value="general">Regular</option>
                            <option value="rte">RTE</option>
                            <option value="management">Management</option>
                            <option value="other">Others</option>
                        </select>

                        <select className="filter-select" value={sortBy} onChange={handleSortChange} style={{ minWidth: "150px" }}>
                            <option value="roll">Sort: Roll No.</option>
                            <option value="name">Sort: Name (A–Z)</option>
                        </select>
                        <button type="button" className="clear-btn" onClick={() => { setSearchKeyword(""); setSelectedClass("All"); setSelectedCategory("All"); setSortBy("roll"); }}>Clear</button>
                        {/* Classes are now created and managed on the dedicated
                            Class Management page. */}
                        <button type="button" className="clear-btn" onClick={() => setShowCols((v) => !v)}>Columns ▾</button>
                    </div>
                    </div>

                    </div>
                    </div>

                    {/* Student records table */}
                    <div className="settings-card records-card" style={{ marginTop: 14 }}>
                    {showCols && (
                        <div className="settings-card" style={{ padding: 12, marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {COLUMNS.map((c) => (
                                <label key={c} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, minHeight: 36 }}>
                                    <input type="checkbox" checked={!hiddenCols.includes(c)} onChange={() => toggleCol(c)} /> {c}
                                </label>
                            ))}
                        </div>
                    )}

                    {selectedIds.length > 0 && (
                        <div className="sticky-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
                            <strong>{selectedIds.length} selected</strong>
                            <div style={{ display: "flex", gap: 8 }}>
                                <button type="button" className="save-btn" onClick={bulkExport}>Export CSV</button>
                                <button type="button" className="delete-btn" onClick={bulkArchive}>Archive</button>
                                <button type="button" className="cancel-btn" onClick={() => setSelectedIds([])}>Clear</button>
                            </div>
                        </div>
                    )}

                    <div className="table-container">
                        <table className="stack-sm p-even-table">
                            <thead>
                                <tr>
                                    <th><input type="checkbox" aria-label="Select all" checked={filteredStudents.length > 0 && filteredStudents.every((s) => selectedIds.includes(s.id))} onChange={(e) => setSelectedIds(e.target.checked ? filteredStudents.map((s) => s.id) : [])} /></th>
                                    <th style={{ display: hiddenCols.includes("Adm No.") ? "none" : "" }}>Adm No.</th>
                                    <th style={{ display: hiddenCols.includes("SATS No.") ? "none" : "" }}>SATS No.</th>
                                    <th style={{ display: hiddenCols.includes("Roll No.") ? "none" : "" }}>Roll No.</th>
                                    <th style={{ display: hiddenCols.includes("Student Name") ? "none" : "" }}>Student Name</th>
                                    <th style={{ display: hiddenCols.includes("Class") ? "none" : "" }}>Class</th>
                                    <th style={{ display: hiddenCols.includes("Category") ? "none" : "" }}>Category</th>
                                    <th style={{ display: hiddenCols.includes("Contact") ? "none" : "" }}>Contact</th>
                                    <th style={{ display: hiddenCols.includes("Status") ? "none" : "" }}>Status</th>
                                    <th style={{ textAlign: "right", paddingRight: "20px" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStudents.length === 0 ? (
                                    <tr>
                                        <td colSpan="10">
                                            <div className="empty-state">
                                                <span className="empty-icon">👨‍🎓</span>
                                                <strong>{showArchived ? "No archived students" : "No students yet"}</strong>
                                                <span>{showArchived ? "Archived students will appear here." : "Add your first student to get started."}</span>
                                                {!showArchived && (
                                                    <button type="button" className="primary-btn" onClick={handleAddStudent}>+ Add Student</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredStudents.map((student) => (
                                        <tr key={student.id} style={student.status === "archived" ? { opacity: 0.65 } : {}}>
                                            <td data-label="Select">
                                                <input type="checkbox" aria-label="Select student" checked={selectedIds.includes(student.id)} onChange={(e) => setSelectedIds((prev) => e.target.checked ? [...prev, student.id] : prev.filter((id) => id !== student.id))} />
                                            </td>
                                            <td data-label="Adm No." style={{ color: "#64748B", fontSize: "13px", display: hiddenCols.includes("Adm No.") ? "none" : "" }}>{student.admissionNumber || "-"}</td>
                                            <td data-label="SATS No." style={{ color: "#64748B", fontSize: "13px", display: hiddenCols.includes("SATS No.") ? "none" : "" }}>{student.satsNumber || "-"}</td>
                                            <td data-label="Roll No." style={{ display: hiddenCols.includes("Roll No.") ? "none" : "" }}><strong>{student.rollNumber || "-"}</strong></td>
                                            <td data-label="Student" style={{ display: hiddenCols.includes("Student Name") ? "none" : "" }}>
                                                {inlineEdit?.id === student.id && inlineEdit.field === "studentName" ? (
                                                    <span><input value={inlineEdit.value} onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })} style={{ width: "90%" }} /><button type="button" className="save-btn" onClick={saveInline} style={{ marginLeft: 4 }}>✓</button></span>
                                                ) : (
                                                    <strong onDoubleClick={() => setInlineEdit({ id: student.id, field: "studentName", value: student.studentName || "" })} title="Double-click to edit">{student.studentName}</strong>
                                                )}
                                            </td>
                                            <td data-label="Class" style={{ display: hiddenCols.includes("Class") ? "none" : "" }}>{student.className || "-"}</td>
                                            <td data-label="Category" style={{ display: hiddenCols.includes("Category") ? "none" : "" }}>
                                                <span className={student.studentCategory === "rte" ? "payment-badge mode-upi" : "payment-badge mode-default"}>
                                                    {student.studentCategory === "rte" ? "RTE" :
                                                     student.studentCategory === "management" ? "Management" :
                                                     student.studentCategory === "other" ? "Others" : "Regular"}
                                                </span>
                                            </td>
                                            <td data-label="Contact" style={{ display: hiddenCols.includes("Contact") ? "none" : "" }}>
                                                <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.4 }}>
                                                    {inlineEdit?.id === student.id && inlineEdit.field === "contact1" ? (
                                                        <span><input value={inlineEdit.value} onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })} style={{ width: "90%" }} /><button type="button" className="save-btn" onClick={saveInline} style={{ marginLeft: 4 }}>✓</button></span>
                                                    ) : (
                                                        <span onDoubleClick={() => setInlineEdit({ id: student.id, field: "contact1", value: student.contact1 || "" })} title="Double-click to edit">{student.contact1 || "-"}</span>
                                                    )}
                                                    {student.contact2 ? (
                                                        <span style={{ fontSize: "12px", color: "#64748B" }}>{student.contact2}</span>
                                                    ) : null}
                                                </div>
                                            </td>
                                            <td data-label="Status" style={{ display: hiddenCols.includes("Status") ? "none" : "" }}>
                                                <span className={student.status === "archived" ? "payment-badge mode-default" : "payment-badge mode-upi"}>
                                                    {student.status === "archived" ? "Archived" : "Active"}
                                                </span>
                                            </td>
                                            <td data-label="" style={{ textAlign: "right" }}>
                                                <div className="action-buttons" style={{ justifyContent: "flex-end" }}>
                                                    <button
                                                        onClick={() => setDetailState({ studentId: student.id, tab: "overview" })}
                                                        style={{ background: "#0F172A", border: "1px solid #0F172A", color: "#fff", padding: "6px 14px", borderRadius: "4px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}
                                                    >
                                                        View Details
                                                    </button>

                                                    {student.status === "archived" ? (
                                                        <button className="edit-btn" onClick={() => handleRestore(student)}>Restore</button>
                                                    ) : (
                                                        <button className="delete-btn" onClick={() => handleArchive(student)}>Archive</button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    </div>
                </div>
            </div>

            {/* MODALS */}
            <button
                type="button"
                className="p-mobile-cta"
                onClick={handleAddStudent}
                aria-label="Add Student"
            >
                ＋ Add Student
            </button>

            {detailStudent && (
                <StudentDetailModal
                    student={detailStudent}
                    initialTab={detailState.tab}
                    onClose={() => setDetailState(null)}
                    onEdit={handleEdit}
                />
            )}

            {/* The form renders AFTER the detail modal so it stacks on top when
                editing from inside the modal; on close both stay in place — the
                detail view re-renders with the freshly saved data. */}
            {showForm && (
                <StudentForm
                    student={selectedStudent}
                    onClose={() => {
                        setShowForm(false);
                        setSelectedStudent(null);
                        fetchStudents();
                        fetchCounts();
                    }}
                />
            )}

            <PromptDialog
                open={!!archiveTarget}
                onClose={() => setArchiveTarget(null)}
                onConfirm={confirmArchive}
                title={archiveTarget ? `Archive ${archiveTarget.studentName}?` : ""}
                message="The student will NOT be deleted. Their fee history will remain. A reason is required."
                multiline
                requireValue
                placeholder="Reason for archiving (required)"
                confirmLabel="Archive"
                busy={archiving}
            />
        </div>
    );
}

// =====================================================
// UNIFIED STUDENT DETAIL MODAL
// One place for everything: profile + full fee account.
// =====================================================
export function StudentDetailModal({ student, initialTab = "overview", onClose, onEdit }) {
    const [tab, setTab] = useState(initialTab);
    const [history, setHistory] = useState(null);
    const [loadingFees, setLoadingFees] = useState(true);
    const [results, setResults] = useState(null);
    const [loadingResults, setLoadingResults] = useState(false);
    const [dlExamId, setDlExamId] = useState(null);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                setLoadingFees(true);
                const res = await api.get(`/payments/history/student/${student.id}`);
                if (active) setHistory(res.data);
            } catch (error) {
                console.error("Fee account error:", error);
                if (active) setHistory(null);
            } finally {
                if (active) setLoadingFees(false);
            }
        })();
        return () => { active = false; };
    }, [student.id]);

    // Lazy-load published exam results only when the Results tab is opened.
    useEffect(() => {
        if (tab !== "results" || results !== null) return;
        let active = true;
        (async () => {
            try {
                setLoadingResults(true);
                const res = await api.get(`/students/${student.id}/results`);
                if (active) setResults(res.data?.history || []);
            } catch (error) {
                console.error("Result history error:", error);
                if (active) setResults([]);
            } finally {
                if (active) setLoadingResults(false);
            }
        })();
        return () => { active = false; };
    }, [tab, results, student.id]);

    // Download a report card as an in-memory PDF (server streams it; nothing on disk).
    const downloadReportCard = async (examId, examName) => {
        try {
            setDlExamId(examId);
            const res = await api.get(`/students/${student.id}/report-card/${examId}`, { responseType: "blob" });
            const blob = new Blob([res.data], { type: "application/pdf" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `ReportCard_${(student.rollNumber || student.studentName || "student")}_${(examName || "exam")}.pdf`.replace(/[^a-z0-9._-]+/gi, "_");
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Download report card error:", error);
            toast(error?.response?.data?.message || "Unable to download report card.");
        } finally {
            setDlExamId(null);
        }
    };

    if (!student) return null;

    const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const Label = ({ children }) => <div style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>{children}</div>;
    const Value = ({ children }) => <div style={{ fontSize: "14px", fontWeight: "600", color: "#0F172A", marginBottom: "16px" }}>{children || "-"}</div>;

    // Fee math (mirrors the standalone ledger).
    const prevDues = Math.max(0, Number(student?.previousDues || 0) - Number(student?.previousDuesConcession || 0));
    const concession = Number(student?.concessionAmount || 0);
    let standardTotal = Number(history?.totalFee || 0);
    if (Array.isArray(history?.items) && history.items.length > 0) {
        standardTotal = history.items.reduce((sum, item) => {
            if (item.itemType === "carry_forward" || item.componentName?.toLowerCase().includes("previous")) return sum;
            return sum + Number(item.amount || 0);
        }, 0);
    }
    const netAcademicFee = Math.max(0, standardTotal - concession);
    const computedTotalFee = prevDues + netAcademicFee;
    const computedPaid = Number(history?.totalPaid || 0);
    const computedBalance = Math.max(0, computedTotalFee - computedPaid);

    const TabButton = ({ id, children }) => (
        <button
            onClick={() => setTab(id)}
            style={{
                padding: "10px 18px",
                border: "none",
                background: "none",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600",
                color: tab === id ? "#0F172A" : "#94A3B8",
                borderBottom: tab === id ? "3px solid #0F172A" : "3px solid transparent"
            }}
        >
            {children}
        </button>
    );

    return (
        <OverlayDialog onClose={onClose} ariaLabel="Student detail">
            <div style={{ backgroundColor: "#ffffff", borderRadius: "14px", width: "100%", maxWidth: "720px", maxHeight: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", overflow: "hidden" }}>

                {/* Header Strip */}
                <div style={{ backgroundColor: "#0F172A", padding: "24px", color: "#fff", position: "relative" }}>
                    <div style={{ position: "absolute", top: "16px", right: "16px", display: "flex", gap: "8px", alignItems: "center" }}>
                        {student.status !== "archived" && onEdit && (
                            <button
                                onClick={() => onEdit(student)}
                                style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}
                            >
                                Edit
                            </button>
                        )}
                        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", width: "30px", height: "30px", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>✕</button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <div style={{ width: "64px", height: "64px", backgroundColor: "#334155", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", fontWeight: "bold", border: "2px solid #64748B" }}>
                            {student.studentName.charAt(0)}
                        </div>
                        <div>
                            <h2 style={{ margin: "0 0 4px 0", fontSize: "22px" }}>{student.studentName}</h2>
                            <div style={{ display: "flex", gap: "12px", fontSize: "13px", color: "#CBD5E1", flexWrap: "wrap" }}>
                                <span>Class: <strong>{student.className || "-"}</strong></span>
                                <span>|</span>
                                <span>Roll No: <strong>{student.rollNumber || "-"}</strong></span>
                                <span>|</span>
                                <span style={{ color: student.status === 'active' ? '#86EFAC' : '#FCA5A5' }}>● {String(student.status || "").toUpperCase()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick balance chip so the key number is visible up top */}
                    {!loadingFees && history && (
                        <div style={{ marginTop: "16px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                            <span style={{ background: "rgba(255,255,255,0.12)", padding: "6px 12px", borderRadius: "8px", fontSize: "13px" }}>Total Demand: <strong>{money(computedTotalFee)}</strong></span>
                            <span style={{ background: "rgba(134,239,172,0.18)", color: "#86EFAC", padding: "6px 12px", borderRadius: "8px", fontSize: "13px" }}>Paid: <strong>{money(computedPaid)}</strong></span>
                            <span style={{ background: computedBalance > 0 ? "rgba(252,165,165,0.18)" : "rgba(134,239,172,0.18)", color: computedBalance > 0 ? "#FCA5A5" : "#86EFAC", padding: "6px 12px", borderRadius: "8px", fontSize: "13px" }}>Balance: <strong>{money(computedBalance)}</strong></span>
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div style={{ display: "flex", borderBottom: "1px solid #E2E8F0", padding: "0 12px", backgroundColor: "#fff" }}>
                    <TabButton id="overview">Profile</TabButton>
                    <TabButton id="fees">Fee Account</TabButton>
                    <TabButton id="results">Exam Results</TabButton>
                </div>

                <div style={{ padding: "24px", overflowY: "auto" }}>
                    {tab === "overview" ? (
                        <>
                            <h3 style={{ fontSize: "15px", color: "#334155", borderBottom: "1px solid #E2E8F0", paddingBottom: "8px", marginBottom: "16px", marginTop: 0 }}>Academic Profile</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                                <div><Label>Admission No.</Label><Value>{student.admissionNumber}</Value></div>
                                <div><Label>SATS No.</Label><Value>{student.satsNumber}</Value></div>
                                <div><Label>PEN No.</Label><Value>{student.penNumber}</Value></div>
                                <div><Label>Student Category</Label><Value>
                                    <span className={student.studentCategory === "rte" ? "payment-badge mode-upi" : "payment-badge mode-default"}>
                                        {student.studentCategory === "rte" ? "RTE" :
                                         student.studentCategory === "management" ? "Management" :
                                         student.studentCategory === "other" ? "Others" : "Regular"}
                                    </span>
                                </Value></div>
                                <div><Label>Enrollment Date</Label><Value>{student.createdAt ? new Date(student.createdAt).toLocaleDateString() : "-"}</Value></div>
                            </div>

                            <h3 style={{ fontSize: "15px", color: "#334155", borderBottom: "1px solid #E2E8F0", paddingBottom: "8px", marginBottom: "16px", marginTop: "8px" }}>Personal Details</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                                <div><Label>Gender</Label><Value>{student.gender}</Value></div>
                                <div><Label>Date of Birth</Label><Value>{student.dob ? new Date(student.dob).toLocaleDateString() : "-"}</Value></div>
                                <div><Label>Primary Contact</Label><Value>{student.contact1}</Value></div>
                                <div><Label>Secondary Contact</Label><Value>{student.contact2}</Value></div>
                                <div><Label>Father's Name</Label><Value>{student.fatherName}</Value></div>
                                <div><Label>Mother's Name</Label><Value>{student.motherName}</Value></div>
                                <div style={{ gridColumn: "span 3" }}><Label>Home Address</Label><Value>{student.address}</Value></div>
                                <div style={{ gridColumn: "span 3" }}><Label>General Remarks</Label><Value>{student.remark}</Value></div>
                            </div>
                        </>
                    ) : tab === "fees" ? (
                        loadingFees ? (
                            <div className="skel-card" style={{ margin: "12px 0" }}>
                                <div className="skel skel-line short" /><div className="skel skel-line tall" /><div className="skel skel-line" />
                            </div>
                        ) : history ? (
                            <>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#F8FAFC", padding: "10px 14px", borderRadius: "8px", border: "1px solid #E2E8F0", marginBottom: "16px" }}>
                                    <div><span style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", textTransform: "uppercase" }}>Academic Session</span><div style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A" }}>{history.academicYear?.name || "-"}</div></div>
                                    <span style={{ backgroundColor: "#DCFCE7", color: "#15803D", fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "20px" }}>● Active Account</span>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "20px" }}>
                                    <div style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", padding: "12px", borderRadius: "8px" }}><span style={{ fontSize: "11px", color: "#64748B", fontWeight: "600" }}>Total Demand</span><div style={{ fontSize: "17px", fontWeight: "700", color: "#0F172A", marginTop: "2px" }}>{money(computedTotalFee)}</div></div>
                                    <div style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", padding: "12px", borderRadius: "8px" }}><span style={{ fontSize: "11px", color: "#15803D", fontWeight: "600" }}>Total Paid</span><div style={{ fontSize: "17px", fontWeight: "700", color: "#16A34A", marginTop: "2px" }}>{money(computedPaid)}</div></div>
                                    <div style={{ backgroundColor: computedBalance > 0 ? "#FEF2F2" : "#F8FAFC", border: "1px solid", borderColor: computedBalance > 0 ? "#FECACA" : "#E2E8F0", padding: "12px", borderRadius: "8px" }}><span style={{ fontSize: "11px", color: computedBalance > 0 ? "#DC2626" : "#64748B", fontWeight: "600" }}>Balance Due</span><div style={{ fontSize: "17px", fontWeight: "700", color: computedBalance > 0 ? "#DC2626" : "#16A34A", marginTop: "2px" }}>{money(computedBalance)}</div></div>
                                </div>

                                <div style={{ marginBottom: "20px" }}>
                                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#475569", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Assessed Fee Structure</div>
                                    <div style={{ border: "1px solid #E2E8F0", borderRadius: "8px", overflow: "hidden", backgroundColor: "#FFFFFF" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0", fontSize: "12px", fontWeight: "600", color: "#475569" }}><span>Component</span><span>Amount (₹)</span></div>
                                        {prevDues > 0 && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", backgroundColor: "#EFF6FF", borderBottom: "1px solid #DBEAFE" }}><div style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ color: "#1E40AF", fontWeight: "600", fontSize: "13px" }}>Previous Dues</span><span style={{ backgroundColor: "#DBEAFE", color: "#1E40AF", fontSize: "10px", fontWeight: "700", padding: "1px 6px", borderRadius: "4px" }}>Carry Forward</span></div><strong style={{ color: "#1E40AF", fontSize: "13px" }}>{money(prevDues)}</strong></div>}
                                        {history.items?.map((item) => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 14px", borderBottom: "1px solid #F1F5F9", fontSize: "13px" }}><span style={{ color: "#334155" }}>{item.componentName}</span><strong style={{ color: "#0F172A" }}>{money(item.amount)}</strong></div>)}
                                        {concession > 0 && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", backgroundColor: "#F0FDF4", borderTop: "1px solid #DCFCE7" }}><div style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ color: "#15803D", fontWeight: "600", fontSize: "13px" }}>Fee Concession</span><span style={{ backgroundColor: "#DCFCE7", color: "#15803D", fontSize: "10px", fontWeight: "700", padding: "1px 6px", borderRadius: "4px" }}>{student.concessionReason || "Discount"}</span></div><strong style={{ color: "#16A34A", fontSize: "13px" }}>- {money(concession)}</strong></div>}
                                    </div>
                                </div>

                                <div>
                                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#475569", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Transaction Receipts Log</div>
                                    <div style={{ border: "1px solid #E2E8F0", borderRadius: "8px", overflow: "hidden", backgroundColor: "#FFFFFF" }}>
                                        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1.2fr 0.8fr", padding: "8px 14px", backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0", fontSize: "12px", fontWeight: "600", color: "#475569" }}><span>Date</span><span>Mode</span><span style={{ textAlign: "center" }}>Status</span><span style={{ textAlign: "right" }}>Amount Paid</span><span style={{ textAlign: "right" }}>Receipt</span></div>
                                        {history.payments?.length === 0 ? <div style={{ padding: "14px", textAlign: "center", color: "#64748B", fontSize: "13px" }}>No receipts recorded for this session.</div> : history.payments?.map((payment) => (
                                            <Fragment key={payment.id}>
                                                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1.2fr 0.8fr", alignItems: "center", padding: "9px 14px", borderBottom: "1px solid #F1F5F9", fontSize: "13px", opacity: payment.status === "reversed" ? 0.6 : 1 }}><span style={{ color: "#334155" }}>{payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString("en-IN") : "-"}</span><span style={{ color: "#334155", fontWeight: "500" }}>{payment.paymentMode || "Cash"}</span><span style={{ textAlign: "center" }}><span style={{ fontSize: "10px", fontWeight: "700", padding: "2px 7px", borderRadius: "4px", backgroundColor: payment.status === "reversed" ? "#F1F5F9" : "#DCFCE7", color: payment.status === "reversed" ? "#64748B" : "#15803D" }}>{payment.status === "reversed" ? "Reversed" : "Completed"}</span></span><strong style={{ textAlign: "right", color: "#0F172A" }}>{money(payment.amount)}</strong><span style={{ textAlign: "right" }}>{payment.status !== "reversed" && <button className="receipt-btn" onClick={() => printReceipt(payment.id)}>Receipt</button>}</span></div>
                                                {payment.status === "reversed" && (
                                                    <div style={{ background: "var(--danger-bg)", color: "var(--danger)", fontSize: "12px", fontWeight: 600, padding: "6px 14px 8px", borderBottom: "1px solid #F1F5F9" }}>
                                                        Reversed{payment.voidedAt ? ` on ${new Date(payment.voidedAt).toLocaleDateString("en-IN")}` : ""} — Reason: {payment.voidReason || "Not recorded"}
                                                    </div>
                                                )}
                                            </Fragment>
                                        ))}
                                    </div>
                                </div>
                            </>
                        ) : <div style={{ padding: "20px", textAlign: "center", color: "#DC2626" }}>Unable to load fee account.</div>
                    ) : (
                        loadingResults ? (
                            <div className="skel-card" style={{ margin: "12px 0" }}>
                                <div className="skel skel-line short" /><div className="skel skel-line tall" /><div className="skel skel-line" />
                            </div>
                        ) : results && results.length > 0 ? (
                            <div>
                                <div style={{ fontSize: "12px", fontWeight: "700", color: "#475569", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Published Exam Results</div>
                                <div style={{ border: "1px solid #E2E8F0", borderRadius: "8px", overflow: "hidden", backgroundColor: "#FFFFFF" }}>
                                    <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr 0.8fr 1.1fr", padding: "8px 14px", backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0", fontSize: "12px", fontWeight: "600", color: "#475569" }}><span>Exam</span><span>Session</span><span style={{ textAlign: "center" }}>Result</span><span style={{ textAlign: "right" }}>Report Card</span></div>
                                    {results.map((r) => (
                                        <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr 0.8fr 1.1fr", alignItems: "center", padding: "9px 14px", borderBottom: "1px solid #F1F5F9", fontSize: "13px" }}>
                                            <span style={{ color: "#334155" }}><strong>{r.examName}</strong><div style={{ fontSize: "11px", color: "#64748B" }}>{Number(r.percentage || 0).toFixed(1)}% • {r.totalObtained}/{r.totalMax}</div></span>
                                            <span style={{ color: "#334155" }}>{r.academicYear || "-"}</span>
                                            <span style={{ textAlign: "center" }}><span style={{ fontSize: "10px", fontWeight: "700", padding: "2px 7px", borderRadius: "4px", backgroundColor: r.overallStatus === "pass" ? "#DCFCE7" : r.overallStatus === "fail" ? "#FEE2E2" : "#FEF9C3", color: r.overallStatus === "pass" ? "#15803D" : r.overallStatus === "fail" ? "#B91C1C" : "#A16207" }}>{String(r.overallStatus || "-").toUpperCase()}</span></span>
                                            <span style={{ textAlign: "right" }}><button onClick={() => downloadReportCard(r.examId, r.examName)} disabled={dlExamId === r.examId} style={{ padding: "6px 12px", backgroundColor: "#0F172A", color: "#fff", border: "none", borderRadius: "6px", cursor: dlExamId === r.examId ? "wait" : "pointer", fontSize: "12px", fontWeight: "600", opacity: dlExamId === r.examId ? 0.7 : 1 }}>{dlExamId === r.examId ? "…" : "⬇ Download"}</button></span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : <div style={{ padding: "30px", textAlign: "center", color: "#64748B", fontSize: "14px" }}>No published exam results for this student yet.</div>
                    )}
                </div>

                <div style={{ padding: "16px 24px", backgroundColor: "#F8FAFC", borderTop: "1px solid #E2E8F0", textAlign: "right" }}>
                    <button onClick={onClose} style={{ padding: "8px 24px", backgroundColor: "#fff", border: "1px solid #CBD5E1", borderRadius: "6px", cursor: "pointer", fontWeight: "600", color: "#334155" }}>Close</button>
                </div>
            </div>
        </OverlayDialog>
    );
}


export default StudentsPage;