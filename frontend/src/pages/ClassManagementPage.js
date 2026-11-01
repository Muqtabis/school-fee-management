import { toast, confirmDialog } from "../services/notify";
import { useEffect, useState } from "react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import PromptDialog from "../components/PromptDialog";
import OverlayDialog from "../components/OverlayDialog";
import api from "../services/api";


// =====================================================
// CLASS MANAGEMENT
//
// Fee-structure style flow: subjects are created in a
// MASTER catalogue first, then each class picks (checkbox
// modal) the subjects actually taught in it.
// =====================================================

function ClassManagementPage() {

    const [classes, setClasses] = useState([]);
    const [masterSubjects, setMasterSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);

    // Create-class form.
    const [newClassName, setNewClassName] = useState("");
    const [newSection, setNewSection] = useState("");

    // Master subject catalogue (inline rename / delete; creation happens
    // exclusively through the class Subjects picker).
    const [editingMaster, setEditingMaster] = useState(null); // { id, name }

    // Per-class subjects chip picker (like the fee price editor).
    const [subTarget, setSubTarget] = useState(null);     // class row
    const [subRows, setSubRows] = useState([]);           // [{ id, subjectName, selected, examCount }]
    const [subLoading, setSubLoading] = useState(false);
    const [subSaving, setSubSaving] = useState(false);
    const [newSubName, setNewSubName] = useState("");     // create-from-modal input
    const [subCreating, setSubCreating] = useState(false);


    // =====================================================
    // LOADERS
    // =====================================================

    const loadClasses = async () => {
        try {
            const res = await api.get("/classes");
            setClasses(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            toast(error.response?.data?.message || "Unable to load classes.");
        }
    };

    const loadMasterSubjects = async () => {
        try {
            const res = await api.get("/classes/subjects-master");
            setMasterSubjects(res.data.subjects || []);
        } catch (error) {
            console.error("Master subjects load error:", error.response?.data || error.message);
        }
    };

    const loadAll = async () => {
        setLoading(true);
        await Promise.all([loadClasses(), loadMasterSubjects()]);
        setLoading(false);
    };

    useEffect(() => {
        loadAll();
    }, []);


    // =====================================================
    // CLASS CRUD
    // =====================================================

    const createClass = async (e) => {
        e.preventDefault();
        if (!newClassName.trim()) {
            toast("Class name is required.");
            return;
        }
        try {
            await api.post("/classes", { className: newClassName.trim(), section: newSection.trim() });
            setNewClassName("");
            setNewSection("");
            loadClasses();
        } catch (error) {
            toast(error.response?.data?.message || "Unable to create class.");
        }
    };

    // Rename flow: centered two-step PromptDialog replaces the
    // old window.prompt pair (name, then optional section).
    const [renameTarget, setRenameTarget] = useState(null);
    const [renameStep, setRenameStep] = useState(1);
    const [renameName, setRenameName] = useState("");

    const renameClass = (cls) => {
        setRenameTarget(cls);
        setRenameStep(1);
    };

    const closeRenameDialogs = () => {
        setRenameTarget(null);
        setRenameStep(1);
    };

    const handleRenameStep1 = (value) => {
        if (!value) {
            toast("Class name is required.");
            return;
        }
        setRenameName(value);
        setRenameStep(2);
    };

    const handleRenameStep2 = async (value) => {
        setBusyId(renameTarget.id);
        try {
            await api.put(`/classes/${renameTarget.id}`, { className: renameName, section: value });
            loadClasses();
            closeRenameDialogs();
        } catch (error) {
            toast(error.response?.data?.message || "Unable to rename class.");
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
            toast(error.response?.data?.message || "Unable to change lock state.");
        } finally {
            setBusyId(null);
        }
    };

    const deleteClass = async (cls) => {
        const confirmed = await confirmDialog({
            title: "Permanently delete?",
            message:
            `PERMANENTLY DELETE "${cls.name}"?\n\n` +
            `This also deletes every student in this class and ALL of their records ` +
            `(enrollments, fees, payments, exam marks), plus this class's fee structures, ` +
            `subjects and exams. This cannot be undone.`,
            confirmLabel: "Delete forever",
            danger: true
        });
        if (!confirmed) return;

        setBusyId(cls.id);
        try {
            const res = await api.delete(`/classes/${cls.id}`);
            toast(res.data?.message || "Class deleted.");
            loadClasses();
            loadMasterSubjects();
        } catch (error) {
            toast(error.response?.data?.message || "Unable to delete class.");
        } finally {
            setBusyId(null);
        }
    };


    // =====================================================
    // MASTER SUBJECTS (catalogue)
    // =====================================================

    const saveEditMaster = async () => {
        const name = editingMaster.name.trim();
        if (!name) return toast("Subject name is required.");
        try {
            const res = await api.put(`/classes/subjects-master/${editingMaster.id}`, { subjectName: name });
            toast(res.data?.message || "Subject renamed.");
            setEditingMaster(null);
            loadMasterSubjects();
        } catch (error) {
            toast(error.response?.data?.message || "Unable to rename subject.");
        }
    };

    const deleteMasterSubject = async (subject) => {
        if (!(await confirmDialog({
            title: "Delete master subject?",
            message: subject.classCount > 0
                ? `"${subject.subjectName}" is still taught in ${subject.classCount} class(es). Remove it from those classes first.`
                : `Delete "${subject.subjectName}" from the catalogue? Nothing currently uses it.`,
            confirmLabel: "Delete",
            danger: true
        }))) return;

        try {
            const res = await api.delete(`/classes/subjects-master/${subject.id}`);
            toast(res.data?.message || "Subject deleted.");
            loadMasterSubjects();
        } catch (error) {
            toast(error.response?.data?.message || "Unable to delete subject.");
        }
    };


    // =====================================================
    // PER-CLASS SUBJECTS (checkbox modal, fee-editor style)
    // =====================================================

    const openSubjects = async (cls) => {
        setSubTarget(cls);
        setSubRows([]);
        setNewSubName("");
        await reloadSubRows(cls);
    };

    const reloadSubRows = async (cls) => {
        setSubLoading(true);
        try {
            const res = await api.get(`/classes/${cls.id}/subjects`);
            setSubRows(res.data.subjects || []);
        } catch (error) {
            toast(error.response?.data?.message || "Unable to load class subjects.");
        } finally {
            setSubLoading(false);
        }
    };

    const closeSubjects = () => {
        setSubTarget(null);
        setSubRows([]);
        setNewSubName("");
        setSubCreating(false);
    };

    const toggleSub = (id) => {
        setSubRows((prev) =>
            prev.map((r) => (r.id === id ? { ...r, selected: r.selected ? 0 : 1 } : r))
        );
    };

    // Create a catalogue subject straight from the modal, then refresh the chips.
    const createSubjectInsideModal = async (e) => {
        e.preventDefault();
        if (!subTarget) return;
        const name = newSubName.trim();
        if (!name) return toast("Enter a subject name.");
        try {
            setSubCreating(true);
            const res = await api.post("/classes/subjects-master", { subjectName: name });
            toast(res.data?.message || `Subject "${name}" added.`);
            setNewSubName("");
            loadMasterSubjects();
            await reloadSubRows(subTarget);
        } catch (error) {
            toast(error.response?.data?.message || "Unable to create subject.");
        } finally {
            setSubCreating(false);
        }
    };

    const saveClassSubjects = async () => {
        if (!subTarget) return;
        try {
            setSubSaving(true);
            const res = await api.put(`/classes/${subTarget.id}/subjects`, {
                subjectIds: subRows.filter((r) => r.selected).map((r) => r.id)
            });
            toast(res.data?.message || "Subjects saved.");
            closeSubjects();
            loadMasterSubjects();
        } catch (error) {
            toast(error.response?.data?.message || "Unable to save class subjects.");
        } finally {
            setSubSaving(false);
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
                            <p>Create classes, build a master subject catalogue, and pick the subjects taught in each class.</p>
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
                                <table className="stack-sm">
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
                                                    <td data-label="Class">{cls.name}</td>
                                                    <td data-label="Status">{cls.isLocked ? "🔒 Locked" : "Unlocked"}</td>
                                                    <td data-label="">
                                                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                                            <button type="button" disabled={busyId === cls.id} onClick={() => openSubjects(cls)}>
                                                                Subjects
                                                            </button>
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
                                                                style={{ marginLeft: "auto" }}
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
                                MASTER SUBJECTS (catalogue only — subjects
                                are born inside the class Subjects picker)
                            ============================================ */}
                            <div className="settings-card" style={{ marginTop: "25px" }}>
                                <h3>Master Subjects</h3>
                                <p style={{ color: "#666", marginTop: "6px" }}>
                                    New subjects are created using the <strong>Subjects</strong> button on a class card
                                    &mdash; this catalogue is for renaming, deleting and a quick overview. Marks and
                                    pass marks are not set here &mdash; each exam configures its own on the Exam &amp;
                                    Results page.
                                </p>

                                <div className="table-container" style={{ marginTop: "18px" }}>
                                    <table className="stack-sm">
                                        <thead>
                                            <tr>
                                                <th>Subject</th>
                                                <th>Used In</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {masterSubjects.length === 0 ? (
                                                <tr><td colSpan="3">No subjects in the catalogue yet. Use the Subjects button on a class card to create the first one.</td></tr>
                                            ) : (
                                                masterSubjects.map((s) => {
                                                    const isEditing = editingMaster?.id === s.id;
                                                    return (
                                                        <tr key={s.id}>
                                                            <td data-label="Subject">
                                                                {isEditing ? (
                                                                    <input
                                                                        value={editingMaster.name}
                                                                        onChange={(e) => setEditingMaster({ ...editingMaster, name: e.target.value })}
                                                                        placeholder="Subject name"
                                                                        style={{ width: "100%" }}
                                                                    />
                                                                ) : (
                                                                    <strong>{s.subjectName}</strong>
                                                                )}
                                                            </td>
                                                            <td data-label="Used In">
                                                                <span style={{
                                                                    padding: "4px 10px",
                                                                    borderRadius: "20px",
                                                                    fontSize: "12px",
                                                                    fontWeight: "600",
                                                                    backgroundColor: s.classCount > 0 ? "#E2E8F0" : "#F1F5F9",
                                                                    color: s.classCount > 0 ? "#475569" : "#94A3B8"
                                                                }}>
                                                                    {s.classCount > 0 ? `${s.classCount} class${s.classCount === 1 ? "" : "es"}` : "Not used yet"}
                                                                </span>
                                                            </td>
                                                            <td data-label="Actions">
                                                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                                                    {isEditing ? (
                                                                        <>
                                                                            <button type="button" onClick={saveEditMaster}>Save</button>
                                                                            <button type="button" onClick={() => setEditingMaster(null)}>Cancel</button>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <button type="button" onClick={() => setEditingMaster({ id: s.id, name: s.subjectName })}>
                                                                                Rename
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                className="delete-btn"
                                                                                style={{ marginLeft: "auto" }}
                                                                                title={s.classCount > 0 ? "Remove it from the classes first" : "Delete from catalogue"}
                                                                                onClick={() => deleteMasterSubject(s)}
                                                                            >
                                                                                Delete
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}

                    {/* =================================================
                        CLASS SUBJECTS MODAL (chip picker)
                        Tapping a chip toggles the subject for this class;
                        saving syncs the class's subject rows.
                    ================================================= */}
                    {subTarget && (
                        <OverlayDialog onClose={closeSubjects} ariaLabel="Class subjects picker">
                            <div className="history-modal" style={{ maxWidth: "560px" }}>
                                <div className="modal-header">
                                    <div>
                                        <h2>Subjects Taught in: {subTarget.name}</h2>
                                        <p>Tap a chip to include / exclude it, then save.</p>
                                    </div>
                                    <button className="close-btn" onClick={closeSubjects}>✕</button>
                                </div>

                                {subTarget.isLocked && (
                                    <p style={{ color: "#b45309", margin: "12px 20px 0" }}>
                                        🔒 This class is locked — unlock it first to change its subjects.
                                    </p>
                                )}

                                <div style={{ padding: "18px 20px 4px" }}>
                                    {subLoading ? (
                                        <p style={{ color: "#94A3B8" }}>Loading.</p>
                                    ) : subRows.length === 0 ? (
                                        <p style={{ color: "#94A3B8", textAlign: "center", padding: "12px 0" }}>
                                            No subjects yet — add one below to get started.
                                        </p>
                                    ) : (
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                            {subRows.map((s) => {
                                                const chosen = !!s.selected;
                                                const protectedExam = s.examCount > 0;
                                                const disabled = subTarget.isLocked || protectedExam;
                                                return (
                                                    <button
                                                        key={s.id}
                                                        type="button"
                                                        disabled={disabled}
                                                        onClick={() => toggleSub(s.id)}
                                                        title={
                                                            subTarget.isLocked
                                                                ? "The class is locked"
                                                                : protectedExam
                                                                    ? `Used by ${s.examCount} exam(s) — can't be removed`
                                                                    : chosen ? "Tap to remove from this class" : "Tap to teach in this class"
                                                        }
                                                        style={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: "6px",
                                                            padding: "8px 14px",
                                                            borderRadius: "20px",
                                                            fontSize: "13px",
                                                            fontWeight: "600",
                                                            cursor: disabled ? "not-allowed" : "pointer",
                                                            border: `1px solid ${chosen ? "#22c55e" : "#cbd5e1"}`,
                                                            backgroundColor: chosen
                                                                ? (protectedExam ? "#F1F5F9" : "#DCFCE7")
                                                                : "#ffffff",
                                                            color: chosen
                                                                ? (protectedExam ? "#475569" : "#166534")
                                                                : "#64748B"
                                                        }}
                                                    >
                                                        {chosen && <span aria-hidden="true">✓</span>}
                                                        {s.subjectName}
                                                        {protectedExam && <span aria-hidden="true">🔒</span>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <p style={{ margin: "10px 20px 0", fontSize: "12px", color: "#94A3B8" }}>
                                    🔒 = used in exams, stays in the class. New subjects join the master catalogue and can be used anywhere.
                                </p>

                                {!subTarget.isLocked && (
                                    <form
                                        onSubmit={createSubjectInsideModal}
                                        style={{ display: "flex", gap: "10px", padding: "12px 20px", alignItems: "center" }}
                                    >
                                        <input
                                            value={newSubName}
                                            onChange={(e) => setNewSubName(e.target.value)}
                                            placeholder="Add a new subject (e.g. Drawing)"
                                            disabled={subCreating}
                                            style={{ flex: 1, marginBottom: 0 }}
                                        />
                                        <button type="submit" disabled={subCreating || !newSubName.trim()}>
                                            {subCreating ? "Adding..." : "+ Add"}
                                        </button>
                                    </form>
                                )}

                                <div className="modal-actions" style={{ padding: "16px 20px 20px", borderTop: "1px solid #E2E8F0", marginTop: "12px" }}>
                                    <button className="cancel-btn" onClick={closeSubjects}>Close</button>
                                    {!subTarget.isLocked && (
                                        <button className="save-btn" onClick={saveClassSubjects} disabled={subSaving || subLoading} style={{ padding: "10px 24px" }}>
                                            {subSaving ? "Saving..." : "Save Subjects"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </OverlayDialog>
                    )}

                </div>
            </div>
            <PromptDialog
                open={!!renameTarget && renameStep === 1}
                onClose={closeRenameDialogs}
                onConfirm={handleRenameStep1}
                title={renameTarget ? `Rename ${renameTarget.className}${renameTarget.section ? " " + renameTarget.section : ""}` : ""}
                message="New class name:"
                requireValue
                initialValue={renameTarget ? renameTarget.className : ""}
                placeholder="Class name (e.g. 6, LKG)"
                confirmLabel="Continue"
            />

            <PromptDialog
                open={!!renameTarget && renameStep === 2}
                onClose={closeRenameDialogs}
                onConfirm={handleRenameStep2}
                title={renameTarget ? `Section for ${renameName}` : ""}
                message="Optional (e.g. A, B). Leave blank for none."
                requireValue={false}
                initialValue={renameTarget ? (renameTarget.section || "") : ""}
                placeholder="Section"
                confirmLabel="Save"
            />

        </div>
    );
}


export default ClassManagementPage;
