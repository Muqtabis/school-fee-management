// =====================================================
// MARKSHEET / REPORT CARD PDF GENERATOR
//
// Renders a one-page report card per student for a given
// exam from a PRE-COMPUTED result model (see
// utils/grading.computeStudentResult) so the PDF, the
// stored snapshot and the on-screen preview all agree.
// It uses each subject's EXAM-SPECIFIC max marks and the
// admin-defined pass mark.
//
// ONE shared renderer, two sinks:
//   generateMarksheetBuffer(data) -> Promise<Buffer>
//       in-memory; nothing is written to disk. Used by the
//       "Download Report Card" button (no-storage flow).
//   generateMarksheet(data) -> Promise<filePath>
//       writes into backend/reports/. Legacy path kept for
//       the WhatsApp delivery flow that needs a file/URL.
//
// Uses pdfkit (already a project dependency).
// =====================================================

const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const REPORTS_DIR = path.join(__dirname, "..", "reports");


function ensureReportsDir() {
    if (!fs.existsSync(REPORTS_DIR)) {
        fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }
}


function safeName(value) {
    return String(value || "")
        .replace(/[^a-z0-9._-]+/gi, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 60);
}

// How a subject cell prints given its mark status.
function cellText(sr) {
    switch (sr.markStatus) {
        case "absent": return "AB";
        case "exempted": return "EX";
        case "medical_leave": return "ML";
        case "not_applicable": return "NA";
        default: return String(sr.marksObtained ?? 0);
    }
}

function resultText(sr) {
    if (sr.markStatus === "absent") return "Absent";
    if (sr.subjectPass === null) return "-";
    return sr.subjectPass ? "Pass" : "Fail";
}

function overallText(overallStatus) {
    if (overallStatus === "absent") return "Incomplete (absent in one or more subjects)";
    if (overallStatus === "fail") return "FAIL";
    return "PASS";
}

// =====================================================
// SHARED RENDERER
//
// Draws the whole one-page report card onto an already-
// created PDFDocument. The caller owns the sink (a file
// stream, or an in-memory buffer) and calls doc.end().
//
// data = {
//   exam:    { id, examName, className, examType, academicYear },
//   student: { id, studentName, rollNumber, className },
//   result:  { subjectResults:[{ subjectName, maxMarks, passMarks,
//                marksObtained, markStatus, grade, subjectPass }],
//              totalObtained, totalMax, percentage, grade, overallStatus },
//   meta:    { schoolName, publishedAt, remarks, attendance }
// }
// =====================================================
function renderMarksheet(doc, data) {

    const { exam, student, result, meta = {} } = data;
    const schoolName = meta.schoolName || "The Age School";
    const subjectResults = (result && result.subjectResults) || [];

    // ---- Header ----
    doc.fontSize(20).font("Helvetica-Bold").text(schoolName, { align: "center" });
    doc.moveDown(0.2).fontSize(12).font("Helvetica").text("Statement of Marks", { align: "center" });

    const titleBits = [exam.examName];
    if (exam.examType) titleBits.push(`(${String(exam.examType).replace(/_/g, " ")})`);
    doc.moveDown(0.2).fontSize(12).font("Helvetica-Bold").text(titleBits.join(" "), { align: "center" });
    if (exam.academicYear) {
        doc.moveDown(0.1).fontSize(10).font("Helvetica").text(`Academic Year: ${exam.academicYear}`, { align: "center" });
    }
    doc.moveDown(1);

    // ---- Student details ----
    const detailTop = doc.y;
    doc.fontSize(11).font("Helvetica");
    doc.text(`Name: ${student.studentName || "-"}`, 50, detailTop);
    doc.text(`Class: ${student.className || exam.className || "-"}`, 320, detailTop);
    doc.text(`Roll No: ${student.rollNumber || "-"}`, 50, detailTop + 18);
    if (meta.attendance) {
        doc.text(`Attendance: ${meta.attendance}`, 320, detailTop + 18);
    }
    doc.moveDown(2.4);

    // ---- Marks table ----
    const tableTop = doc.y + 5;
    const colSubject = 50;
    const colMarks = 300;
    const colMax = 370;
    const colGrade = 440;
    const colResult = 500;

    doc.font("Helvetica-Bold").fontSize(11);
    doc.text("Subject", colSubject, tableTop);
    doc.text("Marks", colMarks, tableTop);
    doc.text("Max", colMax, tableTop);
    doc.text("Grade", colGrade, tableTop);
    doc.text("Result", colResult, tableTop);
    doc.moveTo(colSubject, tableTop + 15).lineTo(545, tableTop + 15).stroke();

    let y = tableTop + 22;
    doc.font("Helvetica").fontSize(11);
    subjectResults.forEach((sr) => {
        doc.text(sr.subjectName || "-", colSubject, y, { width: 240 });
        doc.text(cellText(sr), colMarks, y);
        doc.text(String(sr.maxMarks ?? "-"), colMax, y);
        doc.text(sr.grade || "-", colGrade, y);
        doc.text(resultText(sr), colResult, y);
        y += 20;
    });

    doc.moveTo(colSubject, y).lineTo(545, y).stroke();
    y += 8;

    // ---- Totals ----
    doc.font("Helvetica-Bold").fontSize(11);
    doc.text("Total", colSubject, y);
    doc.text(String(result.totalObtained ?? 0), colMarks, y);
    doc.text(String(result.totalMax ?? 0), colMax, y);

    y += 22;
    doc.font("Helvetica").fontSize(11);
    doc.text(`Percentage: ${Number(result.percentage || 0).toFixed(2)}%`, colSubject, y);
    if (result.grade) doc.text(`Overall Grade: ${result.grade}`, colGrade - 60, y);

    y += 18;
    doc.font("Helvetica-Bold").text(`Overall Result: ${overallText(result.overallStatus)}`, colSubject, y);

    if (meta.remarks) {
        y += 20;
        doc.font("Helvetica").fontSize(10).text(`Remarks: ${meta.remarks}`, colSubject, y, { width: 495 });
    }

    // ---- Footer ----
    const publishLine = meta.publishedAt
        ? `Published on ${new Date(meta.publishedAt).toLocaleDateString()}`
        : `Generated on ${new Date().toLocaleString()}`;
    doc.font("Helvetica-Oblique").fontSize(9)
        .text(publishLine, 50, 780, { align: "center", width: 495 });
}

// =====================================================
// IN-MEMORY: resolve to a Buffer, nothing touches disk.
// =====================================================
function generateMarksheetBuffer(data) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: "A4", margin: 50 });
            const chunks = [];
            doc.on("data", (c) => chunks.push(c));
            doc.on("end", () => resolve(Buffer.concat(chunks)));
            doc.on("error", reject);
            renderMarksheet(doc, data);
            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}


// =====================================================
// LEGACY: write into backend/reports/ and resolve to the
// absolute file path. Kept for the WhatsApp delivery flow.
// =====================================================
function generateMarksheet(data) {
    return new Promise((resolve, reject) => {
        try {
            ensureReportsDir();
            const { exam, student } = data;
            const fileName =
                `marksheet_exam${exam.id}_student${student.id}_` +
                `${safeName(student.rollNumber || student.studentName)}.pdf`;
            const filePath = path.join(REPORTS_DIR, fileName);

            const doc = new PDFDocument({ size: "A4", margin: 50 });
            const stream = fs.createWriteStream(filePath);
            stream.on("error", reject);
            stream.on("finish", () => resolve(filePath));
            doc.pipe(stream);
            renderMarksheet(doc, data);
            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}


module.exports = {
    generateMarksheet,
    generateMarksheetBuffer,
    REPORTS_DIR
};
