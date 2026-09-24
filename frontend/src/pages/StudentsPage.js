import { useEffect, useState, useRef } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import StudentForm from "../components/StudentForm";
import StudentSearch from "../components/StudentSearch";
import api from "../services/api";

const formatClass = (c) => {
    if (c.name) return c.name;
    const cName = c.className || "";
    const cSec = c.section || "";
    return cSec ? `${cName} ${cSec}`.trim() : cName.trim();
};

function StudentsPage() {
    const [students, setStudents] = useState([]);
    const [filteredStudents, setFilteredStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [showForm, setShowForm] = useState(false);
    
    const [classes, setClasses] = useState([]);
    
    const [selectedClass, setSelectedClass] = useState("All");
    const [searchKeyword, setSearchKeyword] = useState("");
    const [sortBy, setSortBy] = useState("roll");
    // Unified detail view: { student, tab } — tab is "overview" | "fees".
    const [detailView, setDetailView] = useState(null);
    const [showArchived, setShowArchived] = useState(false);

    // EXCEL IMPORT STATES & REFS
    const fileInputRef = useRef(null);
    const [isImporting, setIsImporting] = useState(false);

    useEffect(() => {
        fetchStudents();
        fetchClasses();
    }, [showArchived]);

    const fetchStudents = async () => {
        try {
            const res = await api.get("/students", {
                params: { status: showArchived ? "archived" : "active" }
            });
            const data = Array.isArray(res.data) ? res.data : [];
            setStudents(data);
            setFilteredStudents(sortStudents(data, sortBy));
        } catch (error) {
            console.error("Unable to fetch students:", error);
            setStudents([]);
            setFilteredStudents([]);
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

    const filterStudents = (search, classFilter, mode = sortBy) => {
        const keyword = String(search || "").toLowerCase().trim();
        const result = students.filter((student) => {
            const matchesSearch =
                !keyword ||
                student.studentName?.toLowerCase().includes(keyword) ||
                student.rollNumber?.toLowerCase().includes(keyword) ||
                student.admissionNumber?.toLowerCase().includes(keyword) ||
                student.satsNumber?.toLowerCase().includes(keyword) ||
                student.fatherName?.toLowerCase().includes(keyword) ||
                student.contact1?.toLowerCase().includes(keyword) ||
                student.contact2?.toLowerCase().includes(keyword);

            const matchesClass = classFilter === "All" || student.className === classFilter;
            return matchesSearch && matchesClass;
        });
        setFilteredStudents(sortStudents(result, mode));
    };

    const handleSearch = (value) => {
        setSearchKeyword(value);
        filterStudents(value, selectedClass);
    };

    const handleClassChange = (e) => {
        const value = e.target.value;
        setSelectedClass(value);
        filterStudents(searchKeyword, value);
    };

    const handleSortChange = (e) => {
        const value = e.target.value;
        setSortBy(value);
        filterStudents(searchKeyword, selectedClass, value);
    };

    const handleStatusToggle = (archived) => {
        setShowArchived(archived);
        setSelectedClass("All");
        setSearchKeyword("");
    };

    const handleEdit = (student) => {
        if (student.status === "archived") {
            alert("Archived students cannot be edited. Restore the student first.");
            return;
        }
        setSelectedStudent(student);
        setShowForm(true);
    };

    const handleArchive = async (student) => {
        const reason = window.prompt(`Why are you archiving ${student.studentName}?`);
        if (!reason || !reason.trim()) return;

        const confirmed = window.confirm(`Archive ${student.studentName}?\n\nThe student will NOT be deleted. Their fee history will remain.`);
        if (!confirmed) return;

        try {
            await api.post(`/students/${student.id}/archive`, { reason: reason.trim() });
            alert("Student archived successfully.");
            fetchStudents();
        } catch (error) {
            alert(error.response?.data?.message || "Unable to archive student.");
        }
    };

    const handleRestore = async (student) => {
        if (!window.confirm(`Restore ${student.studentName}?`)) return;
        try {
            await api.post(`/students/${student.id}/restore`);
            alert("Student restored successfully.");
            fetchStudents();
        } catch (error) {
            alert(error.response?.data?.message || "Unable to restore student.");
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
            alert(res.data.message || "Import successful!");
            
            // AUTOMATICALLY REFRESH BOTH TABLES AFTER IMPORT
            fetchStudents(); 
            fetchClasses(); // <--- ADDED: This guarantees the dropdown populates immediately
            
        } catch (error) {
            console.error("Import error:", error);
            alert(error.response?.data?.message || "Failed to import students.");
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = ""; // Reset the input
        }
    };

    return (
        <div className="dashboard">
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

                    <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                        <button
                            type="button"
                            className={!showArchived ? "primary-btn" : "clear-btn"}
                            onClick={() => handleStatusToggle(false)}
                        >
                            Active Students
                        </button>

                        <button
                            type="button"
                            className={showArchived ? "primary-btn" : "clear-btn"}
                            onClick={() => handleStatusToggle(true)}
                        >
                            Archived Students
                        </button>
                    </div>

                    <div className="student-filters" style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: "200px" }}>
                            <StudentSearch onSearch={handleSearch} />
                        </div>

                        <select className="filter-select" value={selectedClass} onChange={handleClassChange} style={{ minWidth: "150px" }}>
                            <option value="All">All Classes</option>
                            {classes.map((c) => {
                                const displayClass = formatClass(c);
                                return <option key={c.id} value={displayClass}>{displayClass}</option>;
                            })}
                        </select>

                        <select className="filter-select" value={sortBy} onChange={handleSortChange} style={{ minWidth: "150px" }}>
                            <option value="roll">Sort: Roll No.</option>
                            <option value="name">Sort: Name (A–Z)</option>
                        </select>
                        {/* Classes are now created and managed on the dedicated
                            Class Management page. */}
                    </div>

                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Adm No.</th>
                                    <th>Roll No.</th>
                                    <th>Student Name</th>
                                    <th>Class</th>
                                    <th>Contact</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: "right", paddingRight: "20px" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStudents.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                                            {showArchived ? "No archived students found." : "No active students found."}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredStudents.map((student) => (
                                        <tr key={student.id} style={student.status === "archived" ? { opacity: 0.65 } : {}}>
                                            <td style={{ color: "#64748B", fontSize: "13px" }}>{student.admissionNumber || "-"}</td>
                                            <td><strong>{student.rollNumber || "-"}</strong></td>
                                            <td><strong>{student.studentName}</strong></td>
                                            <td>{student.className || "-"}</td>
                                            <td>
                                                <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.4 }}>
                                                    <span>{student.contact1 || "-"}</span>
                                                    {student.contact2 ? (
                                                        <span style={{ fontSize: "12px", color: "#64748B" }}>{student.contact2}</span>
                                                    ) : null}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={student.status === "archived" ? "payment-badge mode-default" : "payment-badge mode-upi"}>
                                                    {student.status === "archived" ? "Archived" : "Active"}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: "right" }}>
                                                <div className="action-buttons" style={{ justifyContent: "flex-end" }}>
                                                    <button
                                                        onClick={() => setDetailView({ student, tab: "overview" })}
                                                        style={{ background: "#0F172A", border: "1px solid #0F172A", color: "#fff", padding: "6px 14px", borderRadius: "4px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}
                                                    >
                                                        View Details
                                                    </button>

                                                    {student.status === "archived" ? (
                                                        <button className="edit-btn" onClick={() => handleRestore(student)}>Restore</button>
                                                    ) : (
                                                        <>
                                                            <button className="edit-btn" onClick={() => handleEdit(student)}>Edit</button>
                                                            <button className="delete-btn" onClick={() => handleArchive(student)}>Archive</button>
                                                        </>
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

            {/* MODALS */}
            {showForm && (
                <StudentForm
                    student={selectedStudent}
                    onClose={() => {
                        setShowForm(false);
                        setSelectedStudent(null);
                        fetchStudents();
                    }}
                />
            )}

            {detailView && (
                <StudentDetailModal
                    student={detailView.student}
                    initialTab={detailView.tab}
                    onClose={() => setDetailView(null)}
                />
            )}
        </div>
    );
}

// =====================================================
// UNIFIED STUDENT DETAIL MODAL
// One place for everything: profile + full fee account.
// =====================================================
function StudentDetailModal({ student, initialTab = "overview", onClose }) {
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
            alert(error?.response?.data?.message || "Unable to download report card.");
        } finally {
            setDlExamId(null);
        }
    };

    if (!student) return null;

    const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const Label = ({ children }) => <div style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>{children}</div>;
    const Value = ({ children }) => <div style={{ fontSize: "14px", fontWeight: "600", color: "#0F172A", marginBottom: "16px" }}>{children || "-"}</div>;

    // Fee math (mirrors the standalone ledger).
    const prevDues = Number(student?.previousDues || 0);
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
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "16px" }}>
            <div style={{ backgroundColor: "#ffffff", borderRadius: "14px", width: "100%", maxWidth: "720px", maxHeight: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", overflow: "hidden" }}>

                {/* Header Strip */}
                <div style={{ backgroundColor: "#0F172A", padding: "24px", color: "#fff", position: "relative" }}>
                    <button onClick={onClose} style={{ position: "absolute", top: "16px", right: "16px", background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", width: "30px", height: "30px", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>✕</button>
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
                            <div style={{ padding: "30px", textAlign: "center", color: "#64748B", fontSize: "14px" }}>Loading fee account...</div>
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
                                        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1.2fr", padding: "8px 14px", backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0", fontSize: "12px", fontWeight: "600", color: "#475569" }}><span>Date</span><span>Mode</span><span style={{ textAlign: "center" }}>Status</span><span style={{ textAlign: "right" }}>Amount Paid</span></div>
                                        {history.payments?.length === 0 ? <div style={{ padding: "14px", textAlign: "center", color: "#64748B", fontSize: "13px" }}>No receipts recorded for this session.</div> : history.payments?.map((payment) => <div key={payment.id} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1.2fr", alignItems: "center", padding: "9px 14px", borderBottom: "1px solid #F1F5F9", fontSize: "13px", opacity: payment.status === "reversed" ? 0.6 : 1 }}><span style={{ color: "#334155" }}>{payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString("en-IN") : "-"}</span><span style={{ color: "#334155", fontWeight: "500" }}>{payment.paymentMode || "Cash"}</span><span style={{ textAlign: "center" }}><span style={{ fontSize: "10px", fontWeight: "700", padding: "2px 7px", borderRadius: "4px", backgroundColor: payment.status === "reversed" ? "#F1F5F9" : "#DCFCE7", color: payment.status === "reversed" ? "#64748B" : "#15803D" }}>{payment.status === "reversed" ? "Reversed" : "Completed"}</span></span><strong style={{ textAlign: "right", color: "#0F172A" }}>{money(payment.amount)}</strong></div>)}
                                    </div>
                                </div>
                            </>
                        ) : <div style={{ padding: "20px", textAlign: "center", color: "#DC2626" }}>Unable to load fee account.</div>
                    ) : (
                        loadingResults ? (
                            <div style={{ padding: "30px", textAlign: "center", color: "#64748B", fontSize: "14px" }}>Loading exam results...</div>
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
        </div>
    );
}


export default StudentsPage;