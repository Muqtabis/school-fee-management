import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import StudentForm from "../components/StudentForm";
import StudentSearch from "../components/StudentSearch";
import api from "../services/api";

function StudentsPage() {
    const [students, setStudents] = useState([]);
    const [filteredStudents, setFilteredStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [selectedClass, setSelectedClass] = useState("All");
    const [searchKeyword, setSearchKeyword] = useState("");
    const [historyStudent, setHistoryStudent] = useState(null);
    const [showArchived, setShowArchived] = useState(false);

    const classes = [
        "LKG", "UKG", 
    "1A", "1B", "2A", "2B", "3A", "3B", "4A", "4B", 
    "5A", "5B", "6A", "6B", "7A", "7B", "8A", "8B", 
    "9A", "9B", "10A", "10B"
    ];

    // =====================================================
    // LOAD STUDENTS
    // =====================================================
    useEffect(() => {
        fetchStudents();
    }, [showArchived]);

    const fetchStudents = async () => {
        try {
            const res = await api.get("/students", {
                params: {
                    status: showArchived ? "archived" : "active"
                }
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

    // =====================================================
    // FILTER LOGIC
    // =====================================================
    const filterStudents = (search, classFilter) => {
        const keyword = String(search || "").toLowerCase().trim();

        const result = students.filter((student) => {
            const matchesSearch =
                !keyword ||
                student.studentName?.toLowerCase().includes(keyword) ||
                student.rollNumber?.toLowerCase().includes(keyword) ||
                student.className?.toLowerCase().includes(keyword) ||
                student.fatherName?.toLowerCase().includes(keyword) ||
                student.contact1?.toLowerCase().includes(keyword);

            const matchesClass =
                classFilter === "All" || student.className === classFilter;

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

    // =====================================================
    // ACTIONS
    // =====================================================
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

        const confirmed = window.confirm(
            `Archive ${student.studentName}?\n\n` +
            `Class: ${getClassDisplay(student.className)}\n` +
            `Roll No: ${student.rollNumber || "-"}\n\n` +
            `Reason: ${reason.trim()}\n\n` +
            `The student will NOT be deleted. Their fee and payment history will remain.`
        );

        if (!confirmed) return;

        try {
            await api.post(`/students/${student.id}/archive`, {
                reason: reason.trim()
            });
            alert("Student archived successfully.");
            fetchStudents();
        } catch (error) {
            alert(error.response?.data?.message || "Unable to archive student.");
        }
    };

    const handleRestore = async (student) => {
        const confirmed = window.confirm(
            `Restore ${student.studentName}?\n\n` +
            `Class: ${getClassDisplay(student.className)}\n` +
            `Roll No: ${student.rollNumber || "-"}`
        );

        if (!confirmed) return;

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

    const getClassDisplay = (className) => {
        if (className === "LKG" || className === "UKG") return className;
        return `${className} Standard`;
    };

    return (
        <div className="dashboard">
            <Sidebar />

            <div className="main-content">
                <Navbar />

                <div className="page-content">
                    {/* PAGE HEADER */}
                    <div className="page-header">
                        <div>
                            <h2>Students</h2>
                            <p>Manage students, classes, and individual fee accounts.</p>
                        </div>

                        {!showArchived && (
                            <button className="primary-btn" onClick={handleAddStudent}>
                                + Add Student
                            </button>
                        )}
                    </div>

                    {/* STATUS BUTTONS */}
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

                    {/* FILTERS */}
                    <div className="student-filters">
                        <StudentSearch onSearch={handleSearch} />

                        <select
                            className="filter-select"
                            value={selectedClass}
                            onChange={handleClassChange}
                        >
                            <option value="All">All Classes</option>
                            {classes.map((className) => (
                                <option key={className} value={className}>
                                    {getClassDisplay(className)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* MAIN STUDENTS TABLE */}
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Roll No.</th>
                                    <th>Student</th>
                                    <th>Class</th>
                                    <th>Father</th>
                                    <th>Contact</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                {filteredStudents.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                                            {showArchived
                                                ? "No archived students found."
                                                : "No active students found."}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredStudents.map((student, index) => (
                                        <tr
                                            key={student.id}
                                            style={student.status === "archived" ? { opacity: 0.65 } : {}}
                                        >
                                            <td>{index + 1}</td>
                                            <td><strong>{student.rollNumber || "-"}</strong></td>
                                            <td><strong>{student.studentName}</strong></td>
                                            <td>{getClassDisplay(student.className)}</td>
                                            <td>{student.fatherName || "-"}</td>
                                            <td>{student.contact1 || "-"}</td>
                                            <td>
                                                <span className={student.status === "archived" ? "payment-badge mode-default" : "payment-badge mode-upi"}>
                                                    {student.status === "archived" ? "Archived" : "Active"}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button
                                                        className="history-btn"
                                                        onClick={() => setHistoryStudent(student)}
                                                    >
                                                        History
                                                    </button>

                                                    {student.status === "archived" ? (
                                                        <button
                                                            className="edit-btn"
                                                            onClick={() => handleRestore(student)}
                                                        >
                                                            Restore
                                                        </button>
                                                    ) : (
                                                        <>
                                                            <button
                                                                className="edit-btn"
                                                                onClick={() => handleEdit(student)}
                                                            >
                                                                Edit
                                                            </button>

                                                            <button
                                                                className="delete-btn"
                                                                onClick={() => handleArchive(student)}
                                                            >
                                                                Archive
                                                            </button>
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

            {/* ADD/EDIT STUDENT MODAL */}
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

            {/* FULL FEE HISTORY MODAL */}
            {historyStudent && (
                <FeeHistory
                    student={historyStudent}
                    onClose={() => setHistoryStudent(null)}
                />
            )}
        </div>
    );
}

// =====================================================
// CLEAN & COMPACT FLEXBOX FEE HISTORY MODAL
// =====================================================
function FeeHistory({ student, onClose }) {
    const [history, setHistory] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadHistory();
    }, [student]);

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

    const money = (value) =>
        `₹${Number(value || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;

    // Compute Net Total Demand incorporating Previous Dues & Concession
    const prevDues = Number(student?.previousDues || 0);
    const concession = Number(student?.concessionAmount || 0);

    let standardTotal = Number(history?.totalFee || 0);
    if (Array.isArray(history?.items) && history.items.length > 0) {
        standardTotal = history.items.reduce((sum, item) => {
            if (
                item.itemType === "carry_forward" ||
                item.componentName?.toLowerCase().includes("previous")
            ) {
                return sum;
            }
            return sum + Number(item.amount || 0);
        }, 0);
    }

    const netAcademicFee = Math.max(0, standardTotal - concession);
    const computedTotalFee = prevDues + netAcademicFee;
    const computedPaid = Number(history?.totalPaid || 0);
    const computedBalance = Math.max(0, computedTotalFee - computedPaid);

    return (
        <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px"
        }}>
            <div style={{
                backgroundColor: "#ffffff",
                borderRadius: "14px",
                width: "100%",
                maxWidth: "600px",
                maxHeight: "90vh",
                overflowY: "auto",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                display: "flex",
                flexDirection: "column",
                boxSizing: "border-box"
            }}>
                {/* HEADER */}
                <div style={{
                    padding: "16px 20px",
                    borderBottom: "1px solid #E2E8F0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                }}>
                    <div>
                        <h2 style={{ fontSize: "17px", fontWeight: "700", color: "#0F172A", margin: 0 }}>
                            Fee Account Ledger
                        </h2>
                        <p style={{ fontSize: "13px", color: "#64748B", margin: "2px 0 0" }}>
                            <strong style={{ color: "#1E293B" }}>{student.studentName}</strong>
                            {" • "}
                            <span>{student.rollNumber ? `Roll No. ${student.rollNumber}` : "No Roll"}</span>
                            {" • "}
                            <span>
                                {student.className === "LKG" || student.className === "UKG"
                                    ? student.className
                                    : `${student.className} Standard`}
                            </span>
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            background: "#F1F5F9",
                            border: "none",
                            fontSize: "14px",
                            color: "#475569",
                            cursor: "pointer",
                            width: "28px",
                            height: "28px",
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: "bold"
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* MODAL BODY */}
                <div style={{ padding: "20px" }}>
                    {loading ? (
                        <div style={{ padding: "30px", textAlign: "center", color: "#64748B", fontSize: "14px" }}>
                            Loading account ledger...
                        </div>
                    ) : history ? (
                        <>
                            {/* ACADEMIC SESSION BANNER */}
                            <div style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                backgroundColor: "#F8FAFC",
                                padding: "10px 14px",
                                borderRadius: "8px",
                                border: "1px solid #E2E8F0",
                                marginBottom: "16px"
                            }}>
                                <div>
                                    <span style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", textTransform: "uppercase" }}>
                                        Academic Session
                                    </span>
                                    <div style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A" }}>
                                        {history.academicYear?.name || "2026-2027"}
                                    </div>
                                </div>
                                <span style={{
                                    backgroundColor: "#DCFCE7",
                                    color: "#15803D",
                                    fontSize: "11px",
                                    fontWeight: "700",
                                    padding: "3px 10px",
                                    borderRadius: "20px"
                                }}>
                                    ● Active Account
                                </span>
                            </div>

                            {/* 3 SUMMARY CARDS */}
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(3, 1fr)",
                                gap: "10px",
                                marginBottom: "20px"
                            }}>
                                <div style={{
                                    backgroundColor: "#F8FAFC",
                                    border: "1px solid #E2E8F0",
                                    padding: "12px",
                                    borderRadius: "8px"
                                }}>
                                    <span style={{ fontSize: "11px", color: "#64748B", fontWeight: "600" }}>Total Demand</span>
                                    <div style={{ fontSize: "17px", fontWeight: "700", color: "#0F172A", marginTop: "2px" }}>
                                        {money(computedTotalFee)}
                                    </div>
                                </div>

                                <div style={{
                                    backgroundColor: "#F0FDF4",
                                    border: "1px solid #BBF7D0",
                                    padding: "12px",
                                    borderRadius: "8px"
                                }}>
                                    <span style={{ fontSize: "11px", color: "#15803D", fontWeight: "600" }}>Total Paid</span>
                                    <div style={{ fontSize: "17px", fontWeight: "700", color: "#16A34A", marginTop: "2px" }}>
                                        {money(computedPaid)}
                                    </div>
                                </div>

                                <div style={{
                                    backgroundColor: computedBalance > 0 ? "#FEF2F2" : "#F8FAFC",
                                    border: "1px solid",
                                    borderColor: computedBalance > 0 ? "#FECACA" : "#E2E8F0",
                                    padding: "12px",
                                    borderRadius: "8px"
                                }}>
                                    <span style={{ fontSize: "11px", color: computedBalance > 0 ? "#DC2626" : "#64748B", fontWeight: "600" }}>
                                        Balance Due
                                    </span>
                                    <div style={{
                                        fontSize: "17px",
                                        fontWeight: "700",
                                        color: computedBalance > 0 ? "#DC2626" : "#16A34A",
                                        marginTop: "2px"
                                    }}>
                                        {money(computedBalance)}
                                    </div>
                                </div>
                            </div>

                            {/* ASSESSED FEE STRUCTURE (FLEXBOX LIST) */}
                            <div style={{ marginBottom: "20px" }}>
                                <div style={{
                                    fontSize: "12px",
                                    fontWeight: "700",
                                    color: "#475569",
                                    marginBottom: "8px",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.5px"
                                }}>
                                    Assessed Fee Structure
                                </div>

                                <div style={{
                                    border: "1px solid #E2E8F0",
                                    borderRadius: "8px",
                                    overflow: "hidden",
                                    backgroundColor: "#FFFFFF"
                                }}>
                                    {/* Header Row */}
                                    <div style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        padding: "8px 14px",
                                        backgroundColor: "#F8FAFC",
                                        borderBottom: "1px solid #E2E8F0",
                                        fontSize: "12px",
                                        fontWeight: "600",
                                        color: "#475569"
                                    }}>
                                        <span>Component</span>
                                        <span>Amount (₹)</span>
                                    </div>

                                    {/* Previous Dues */}
                                    {prevDues > 0 && (
                                        <div style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            padding: "10px 14px",
                                            backgroundColor: "#EFF6FF",
                                            borderBottom: "1px solid #DBEAFE"
                                        }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <span style={{ color: "#1E40AF", fontWeight: "600", fontSize: "13px" }}>Previous Dues</span>
                                                <span style={{ backgroundColor: "#DBEAFE", color: "#1E40AF", fontSize: "10px", fontWeight: "700", padding: "1px 6px", borderRadius: "4px" }}>
                                                    Carry Forward
                                                </span>
                                            </div>
                                            <strong style={{ color: "#1E40AF", fontSize: "13px" }}>
                                                {money(prevDues)}
                                            </strong>
                                        </div>
                                    )}

                                    {/* Standard Items */}
                                    {history.items?.map((item) => (
                                        <div
                                            key={item.id}
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                padding: "9px 14px",
                                                borderBottom: "1px solid #F1F5F9",
                                                fontSize: "13px"
                                            }}
                                        >
                                            <span style={{ color: "#334155" }}>{item.componentName}</span>
                                            <strong style={{ color: "#0F172A" }}>{money(item.amount)}</strong>
                                        </div>
                                    ))}

                                    {/* Concession */}
                                    {concession > 0 && (
                                        <div style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            padding: "10px 14px",
                                            backgroundColor: "#F0FDF4",
                                            borderTop: "1px solid #DCFCE7"
                                        }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <span style={{ color: "#15803D", fontWeight: "600", fontSize: "13px" }}>Fee Concession</span>
                                                <span style={{ backgroundColor: "#DCFCE7", color: "#15803D", fontSize: "10px", fontWeight: "700", padding: "1px 6px", borderRadius: "4px" }}>
                                                    {student.concessionReason || "Discount"}
                                                </span>
                                            </div>
                                            <strong style={{ color: "#16A34A", fontSize: "13px" }}>
                                                - {money(concession)}
                                            </strong>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* TRANSACTION RECEIPTS AUDIT LOG */}
                            <div>
                                <div style={{
                                    fontSize: "12px",
                                    fontWeight: "700",
                                    color: "#475569",
                                    marginBottom: "8px",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.5px"
                                }}>
                                    Transaction Receipts Log
                                </div>

                                <div style={{
                                    border: "1px solid #E2E8F0",
                                    borderRadius: "8px",
                                    overflow: "hidden",
                                    backgroundColor: "#FFFFFF"
                                }}>
                                    <div style={{
                                        display: "grid",
                                        gridTemplateColumns: "1.2fr 1fr 1fr 1.2fr",
                                        padding: "8px 14px",
                                        backgroundColor: "#F8FAFC",
                                        borderBottom: "1px solid #E2E8F0",
                                        fontSize: "12px",
                                        fontWeight: "600",
                                        color: "#475569"
                                    }}>
                                        <span>Date</span>
                                        <span>Mode</span>
                                        <span style={{ textAlign: "center" }}>Status</span>
                                        <span style={{ textAlign: "right" }}>Amount Paid</span>
                                    </div>

                                    {history.payments?.length === 0 ? (
                                        <div style={{ padding: "14px", textAlign: "center", color: "#64748B", fontSize: "13px" }}>
                                            No receipts recorded for this session.
                                        </div>
                                    ) : (
                                        history.payments?.map((payment) => (
                                            <div
                                                key={payment.id}
                                                style={{
                                                    display: "grid",
                                                    gridTemplateColumns: "1.2fr 1fr 1fr 1.2fr",
                                                    alignItems: "center",
                                                    padding: "9px 14px",
                                                    borderBottom: "1px solid #F1F5F9",
                                                    fontSize: "13px",
                                                    opacity: payment.status === "reversed" ? 0.6 : 1
                                                }}
                                            >
                                                <span style={{ color: "#334155" }}>
                                                    {payment.paymentDate
                                                        ? new Date(payment.paymentDate).toLocaleDateString("en-IN")
                                                        : "-"}
                                                </span>
                                                <span style={{ color: "#334155", fontWeight: "500" }}>
                                                    {payment.paymentMode || "Cash"}
                                                </span>
                                                <span style={{ textAlign: "center" }}>
                                                    <span style={{
                                                        fontSize: "10px",
                                                        fontWeight: "700",
                                                        padding: "2px 7px",
                                                        borderRadius: "4px",
                                                        backgroundColor: payment.status === "reversed" ? "#F1F5F9" : "#DCFCE7",
                                                        color: payment.status === "reversed" ? "#64748B" : "#15803D"
                                                    }}>
                                                        {payment.status === "reversed" ? "Reversed" : "Completed"}
                                                    </span>
                                                </span>
                                                <strong style={{ textAlign: "right", color: "#0F172A" }}>
                                                    {money(payment.amount)}
                                                </strong>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={{ padding: "20px", textAlign: "center", color: "#DC2626" }}>
                            Unable to load fee account.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default StudentsPage;