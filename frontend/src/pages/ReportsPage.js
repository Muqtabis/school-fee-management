import { toast } from "../services/notify";
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
    const [rawIncomes, setRawIncomes] = useState([]);
    const [rawStudents, setRawStudents] = useState([]);
    const [classStructures, setClassStructures] = useState([]);
    const [tcConcededFee, setTcConcededFee] = useState(0);
    const [reportData, setReportData] = useState({
        academicYear: null,
        totalStudents: 0,
        totalFee: 0,
        classCollection: [],
        modeCollection: [],
        componentBreakdown: []
    });

    const money = (value) =>
        `₹${Number(value || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;

    // ---- Customizable summary cards (same UX as the Dashboard) ----
    const REPORT_CARDS = ["Net Balance", "Total Fees", "Collection", "Fee Collected", "Pending Fees", "Concession", "Collection Mode", "School Receipt", "School Payment"];
    const [hiddenReportCards, setHiddenReportCards] = useState(() => {
        try { return JSON.parse(localStorage.getItem("report-hidden-cards") || "[]"); } catch (e) { return []; }
    });
    const [reportCardOrder, setReportCardOrder] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem("report-card-order") || "[]");
            const valid = Array.isArray(saved) ? saved.filter((c) => typeof c === "string") : [];
            return [...valid, ...REPORT_CARDS.filter((c) => !valid.includes(c))];
        } catch (e) { return [...REPORT_CARDS]; }
    });
    const [customizingReports, setCustomizingReports] = useState(false);
    const reportCardVisible = (name) => !hiddenReportCards.includes(name);
    const toggleReportCard = (name) => {
        const next = hiddenReportCards.includes(name)
            ? hiddenReportCards.filter((c) => c !== name)
            : [...hiddenReportCards, name];
        setHiddenReportCards(next);
        try { localStorage.setItem("report-hidden-cards", JSON.stringify(next)); } catch (e) { /* optional */ }
    };
    const saveReportOrder = (next) => {
        setReportCardOrder(next);
        try { localStorage.setItem("report-card-order", JSON.stringify(next)); } catch (e) { /* optional */ }
    };
    const moveReportCard = (index, direction, list) => {
        const target = index + direction;
        if (target < 0 || target >= list.length) return;
        const next = [...list];
        [next[index], next[target]] = [next[target], next[index]];
        saveReportOrder(next);
    };
    const resetReportOrder = () => saveReportOrder([...REPORT_CARDS]);

    // =====================================================
    // FETCH DATA FROM VM (READ-ONLY)
    // =====================================================
    const fetchReport = async () => {
        try {
            setLoading(true);
            // Each source is fetched independently so one restricted endpoint
            // (e.g. /payments/report-summary is admin-only) cannot blank the whole
            // page for roles that legitimately hold the Reports grant. Totals below
            // are recomputed client-side from the payments/expenses the caller can read.
            const [summaryRes, expenseRes, incomeRes, paymentsRes, studentsRes, yearsRes] = await Promise.all([
                api.get(`/payments/report-summary?period=all`).catch(() => ({ data: {} })),
                api.get("/expenses").catch(() => ({ data: [] })),
                api.get("/incomes").catch(() => ({ data: [] })),
                api.get("/payments").catch(() => ({ data: [] })),
                api.get("/students").catch(() => ({ data: [] })),
                api.get("/fees/academic-years").catch(() => ({ data: [] }))
            ]);

            const summary = summaryRes.data || {};
            const expenses = Array.isArray(expenseRes.data) ? expenseRes.data : [];
            const incomes = Array.isArray(incomeRes.data) ? incomeRes.data : [];
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
                modeCollection: Array.isArray(summary.modeCollection) ? summary.modeCollection : [],
                componentBreakdown: Array.isArray(summary.componentBreakdown) ? summary.componentBreakdown : []
            });

            setRawExpenses(expenses);
            setRawIncomes(incomes);
            setRawPayments(payments);
            setRawStudents(students);
            setClassStructures(structures);

            // TC Conceded Fee = sum of remaining amounts waived at TC time.
            // Fetched on every load so it stays in sync with issued TCs.
            try {
                const tcRes = await api.get("/documents/records");
                const recs = Array.isArray(tcRes.data?.records) ? tcRes.data.records : [];
                setTcConcededFee(recs.reduce((s, r) => s + Number(r.remainingAmount || 0), 0));
            } catch (e) {
                setTcConcededFee(0);
            }
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

    // Filtered Incomes (non-fee inflow: donations, grants, events…)
    const filteredIncomes = useMemo(() => {
        return rawIncomes.filter((i) => {
            if (i.status === "reversed") return false;
            return isDateInPeriod(i.incomeDate || i.created_at, period);
        });
    }, [rawIncomes, period]);

    // =====================================================
    // COMPUTED TOTALS & AGGREGATIONS
    // =====================================================
    const totalCollection = useMemo(() => {
        return filteredPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    }, [filteredPayments]);

    // Split the same collection into three real buckets so nobody has to
    // explain why "Fee Collection" looks high: current students, exited
    // students (old receipts) and cash taken at the TC counter.
    const collectionSplit = useMemo(() => {
        const out = { continuing: 0, exited: 0, tcCounter: 0 };
        filteredPayments.forEach((p) => {
            const amt = Number(p.amount || 0);
            if (p.remarks === "Fee collected at TC counter") out.tcCounter += amt;
            else if (p.studentStatus === "archived") out.exited += amt;
            else out.continuing += amt;
        });
        return out;
    }, [filteredPayments]);

    const totalExpenseAmount = useMemo(() => {
        return filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    }, [filteredExpenses]);

    const totalIncomeAmount = useMemo(() => {
        return filteredIncomes.reduce((sum, i) => sum + Number(i.amount || 0), 0);
    }, [filteredIncomes]);

    const incomeCategorySummary = useMemo(() => {
        const map = {};
        filteredIncomes.forEach((i) => {
            const cat = i.category || "Other";
            if (!map[cat]) map[cat] = { category: cat, amount: 0, count: 0 };
            map[cat].amount += Number(i.amount || 0);
            map[cat].count += 1;
        });
        return Object.values(map).sort((a, b) => b.amount - a.amount);
    }, [filteredIncomes]);

    // Net balance includes ALL inflow: fee collections + other receipts, minus payments.
    const netBalance = totalCollection + totalIncomeAmount - totalExpenseAmount;

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

    // =====================================================
    // OVERALL TOTALS ACROSS THE VISIBLE CLASSES
    // Respects the selected class scope; feeds the summary
    // card, the table TOTAL row, and the Excel tabs.
    // =====================================================
    const classTotals = useMemo(() => ({
        enrolled: classSummaryMatrix.reduce((s, c) => s + Number(c.enrolled || 0), 0),
        assessed: classSummaryMatrix.reduce((s, c) => s + Number(c.totalAssessed || 0), 0),
        collected: classSummaryMatrix.reduce((s, c) => s + Number(c.collected || 0), 0),
        balance: classSummaryMatrix.reduce((s, c) => s + Number(c.balance || 0), 0),
        receipts: classSummaryMatrix.reduce((s, c) => s + Number(c.receipts || 0), 0)
    }), [classSummaryMatrix]);

    const overallRecovery = classTotals.assessed > 0
        ? ((classTotals.collected / classTotals.assessed) * 100).toFixed(1)
        : "0.0";

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
            { "Financial Metric / Parameter": "Total Enrolled Students", "Value": classTotals.enrolled || rawStudents.length },
            { "Financial Metric / Parameter": "Total Assessed School Fees (₹)", "Value": classTotals.assessed },
            { "Financial Metric / Parameter": "Total Fee Collections Received (₹)", "Value": totalCollection },
            { "Financial Metric / Parameter": "Total Outstanding Fees Due (₹)", "Value": classTotals.balance },
            { "Financial Metric / Parameter": "----------------------------------------", "Value": "----------------------------------------" },
            { "Financial Metric / Parameter": "Total Payments (₹)", "Value": totalExpenseAmount },
            { "Financial Metric / Parameter": "Net Operational Balance (₹)", "Value": netBalance },
            { "Financial Metric / Parameter": "Total Payment Receipts Issued", "Value": filteredPayments.length },
            { "Financial Metric / Parameter": "Total Payment Vouchers Logged", "Value": filteredExpenses.length }
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
            "Payment Date": e.expenseDate ? new Date(e.expenseDate).toLocaleDateString("en-IN") : "-",
            "Payment Item / Purpose": e.expenseName || "-",
            "Category": e.category || "General",
            "Paid To (Recipient)": e.paidTo || "-",
            "Amount Paid (₹)": Number(e.amount || 0),
            "Payment Mode": (e.paymentMode || "Cash").toUpperCase()
        }));
        const wsExpenses = XLSX.utils.json_to_sheet(expenseRegisterData);
        wsExpenses["!cols"] = autoFitColumns(expenseRegisterData);
        XLSX.utils.book_append_sheet(workbook, wsExpenses, "Payment Ledger");

        // TAB 5: CLASS RECOVERY MATRIX (per class + overall TOTAL row)
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
        if (classSummaryMatrix.length > 0) {
            classMatrixData.push({
                "Sl No": "",
                "Class": "TOTAL (All Classes)",
                "Enrolled Students": classTotals.enrolled,
                "Total Assessed Fee (₹)": classTotals.assessed,
                "Total Collected (₹)": classTotals.collected,
                "Pending Dues (₹)": classTotals.balance,
                "Recovery Rate": `${overallRecovery}%`,
                "Receipts Issued": classTotals.receipts
            });
        }
        const wsClass = XLSX.utils.json_to_sheet(classMatrixData);
        wsClass["!cols"] = autoFitColumns(classMatrixData);
        XLSX.utils.book_append_sheet(workbook, wsClass, "Class Matrix");

        XLSX.writeFile(workbook, fileName);
    };

    // =====================================================
    // SERVER-SIDE ZIP EXPORT (Excel + receipt PDFs)
    // =====================================================
    const [exporting, setExporting] = useState(false);

    // =====================================================
    // DATA EXPORT CENTER (server-built COMPLETE .xlsx files)
    // =====================================================
    const [dataExport, setDataExport] = useState("");
    const [dataExporting, setDataExporting] = useState(false);

    const DATA_EXPORT_LABELS = {
        "students": "Students",
        "attendance-staff": "Staff_Attendance",
        "attendance-students": "Student_Attendance",
        "exams": "Exams_Results",
        "payments": "Payments",
        "expenses": "Payments"
    };

    const downloadDataExport = async (key) => {
        try {
            setDataExporting(true);
            const res = await api.get(`/exports/${key}`, { responseType: "blob" });

            const blob = new Blob([res.data], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;

            const disposition = res.headers?.["content-disposition"] || "";
            const match = disposition.match(/filename="?([^"]+)"?/);
            link.download = match ? match[1] : `School_${DATA_EXPORT_LABELS[key] || "Data"}_${new Date().toISOString().split("T")[0]}.xlsx`;

            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast("Excel file downloaded.");
        } catch (error) {
            console.error("Data export error:", error);
            toast("Unable to export this data. Please try again.");
        } finally {
            setDataExporting(false);
            setDataExport("");
        }
    };

    const downloadBundle = async () => {
        try {
            setExporting(true);
            const res = await api.get("/payments/export-bundle", {
                params: { period, className: selectedClass },
                responseType: "blob"
            });

            const blob = new Blob([res.data], { type: "application/zip" });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;

            // Try to read the server-provided filename.
            const disposition = res.headers?.["content-disposition"] || "";
            const match = disposition.match(/filename="?([^"]+)"?/);
            link.download = match ? match[1] : `School_Report_${new Date().toISOString().split("T")[0]}.zip`;

            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Bundle export error:", error);
            toast("Unable to export the report bundle. Please try again.");
        } finally {
            setExporting(false);
        }
    };

    const periodName =
        period === "today"
            ? "Today"
            : period === "week"
            ? "This Week"
            : period === "month"
            ? "This Month"
            : "Till Date (All Time)";

    const maximum = Math.max(totalCollection, totalIncomeAmount, totalExpenseAmount, 1);
    const collectionHeight = `${(totalCollection / maximum) * 100}%`;
    const incomeHeight = `${(totalIncomeAmount / maximum) * 100}%`;
    const expenseHeight = `${(totalExpenseAmount / maximum) * 100}%`;

    // Cards: single card per concept. Breakdowns live INSIDE the card
    // (rows array), so no extra cards are created for modes/categories.
    const reportCardDefs = {
        "Net Balance": {
            value: money(netBalance),
            small: "Fees + receipts − payments",
            tone: netBalance < 0 ? "negative-balance" : "positive-balance",
            rows: [
                { name: "Fee Collected", value: money(totalCollection) },
                { name: "School Receipt", value: money(totalIncomeAmount) },
                { name: "School Payment", value: "-" + money(totalExpenseAmount) }
            ]
        },
        "Total Fees": { value: money(classTotals.assessed), small: "Assessed fee demand", tone: "" },
        "Collection": { value: filteredPayments.length, small: selectedClass === "all" ? "All active receipts" : `Class ${selectedClass} receipts` },
        "Fee Collected": {
            value: money(totalCollection),
            small: "Net cash/digital inflow",
            detail: `Current ${money(collectionSplit.continuing)} · Exited ${money(collectionSplit.exited)} · TC counter ${money(collectionSplit.tcCounter)}`
        },
        "Pending Fees": { value: money(classTotals.balance), small: selectedClass === "all" ? "Outstanding across all classes" : `Outstanding for Class ${selectedClass}`, tone: classTotals.balance > 0 ? "negative-balance" : "positive-balance" },
        "Concession": {
            value: money(tcConcededFee),
            small: "Concessions granted",
            rows: [
                { name: "TC Written Off", value: money(tcConcededFee) },
                { name: "Previous Dues Conceded", value: money(0) }
            ]
        },
        "Collection Mode": {
            value: money(modeSummary.reduce((s, m) => s + Number(m.amount || 0), 0)),
            small: "Fee collected through each mode",
            rows: modeSummary.map((m) => ({ name: m.mode, value: money(m.amount) }))
        },
        "School Receipt": {
            value: money(totalIncomeAmount),
            small: `${filteredIncomes.length} receipt voucher(s)`,
            rows: incomeCategorySummary.map((c) => ({ name: c.category, value: money(c.amount) }))
        },
        "School Payment": {
            value: money(totalExpenseAmount),
            small: `${filteredExpenses.length} payment voucher(s)`,
            rows: expenseCategorySummary.map((c) => ({ name: c.category, value: money(c.amount) }))
        }
    };
    const activeCardNames = [...reportCardOrder];
    Object.keys(reportCardDefs).forEach((name) => { if (!activeCardNames.includes(name)) activeCardNames.push(name); });

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

                            {/* DATA EXPORT DROPDOWN — complete .xlsx download center */}
                            <select
                                value={dataExport}
                                disabled={dataExporting}
                                onChange={(e) => {
                                    const key = e.target.value;
                                    setDataExport(key);
                                    if (key) downloadDataExport(key);
                                }}
                                style={{
                                    padding: "8px 12px",
                                    borderRadius: "6px",
                                    border: "1px solid #d1d5db",
                                    fontWeight: "600",
                                    backgroundColor: dataExporting ? "#f3f4f6" : "#fff"
                                }}
                            >
                                <option value="">
                                    {dataExporting ? "⏳ Preparing Excel..." : "⬇️ Download Data (Excel)"}
                                </option>
                                <option value="students">🎓 Students — All Fields</option>
                                <option value="attendance-staff">🧑‍🏫 Staff Attendance — All Records</option>
                                <option value="attendance-students">🧒 Student Attendance — All Records</option>
                                <option value="exams">📝 Exams &amp; Results — All Data</option>
                                <option value="payments">💰 Payments — All Fields</option>
                                <option value="expenses">💸 Payments — All Fields</option>
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

                            {/* Full bundle: Excel + receipt PDFs (server-side) */}
                            <button
                                onClick={downloadBundle}
                                disabled={exporting}
                                title="Excel report plus a PDF receipt for every payment, zipped together"
                                style={{
                                    padding: "8px 14px",
                                    backgroundColor: exporting ? "#94A3B8" : "#7C3AED",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "6px",
                                    cursor: exporting ? "not-allowed" : "pointer",
                                    fontWeight: "600"
                                }}
                            >
                                {exporting ? "Preparing..." : "📦 Excel + Receipts (.zip)"}
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

                    {/* TOP SUMMARY CARDS — show/hide and reorder from Customize */}
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                        <button type="button" className="clear-btn" onClick={() => setCustomizingReports((v) => !v)}>{customizingReports ? "Done" : "⚙ Customize cards"}</button>
                    </div>
                    {customizingReports && (
                        <div className="settings-card" style={{ padding: 14, marginBottom: 12 }}>
                            <div style={{ fontSize: 12, color: "#64748B", marginBottom: 10 }}>
                                Tick a card to show it. Use ↑ / ↓ to set the order of the summary cards. Your layout is saved automatically.
                            </div>
                            <div style={{ display: "grid", gap: 6 }}>
                                {activeCardNames.map((c, i) => (
                                    <div key={c} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 40 }}>
                                        <input type="checkbox" checked={reportCardVisible(c)} onChange={() => toggleReportCard(c)} aria-label={"Show " + c} />
                                        <span style={{ fontSize: 12, flex: 1, minWidth: 0 }}>{c}</span>
                                        <button type="button" className="clear-btn" style={{ padding: "4px 10px" }} onClick={() => moveReportCard(i, -1, activeCardNames)} disabled={i === 0} aria-label={"Move " + c + " up"}>↑</button>
                                        <button type="button" className="clear-btn" style={{ padding: "4px 10px" }} onClick={() => moveReportCard(i, 1, activeCardNames)} disabled={i === activeCardNames.length - 1} aria-label={"Move " + c + " down"}>↓</button>
                                    </div>
                                ))}
                            </div>
                            <button type="button" className="clear-btn" style={{ marginTop: 10 }} onClick={resetReportOrder}>Reset to default order</button>
                        </div>
                    )}

                    {/* Three EXISTING cards, promoted to big component-detail cards
                        (no duplicates — the same names are hidden from the small grid). */}
                    <h3 className="section-title">Fee Inflow &amp; Balance Summary</h3>
                    <div className="report-big-cards">
                        {["Total Fees", "Fee Collected", "Pending Fees"]
                            .filter((name) => reportCardVisible(name) && reportCardDefs[name])
                            .map((name) => {
                                const card = reportCardDefs[name];
                                const key = name === "Total Fees" ? "assessed" : name === "Fee Collected" ? "collected" : "pending";
                                return (
                                    <div className="settings-card report-big-card" key={name}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, borderBottom: "2px solid #17365d", paddingBottom: 8 }}>
                                            <strong style={{ fontSize: 15, color: "#17365d" }}>{name}</strong>
                                            <strong className={card.tone || ""} style={{ fontSize: 22 }}>{loading ? "..." : card.value}</strong>
                                        </div>
                                        {reportData.componentBreakdown.filter((c) => Math.abs(Number(c[key] || 0)) > 0.001).length === 0 ? (
                                            <p style={{ color: "#64748B", fontSize: 12, margin: 0 }}>No fee components recorded.</p>
                                        ) : reportData.componentBreakdown
                                            .filter((c) => Math.abs(Number(c[key] || 0)) > 0.001)
                                            .map((c) => (
                                                <div key={c.key || c.name} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: "1px solid #E2E8F0", fontSize: 12 }}>
                                                    <span style={{ color: "#475569" }}>{c.name}</span>
                                                    <strong style={{ color: Number(c[key]) < 0 ? "#15803D" : "#0F172A" }}>{money(c[key])}</strong>
                                                </div>
                                            ))}
                                    </div>
                                );
                            })}
                    </div>

                    {/* Cards with breakdowns (Collection Mode / Receipt / Payment) */}
                    <div className="report-big-cards">
                        {activeCardNames
                            .filter((name) => reportCardVisible(name) && reportCardDefs[name] && Array.isArray(reportCardDefs[name].rows))
                            .map((name) => {
                                const d = reportCardDefs[name];
                                return (
                                    <div className="settings-card report-big-card" key={name}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, borderBottom: "2px solid #17365d", paddingBottom: 8 }}>
                                                <strong style={{ fontSize: 14, color: "#17365d" }}>{name}</strong>
                                                <strong className={d.tone || ""} style={{ fontSize: 22 }}>{loading ? "..." : d.value}</strong>
                                            </div>
                                            <small style={{ display: "block", color: "#64748B", fontSize: 11, marginBottom: 8 }}>{d.small}</small>
                                            {d.rows.length === 0 ? (
                                                <p style={{ color: "#64748B", fontSize: 12, margin: 0 }}>No records available.</p>
                                            ) : d.rows.map((r) => (
                                                <div key={r.name} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: "1px solid #E2E8F0", fontSize: 12 }}>
                                                    <span style={{ color: "#475569" }}>{r.name}</span>
                                                    <strong style={{ color: "#0F172A" }}>{r.value}</strong>
                                                </div>
                                            ))}
                                    </div>
                                );
                            })}
                    </div>

                    <div className="report-cards">
                        {activeCardNames
                            .filter((name) => !["Total Fees", "Fee Collected", "Pending Fees"].includes(name))
                            .filter((name) => reportCardVisible(name) && reportCardDefs[name] && !Array.isArray(reportCardDefs[name].rows))
                            .map((name) => {
                                const d = reportCardDefs[name];
                                return (
                                    <div className="report-summary-card" key={name}>
                                        <span>{name}</span>
                                        <strong className={d.tone || ""}>{loading ? "..." : d.value}</strong>
                                        <small>{d.small}</small>
                                        {d.detail && (
                                            <small style={{ display: "block", marginTop: "4px", fontSize: "10px", color: "#64748B" }}>
                                                {loading ? "..." : d.detail}
                                            </small>
                                        )}
                                    </div>
                                );
                            })}
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
                                <strong>{money(netBalance)}</strong>
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
                                            className="chart-bar income-bar"
                                            style={{ height: incomeHeight }}
                                        />
                                    </div>
                                    <span>Receipt</span>
                                </div>

                                <div className="chart-column">
                                    <div className="chart-bar-wrapper">
                                        <div
                                            className="chart-bar expense-bar"
                                            style={{ height: expenseHeight }}
                                        />
                                    </div>
                                    <span>Payment</span>
                                </div>
                            </div>

                            <div className="chart-legend">
                                <div>
                                    <span className="legend-dot collection-dot" />
                                    <span>Fee Collection</span>
                                </div>
                                <div>
                                    <span className="legend-dot income-dot" />
                                    <span>Receipt</span>
                                </div>
                                <div>
                                    <span className="legend-dot expense-dot" />
                                    <span>Payment</span>
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
                                <table className="report-table stack-sm">
                                    <thead>
                                        <tr>
                                            <th>Class</th>
                                            <th>Enrolled</th>
                                            <th>Assessed Fee</th>
                                            <th>Collected</th>
                                            <th>Remaining Balance</th>
                                            <th>Recovery Rate</th>
                                            <th>Receipts</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {classSummaryMatrix.map((item) => (
                                            <tr key={item.className}>
                                                <td data-label="Class"><strong>{item.className}</strong></td>
                                                <td data-label="Enrolled">{item.enrolled}</td>
                                                <td data-label="Assessed Fee">{money(item.totalAssessed)}</td>
                                                <td data-label="Collected"><strong>{money(item.collected)}</strong></td>
                                                <td data-label="Remaining Balance" style={{ color: item.balance > 0 ? "#DC2626" : "#16A34A", fontWeight: "700" }}>
                                                    {money(item.balance)}
                                                </td>
                                                <td data-label="Recovery Rate">
                                                    <span className="payment-badge" style={{ backgroundColor: Number(item.recoveryRate) >= 80 ? "#DCFCE7" : "#FEF3C7" }}>
                                                        {item.recoveryRate}%
                                                    </span>
                                                </td>
                                                <td data-label="Receipts">{item.receipts}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ backgroundColor: "#F8FAFC", borderTop: "2px solid #E2E8F0" }}>
                                            <td data-label="Class"><strong>TOTAL</strong></td>
                                            <td data-label="Enrolled"><strong>{classTotals.enrolled}</strong></td>
                                            <td data-label="Assessed Fee"><strong>{money(classTotals.assessed)}</strong></td>
                                            <td data-label="Collected"><strong>{money(classTotals.collected)}</strong></td>
                                            <td data-label="Remaining Balance" style={{ color: classTotals.balance > 0 ? "#DC2626" : "#16A34A" }}>
                                                <strong>{money(classTotals.balance)}</strong>
                                            </td>
                                            <td data-label="Recovery Rate"><strong>{overallRecovery}%</strong></td>
                                            <td data-label="Receipts"><strong>{classTotals.receipts}</strong></td>
                                        </tr>
                                    </tfoot>
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
                                <h3>Payments by Category</h3>
                                <p>{periodName}</p>
                            </div>

                            {expenseCategorySummary.length === 0 ? (
                                <div className="report-empty">No payment records available</div>
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
                                <table className="report-table stack-sm">
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
                                                <td data-label="Receipt No"><span className="receipt-number">REC-{payment.id}</span></td>
                                                <td data-label="Student"><strong>{payment.studentName || "-"}</strong></td>
                                                <td data-label="Class">{payment.className || "-"}</td>
                                                <td data-label="Date">{payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString("en-IN") : "-"}</td>
                                                <td data-label="Mode"><span className="payment-badge">{payment.paymentMode || "Cash"}</span></td>
                                                <td data-label="Amount"><strong>{money(payment.amount)}</strong></td>
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