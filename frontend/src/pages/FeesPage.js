import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

const classes = [
    "LKG",
    "UKG",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10"
];

function FeesPage() {
    const { user } = useAuth();
    const isAdmin = user?.role === "admin";

    const [years, setYears] = useState([]);
    const [selectedYear, setSelectedYear] = useState(null);
    const [structures, setStructures] = useState([]);
    const [selectedStructure, setSelectedStructure] = useState(null);
    const [structureItems, setStructureItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [newYear, setNewYear] = useState({
        name: "",
        startDate: "",
        endDate: ""
    });

    // NEW: State for creating a new class structure
    const [newStructureClass, setNewStructureClass] = useState("");

    // =====================================================
    // LOAD ACADEMIC YEARS
    // =====================================================
    const loadYears = async () => {
        try {
            setLoading(true);
            const res = await api.get("/fees/academic-years");
            const data = Array.isArray(res.data) ? res.data : [];
            setYears(data);
            const active = data.find(year => year.status === "active");
            setSelectedYear(active || data[0] || null);
        } catch (error) {
            console.error("Unable to load academic years:", error);
            alert(error.response?.data?.message || "Unable to load academic years.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadYears();
    }, []);

    // =====================================================
    // LOAD STRUCTURES
    // =====================================================
    const loadStructures = async (yearId) => {
        if (!yearId) {
            setStructures([]);
            return;
        }
        try {
            const res = await api.get("/fees/structures", {
                params: { academicYearId: yearId }
            });
            setStructures(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error("Unable to load structures:", error);
            setStructures([]);
            alert(error.response?.data?.message || "Unable to load fee structures.");
        }
    };

    useEffect(() => {
        if (selectedYear) {
            loadStructures(selectedYear.id);
        } else {
            setStructures([]);
        }
    }, [selectedYear]);

    // =====================================================
    // OPEN STRUCTURE
    // =====================================================
    const openStructure = async (structure) => {
        try {
            const res = await api.get(`/fees/structures/${structure.id}`);
            setSelectedStructure(res.data.structure);
            setStructureItems(Array.isArray(res.data.items) ? res.data.items : []);
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.message || "Unable to load fee structure.");
        }
    };

    // =====================================================
    // EDIT AMOUNT
    // =====================================================
    const changeAmount = (componentId, value) => {
        setStructureItems(current =>
            current.map(item =>
                item.componentId === componentId
                    ? { ...item, amount: value }
                    : item
            )
        );
    };

    // =====================================================
    // SAVE STRUCTURE
    // =====================================================
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

            // Reload structure list and currently opened structure
            await loadStructures(selectedYear.id);
            const updated = await api.get(`/fees/structures/${selectedStructure.id}`);
            setSelectedStructure(updated.data.structure);
            setStructureItems(updated.data.items);
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.message || "Unable to save fee structure.");
        } finally {
            setSaving(false);
        }
    };

    // =====================================================
    // CREATE ACADEMIC YEAR
    // =====================================================
    const createYear = async (e) => {
        e.preventDefault();
        if (!newYear.name.trim()) {
            alert("Academic year name is required.");
            return;
        }
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
            console.error(error);
            alert(error.response?.data?.message || "Unable to create academic year.");
        }
    };

    // =====================================================
    // CREATE STRUCTURE (NEW)
    // =====================================================
    const createStructure = async (e) => {
        e.preventDefault();
        if (!selectedYear || !newStructureClass) return;

        try {
            await api.post("/fees/structures", {
                academicYearId: selectedYear.id,
                className: newStructureClass
            });
            
            setNewStructureClass("");
            alert("Class fee structure created successfully.");
            await loadStructures(selectedYear.id);
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.message || "Unable to create fee structure.");
        }
    };

    // =====================================================
    // ACTIVATE YEAR
    // =====================================================
    const activateYear = async (year) => {
        const confirmed = window.confirm(
            `Make ${year.name} the active academic year?\n\nThe current active year will become closed.`
        );
        if (!confirmed) return;

        try {
            await api.post(`/fees/academic-years/${year.id}/activate`);
            alert(`${year.name} is now active.`);
            await loadYears();
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.message || "Unable to activate academic year.");
        }
    };

    // =====================================================
    // PREPARE YEAR
    // =====================================================
    const prepareYear = async (year) => {
        if (year.status === "closed") {
            alert("Closed academic years cannot be prepared.");
            return;
        }
        const confirmed = window.confirm(
            `Prepare student fee accounts for ${year.name}?\n\nThis will create enrollments and fee accounts for active students.\n\nIt does NOT collect payments.`
        );
        if (!confirmed) return;

        try {
            const res = await api.post(`/fees/academic-years/${year.id}/prepare`);
            alert(res.data.message);
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.message || "Unable to prepare academic year.");
        }
    };

    // =====================================================
    // COPY STRUCTURE
    // =====================================================
    const copyStructure = async (structure) => {
        if (!selectedYear) return;

        const targets = years.filter(
            year => Number(year.id) !== Number(selectedYear.id) && year.status !== "closed"
        );

        if (targets.length === 0) {
            alert("There is no available target academic year.");
            return;
        }

        const targetName = window.prompt(
            `Enter target academic year name:\n\n${targets.map(year => year.name).join("\n")}`
        );

        if (!targetName) return;

        const target = targets.find(year => year.name.trim() === targetName.trim());
        if (!target) {
            alert("Target academic year not found.");
            return;
        }

        try {
            await api.post(`/fees/structures/${structure.id}/copy/${target.id}`);
            alert("Fee structure copied successfully.");
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.message || "Unable to copy fee structure.");
        }
    };

    // =====================================================
    // MONEY FORMAT
    // =====================================================
    const money = value =>
        `₹${Number(value || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;

    // =====================================================
    // STRUCTURE TOTAL
    // =====================================================
    const total = structureItems.reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
    );

    // =====================================================
    // LOADING
    // =====================================================
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

    // =====================================================
    // PAGE
    // =====================================================
    return (
        <div className="dashboard">
            <Sidebar />
            <div className="main-content">
                <Navbar />
                <div className="page-content">
                    {/* PAGE HEADER */}
                    <div className="page-header">
                        <div>
                            <h2>Fee Management</h2>
                            <p>Academic years, class fee structures and student fee accounts.</p>
                        </div>
                    </div>

                    {/* ACADEMIC YEAR */}
                    <div className="report-panel" style={{ marginBottom: "20px" }}>
                        <div className="report-panel-header">
                            <div>
                                <h3>Academic Year</h3>
                                <p>Only the active year can receive payments.</p>
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                            <select
                                className="filter-select"
                                value={selectedYear?.id || ""}
                                onChange={e => {
                                    const year = years.find(year => Number(year.id) === Number(e.target.value));
                                    setSelectedYear(year || null);
                                    setSelectedStructure(null);
                                    setStructureItems([]);
                                }}
                            >
                                <option value="">Select Academic Year</option>
                                {years.map(year => (
                                    <option key={year.id} value={year.id}>
                                        {year.name} - {year.status}
                                    </option>
                                ))}
                            </select>

                            {isAdmin && selectedYear && selectedYear.status !== "active" && (
                                <button className="primary-btn" onClick={() => activateYear(selectedYear)}>
                                    Make Active
                                </button>
                            )}

                            {isAdmin && selectedYear && selectedYear.status !== "closed" && (
                                <button className="clear-btn" onClick={() => prepareYear(selectedYear)}>
                                    Prepare Student Accounts
                                </button>
                            )}
                        </div>
                    </div>

                    {/* CREATE YEAR */}
                    {isAdmin && (
                        <div className="report-panel" style={{ marginBottom: "20px" }}>
                            <h3>Add Upcoming Academic Year</h3>
                            <form
                                onSubmit={createYear}
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(3, 1fr)",
                                    gap: "12px",
                                    marginTop: "15px"
                                }}
                            >
                                <input
                                    placeholder="2027-28"
                                    value={newYear.name}
                                    onChange={e => setNewYear({ ...newYear, name: e.target.value })}
                                    required
                                />
                                <input
                                    type="date"
                                    value={newYear.startDate}
                                    onChange={e => setNewYear({ ...newYear, startDate: e.target.value })}
                                />
                                <input
                                    type="date"
                                    value={newYear.endDate}
                                    onChange={e => setNewYear({ ...newYear, endDate: e.target.value })}
                                />
                                <button type="submit" className="primary-btn" style={{ gridColumn: "1 / 4" }}>
                                    Create Upcoming Year
                                </button>
                            </form>
                        </div>
                    )}

                    {/* STRUCTURES */}
                    <div className="report-panel">
                        <div className="report-panel-header">
                            <div>
                                <h3>Class Fee Structures</h3>
                                <p>{selectedYear?.name || "No academic year selected"}</p>
                            </div>
                        </div>

                        {/* NEW: Add Structure Form */}
                        {isAdmin && selectedYear && selectedYear.status !== "closed" && (
                            <form 
                                onSubmit={createStructure} 
                                style={{ display: "flex", gap: "12px", marginBottom: "15px", padding: "0 20px" }}
                            >
                                <select
                                    className="filter-select"
                                    value={newStructureClass}
                                    onChange={(e) => setNewStructureClass(e.target.value)}
                                    required
                                >
                                    <option value="">Select Class to Add</option>
                                    {classes.map(c => (
                                        <option key={c} value={c}>
                                            {c === "LKG" || c === "UKG" ? c : `${c} Standard`}
                                        </option>
                                    ))}
                                </select>
                                <button type="submit" className="primary-btn">
                                    Add Class Structure
                                </button>
                            </form>
                        )}

                        <div className="table-container">
                            {structures.length === 0 ? (
                                <div style={{ padding: "30px", textAlign: "center" }}>
                                    No fee structures found for this academic year.
                                </div>
                            ) : (
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Class</th>
                                            <th>Standard Total</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {structures.map(structure => (
                                            <tr key={structure.id}>
                                                <td>
                                                    {structure.className === "LKG" || structure.className === "UKG"
                                                        ? structure.className
                                                        : `${structure.className} Standard`}
                                                </td>
                                                <td>{money(structure.totalAmount)}</td>
                                                <td>
                                                    <button className="edit-btn" onClick={() => openStructure(structure)}>
                                                        View / Edit
                                                    </button>
                                                    {isAdmin && (
                                                        <button className="history-btn" onClick={() => copyStructure(structure)}>
                                                            Copy
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* STRUCTURE EDITOR MODAL */}
                    {selectedStructure && (
                        <div className="modal-overlay">
                            <div className="history-modal">
                                {/* HEADER */}
                                <div className="modal-header">
                                    <div>
                                        <h2>
                                            {selectedStructure.className === "LKG" || selectedStructure.className === "UKG"
                                                ? selectedStructure.className
                                                : `${selectedStructure.className} Standard`}
                                        </h2>
                                        <p>{selectedStructure.academicYearName}</p>
                                    </div>
                                    <button
                                        className="close-btn"
                                        onClick={() => {
                                            setSelectedStructure(null);
                                            setStructureItems([]);
                                        }}
                                    >
                                        ✕
                                    </button>
                                </div>

                                {/* TABLE */}
                                <div className="table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Fee Component</th>
                                                <th>Optional</th>
                                                <th>Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {structureItems.map(item => (
                                                <tr key={item.componentId}>
                                                    <td>{item.componentName}</td>
                                                    <td>{item.isOptional ? "Yes" : "No"}</td>
                                                    <td>
                                                        {isAdmin && selectedStructure.academicYearStatus !== "closed" ? (
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={item.amount}
                                                                onChange={e => changeAmount(item.componentId, e.target.value)}
                                                            />
                                                        ) : (
                                                            money(item.amount)
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        {/* TOTAL */}
                                        <tfoot>
                                            <tr>
                                                <th colSpan="2">Standard Total</th>
                                                <th>{money(total)}</th>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                {/* ACTIONS */}
                                <div className="modal-actions">
                                    <button
                                        className="cancel-btn"
                                        onClick={() => {
                                            setSelectedStructure(null);
                                            setStructureItems([]);
                                        }}
                                    >
                                        Close
                                    </button>
                                    {isAdmin && selectedStructure.academicYearStatus !== "closed" && (
                                        <button className="save-btn" onClick={saveStructure} disabled={saving}>
                                            {saving ? "Saving..." : "Save Fee Structure"}
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