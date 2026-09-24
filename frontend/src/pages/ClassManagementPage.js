import { useEffect, useState } from "react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import api from "../services/api";


// =====================================================
// CLASS MANAGEMENT
//
// The single home for classes: create / rename / lock /
// delete, plus the per-class subjects that exams need.
// (Both used to live elsewhere — the Students page "Manage
// Classes" modal and the Teacher Management page.)
// =====================================================

function ClassManagementPage() {

    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);

    // Create-class form.
    const [newClassName, setNewClassName] = useState("");
    const [newSection, setNewSection] = useState("");

    // Subject creation form. Max marks is NOT set here: Class Management
    // does not decide exam marks (each exam configures its own max on the
    // Exam & Results page). The backend applies a sensible internal default.
    const [subjectForm, setSubjectForm] = useState({ className: "", subjectName: "" });


    // =====================================================
    // LOADERS
    // =====================================================

    const loadClasses = async () => {
        try {
            const res = await api.get("/classes");
            setClasses(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            alert(error.response?.data?.message || "Unable to load classes.");
        }
    };

    const loadSubjects = async () => {
        try {
            const res = await api.get("/teachers/subjects");
            setSubjects(res.data.subjects || []);
        } catch (error) {
            console.error("Subjects load error:", error.response?.data || error.message);
        }
    };

    const loadAll = async () => {
        setLoading(true);
        await Promise.all([loadClasses(), loadSubjects()]);
        setLoading(false);
    };

    useEffect(() => {
        loadAll();
    }, []);

    // Distinct class names for the subject dropdown. Use the raw className
    // (matches how subjects/exams/students key their free-text class value).
    // `classes` already arrives in academic order (LKG..10) from the API;
    // keep that order for the dropdown (dedupe only) instead of re-sorting
    // alphabetically, which would scramble LKG/UKG and 10 against 1/2.
    const classNames = [...new Set(classes.map((c) => c.className))];


    // =====================================================
    // CLASS CRUD
    // =====================================================

    const createClass = async (e) => {
        e.preventDefault();
        if (!newClassName.trim()) {
            alert("Class name is required.");
            return;
        }
        try {
            await api.post("/classes", { className: newClassName.trim(), section: newSection.trim() });
            setNewClassName("");
            setNewSection("");
            loadClasses();
        } catch (error) {
            alert(error.response?.data?.message || "Unable to create class.");
        }
    };

    const renameClass = async (cls) => {
        const name = window.prompt("New class name:", cls.className);
        if (name === null) return;
        if (!name.trim()) {
            alert("Class name is required.");
            return;
        }
        const section = window.prompt("Section (leave blank if none):", cls.section || "");
        if (section === null) return;

        setBusyId(cls.id);
        try {
            await api.put(`/classes/${cls.id}`, { className: name.trim(), section: section.trim() });
            loadClasses();
            // Renaming changes the free-text className stored on subjects too.
            loadSubjects();
        } catch (error) {
            alert(error.response?.data?.message || "Unable to rename class.");
        } finally {
            setBusyId(null);
        }
    };

    const toggleLock = async (cls) => {
        setBusyId(cls.id);
        try {
            await api.post(`/classes/${cls.id}/${cls.isLocked ? "unlock" : "lock"}`);
            loadClasses();
        } catch (error) {
            alert(error.response?.data?.message || "Unable to change lock state.");
        } finally {
            setBusyId(null);
        }
    };

    const deleteClass = async (cls) => {
        const confirmed = window.confirm(
            `PERMANENTLY DELETE "${cls.name}"?\n\n` +
            `This also deletes every student in this class and ALL of their records ` +
            `(enrollments, fees, payments, exam marks), plus this class's fee structures, ` +
            `subjects and exams. This cannot be undone.`
        );
        if (!confirmed) return;

        setBusyId(cls.id);
        try {
            const res = await api.delete(`/classes/${cls.id}`);
            alert(res.data?.message || "Class deleted.");
            loadClasses();
            loadSubjects();
        } catch (error) {
            alert(error.response?.data?.message || "Unable to delete class.");
        } finally {
            setBusyId(null);
        }
    };


    // =====================================================
    // SUBJECTS
    // =====================================================

    const handleSubjectChange = (e) => {
        setSubjectForm({ ...subjectForm, [e.target.name]: e.target.value });
    };

    const createSubject = async (e) => {
        e.preventDefault();
        if (!subjectForm.className || !subjectForm.subjectName.trim()) {
            alert("Choose a class and enter a subject name.");
            return;
        }
        try {
            await api.post("/teachers/subjects", {
                className: subjectForm.className,
                subjectName: subjectForm.subjectName.trim()
            });
            setSubjectForm({ className: subjectForm.className, subjectName: "" });
            loadSubjects();
        } catch (error) {
            alert(error.response?.data?.message || "Unable to create subject.");
        }
    };

    const deleteSubject = async (subject) => {
        if (!window.confirm(`Delete ${subject.subjectName} (${subject.className})?`)) return;
        try {
            await api.delete(`/teachers/subjects/${subject.id}`);
            loadSubjects();
        } catch (error) {
            alert(error.response?.data?.message || "Unable to delete subject.");
        }
    };


    // =====================================================
    // UI
    // =====================================================

    return (
        <div className="dashboard">
            <Sidebar />

            <div className="main-content">
                <Navbar />

                <div className="page-content">
                    <div className="page-header">
                        <div>
                            <h2>Class Management</h2>
                            <p>Create and manage classes, and the subjects each class is examined on.</p>
                        </div>
                    </div>

                    {loading ? (
                        <p>Loading...</p>
                    ) : (
                        <>
                            {/* ============================================
                                CREATE CLASS
                            ============================================ */}
                            <div className="settings-card">
                                <h3>Add Class</h3>
                                <form
                                    onSubmit={createClass}
                                    style={{ display: "flex", gap: "12px", marginTop: "18px", flexWrap: "wrap", alignItems: "center" }}
                                >
                                    <input
                                        value={newClassName}
                                        onChange={(e) => setNewClassName(e.target.value)}
                                        placeholder="Class name (e.g. 1-B)"
                                        required
                                    />
                                    <input
                                        value={newSection}
                                        onChange={(e) => setNewSection(e.target.value)}
                                        placeholder="Section (optional)"
                                    />
                                    <button type="submit" className="primary-btn">Add Class</button>
                                </form>
                            </div>

                            {/* ============================================
                                CLASSES TABLE
                            ============================================ */}
                            <div className="table-container" style={{ marginTop: "25px" }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Class</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {classes.length === 0 ? (
                                            <tr><td colSpan="3">No classes yet.</td></tr>
                                        ) : (
                                            classes.map((cls) => (
                                                <tr key={cls.id}>
                                                    <td>{cls.name}</td>
                                                    <td>{cls.isLocked ? "🔒 Locked" : "Unlocked"}</td>
                                                    <td>
                                                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                                            <button
                                                                type="button"
                                                                disabled={busyId === cls.id || cls.isLocked}
                                                                title={cls.isLocked ? "Unlock the class first to rename" : "Rename class"}
                                                                onClick={() => renameClass(cls)}
                                                            >
                                                                Rename
                                                            </button>
                                                            <button type="button" disabled={busyId === cls.id} onClick={() => toggleLock(cls)}>
                                                                {cls.isLocked ? "Unlock" : "Lock"}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="delete-btn"
                                                                disabled={busyId === cls.id || cls.isLocked}
                                                                title={cls.isLocked ? "Unlock the class first" : "Delete class"}
                                                                onClick={() => deleteClass(cls)}
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* ============================================
                                SUBJECTS PER CLASS
                            ============================================ */}
                            <div className="settings-card" style={{ marginTop: "25px" }}>
                                <h3>Class Subjects</h3>
                                <p style={{ color: "#666", marginTop: "6px" }}>
                                    A class needs subjects before an exam can be created for it. Marks and pass
                                    marks are not set here &mdash; each exam configures its own on the Exam &amp;
                                    Results page.
                                </p>

                                <form
                                    onSubmit={createSubject}
                                    style={{ display: "flex", gap: "12px", marginTop: "18px", flexWrap: "wrap", alignItems: "center" }}
                                >
                                    <select name="className" value={subjectForm.className} onChange={handleSubjectChange} required>
                                        <option value="">Select class</option>
                                        {classNames.map((c) => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>

                                    <input
                                        name="subjectName"
                                        value={subjectForm.subjectName}
                                        onChange={handleSubjectChange}
                                        placeholder="Subject name"
                                        required
                                    />

                                    <button type="submit" className="primary-btn">Add Subject</button>
                                </form>

                                <div className="table-container" style={{ marginTop: "18px" }}>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Class</th>
                                                <th>Subject</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {subjects.length === 0 ? (
                                                <tr><td colSpan="3">No subjects yet.</td></tr>
                                            ) : (
                                                subjects.map((s) => (
                                                    <tr key={s.id}>
                                                        <td>{s.className}</td>
                                                        <td>{s.subjectName}</td>
                                                        <td>
                                                            <button type="button" onClick={() => deleteSubject(s)}>
                                                                Delete
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}

                </div>
            </div>
        </div>
    );
}


export default ClassManagementPage;
