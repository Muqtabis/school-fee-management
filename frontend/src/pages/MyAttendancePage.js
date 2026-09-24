import { useEffect, useState } from "react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import api from "../services/api";


const STATUS_LABEL = {
    present: "Present",
    absent: "Absent",
    half_day: "Half-day",
    leave: "Leave"
};


function MyAttendancePage() {

    const [records, setRecords] = useState([]);
    const [range, setRange] = useState({ from: "", to: "" });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get("/attendance/mine");
                setRecords(res.data.records || []);
                setRange({ from: res.data.from, to: res.data.to });
            } catch (error) {
                alert(error.response?.data?.message || "Unable to load your attendance.");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // Per-status counts for a quick summary.
    const summary = records.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
    }, {});


    return (
        <div className="dashboard">
            <Sidebar />

            <div className="main-content">
                <Navbar />

                <div className="page-content">
                    <div className="page-header">
                        <div>
                            <h2>My Attendance</h2>
                            <p>
                                Your attendance record
                                {range.from && range.to ? ` (${range.from} to ${range.to})` : ""}.
                            </p>
                        </div>
                    </div>

                    {/* Summary chips */}
                    {!loading && records.length > 0 && (
                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "20px" }}>
                            {Object.keys(STATUS_LABEL).map((key) => (
                                <span
                                    key={key}
                                    style={{
                                        padding: "6px 12px",
                                        background: "#eef2ff",
                                        borderRadius: "12px",
                                        fontSize: "14px"
                                    }}
                                >
                                    {STATUS_LABEL[key]}: <strong>{summary[key] || 0}</strong>
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Status</th>
                                    <th>Remark</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="3">Loading...</td></tr>
                                ) : records.length === 0 ? (
                                    <tr><td colSpan="3">No attendance recorded for this period.</td></tr>
                                ) : (
                                    records.map((r) => (
                                        <tr key={r.attendanceDate}>
                                            <td>{r.attendanceDate}</td>
                                            <td>{STATUS_LABEL[r.status] || r.status}</td>
                                            <td>{r.remark || "-"}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                </div>
            </div>
        </div>
    );
}


export default MyAttendancePage;
