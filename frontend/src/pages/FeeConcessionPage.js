import { toast, confirmDialog } from "../services/notify";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import OverlayDialog from "../components/OverlayDialog";
import StudentSearch from "../components/StudentSearch";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

// =====================================================
// FEE CONCESSION MANAGEMENT
//
// One page to categorise students (Regular, RTE, Management, Others) and
// grant/review fee concessions.
// A concession lowers the student's fee demand automatically:
// the ledger math (Payments, Reports, dashboards) subtracts
// concessionAmount from the standard class fee items.
//
// An RTE student who gets free education simply receives a
// concession equal to the standard class fee -> net demand 0.
// =====================================================

const CATEGORY_OPTIONS = [
    { value: "general", label: "Regular" },
    { value: "rte", label: "RTE" },
    { value: "management", label: "Management" },
    { value: "other", label: "Others" }
];

const categoryLabel = (value) =>
    CATEGORY_OPTIONS.find((opt) => opt.value === value)?.label || "Regular";

function FeeConcessionPage() {
    const { user } = useAuth();
    // Removing a concession is money-impacting — admin only.
    const isAdmin = user?.role === "admin";

    const [students, setStudents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);

    const [selectedClass, setSelectedClass] = useState("All");
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [concessionsOnly, setConcessionsOnly] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState("");
    const [sortBy, setSortBy] = useState("roll");

    // Editor dialog: editingStudent = null -> add mode (student picker enabled).
    const [showDialog, setShowDialog] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [formData, setFormData] = useState({
        studentId: "",
        concessionAmount: "",
        concessionReason: "",
        studentCategory: "general"
    });
    const [saving, setSaving] = useState(false);
    // Class filter inside the concession dialog (add mode) so the student
    // dropdown can be narrowed instead of listing the whole school.
    const [dialogClass, setDialogClass] = useState("All");

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [studentsRes, classesRes] = await Promise.all([
                    api.get("/students", { params: { status: "active" } }),
                    api.get("/classes")
                ]);
                setStudents(Array.isArray(studentsRes.data) ? studentsRes.data : []);
                setClasses(Array.isArray(classesRes.data) ? classesRes.data : []);
            } catch (error) {
                console.error("Unable to load concession data:", error);
                setStudents([]);
                setClasses([]);
                toast(error.response?.data?.message || "Unable to load students.");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // Real-time refresh: refetch when the window regains focus and on a gentle
    // timer, so changes made anywhere show up without a manual page refresh.
    // The filtered list is derived from state, so the view never resets.
    useEffect(() => {
        const refresh = () => refreshStudents();
        window.addEventListener("focus", refresh);
        const timer = setInterval(refresh, 30000);
        return () => {
            window.removeEventListener("focus", refresh);
            clearInterval(timer);
        };
    }, []);

    const refreshStudents = async () => {
        try {
            const res = await api.get("/students", { params: { status: "active" } });
            setStudents(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error("Unable to refresh students:", error);
        }
    };

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

    const filteredStudents = useMemo(() => {
        const keyword = String(searchKeyword || "").toLowerCase().trim();
        const result = students.filter((student) => {
            const matchesSearch =
                !keyword ||
                student.studentName?.toLowerCase().includes(keyword) ||
                student.rollNumber?.toLowerCase().includes(keyword) ||
                student.admissionNumber?.toLowerCase().includes(keyword) ||
                student.satsNumber?.toLowerCase().includes(keyword) ||
                student.fatherName?.toLowerCase().includes(keyword) ||
                student.contact1?.toLowerCase().includes(keyword);

            const matchesClass = selectedClass === "All" || student.className === selectedClass;
            const matchesCategory =
                selectedCategory === "All" || (student.studentCategory || "general") === selectedCategory;
            const matchesConcession = !concessionsOnly || Number(student.concessionAmount || 0) > 0;

            return matchesSearch && matchesClass && matchesCategory && matchesConcession;
        });
        return sortStudents(result, sortBy);
    }, [students, searchKeyword, selectedClass, selectedCategory, concessionsOnly, sortBy]);

    const summary = useMemo(() => {
        const conceded = students.filter((s) => Number(s.concessionAmount || 0) > 0);
        return {
            concessionCount: conceded.length,
            totalConcession: conceded.reduce((sum, s) => sum + Number(s.concessionAmount || 0), 0),
            rteCount: students.filter((s) => (s.studentCategory || "general") === "rte").length
        };
    }, [students]);

    const money = (value) =>
        `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const formatClass = (c) => {
        if (c.name) return c.name;
        const cName = c.className || "";
        const cSec = c.section || "";
        return cSec ? `${cName} ${cSec}`.trim() : cName.trim();
    };

    const CategoryBadge = ({ student }) => {
        const value = student.studentCategory || "general";
        return (
            <span className={value === "rte" ? "payment-badge mode-upi" : "payment-badge mode-default"}>
                {categoryLabel(value)}
            </span>
        );
    };

    const openAdd = () => {
        setEditingStudent(null);
        setDialogClass("All");
        setFormData({ studentId: "", concessionAmount: "", concessionReason: "", studentCategory: "general" });
        setShowDialog(true);
    };

    const openEdit = (student) => {
        setEditingStudent(student);
        setFormData({
            studentId: String(student.id),
            concessionAmount: String(Number(student.concessionAmount || 0)),
            concessionReason: student.concessionReason || "",
            studentCategory: student.studentCategory || "general"
        });
        setShowDialog(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();

        const studentId = editingStudent ? editingStudent.id : Number(formData.studentId);
        if (!studentId) return toast("Please select a student.");

        const amount = Number(formData.concessionAmount);
        if (!Number.isFinite(amount) || amount < 0) return toast("Concession amount must be 0 or more.");

        const reason = String(formData.concessionReason || "").trim();
        if (amount > 0 && !reason) return toast("A reason is required when granting a concession.");

        setSaving(true);
        try {
            await api.put(`/concessions/${studentId}`, {
                concessionAmount: amount,
                concessionReason: reason,
                studentCategory: formData.studentCategory
            });
            toast(amount > 0 ? "Concession saved." : "Concession cleared.");
            setShowDialog(false);
            setEditingStudent(null);
            await refreshStudents();
        } catch (error) {
            toast(error.response?.data?.message || "Unable to save concession.");
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = async (student) => {
        if (!(await confirmDialog({
            message: `Remove the concession of ${money(student.concessionAmount)} from ${student.studentName}? Their fee demand will go back up. The category stays unchanged.`,
            confirmLabel: "Remove",
            danger: true
        }))) return;
        try {
            await api.delete(`/concessions/${student.id}`);
            toast("Concession removed.");
            await refreshStudents();
        } catch (error) {
            toast(error.response?.data?.message || "Unable to remove concession.");
        }
    };

    if (loading) {
        return (
            <div className="dashboard">
                <Sidebar />
                <div className="main-content">
                    <Navbar />
                    <div className="page-content">
                        <div className="p-skeleton p-skeleton-line short" />
                        <div className="p-skeleton p-skeleton-table" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <Sidebar />

            <div className="main-content">
                <Navbar />

                <div className="page-content">
                    <div className="page-header">
                        <div>
                            <h2>Fee Concessions</h2>
                            <p>Categorise students (RTE, Management, etc.) and manage fee concessions &amp; free education.</p>
                        </div>
                        <button className="primary-btn" onClick={openAdd}>
                            + Add Concession
                        </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "20px" }}>
                        <div style={{ backgroundColor: "#FEF3C7", border: "1px solid #FDE68A", padding: "12px", borderRadius: "8px" }}>
                            <span style={{ fontSize: "11px", color: "#92400E", fontWeight: "600" }}>STUDENTS WITH CONCESSION</span>
                            <div style={{ fontSize: "18px", fontWeight: "700", color: "#92400E", marginTop: "2px" }}>{summary.concessionCount}</div>
                        </div>
                        <div style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", padding: "12px", borderRadius: "8px" }}>
                            <span style={{ fontSize: "11px", color: "#15803D", fontWeight: "600" }}>TOTAL CONCEDED PER YEAR</span>
                            <div style={{ fontSize: "18px", fontWeight: "700", color: "#16A34A", marginTop: "2px" }}>{money(summary.totalConcession)}</div>
                        </div>
                        <div style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", padding: "12px", borderRadius: "8px" }}>
                            <span style={{ fontSize: "11px", color: "#1E40AF", fontWeight: "600" }}>RTE STUDENTS</span>
                            <div style={{ fontSize: "18px", fontWeight: "700", color: "#1E3A8A", marginTop: "2px" }}>{summary.rteCount}</div>
                        </div>
                    </div>

                    <div className="student-filters" style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: "200px" }}>
                            <StudentSearch onSearch={(value) => setSearchKeyword(value)} />
                        </div>

                        <select
                            className="filter-select"
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            style={{ minWidth: "150px" }}
                        >
                            <option value="All">All Classes</option>
                            {classes.map((c) => {
                                const displayClass = formatClass(c);
                                return <option key={c.id} value={displayClass}>{displayClass}</option>;
                            })}
                        </select>

                        <select
                            className="filter-select"
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            style={{ minWidth: "170px" }}
                        >
                            <option value="All">All Categories</option>
                            {CATEGORY_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>

                        <select
                            className="filter-select"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            style={{ minWidth: "160px" }}
                        >
                            <option value="roll">Sort: Roll No.</option>
                            <option value="name">Sort: Name (A–Z)</option>
                        </select>

                        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#334155", cursor: "pointer", whiteSpace: "nowrap" }}>
                            <input
                                type="checkbox"
                                checked={concessionsOnly}
                                onChange={(e) => setConcessionsOnly(e.target.checked)}
                                style={{ width: "15px", height: "15px" }}
                            />
                            Only with concession
                        </label>
                    </div>

                    <div className="table-container">
                        <table className="stack-sm">
                            <thead>
                                <tr>
                                    <th>Adm No.</th>
                                    <th>Roll No.</th>
                                    <th>Student Name</th>
                                    <th>Class</th>
                                    <th>Category</th>
                                    <th>Concession</th>
                                    <th>Reason</th>
                                    <th style={{ textAlign: "right", paddingRight: "20px" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStudents.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                                            No students match the current filters.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredStudents.map((student) => (
                                        <tr key={student.id}>
                                            <td data-label="Adm No." style={{ color: "#64748B", fontSize: "13px" }}>{student.admissionNumber || "-"}</td>
                                            <td data-label="Roll No."><strong>{student.rollNumber || "-"}</strong></td>
                                            <td data-label="Student"><strong>{student.studentName}</strong></td>
                                            <td data-label="Class">{student.className || "-"}</td>
                                            <td data-label="Category"><CategoryBadge student={student} /></td>
                                            <td data-label="Concession">
                                                {Number(student.concessionAmount || 0) > 0 ? (
                                                    <span className="payment-badge mode-default" style={{ backgroundColor: "#FEF3C7", color: "#92400E", fontWeight: "700" }}>
                                                        {money(student.concessionAmount)}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: "#94A3B8", fontSize: "13px" }}>—</span>
                                                )}
                                            </td>
                                            <td data-label="Reason">
                                                <div style={{ maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#475569", fontSize: "13px" }} title={student.concessionReason || ""}>
                                                    {student.concessionReason || "-"}
                                                </div>
                                            </td>
                                            <td data-label="" style={{ textAlign: "right" }}>
                                                <div className="action-buttons" style={{ justifyContent: "flex-end" }}>
                                                    <button className="edit-btn" onClick={() => openEdit(student)}>Edit</button>
                                                    {isAdmin && Number(student.concessionAmount || 0) > 0 && (
                                                        <button className="delete-btn" onClick={() => handleRemove(student)}>Remove</button>
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

            {/* Floating mobile action, matching the Students page pattern */}
            <button
                type="button"
                className="p-mobile-cta"
                onClick={openAdd}
                aria-label="Add Concession"
            >
                ＋ Concession
            </button>

            {/* CATEGORY + CONCESSION EDITOR */}
            {showDialog && (
                <OverlayDialog onClose={() => setShowDialog(false)} ariaLabel="Fee concession editor">
                    <div className="student-modal" style={{ maxWidth: "600px", maxHeight: "90vh", overflowY: "auto" }}>
                        <div className="modal-header" style={{ position: "sticky", top: 0, backgroundColor: "#fff", zIndex: 10 }}>
                            <div>
                                <h2>{editingStudent ? "Edit Category & Fee Concession" : "New Fee Concession"}</h2>
                                <p>Saving updates the fee demand instantly across Payments, Reports and dashboards.</p>
                            </div>
                            <button type="button" className="close-btn" onClick={() => setShowDialog(false)}>✕</button>
                        </div>

                        <form className="student-form" onSubmit={handleSave} style={{ padding: "20px" }}>
                            {!editingStudent && (
                                <div className="form-group" style={{ marginBottom: "16px" }}>
                                    <label>Select Class <small style={{ color: "#64748B" }}>(to narrow the student list)</small></label>
                                    <select
                                        value={dialogClass}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setDialogClass(value);
                                            // If the picked student isn't in the newly
                                            // selected class, clear the pick.
                                            if (value !== "All" && formData.studentId) {
                                                const keep = students.some(
                                                    (s) => String(s.id) === String(formData.studentId) && s.className === value
                                                );
                                                if (!keep) setFormData((prev) => ({ ...prev, studentId: "" }));
                                            }
                                        }}
                                    >
                                        <option value="All">All Classes</option>
                                        {classes.map((c) => {
                                            const displayClass = formatClass(c);
                                            return <option key={c.id} value={displayClass}>{displayClass}</option>;
                                        })}
                                    </select>
                                </div>
                            )}

                            <div className="form-group" style={{ marginBottom: "16px" }}>
                                <label>Student *</label>
                                <select
                                    name="studentId"
                                    value={editingStudent ? String(editingStudent.id) : formData.studentId}
                                    onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                                    disabled={!!editingStudent}
                                    required
                                >
                                    <option value="">Select Student</option>
                                    {(dialogClass === "All" ? students : students.filter((s) => s.className === dialogClass)).map((student) => (
                                        <option key={student.id} value={String(student.id)}>
                                            {student.studentName} — {student.className} (Roll {student.rollNumber || "-"})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: "16px" }}>
                                <label>Student Category</label>
                                <select
                                    name="studentCategory"
                                    value={formData.studentCategory}
                                    onChange={(e) => setFormData({ ...formData, studentCategory: e.target.value })}
                                >
                                    {CATEGORY_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: "16px" }}>
                                <label>
                                    Concession Amount (₹) <small style={{ color: "#64748B" }}>(0 clears the concession)</small>
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    name="concessionAmount"
                                    value={formData.concessionAmount}
                                    onChange={(e) => setFormData({ ...formData, concessionAmount: e.target.value })}
                                    placeholder="e.g. 5000"
                                />
                            </div>

                            {Number(formData.concessionAmount) > 0 && (
                                <div className="form-group" style={{ marginBottom: "16px" }}>
                                    <label>Concession Reason *</label>
                                    <textarea
                                        name="concessionReason"
                                        rows={3}
                                        value={formData.concessionReason}
                                        onChange={(e) => setFormData({ ...formData, concessionReason: e.target.value })}
                                        placeholder="e.g. RTE free education, Management approval, Sibling discount"
                                        required
                                    />
                                    <small style={{ color: "#64748B", display: "block", marginTop: "4px" }}>
                                        Tip: for RTE free education, enter the full standard class fee as the concession — the net demand becomes ₹0.
                                    </small>
                                </div>
                            )}

                            <div className="modal-actions" style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #E2E8F0", position: "sticky", bottom: 0, backgroundColor: "#fff", paddingBottom: "10px" }}>
                                <button type="button" className="cancel-btn" onClick={() => setShowDialog(false)}>Cancel</button>
                                <button type="submit" className="save-btn" disabled={saving} style={{ padding: "10px 24px" }}>
                                    {saving ? "Saving..." : "Save"}
                                </button>
                            </div>
                        </form>
                    </div>
                </OverlayDialog>
            )}
        </div>
    );
}

export default FeeConcessionPage;
