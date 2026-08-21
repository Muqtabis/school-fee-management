import { useEffect, useState, useMemo } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import api from "../services/api";
import * as XLSX from "xlsx";

function ReportsPage() {
    const [period, setPeriod] = useState("all");
    const [selectedClass, setSelectedClass] = useState("all");
    const [loading, setLoading] = useState(true);

    const [rawPayments, setRawPayments] = useState([]);
    const [rawExpenses, setRawExpenses] = useState([]);
    const [rawStudents, setRawStudents] = useState([]);
    const [classStructures, setClassStructures] = useState([]);
    const [reportData, setReportData] = useState({
        academicYear: null,
        totalStudents: 0,
        totalFee: 0,
        classCollection: [],
        modeCollection: []
    });

    const money = (value) =>
        `₹${Number(value || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;

    // =====================================================
    // FETCH DATA FROM VM (READ-ONLY)
    // =====================================================
    const fetchReport = async () => {
        try {
            setLoading(true);
            const [summaryRes, expenseRes, paymentsRes, studentsRes, yearsRes] = await Promise.all([
                api.get(`/payments/report-summary?period=all`),
                api.get("/expenses"),
                api.get("/payments"),
                api.get("/students"),
                api.get("/fees/academic-years").catch(() => ({ data: [] }))
            ]);

            const summary = summaryRes.data || {};
            const expenses = Array.isArray(expenseRes.data) ? expenseRes.data : [];
            const payments = Array.isArray(paymentsRes.data)
                ? paymentsRes.data
                : Array.isArray(summary.recentPayments)
                ? summary.recentPayments
                : [];
            const students = Array.isArray(studentsRes.data) ? studentsRes.data : [];
            const years = Array.isArray(yearsRes.data) ? yearsRes.data : [];
            const activeYear = years.find((y) => y.status === "active") || years[0] || null;

            // Load class fee structures for the active academic year
            let structures = [];
            if (activeYear?.id) {
                try {
                    const structRes = await api.get("/fees/structures", {
                        params: { academicYearId: activeYear.id }
                    });
                    structures = Array.isArray(structRes.data) ? structRes.data : [];
                } catch (e) {
                    console.error("Structure load error:", e);
                }
            }

            setReportData({
                academicYear: summary.academicYear || activeYear || null,
                totalStudents: Number(summary.totalStudents || students.length || 0),
                totalFee: Number(summary.totalFee || 0),
                classCollection: Array.isArray(summary.classCollection) ? summary.classCollection : [],
                modeCollection: Array.isArray(summary.modeCollection) ? summary.modeCollection : []
            });

            setRawExpenses(expenses);
            setRawPayments(payments);
            setRawStudents(students);
            setClassStructures(structures);
        } catch (error) {
            console.error("REPORT FETCH ERROR:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, []);

    // =====================================================
    // UNIQUE CLASS LIST FOR DROPDOWN
    // =====================================================
    const classList = useMemo(() => {
        const set = new Set();
        reportData.classCollection.forEach((c) => {
            if (c.className) set.add(c.className);
        });
        rawPayments.forEach((p) => {
            if (p.className) set.add(p.className);
        });
        rawStudents.forEach((s) => {
            if (s.className) set.add(s.className);
        });
        return Array.from(set).sort();
    }, [reportData.classCollection, rawPayments, rawStudents]);

    // =====================================================
    // DATE & CLASS FILTER LOGIC
    // =====================================================
    const isDateInPeriod = (dateStr, targetPeriod) => {
        if (!dateStr || targetPeriod === "all") return true;
        const d = new Date(dateStr);
        const today = new Date();
        d.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        if (targetPeriod === "today") {
            return d.getTime() === today.getTime();
        }

        if (targetPeriod === "month") {
            return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        }

        if (targetPeriod === "week") {
            const day = today.getDay();
            const diff = day === 0 ? 6 : day - 1;
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - diff);
            startOfWeek.setHours(0, 0, 0, 0);
            return d >= startOfWeek && d <= today;
        }

        return true;
    };

    // Filtered Payments
    const filteredPayments = useMemo(() => {
        return rawPayments.filter((p) => {
            if (p.status === "reversed") return false;
            const matchesPeriod = isDateInPeriod(p.paymentDate || p.created_at, period);
            const matchesClass = selectedClass === "all" || p.className === selectedClass;
            return matchesPeriod && matchesClass;
        });
    }, [rawPayments, period, selectedClass]);

    // Filtered Expenses
    const filteredExpenses = useMemo(() => {
        return rawExpenses.filter((e) => {
            if (e.status === "reversed") return false;
            return isDateInPeriod(e.expenseDate || e.created_at, period);
        });
    }, [rawExpenses, period]);

    // =====================================================
    // COMPUTED TOTALS & AGGREGATIONS
    // =====================================================
    const totalCollection = useMemo(() => {
        return filteredPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    }, [filteredPayments]);

    const totalExpenseAmount = useMemo(() => {
        return filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    }, [filteredExpenses]);

    const netBalance = totalCollection - totalExpenseAmount;

    // Filtered Class Collection Matrix
    const classSummaryMatrix = useMemo(() => {
        const map = {};

        reportData.classCollection.forEach((c) => {
            map[c.className] = {
                className: c.className,
                enrolled: Number(c.students || 0),
                totalAssessed: Number(c.totalFee || 0),
                collected: 0,
                receipts: 0
            };
        });

        filteredPayments.forEach((p) => {
            const cName = p.className || "Unassigned";
            if (!map[cName]) {
                map[cName] = { className: cName, enrolled: 0, totalAssessed: 0, collected: 0, receipts: 0 };
            }
            map[cName].collected += Number(p.amount || 0);
            map[cName].receipts += 1;
        });

        return Object.values(map)
            .filter((c) => (selectedClass === "all" ? true : c.className === selectedClass))
            .map((c) => {
                const balance = Math.max(0, c.totalAssessed - c.collected);
                const recoveryRate = c.totalAssessed > 0 ? ((c.collected / c.totalAssessed) * 100).toFixed(1) : "0.0";
                return { ...c, balance, recoveryRate };
            });
    }, [reportData.classCollection, filteredPayments, selectedClass]);

    // Mode Collection Map
    const modeSummary = useMemo(() => {
        const map = {};
        filteredPayments.forEach((p) => {
            const mode = p.paymentMode || "Cash";
            map[mode] = (map[mode] || 0) + Number(p.amount || 0);
        });
        return Object.entries(map).map(([mode, amount]) => ({
            mode,
            amount,
            percentage: totalCollection > 0 ? ((amount / totalCollection) * 100).toFixed(1) : "0.0"
        }));
    }, [filteredPayments, totalCollection]);

    // Expense Categories Map
    const expenseCategorySummary = useMemo(() => {
        const map = {};
        filteredExpenses.forEach((e) => {
            const cat = e.category || "Other";
            if (!map[cat]) map[cat] = { category: cat, amount: 0, count: 0 };
            map[cat].amount += Number(e.amount || 0);
            map[cat].count += 1;
        });
        return Object.values(map).sort((a, b) => b.amount - a.amount);
    }, [filteredExpenses]);

    // =====================================================
    // EXCEL EXPORT (AUTO-SIZED, MULTI-TAB MASTER BACKUP)
    // =====================================================
    const autoFitColumns = (jsonArray) => {
        if (!jsonArray || jsonArray.length === 0) return [];
        const keys = Object.keys(jsonArray[0]);
        return keys.map((key) => {
            const maxContentLength = Math.max(
                key.length,
                ...jsonArray.map((row) => (row[key] !== undefined && row[key] !== null ? String(row[key]).length : 0))
            );
            return { wch: Math.min(Math.max(maxContentLength + 4, 14), 45) };
        });
    };

    const generateExcelReport = (scopeType = "MASTER_BACKUP") => {
        const exportDate = new Date().toISOString().split("T")[0];
        const academicYearName = reportData.academicYear?.name || "2026-2027";
        const fileName =
            scopeType === "MASTER_BACKUP"
                ? `THE_AGE_SCHOOL_Master_Backup_${academicYearName}_${exportDate}.xlsx`
                : `Monthly_Fee_Reconciliation_${exportDate}.xlsx`;

        const workbook = XLSX.utils.book_new();

        // 1. Build Class Fee Structure lookup map
        const classFeeMap = {};
        classStructures.forEach((struct) => {
            if (struct.className) {
                classFeeMap[String(struct.className).trim().toLowerCase()] = Number(struct.totalAmount || 0);
            }
        });

        // Fallback from reportData.classCollection if structures API was empty
        reportData.classCollection.forEach((c) => {
            const cName = String(c.className || "").trim().toLowerCase();
            if (cName && !classFeeMap[cName] && c.students > 0) {
                classFeeMap[cName] = Number(c.totalFee || 0) / Number(c.students);
            }
        });

        // TAB 1: OVERVIEW SUMMARY
        const summaryData = [
            { "Financial Metric / Parameter": "Institution Name", "Value": "THE AGE SCHOOL" },
            { "Financial Metric / Parameter": "Academic Session", "Value": academicYearName },
            { "Financial Metric / Parameter": "Report Scope", "Value": scopeType === "MASTER_BACKUP" ? "Full Master Backup (Till Date)" : "Monthly Reconciliation" },
            { "Financial Metric / Parameter": "Class Filter Applied", "Value": selectedClass === "all" ? "Whole School (All Classes)" : `Class ${selectedClass}` },
            { "Financial Metric / Parameter": "Backup Generated Date", "Value": exportDate },
            { "Financial Metric / Parameter": "----------------------------------------", "Value": "----------------------------------------" },
            { "Financial Metric / Parameter": "Total Enrolled Students", "Value": rawStudents.length || reportData.totalStudents },
            { "Financial Metric / Parameter": "Total Assessed School Fees (₹)", "Value": reportData.totalFee },
            { "Financial Metric / Parameter": "Total Fee Collections Received (₹)", "Value": totalCollection },
            { "Financial Metric / Parameter": "Total Outstanding Fees Due (₹)", "Value": Math.max(0, reportData.totalFee - totalCollection) },
            { "Financial Metric / Parameter": "----------------------------------------", "Value": "----------------------------------------" },
            { "Financial Metric / Parameter": "Total Operational Expenses (₹)", "Value": totalExpenseAmount },
            { "Financial Metric / Parameter": "Net Operational Balance (₹)", "Value": netBalance },
            { "Financial Metric / Parameter": "Total Payment Receipts Issued", "Value": filteredPayments.length },
            { "Financial Metric / Parameter": "Total Expense Vouchers Logged", "Value": filteredExpenses.length }
        ];
        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        wsSummary["!cols"] = autoFitColumns(summaryData);
        XLSX.utils.book_append_sheet(workbook, wsSummary, "Overview Summary");

        // TAB 2: STUDENT FEE REGISTER (MATCHED STRICTLY BY ID & CLASS)
        const studentLedgerData = rawStudents
            .filter((s) => selectedClass === "all" || s.className === selectedClass)
            .map((s, idx) => {
                // Match strictly by student ID, or combination of rollNumber + className
                const sPayments = rawPayments.filter((p) => {
                    if (p.status === "reversed") return false;
                    if (p.student_id !== undefined && s.id !== undefined && Number(p.student_id) === Number(s.id)) return true;
                    if (p.studentId !== undefined && s.id !== undefined && Number(p.studentId) === Number(s.id)) return true;
                    return p.rollNumber === s.rollNumber && p.className === s.className;
                });

                const totalPaid = sPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
                const classKey = String(s.className || "").trim().toLowerCase();
                const assignedFee = classFeeMap[classKey] !== undefined ? classFeeMap[classKey] : 0;
                const pendingDue = Math.max(0, assignedFee - totalPaid);

                let status = "UNPAID";
                if (assignedFee > 0 && totalPaid >= assignedFee) {
                    status = "PAID";
                } else if (totalPaid > 0 && pendingDue > 0) {
                    status = "PARTIAL";
                } else if (assignedFee === 0 && totalPaid > 0) {
                    status = "PAID";
                } else if (assignedFee === 0 && totalPaid === 0) {
                    status = "FEE NOT SET";
                }

                return {
                    "Sl No": idx + 1,
                    "Roll / Admission No": s.rollNumber || "-",
                    "Student Name": s.studentName || "-",
                    "Class": s.className || "-",
                    "Father / Guardian": s.fatherName || "-",
                    "Parent Phone": s.contact1 || "-",
                    "Assigned Fee (₹)": assignedFee,
                    "Total Paid (₹)": totalPaid,
                    "Pending Due (₹)": pendingDue,
                    "Payment Status": status,
                    "Receipts Count": sPayments.length
                };
            });
        const wsStudents = XLSX.utils.json_to_sheet(studentLedgerData);
        wsStudents["!cols"] = autoFitColumns(studentLedgerData);
        XLSX.utils.book_append_sheet(workbook, wsStudents, "Student Fee Register");

        // TAB 3: COMPLETE PAYMENT RECEIPTS AUDIT
        const paymentRegisterData = filteredPayments.map((p, idx) => ({
            "Sl No": idx + 1,
            "Receipt Number": p.receipt_no || `REC-${p.id}`,
            "Payment Date": p.paymentDate ? new Date(p.paymentDate).toLocaleDateString("en-IN") : "-",
            "Student Name": p.studentName || "-",
            "Roll Number": p.rollNumber || "-",
            "Class": p.className || "-",
            "Amount Received (₹)": Number(p.amount || 0),
            "Payment Channel / Mode": (p.paymentMode || "Cash").toUpperCase(),
            "Accounting Remarks": p.remarks || "-"
        }));
        const wsPayments = XLSX.utils.json_to_sheet(paymentRegisterData);
        wsPayments["!cols"] = autoFitColumns(paymentRegisterData);
        XLSX.utils.book_append_sheet(workbook, wsPayments, "Payment Receipts");

        // TAB 4: EXPENSE VOUCHERS LEDGER
        const expenseRegisterData = filteredExpenses.map((e, idx) => ({
            "Sl No": idx + 1,
            "Voucher ID": `EXP-${e.id}`,
            "Expense Date": e.expenseDate ? new Date(e.expenseDate).toLocaleDateString("en-IN") : "-",
            "Expense Item / Purpose": e.expenseName || "-",
            "Category": e.category || "General",
            "Paid To (Recipient)": e.paidTo || "-",
            "Amount Paid (₹)": Number(e.amount || 0),
            "Payment Mode": (e.paymentMode || "Cash").toUpperCase()
        }));
        const wsExpenses = XLSX.utils.json_to_sheet(expenseRegisterData);
        wsExpenses["!cols"] = autoFitColumns(expenseRegisterData);
        XLSX.utils.book_append_sheet(workbook, wsExpenses, "Expense Ledger");

        // TAB 5: CLASS RECOVERY MATRIX
        const classMatrixData = classSummaryMatrix.map((c, idx) => ({
            "Sl No": idx + 1,
            "Class": c.className,
            "Enrolled Students": c.enrolled,
            "Total Assessed Fee (₹)": c.totalAssessed,
            "Total Collected (₹)": c.collected,
            "Pending Dues (₹)": c.balance,
            "Recovery Rate": `${c.recoveryRate}%`,
            "Receipts Issued": c.receipts
        }));
        const wsClass = XLSX.utils.json_to_sheet(classMatrixData);
        wsClass["!cols"] = autoFitColumns(classMatrixData);
        XLSX.utils.book_append_sheet(workbook, wsClass, "Class Matrix");

        XLSX.writeFile(workbook, fileName);
    };

    const periodName =
        period === "today"
            ? "Today"
            : period === "week"
            ? "This Week"
            : period === "month"
            ? "This Month"
            : "Till Date (All Time)";

    const maximum = Math.max(totalCollection, totalExpenseAmount, 1);
    const collectionHeight = `${(totalCollection / maximum) * 100}%`;
    const expenseHeight = `${(totalExpenseAmount / maximum) * 100}%`;

    return (
        <div className="dashboard">
            <Sidebar />

            <div className="main-content">
                <Navbar />

                <div className="page-content">
                    {/* HEADER CONTROLS */}
                    <div className="page-header">
                        <div>
                            <h2>Institutional Financial Reports</h2>
                            <p>
                                Audit, class ledgers, and cash flow reconciliation for{" "}
                                <strong>{reportData.academicYear?.name || "Active Session"}</strong>
                            </p>
                        </div>

                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                            {/* Class Dropdown */}
                            <select
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #d1d5db", fontWeight: "600" }}
                            >
                                <option value="all">🏫 All Classes</option>
                                {classList.map((c) => (
                                    <option key={c} value={c}>
                                        Class {c}
                                    </option>
                                ))}
                            </select>

                            {/* Period Dropdown */}
                            <select
                                value={period}
                                onChange={(e) => setPeriod(e.target.value)}
                                style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #d1d5db", fontWeight: "600" }}
                            >
                                <option value="all">📅 Till Date (Cumulative)</option>
                                <option value="month">📅 This Month</option>
                                <option value="week">📅 This Week</option>
                                <option value="today">📅 Today</option>
                            </select>

                            {/* Monthly Export Button */}
                            <button
                                onClick={() => generateExcelReport("MONTHLY")}
                                style={{
                                    padding: "8px 14px",
                                    backgroundColor: "#1D6F42",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    fontWeight: "600"
                                }}
                            >
                                📄 Monthly Audit (.xlsx)
                            </button>

                            {/* Till Date Master Backup Button */}
                            <button
                                onClick={() => generateExcelReport("MASTER_BACKUP")}
                                style={{
                                    padding: "8px 14px",
                                    backgroundColor: "#1E3A8A",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    fontWeight: "600"
                                }}
                            >
                                💾 Master Backup (.xlsx)
                            </button>
                        </div>
                    </div>

                    <div className="report-period-text">
                        Scope: <strong>{selectedClass === "all" ? "Whole Institution" : `Class ${selectedClass}`}</strong>
                        {" • "}
                        Period: <strong>{periodName}</strong>
                        {" • "}
                        Receipts Count: <strong>{filteredPayments.length}</strong>
                    </div>

                    {/* TOP SUMMARY CARDS */}
                    <h3 className="section-title">Fee Inflow & Balance Summary</h3>

                    <div className="report-cards">
                        <div className="report-summary-card">
                            <span>Total Receipts</span>
                            <strong>{loading ? "..." : filteredPayments.length}</strong>
                            <small>{selectedClass === "all" ? "All active receipts" : `Class ${selectedClass} receipts`}</small>
                        </div>

                        <div className="report-summary-card">
                            <span>Total Fee Collected</span>
                            <strong>{loading ? "..." : money(totalCollection)}</strong>
                            <small>Net cash/digital inflow</small>
                        </div>

                        <div className="report-summary-card">
                            <span>Total Expenses</span>
                            <strong>{loading ? "..." : money(totalExpenseAmount)}</strong>
                            <small>{filteredExpenses.length} expense voucher(s)</small>
                        </div>

                        <div className="report-summary-card">
                            <span>Net Cash Balance</span>
                            <strong className={netBalance < 0 ? "negative-balance" : "positive-balance"}>
                                {loading ? "..." : money(netBalance)}
                            </strong>
                            <small>Inflow minus outflow</small>
                        </div>
                    </div>

                    {/* CASH FLOW BAR GRAPH */}
                    <div className="report-panel financial-chart-panel">
                        <div className="report-panel-header">
                            <div>
                                <h3>Cash Flow Analysis</h3>
                                <p>{periodName} • {selectedClass === "all" ? "School Total" : `Class ${selectedClass}`}</p>
                            </div>
                        </div>

                        <div className="financial-chart">
                            <div className="chart-value">
                                <span>Net Inflow</span>
                                <strong>{money(totalCollection)}</strong>
                            </div>

                            <div className="chart-area">
                                <div className="chart-column">
                                    <div className="chart-bar-wrapper">
                                        <div
                                            className="chart-bar collection-bar"
                                            style={{ height: collectionHeight }}
                                        />
                                    </div>
                                    <span>Fee Collection</span>
                                </div>

                                <div className="chart-column">
                                    <div className="chart-bar-wrapper">
                                        <div
                                            className="chart-bar expense-bar"
                                            style={{ height: expenseHeight }}
                                        />
                                    </div>
                                    <span>Expenses</span>
                                </div>
                            </div>

                            <div className="chart-legend">
                                <div>
                                    <span className="legend-dot collection-dot" />
                                    <span>Fee Collection</span>
                                </div>
                                <div>
                                    <span className="legend-dot expense-dot" />
                                    <span>Expenses</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CLASS-WISE RECOVERY MATRIX TABLE */}
                    <div className="report-panel">
                        <div className="report-panel-header">
                            <div>
                                <h3>Class-wise Fee Performance Ledger</h3>
                                <p>Progressive recovery and outstanding balances</p>
                            </div>
                        </div>

                        {classSummaryMatrix.length === 0 ? (
                            <div className="report-empty">No class records available for the selected filters.</div>
                        ) : (
                            <div className="report-table-wrapper">
                                <table className="report-table">
                                    <thead>
                                        <tr>
                                            <th>Class</th>
                                            <th>Enrolled</th>
                                            <th>Assessed Fee</th>
                                            <th>Collected</th>
                                            <th>Balance</th>
                                            <th>Recovery Rate</th>
                                            <th>Receipts</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {classSummaryMatrix.map((item) => (
                                            <tr key={item.className}>
                                                <td><strong>{item.className}</strong></td>
                                                <td>{item.enrolled}</td>
                                                <td>{money(item.totalAssessed)}</td>
                                                <td><strong>{money(item.collected)}</strong></td>
                                                <td style={{ color: item.balance > 0 ? "#DC2626" : "#16A34A", fontWeight: "700" }}>
                                                    {money(item.balance)}
                                                </td>
                                                <td>
                                                    <span className="payment-badge" style={{ backgroundColor: Number(item.recoveryRate) >= 80 ? "#DCFCE7" : "#FEF3C7" }}>
                                                        {item.recoveryRate}%
                                                    </span>
                                                </td>
                                                <td>{item.receipts}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* PAYMENT MODES & EXPENSE BREAKDOWN */}
                    <div className="report-grid">
                        <div className="report-panel">
                            <div className="report-panel-header">
                                <h3>Payment Channels Reconciliation</h3>
                                <p>Mode of settlement</p>
                            </div>

                            {modeSummary.length === 0 ? (
                                <div className="report-empty">No payment data available</div>
                            ) : (
                                <div className="report-list">
                                    {modeSummary.map((item) => (
                                        <div className="report-list-row" key={item.mode}>
                                            <div>
                                                <strong>{item.mode}</strong>
                                                <small>{item.percentage}% of collections</small>
                                            </div>
                                            <strong>{money(item.amount)}</strong>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="report-panel">
                            <div className="report-panel-header">
                                <h3>Operational Expenses by Category</h3>
                                <p>{periodName}</p>
                            </div>

                            {expenseCategorySummary.length === 0 ? (
                                <div className="report-empty">No expense records available</div>
                            ) : (
                                <div className="report-list">
                                    {expenseCategorySummary.map((item) => (
                                        <div className="report-list-row" key={item.category}>
                                            <div>
                                                <strong>{item.category}</strong>
                                                <small>{item.count} voucher(s)</small>
                                            </div>
                                            <strong>{money(item.amount)}</strong>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RECENT PAYMENTS AUDIT TRAIL */}
                    <div className="report-panel recent-payments">
                        <div className="report-panel-header">
                            <h3>Filtered Payment Transactions</h3>
                            <p>{filteredPayments.length} transaction(s) recorded</p>
                        </div>

                        {filteredPayments.length === 0 ? (
                            <div className="report-empty">No payment records found matching the current filters.</div>
                        ) : (
                            <div className="report-table-wrapper">
                                <table className="report-table">
                                    <thead>
                                        <tr>
                                            <th>Receipt No</th>
                                            <th>Student</th>
                                            <th>Class</th>
                                            <th>Date</th>
                                            <th>Mode</th>
                                            <th>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPayments.slice(0, 15).map((payment) => (
                                            <tr key={payment.id}>
                                                <td><span className="receipt-number">REC-{payment.id}</span></td>
                                                <td><strong>{payment.studentName || "-"}</strong></td>
                                                <td>{payment.className || "-"}</td>
                                                <td>{payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString("en-IN") : "-"}</td>
                                                <td><span className="payment-badge">{payment.paymentMode || "Cash"}</span></td>
                                                <td><strong>{money(payment.amount)}</strong></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ReportsPage;