import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

function FeesPage() {
    const { user } = useAuth();
    const isAdmin = user?.role === "admin";

    // Data State
    const [years, setYears] = useState([]);
    const [classes, setClasses] = useState([]); 
    const [feeComponents, setFeeComponents] = useState([]); 
    
    const [selectedYear, setSelectedYear] = useState(null);
    const [structures, setStructures] = useState([]);
    const [selectedStructure, setSelectedStructure] = useState(null);
    const [structureItems, setStructureItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form State
    const [newYear, setNewYear] = useState({ name: "", startDate: "", endDate: "" });
    const [newComponent, setNewComponent] = useState({ name: "", isOptional: false });
    const [selectedClass, setSelectedClass] = useState("");

    // Inline component edit
    const [editingComponent, setEditingComponent] = useState(null); // { id, name, isOptional }

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setLoading(true);
                await Promise.all([
                    loadYears(),
                    loadClasses(),
                    loadComponents()
                ]);
            } catch (error) {
                console.error("Error loading initial data:", error);
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, []);

    const loadYears = async () => {
        const res = await api.get("/fees/academic-years");
        const data = Array.isArray(res.data) ? res.data : [];
        setYears(data);
        const active = data.find(year => year.status === "active");
        setSelectedYear(active || data[0] || null);
    };

    const loadClasses = async () => {
        const res = await api.get("/classes");
        setClasses(Array.isArray(res.data) ? res.data : []);
    };

    const loadComponents = async () => {
        const res = await api.get("/fees/components");
        setFeeComponents(Array.isArray(res.data) ? res.data : []);
    };

    const loadStructures = async (yearId) => {
        if (!yearId) {
            setStructures([]);
            return;
        }
        try {
            const res = await api.get("/fees/structures", { params: { academicYearId: yearId } });
            setStructures(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error("Unable to load structures:", error);
            setStructures([]);
        }
    };

    useEffect(() => {
        if (selectedYear) {
            loadStructures(selectedYear.id);
        } else {
            setStructures([]);
        }
    }, [selectedYear]);

    // --- FEE COMPONENT CRUD ---
    const createComponent = async (e) => {
        e.preventDefault();
        if (!newComponent.name.trim()) return alert("Component name is required.");
        
        try {
            await api.post("/fees/components", {
                componentName: newComponent.name,
                isOptional: newComponent.isOptional
            });
            setNewComponent({ name: "", isOptional: false });
            await loadComponents();
        } catch (error) {
            alert(error.response?.data?.message || "Unable to create fee component.");
        }
    };

    const deleteComponent = async (id) => {
        if (!window.confirm("Delete this fee component? It will be removed from future structures.")) return;
        try {
            await api.delete(`/fees/components/${id}`);
            await loadComponents();
        } catch (error) {
            alert(error.response?.data?.message || "Unable to delete component.");
        }
    };

    const startEditComponent = (comp) => {
        setEditingComponent({ id: comp.id, name: comp.componentName || "", isOptional: !!comp.isOptional });
    };

    const cancelEditComponent = () => setEditingComponent(null);

    const saveEditComponent = async () => {
        if (!editingComponent?.name.trim()) return alert("Component name is required.");
        try {
            await api.put(`/fees/components/${editingComponent.id}`, {
                componentName: editingComponent.name.trim(),
                isOptional: editingComponent.isOptional
            });
            setEditingComponent(null);
            await loadComponents();
        } catch (error) {
            alert(error.response?.data?.message || "Unable to update component.");
        }
    };

    // --- ACADEMIC YEAR CRUD ---
    const createYear = async (e) => {
        e.preventDefault();
        if (!newYear.name.trim()) return alert("Academic year name is required.");
        try {
            await api.post("/fees/academic-years", {
                name: newYear.name.trim(),
                startDate: newYear.startDate || null,
                endDate: newYear.endDate || null
            });
            setNewYear({ name: "", startDate: "", endDate: "" });
            alert("Academic year created successfully.");
            await loadYears();
        } catch (error) {
            alert(error.response?.data?.message || "Unable to create academic year.");
        }
    };

    const activateYear = async (year) => {
        if (!window.confirm(`Make ${year.name} the active academic year?`)) return;
        try {
            await api.post(`/fees/academic-years/${year.id}/activate`);
            alert(`${year.name} is now active.`);
            await loadYears();
        } catch (error) {
            alert(error.response?.data?.message || "Unable to activate academic year.");
        }
    };

    const prepareYear = async (year) => {
        if (year.status === "closed") return alert("Closed academic years cannot be prepared.");
        if (!window.confirm(`Prepare student fee accounts for ${year.name}?`)) return;
        try {
            const res = await api.post(`/fees/academic-years/${year.id}/prepare`);
            alert(res.data.message);
        } catch (error) {
            alert(error.response?.data?.message || "Unable to prepare academic year.");
        }
    };

    // --- STRUCTURE CRUD ---
    const createStructure = async (e) => {
        e.preventDefault();
        if (!selectedYear || !selectedClass) return alert("Please select a class.");
        try {
            await api.post("/fees/structures", { academicYearId: selectedYear.id, className: selectedClass });
            setSelectedClass("");
            await loadStructures(selectedYear.id);
        } catch (error) {
            alert(error.response?.data?.message || "Unable to create fee structure.");
        }
    };

    const openStructure = async (structure) => {
        try {
            const res = await api.get(`/fees/structures/${structure.id}`);
            setSelectedStructure(res.data.structure);
            setStructureItems(Array.isArray(res.data.items) ? res.data.items : []);
        } catch (error) {
            alert(error.response?.data?.message || "Unable to load fee structure.");
        }
    };

    const saveStructure = async () => {
        if (!selectedStructure) return;
        try {
            setSaving(true);
            await api.put(`/fees/structures/${selectedStructure.id}`, {
                items: structureItems.map(item => ({
                    componentId: item.componentId,
                    amount: Number(item.amount || 0)
                }))
            });
            alert("Fee structure saved successfully.");
            await loadStructures(selectedYear.id);
            const updated = await api.get(`/fees/structures/${selectedStructure.id}`);
            setSelectedStructure(updated.data.structure);
            setStructureItems(updated.data.items);
        } catch (error) {
            alert(error.response?.data?.message || "Unable to save fee structure.");
        } finally {
            setSaving(false);
        }
    };

    const copyStructure = async (structure) => {
        if (!selectedYear) return;
        const targets = years.filter(year => Number(year.id) !== Number(selectedYear.id) && year.status !== "closed");
        if (targets.length === 0) return alert("There is no available target academic year.");
        
        const targetName = window.prompt(`Enter target academic year name:\n\n${targets.map(y => y.name).join("\n")}`);
        if (!targetName) return;
        
        const target = targets.find(year => year.name.trim() === targetName.trim());
        if (!target) return alert("Target academic year not found.");

        try {
            await api.post(`/fees/structures/${structure.id}/copy/${target.id}`);
            alert("Fee structure copied successfully.");
        } catch (error) {
            alert(error.response?.data?.message || "Unable to copy fee structure.");
        }
    };

    const changeAmount = (componentId, value) => {
        setStructureItems(current =>
            current.map(item => item.componentId === componentId ? { ...item, amount: value } : item )
        );
    };

    const formatClass = (c) => {
        if (c.name) return c.name;
        if (c.className) return c.section ? `${c.className} ${c.section}`.trim() : c.className;
        return "Unknown";
    };

    const money = value => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const total = structureItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    if (loading) {
        return (
            <div className="dashboard">
                <Sidebar />
                <div className="main-content">
                    <Navbar />
                    <div className="page-content">Loading fee management...</div>
                </div>
            </div>
        );
    }

    const availableClasses = classes.filter(c => !structures.some(s => s.className === formatClass(c)));

    return (
        <div className="dashboard">
            <Sidebar />
            <div className="main-content">
                <Navbar />
                <div className="page-content">
                    
                    {/* HEADER */}
                    <div className="page-header" style={{ marginBottom: "20px" }}>
                        <div>
                            <h2>Fee Management</h2>
                            <p>Configure Academic Years, Master Fee Components, and Class Prices.</p>
                        </div>
                    </div>

                    {/* PANEL 1: ACADEMIC YEAR */}
                    <div className="report-panel" style={{ marginBottom: "24px" }}>
                        <div className="report-panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                            <div>
                                <h3>1. Academic Year Configuration</h3>
                                <p>Select or create an academic year.</p>
                            </div>

                            {isAdmin && (
                                <form onSubmit={createYear} style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                    <input
                                        type="text"
                                        placeholder="New Year (e.g., 2026-27)"
                                        value={newYear.name}
                                        onChange={e => setNewYear({ ...newYear, name: e.target.value })}
                                        className="search-input"
                                        style={{ minWidth: "220px", marginBottom: "0" }}
                                        required
                                    />
                                    <button type="submit" className="primary-btn">+ Create Year</button>
                                </form>
                            )}
                        </div>

                        <div style={{ padding: "20px", display: "flex", gap: "12px", alignItems: "center", borderTop: "1px solid #E2E8F0" }}>
                            <select
                                className="filter-select"
                                value={selectedYear?.id || ""}
                                onChange={e => {
                                    const year = years.find(y => Number(y.id) === Number(e.target.value));
                                    setSelectedYear(year || null);
                                    setSelectedStructure(null);
                                    setStructureItems([]);
                                }}
                                style={{ minWidth: "250px", marginBottom: "0" }}
                            >
                                <option value="">Select Academic Year...</option>
                                {years.map(year => (
                                    <option key={year.id} value={year.id}>
                                        {year.name} (Status: {year.status.charAt(0).toUpperCase() + year.status.slice(1)})
                                    </option>
                                ))}
                            </select>

                            {isAdmin && selectedYear && selectedYear.status !== "active" && (
                                <button className="primary-btn" onClick={() => activateYear(selectedYear)}>Make Active</button>
                            )}

                            {isAdmin && selectedYear && selectedYear.status !== "closed" && (
                                <button className="clear-btn" onClick={() => prepareYear(selectedYear)}>Prepare Student Accounts</button>
                            )}
                        </div>
                    </div>

                    {/* PANEL 2: MASTER FEE COMPONENTS */}
                    <div className="report-panel" style={{ marginBottom: "24px" }}>
                        <div className="report-panel-header">
                            <div>
                                <h3>2. Master Fee Components</h3>
                                <p>Define custom categories (e.g., Lab Fee, Sports Fee) to apply to your classes.</p>
                            </div>
                        </div>
                        
                        {isAdmin && (
                            <div style={{ padding: "20px", backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                                <form onSubmit={createComponent} style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
                                    <input
                                        type="text"
                                        placeholder="Enter New Fee Category Name"
                                        value={newComponent.name}
                                        onChange={e => setNewComponent({ ...newComponent, name: e.target.value })}
                                        className="search-input"
                                        style={{ flex: 1, minWidth: "200px", marginBottom: "0", padding: "10px" }}
                                        required
                                    />
                                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#334155", fontWeight: "500", cursor: "pointer" }}>
                                        <input 
                                            type="checkbox" 
                                            checked={newComponent.isOptional}
                                            onChange={e => setNewComponent({ ...newComponent, isOptional: e.target.checked })}
                                            style={{ width: "16px", height: "16px" }}
                                        />
                                        Optional Fee?
                                    </label>
                                    <button type="submit" className="primary-btn" style={{ padding: "10px 20px" }}>
                                        + Add Component
                                    </button>
                                </form>
                            </div>
                        )}

                        <div className="table-container">
                            {feeComponents.length === 0 ? (
                                <div style={{ padding: "30px", textAlign: "center", color: "#64748B" }}>
                                    No fee components configured yet. Add one above to get started.
                                </div>
                            ) : (
                                <table style={{ width: "100%" }}>
                                    <thead>
                                        <tr>
                                            <th>Fee Category Name</th>
                                            <th>Type</th>
                                            {isAdmin && <th style={{ textAlign: "right", paddingRight: "24px" }}>Action</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {feeComponents.map(comp => {
                                            const isEditing = editingComponent?.id === comp.id;
                                            return (
                                            <tr key={comp.id}>
                                                <td style={{ fontSize: "14px", fontWeight: "600", color: "#1E293B" }}>
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            value={editingComponent.name}
                                                            onChange={e => setEditingComponent({ ...editingComponent, name: e.target.value })}
                                                            className="search-input"
                                                            style={{ marginBottom: 0, padding: "8px", width: "100%", boxSizing: "border-box" }}
                                                        />
                                                    ) : comp.componentName}
                                                </td>
                                                <td>
                                                    {isEditing ? (
                                                        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#334155", cursor: "pointer" }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={editingComponent.isOptional}
                                                                onChange={e => setEditingComponent({ ...editingComponent, isOptional: e.target.checked })}
                                                                style={{ width: "16px", height: "16px" }}
                                                            />
                                                            Optional
                                                        </label>
                                                    ) : (
                                                        <span style={{
                                                            padding: "4px 10px",
                                                            borderRadius: "20px",
                                                            fontSize: "12px",
                                                            fontWeight: "600",
                                                            backgroundColor: comp.isOptional ? "#FEF3C7" : "#E2E8F0",
                                                            color: comp.isOptional ? "#D97706" : "#475569"
                                                        }}>
                                                            {comp.isOptional ? "Optional" : "Mandatory"}
                                                        </span>
                                                    )}
                                                </td>
                                                {isAdmin && (
                                                    <td style={{ textAlign: "right", paddingRight: "24px" }}>
                                                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                                                            {isEditing ? (
                                                                <>
                                                                    <button
                                                                        onClick={saveEditComponent}
                                                                        style={{ background: "#0F172A", border: "none", color: "#fff", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontSize: "13px", fontWeight: "500" }}
                                                                    >
                                                                        Save
                                                                    </button>
                                                                    <button
                                                                        onClick={cancelEditComponent}
                                                                        style={{ background: "#F1F5F9", border: "1px solid #CBD5E1", color: "#475569", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontSize: "13px", fontWeight: "500" }}
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button
                                                                        onClick={() => startEditComponent(comp)}
                                                                        style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#2563EB", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontSize: "13px", fontWeight: "500" }}
                                                                    >
                                                                        Edit
                                                                    </button>
                                                                    <button
                                                                        onClick={() => deleteComponent(comp.id)}
                                                                        style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#EF4444", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontSize: "13px", fontWeight: "500" }}
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* PANEL 3: CLASS STRUCTURES */}
                    <div className="report-panel">
                        <div className="report-panel-header">
                            <div>
                                <h3>3. Class Fee Structures</h3>
                                <p>{selectedYear ? `Configuring structures for ${selectedYear.name}` : "Please select an Academic Year above."}</p>
                            </div>
                        </div>

                        {isAdmin && selectedYear && selectedYear.status !== "closed" && (
                            <div style={{ padding: "16px 20px", backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                                <form onSubmit={createStructure} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                                    <select
                                        className="filter-select"
                                        value={selectedClass}
                                        onChange={(e) => setSelectedClass(e.target.value)}
                                        required
                                        style={{ minWidth: "250px", marginBottom: "0", backgroundColor: "#fff" }}
                                    >
                                        <option value="">Select Class to Configure...</option>
                                        {availableClasses.map(c => {
                                            const displayClass = formatClass(c);
                                            return <option key={c.id} value={displayClass}>{displayClass}</option>;
                                        })}
                                    </select>
                                    <button type="submit" className="primary-btn">+ Add Class Structure</button>
                                </form>
                            </div>
                        )}

                        <div className="table-container">
                            {!selectedYear ? (
                                <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>Select an academic year to view class fees.</div>
                            ) : structures.length === 0 ? (
                                <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>No fee structures found for {selectedYear.name}.</div>
                            ) : (
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Class / Section</th>
                                            <th>Standard Total</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {structures.map(structure => (
                                            <tr key={structure.id}>
                                                <td><strong>{structure.className}</strong></td>
                                                <td>{money(structure.totalAmount)}</td>
                                                <td>
                                                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                                        <button className="edit-btn" onClick={() => openStructure(structure)}>View / Edit Prices</button>
                                                        {isAdmin && <button className="history-btn" onClick={() => copyStructure(structure)}>Copy Template</button>}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* ========================================= */}
                    {/* STRUCTURE EDITOR MODAL (FLOATS ON TOP)    */}
                    {/* ========================================= */}
                    {selectedStructure && (
                        <div className="modal-overlay">
                            <div className="history-modal" style={{ maxWidth: "700px" }}>
                                <div className="modal-header">
                                    <div>
                                        <h2>Configure Prices: Class {selectedStructure.className}</h2>
                                        <p>{selectedStructure.academicYearName} • All your Master Components appear here.</p>
                                    </div>
                                    <button className="close-btn" onClick={() => { setSelectedStructure(null); setStructureItems([]); }}>✕</button>
                                </div>

                                <div className="table-container" style={{ maxHeight: "60vh", overflowY: "auto" }}>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Fee Component</th>
                                                <th>Type</th>
                                                <th>Amount (₹)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {structureItems.map(item => (
                                                <tr key={item.componentId}>
                                                    <td style={{ fontWeight: "500" }}>{item.componentName}</td>
                                                    <td>
                                                        <span style={{ 
                                                            padding: "4px 8px", 
                                                            borderRadius: "4px", 
                                                            fontSize: "11px", 
                                                            backgroundColor: item.isOptional ? "#FEF3C7" : "#F1F5F9",
                                                            color: item.isOptional ? "#D97706" : "#475569"
                                                        }}>
                                                            {item.isOptional ? "Optional" : "Mandatory"}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {isAdmin && selectedStructure.academicYearStatus !== "closed" ? (
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={item.amount}
                                                                onChange={e => changeAmount(item.componentId, e.target.value)}
                                                                className="search-input"
                                                                style={{ width: "140px", marginBottom: "0", padding: "8px" }}
                                                            />
                                                        ) : (
                                                            money(item.amount)
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr style={{ backgroundColor: "#F8FAFC" }}>
                                                <th colSpan="2" style={{ textAlign: "right", fontSize: "14px", color: "#475569" }}>Total Class Demand:</th>
                                                <th style={{ color: "#2563EB", fontSize: "18px", padding: "16px" }}>{money(total)}</th>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                <div className="modal-actions" style={{ padding: "20px", borderTop: "1px solid #E2E8F0" }}>
                                    <button className="cancel-btn" onClick={() => { setSelectedStructure(null); setStructureItems([]); }}>Close</button>
                                    {isAdmin && selectedStructure.academicYearStatus !== "closed" && (
                                        <button className="save-btn" onClick={saveStructure} disabled={saving} style={{ padding: "10px 24px" }}>
                                            {saving ? "Saving Prices..." : "Save Fee Prices"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default FeesPage;