import { useEffect, useState } from "react";
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
    const [showClassManager, setShowClassManager] = useState(false);
    
    const [selectedClass, setSelectedClass] = useState("All");
    const [searchKeyword, setSearchKeyword] = useState("");
    const [historyStudent, setHistoryStudent] = useState(null);
    const [profileStudent, setProfileStudent] = useState(null); // NEW: Profile State
    const [showArchived, setShowArchived] = useState(false);

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
            setFilteredStudents(data);
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

    const filterStudents = (search, classFilter) => {
        const keyword = String(search || "").toLowerCase().trim();
        const result = students.filter((student) => {
            const matchesSearch =
                !keyword ||
                student.studentName?.toLowerCase().includes(keyword) ||
                student.rollNumber?.toLowerCase().includes(keyword) ||
                student.admissionNumber?.toLowerCase().includes(keyword) ||
                student.satsNumber?.toLowerCase().includes(keyword) ||
                student.fatherName?.toLowerCase().includes(keyword) ||
                student.contact1?.toLowerCase().includes(keyword);

            const matchesClass = classFilter === "All" || student.className === classFilter;
            return matchesSearch && matchesClass;
        });
        setFilteredStudents(result);
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
                            <button className="primary-btn" onClick={handleAddStudent}>
                                + Add Student
                            </button>
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

                        <button 
                            type="button"
                            onClick={() => setShowClassManager(true)}
                            style={{
                                padding: "10px 16px", backgroundColor: "#F1F5F9", border: "1px solid #CBD5E1",
                                borderRadius: "8px", color: "#334155", fontWeight: "600", cursor: "pointer"
                            }}
                        >
                            Manage Classes
                        </button>
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
                                            <td>{student.contact1 || "-"}</td>
                                            <td>
                                                <span className={student.status === "archived" ? "payment-badge mode-default" : "payment-badge mode-upi"}>
                                                    {student.status === "archived" ? "Archived" : "Active"}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: "right" }}>
                                                <div className="action-buttons" style={{ justifyContent: "flex-end" }}>
                                                    <button 
                                                        onClick={() => setProfileStudent(student)}
                                                        style={{ background: "#F1F5F9", border: "1px solid #CBD5E1", color: "#334155", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}
                                                    >
                                                        Profile
                                                    </button>
                                                    <button className="history-btn" onClick={() => setHistoryStudent(student)}>Fees</button>
                                                    
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

            {showClassManager && <ClassManagerModal classes={classes} refreshClasses={fetchClasses} onClose={() => setShowClassManager(false)} />}
            {historyStudent && <FeeHistory student={historyStudent} onClose={() => setHistoryStudent(null)} />}
            {profileStudent && <StudentProfileModal student={profileStudent} onClose={() => setProfileStudent(null)} />}
        </div>
    );
}

