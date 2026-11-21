// =====================================================
// DATA EXPORT CENTER
// Complete (all rows / all columns) .xlsx exports for the
// Reports page download dropdown. READ-ONLY endpoints:
// every query here is a SELECT — nothing writes to the DB.
// Access is gated in routes/exports.js by the "reports"
// page grant (admins always pass the gate).
// =====================================================
const db = require("../db");
const XLSX = require("xlsx");

// ---------- shared helpers ----------

const SCHOOL = (process.env.SCHOOL_NAME || "The Age School").replace(/[^A-Za-z0-9]+/g, "_");
const todayStamp = () => new Date().toISOString().split("T")[0];

const sendWorkbook = (res, label, wb) => {
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const fileName = `${SCHOOL}_${label}_${todayStamp()}.xlsx`;
    res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.status(200).end(buffer);
};

// Auto-size every column so the sheet is readable straight after download.
const fitColumns = (rows) => {
    const safeRows = rows.length ? rows : [{ Note: "No records found" }];
    const headers = Object.keys(safeRows[0]);
    return headers.map((h) => {
        let width = String(h).length;
        safeRows.forEach((r) => {
            const v = r[h] === null || r[h] === undefined ? "" : String(r[h]);
            if (v.length > width) width = v.length;
        });
        return { wch: Math.min(Math.max(width + 2, 9), 48) };
    });
};