// =====================================================
// NEW: STUDENT PROFILE MODAL
// =====================================================
function StudentProfileModal({ student, onClose }) {
    if (!student) return null;

    const Label = ({ children }) => <div style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>{children}</div>;
    const Value = ({ children }) => <div style={{ fontSize: "14px", fontWeight: "600", color: "#0F172A", marginBottom: "16px" }}>{children || "-"}</div>;

    return (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "16px" }}>
            <div style={{ backgroundColor: "#ffffff", borderRadius: "14px", width: "100%", maxWidth: "650px", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", overflow: "hidden" }}>
                
                {/* Header Strip */}
                <div style={{ backgroundColor: "#0F172A", padding: "24px", color: "#fff", position: "relative" }}>
                    <button onClick={onClose} style={{ position: "absolute", top: "16px", right: "16px", background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", width: "30px", height: "30px", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>✕</button>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <div style={{ width: "64px", height: "64px", backgroundColor: "#334155", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", fontWeight: "bold", border: "2px solid #64748B" }}>
                            {student.studentName.charAt(0)}
                        </div>
                        <div>
                            <h2 style={{ margin: "0 0 4px 0", fontSize: "22px" }}>{student.studentName}</h2>
                            <div style={{ display: "flex", gap: "12px", fontSize: "13px", color: "#CBD5E1" }}>
                                <span>Class: <strong>{student.className}</strong></span>
                                <span>|</span>
                                <span>Roll No: <strong>{student.rollNumber || "-"}</strong></span>
                                <span>|</span>
                                <span style={{ color: student.status === 'active' ? '#86EFAC' : '#FCA5A5' }}>● {student.status.toUpperCase()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ padding: "24px", maxHeight: "60vh", overflowY: "auto" }}>
                    <h3 style={{ fontSize: "15px", color: "#334155", borderBottom: "1px solid #E2E8F0", paddingBottom: "8px", marginBottom: "16px" }}>Academic Profile</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                        <div><Label>Admission No.</Label><Value>{student.admissionNumber}</Value></div>
                        <div><Label>SATS No.</Label><Value>{student.satsNumber}</Value></div>
                        <div><Label>Enrollment Date</Label><Value>{new Date(student.createdAt).toLocaleDateString()}</Value></div>
                    </div>

                    <h3 style={{ fontSize: "15px", color: "#334155", borderBottom: "1px solid #E2E8F0", paddingBottom: "8px", marginBottom: "16px", marginTop: "8px" }}>Personal Details</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                        <div><Label>Gender</Label><Value>{student.gender}</Value></div>
                        <div><Label>Date of Birth</Label><Value>{student.dob ? new Date(student.dob).toLocaleDateString() : "-"}</Value></div>
                        <div><Label>Primary Contact</Label><Value>{student.contact1}</Value></div>
                        <div><Label>Father's Name</Label><Value>{student.fatherName}</Value></div>
                        <div><Label>Mother's Name</Label><Value>{student.motherName}</Value></div>
                        <div style={{ gridColumn: "span 3" }}><Label>Home Address</Label><Value>{student.address}</Value></div>
                        <div style={{ gridColumn: "span 3" }}><Label>General Remarks</Label><Value>{student.remark}</Value></div>
                    </div>
                </div>
                
                <div style={{ padding: "16px 24px", backgroundColor: "#F8FAFC", borderTop: "1px solid #E2E8F0", textAlign: "right" }}>
                    <button onClick={onClose} style={{ padding: "8px 24px", backgroundColor: "#fff", border: "1px solid #CBD5E1", borderRadius: "6px", cursor: "pointer", fontWeight: "600", color: "#334155" }}>Close Profile</button>
                </div>
            </div>
        </div>
    );
}

// =====================================================
// DYNAMIC CLASS MANAGER MODAL
// =====================================================
function ClassManagerModal({ classes, refreshClasses, onClose }) {
    const [className, setClassName] = useState("");
    const [section, setSection] = useState("");
    const [loading, setLoading] = useState(false);

    const handleAddClass = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post("/classes", { className, section });
            setClassName("");
            setSection("");
            refreshClasses();
        } catch (error) {
            alert(error.response?.data?.message || "Failed to add class.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClass = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;
        try {
            await api.delete(`/classes/${id}`);
            refreshClasses();
        } catch (error) {
            alert(error.response?.data?.message || "Failed to delete class.");
        }
    };

    return (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "16px" }}>
            <div style={{ backgroundColor: "#ffffff", borderRadius: "14px", width: "100%", maxWidth: "500px", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 style={{ fontSize: "17px", fontWeight: "700", color: "#0F172A", margin: 0 }}>Manage Classes</h2>
                    <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", fontSize: "14px", color: "#475569", cursor: "pointer", width: "28px", height: "28px", borderRadius: "50%", fontWeight: "bold" }}>✕</button>
                </div>
                <div style={{ padding: "20px", overflowY: "auto" }}>
                    <form onSubmit={handleAddClass} style={{ display: "flex", gap: "10px", marginBottom: "20px", padding: "16px", backgroundColor: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0", alignItems: "flex-end" }}>
                        <div style={{ flex: 2 }}>
                            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px", color: "#475569" }}>Class Name *</label>
                            <input type="text" required value={className} onChange={(e) => setClassName(e.target.value)} placeholder="e.g. 10" style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1", boxSizing: "border-box" }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px", color: "#475569" }}>Section</label>
                            <input type="text" value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. A" style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1", boxSizing: "border-box" }} />
                        </div>
                        <button type="submit" disabled={loading || !className.trim()} style={{ padding: "8px 16px", backgroundColor: className.trim() ? "#0F172A" : "#94A3B8", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "600", cursor: className.trim() ? "pointer" : "not-allowed", height: "35px" }}>{loading ? "Adding..." : "Add"}</button>
                    </form>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#475569", marginBottom: "8px", textTransform: "uppercase" }}>Existing Classes ({classes.length})</div>
                    <div style={{ border: "1px solid #E2E8F0", borderRadius: "8px", overflow: "hidden" }}>
                        {classes.length === 0 ? <div style={{ padding: "16px", textAlign: "center", color: "#64748B", fontSize: "13px" }}>No classes added yet.</div> : classes.map((cls, idx) => {
                            const displayClass = formatClass(cls);
                            return (
                                <div key={cls.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: idx !== classes.length - 1 ? "1px solid #F1F5F9" : "none", fontSize: "14px", color: "#334155" }}>
                                    <span style={{ fontWeight: "600" }}>{displayClass}</span>
                                    <button onClick={() => handleDeleteClass(cls.id, displayClass)} style={{ background: "none", border: "none", color: "#EF4444", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>Delete</button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

// =====================================================
// CLEAN & COMPACT FLEXBOX FEE HISTORY MODAL
// =====================================================
function FeeHistory({ student, onClose }) {
    const [history, setHistory] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadHistory(); }, [student]);

    const loadHistory = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/payments/history/student/${student.id}`);
            setHistory(res.data);
        } catch (error) {
            console.error("Fee History Error:", error);
            setHistory(null);
        } finally {
            setLoading(false);
        }
    };

    const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

    return (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "16px" }}>
            <div style={{ backgroundColor: "#ffffff", borderRadius: "14px", width: "100%", maxWidth: "600px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                        <h2 style={{ fontSize: "17px", fontWeight: "700", color: "#0F172A", margin: 0 }}>Fee Account Ledger</h2>
                        <p style={{ fontSize: "13px", color: "#64748B", margin: "2px 0 0" }}><strong style={{ color: "#1E293B" }}>{student.studentName}</strong>{" • "}<span>{student.rollNumber ? `Roll No. ${student.rollNumber}` : "No Roll"}</span>{" • "}<span>{student.className || "-"}</span></p>
                    </div>
                    <button type="button" onClick={onClose} style={{ background: "#F1F5F9", border: "none", fontSize: "14px", color: "#475569", cursor: "pointer", width: "28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>✕</button>
                </div>

                <div style={{ padding: "20px" }}>
                    {loading ? (
                        <div style={{ padding: "30px", textAlign: "center", color: "#64748B", fontSize: "14px" }}>Loading account ledger...</div>
                    ) : history ? (
                        <>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#F8FAFC", padding: "10px 14px", borderRadius: "8px", border: "1px solid #E2E8F0", marginBottom: "16px" }}>
                                <div><span style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", textTransform: "uppercase" }}>Academic Session</span><div style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A" }}>{history.academicYear?.name || "2026-2027"}</div></div>
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
                    ) : <div style={{ padding: "20px", textAlign: "center", color: "#DC2626" }}>Unable to load fee account.</div>}
                </div>
            </div>
        </div>
    );
}

export default StudentsPage;