const addSheet = (wb, sheetName, rows) => {
    const safeRows = rows.length ? rows : [{ Note: "No records found" }];
    const ws = XLSX.utils.json_to_sheet(safeRows);
    ws["!cols"] = fitColumns(safeRows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
};

// The students table gains columns via runtime migrations (e.g. penNumber),
// so always introspect before selecting: exports pick up columns that exist.
const studentsColumns = async () =>
    (await db.allQuery(`PRAGMA table_info(students)`)).map((c) => c.name);

const val = (v) => (v === null || v === undefined ? "" : v);

// =====================================================
// 1) STUDENTS — every column of the students table
// =====================================================
exports.exportStudents = async (req, res) => {
    try {
        const cols = await studentsColumns();
        const wanted = [
            "id", "admissionNumber", "satsNumber", "penNumber", "rollNumber",
            "studentName", "className", "gender", "dob", "fatherName", "motherName",
            "contact1", "contact2", "address", "remark", "previousDues",
            "previousDuesConcession", "previousDuesConcessionReason",
            "tuitionFee", "concessionAmount", "concessionReason", "studentCategory",
            "status", "archivedAt", "archivedBy", "archiveReason"
        ];
        const chosen = wanted.filter((c) => cols.includes(c));
        const extra = cols.filter((c) => !wanted.includes(c) && c !== "id");
        const selectList = [...chosen, ...extra].join(", ");

        const students = await db.allQuery(
            `SELECT ${selectList} FROM students
             ORDER BY CAST(NULLIF(className,'') AS INTEGER) ASC, className ASC,
                      CAST(NULLIF(rollNumber,'') AS INTEGER) ASC, rollNumber ASC, id ASC`
        );

        const HEADER = {
            id: "Id",
            admissionNumber: "Admission No",
            satsNumber: "SATS No",
            penNumber: "PEN",
            rollNumber: "Roll No",
            studentName: "Student Name",
            className: "Class",
            gender: "Gender",
            dob: "Date of Birth",
            fatherName: "Father Name",
            motherName: "Mother Name",
            contact1: "Contact 1",
            contact2: "Contact 2",
            address: "Address",
            remark: "Remarks",
            previousDues: "Previous Dues (Rs.)",
            previousDuesConcession: "Previous Dues Conceded (Rs.)",
            previousDuesConcessionReason: "Previous Dues Concession Reason",
            tuitionFee: "Tuition Fee (Rs.)",
            concessionAmount: "Concession (Rs.)",
            concessionReason: "Concession Reason",
            studentCategory: "Category",
            status: "Status",
            archivedAt: "Archived At",
            archivedBy: "Archived By",
            archiveReason: "Archive Reason"
        };

        const rows = students.map((s) => {
            const row = {};
            [...chosen, ...extra].forEach((c) => {
                row[HEADER[c] || c] = val(s[c]);
            });
            return row;
        });

        const wb = XLSX.utils.book_new();
        addSheet(wb, "Students", rows);
        sendWorkbook(res, "Students", wb);
    } catch (error) {
        console.error("EXPORT students error:", error);
        res.status(500).json({ success: false, message: "Export failed." });
    }
};

// =====================================================
// 2) STAFF ATTENDANCE — every record ever marked
// =====================================================
exports.exportStaffAttendance = async (req, res) => {
    try {
        const records = await db.allQuery(`
            SELECT
                ta.id, u.name AS staffName, u.role,
                ta.attendanceDate, ta.status, ta.remark, ta.isLocked,
                m.name AS markedByName, ta.updatedAt, ta.createdAt
            FROM teacher_attendance ta
            LEFT JOIN users u ON u.id = ta.teacherId
            LEFT JOIN users m ON m.id = ta.markedBy
            ORDER BY ta.attendanceDate ASC, staffName ASC
        `);

        const detail = records.map((r) => ({
            "Id": r.id,
            "Staff": val(r.staffName) || "-",
            "Role": val(r.role) || "-",
            "Date": val(r.attendanceDate) || "-",
            "Status": val(r.status) || "-",
            "Remark": val(r.remark),
            "Locked": Number(r.isLocked) === 1 ? "Yes" : "No",
            "Marked By": val(r.markedByName) || "—",
            "Updated At": val(r.updatedAt),
            "Recorded At": val(r.createdAt)
        }));

        // ---- per-staff summary (any status outside the known set → Other) ----
        const map = {};
        records.forEach((r) => {
            const key = r.staffName || "(unknown)";
            if (!map[key]) {
                map[key] = { staff: key, role: val(r.role) || "-", days: 0, present: 0, absent: 0, leave: 0, other: 0 };
            }
            map[key].days += 1;
            const st = String(r.status || "").toLowerCase();
            if (st === "present") map[key].present += 1;
            else if (st === "absent") map[key].absent += 1;
            else if (st.includes("leave")) map[key].leave += 1;
            else map[key].other += 1;
        });
        const summary = Object.values(map)
            .sort((a, b) => a.staff.localeCompare(b.staff))
            .map((s) => ({
                "Staff": s.staff,
                "Role": s.role,
                "Days Marked": s.days,
                "Present": s.present,
                "Absent": s.absent,
                "Leave": s.leave,
                "Other Statuses": s.other
            }));

        const wb = XLSX.utils.book_new();
        addSheet(wb, "Staff Attendance", detail);
        addSheet(wb, "Per Staff Summary", summary);
        sendWorkbook(res, "Staff_Attendance", wb);
    } catch (error) {
        console.error("EXPORT staff attendance error:", error);
        res.status(500).json({ success: false, message: "Export failed." });
    }
};

// =====================================================
// 3) STUDENT ATTENDANCE — every record ever marked
// =====================================================
exports.exportStudentAttendance = async (req, res) => {
    try {
        const records = await db.allQuery(`
            SELECT
                sa.id, s.admissionNumber, s.satsNumber, s.rollNumber,
                s.studentName, s.className, sa.attendanceDate, sa.status,
                sa.remark, m.name AS markedByName, sa.updatedAt, sa.createdAt
            FROM student_attendance sa
            LEFT JOIN students s ON s.id = sa.studentId
            LEFT JOIN users m ON m.id = sa.markedBy
            ORDER BY sa.attendanceDate ASC, s.className ASC,
                     CAST(NULLIF(s.rollNumber,'') AS INTEGER) ASC, s.rollNumber ASC
        `);

        const detail = records.map((r) => ({
            "Id": r.id,
            "Date": val(r.attendanceDate) || "-",
            "Class": val(r.className) || "-",
            "Roll No": val(r.rollNumber) || "-",
            "Admission No": val(r.admissionNumber) || "-",
            "SATS No": val(r.satsNumber) || "-",
            "Student": val(r.studentName) || "-",
            "Status": val(r.status) || "-",
            "Remark": val(r.remark),
            "Marked By": val(r.markedByName) || "—",
            "Updated At": val(r.updatedAt),
            "Recorded At": val(r.createdAt)
        }));

        // ---- per-student summary ----
        const map = {};
        records.forEach((r) => {
            const key = r.studentId || 0;
            if (!map[key]) {
                map[key] = {
                    name: val(r.studentName) || "(unknown)",
                    className: val(r.className) || "-",
                    roll: val(r.rollNumber) || "-",
                    admission: val(r.admissionNumber) || "-",
                    sats: val(r.satsNumber) || "-",
                    days: 0, present: 0, absent: 0, leave: 0, other: 0
                };
            }
            map[key].days += 1;
            const st = String(r.status || "").toLowerCase();
            if (st === "present") map[key].present += 1;
            else if (st === "absent") map[key].absent += 1;
            else if (st.includes("leave")) map[key].leave += 1;
            else map[key].other += 1;
        });
        const summary = Object.values(map)
            .sort((a, b) =>
                a.className.localeCompare(b.className, undefined, { numeric: true }) ||
                String(a.roll).localeCompare(String(b.roll), undefined, { numeric: true }))
            .map((s) => ({
                "Class": s.className,
                "Roll No": s.roll,
                "Admission No": s.admission,
                "SATS No": s.sats,
                "Student": s.name,
                "Days Marked": s.days,
                "Present": s.present,
                "Absent": s.absent,
                "Leave": s.leave,
                "Other Statuses": s.other
            }));

        const wb = XLSX.utils.book_new();
        addSheet(wb, "Student Attendance", detail);
        addSheet(wb, "Per Student Summary", summary);
        sendWorkbook(res, "Student_Attendance", wb);
    } catch (error) {
        console.error("EXPORT student attendance error:", error);
        res.status(500).json({ success: false, message: "Export failed." });
    }
};

// =====================================================
// 4) EXAMS & RESULTS — exams, results, subject marks,
//    and the raw marks-entry data, each as a full sheet
// =====================================================
exports.exportExams = async (req, res) => {
    try {
        const cols = await studentsColumns();
        const penSel = cols.includes("penNumber") ? "s.penNumber," : "";

        const exams = await db.allQuery(`
            SELECT
                e.id, e.examName, e.className, e.status,
                cu.name AS createdByName, lu.name AS lockedByName, e.lockedAt,
                pu.name AS publishedByName, e.publishedAt, e.createdAt
            FROM exams e
            LEFT JOIN users cu ON cu.id = e.createdBy
            LEFT JOIN users lu ON lu.id = e.lockedBy
            LEFT JOIN users pu ON pu.id = e.publishedBy
            ORDER BY CAST(NULLIF(e.className,'') AS INTEGER) ASC, e.className ASC, e.id ASC
        `);

        const results = await db.allQuery(`
            SELECT
                e.examName, e.className, s.rollNumber, s.studentName,
                s.admissionNumber, s.satsNumber, ${penSel}
                er.totalObtained, er.totalMax, er.percentage, er.grade,
                er.overallStatus, er.version, er.publishedAt
            FROM exam_results er
            INNER JOIN exams e ON e.id = er.examId
            INNER JOIN students s ON s.id = er.studentId
            ORDER BY CAST(NULLIF(e.className,'') AS INTEGER) ASC, e.className ASC,
                     e.examName ASC, CAST(NULLIF(s.rollNumber,'') AS INTEGER) ASC, s.rollNumber ASC
        `);
        const resultRows = results.map((r) => ({
            "Exam": val(r.examName) || "-",
            "Class": val(r.className) || "-",
            "Roll No": val(r.rollNumber) || "-",
            "Admission No": val(r.admissionNumber) || "-",
            "SATS No": val(r.satsNumber) || "-",
            "PEN": val(r.penNumber),
            "Student": val(r.studentName) || "-",
            "Total Obtained": val(r.totalObtained),
            "Total Max": val(r.totalMax),
            "Percentage": val(r.percentage),
            "Grade": val(r.grade) || "-",
            "Result Status": val(r.overallStatus) || "-",
            "Result Version": val(r.version),
            "Published At": val(r.publishedAt)
        }));

        const subjects = await db.allQuery(`
            SELECT
                e.examName, e.className, s.rollNumber, s.studentName,
                ers.subjectName, ers.maxMarks, ers.passMarks, ers.marksObtained,
                ers.markStatus, ers.grade, ers.subjectPass
            FROM exam_result_subjects ers
            INNER JOIN exam_results er ON er.id = ers.resultId
            INNER JOIN exams e ON e.id = er.examId
            INNER JOIN students s ON s.id = er.studentId
            ORDER BY e.examName ASC, e.className ASC,
                     CAST(NULLIF(s.rollNumber,'') AS INTEGER) ASC, ers.id ASC
        `);
        const subjectRows = subjects.map((r) => ({
            "Exam": val(r.examName) || "-",
            "Class": val(r.className) || "-",
            "Roll No": val(r.rollNumber) || "-",
            "Student": val(r.studentName) || "-",
            "Subject": val(r.subjectName) || "-",
            "Marks Obtained": val(r.marksObtained),
            "Max Marks": val(r.maxMarks),
            "Pass Marks": val(r.passMarks),
            "Mark Status": val(r.markStatus) || "-",
            "Grade": val(r.grade) || "-",
            "Subject Pass": r.subjectPass === 1 ? "Yes" : r.subjectPass === 0 ? "No" : ""
        }));

        const raw = await db.allQuery(`
            SELECT
                e.examName, e.className, s.rollNumber, s.studentName,
                sub.subjectName, em.marksObtained, em.isAbsent,
                u.name AS updatedByName, em.updatedAt
            FROM exam_marks em
            INNER JOIN exams e ON e.id = em.examId
            INNER JOIN students s ON s.id = em.studentId
            LEFT JOIN subjects sub ON sub.id = em.subjectId
            LEFT JOIN users u ON u.id = em.updatedBy
            ORDER BY e.examName ASC, e.className ASC, s.rollNumber ASC, sub.subjectName ASC
        `);
        const rawRows = raw.map((r) => ({
            "Exam": val(r.examName) || "-",
            "Class": val(r.className) || "-",
            "Roll No": val(r.rollNumber) || "-",
            "Student": val(r.studentName) || "-",
            "Subject": val(r.subjectName) || "-",
            "Marks Obtained": val(r.marksObtained),
            "Absent": Number(r.isAbsent) === 1 ? "Yes" : "No",
            "Updated By": val(r.updatedByName) || "—",
            "Updated At": val(r.updatedAt)
        }));

        const examRows = exams.map((e) => ({
            "Id": e.id,
            "Exam": val(e.examName) || "-",
            "Class": val(e.className) || "-",
            "Status": val(e.status) || "-",
            "Created By": val(e.createdByName) || "—",
            "Locked By": val(e.lockedByName) || "—",
            "Locked At": val(e.lockedAt),
            "Published By": val(e.publishedByName) || "—",
            "Published At": val(e.publishedAt),
            "Created At": val(e.createdAt)
        }));

        const wb = XLSX.utils.book_new();
        addSheet(wb, "Exams", examRows);
        addSheet(wb, "Results Master", resultRows);
        addSheet(wb, "Subject Marks", subjectRows);
        addSheet(wb, "Raw Marks Entry", rawRows);
        sendWorkbook(res, "Exams_Results", wb);
    } catch (error) {
        console.error("EXPORT exams error:", error);
        res.status(500).json({ success: false, message: "Export failed." });
    }
};

// =====================================================
// 5) PAYMENTS — every payment (incl. reversed, flagged)
//    plus the component-wise line items on their own sheet
// =====================================================
exports.exportPayments = async (req, res) => {
    try {
        const payments = await db.allQuery(`
            SELECT
                p.id, p.paymentDate, p.amount, p.paymentMode, p.remarks, p.status,
                s.admissionNumber, s.rollNumber, s.studentName, s.className,
                s.fatherName, s.satsNumber,
                p.voidedAt, v.name AS voidedByName, p.voidReason
            FROM payments p
            LEFT JOIN students s ON s.id = p.studentId
            LEFT JOIN users v ON v.id = p.voidedBy
            ORDER BY p.paymentDate DESC, p.id DESC
        `);
        const paymentRows = payments.map((p, i) => ({
            "Sl No": i + 1,
            "Receipt No": `REC-${p.id}`,
            "Date": val(p.paymentDate) || "-",
            "Class": val(p.className) || "-",
            "Roll No": val(p.rollNumber) || "-",
            "Admission No": val(p.admissionNumber) || "-",
            "SATS No": val(p.satsNumber) || "-",
            "Student": val(p.studentName) || "-",
            "Father": val(p.fatherName) || "-",
            "Amount Paid (Rs.)": val(p.amount),
            "Mode": val(p.paymentMode) || "Cash",
            "Remarks": val(p.remarks),
            "Status": val(p.status) || "completed",
            "Voided By": val(p.voidedByName) || "",
            "Void Reason": val(p.voidReason)
        }));

        const lineItems = await db.allQuery(`
            SELECT
                p.id AS paymentId, p.paymentDate, s.studentName, s.className,
                li.componentName, li.amount
            FROM payment_line_items li
            INNER JOIN payments p ON p.id = li.paymentId
            LEFT JOIN students s ON s.id = p.studentId
            ORDER BY p.paymentDate DESC, p.id DESC, li.id ASC
        `);
        const lineRows = lineItems.map((r) => ({
            "Receipt No": `REC-${r.paymentId}`,
            "Payment Date": val(r.paymentDate) || "-",
            "Class": val(r.className) || "-",
            "Student": val(r.studentName) || "-",
            "Fee Component": val(r.componentName) || "-",
            "Amount (Rs.)": val(r.amount)
        }));

        const wb = XLSX.utils.book_new();
        addSheet(wb, "Payments", paymentRows);
        addSheet(wb, "Payment Line Items", lineRows);
        sendWorkbook(res, "Payments", wb);
    } catch (error) {
        console.error("EXPORT payments error:", error);
        res.status(500).json({ success: false, message: "Export failed." });
    }
};

// =====================================================
// 6) EXPENSES — every expense, every column
// =====================================================
exports.exportExpenses = async (req, res) => {
    try {
        const expenses = await db.allQuery(
            `SELECT * FROM expenses ORDER BY expenseDate DESC, id DESC`
        );
        const HEADER = {
            id: "Voucher Id",
            expenseName: "Expense",
            category: "Category",
            amount: "Amount (Rs.)",
            expenseDate: "Date",
            paymentMode: "Mode",
            paidTo: "Paid To",
            description: "Description",
            status: "Status",
            voidedAt: "Voided At",
            voidedBy: "Voided By",
            voidReason: "Void Reason",
            createdAt: "Created At"
        };
        const rows = expenses.map((e) => {
            const row = {};
            Object.keys(e).forEach((k) => {
                row[HEADER[k] || k] = val(e[k]);
            });
            return row;
        });

        const wb = XLSX.utils.book_new();
        addSheet(wb, "Expenses", rows);
        sendWorkbook(res, "Expenses", wb);
    } catch (error) {
        console.error("EXPORT expenses error:", error);
        res.status(500).json({ success: false, message: "Export failed." });
    }
};
