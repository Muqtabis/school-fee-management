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
// COMPREHENSIVE PROGRESS CARD (Term / Final)
//
// Drawn as a manual coordinate grid (PDFKit has no row/col
// span). data = { exam, student, model, meta } where model
// comes from utils/progressCard.buildProgressCardModel.
// =====================================================

const PAGE_LEFT = 40;
const PAGE_RIGHT = 555;
const PAGE_WIDTH = PAGE_RIGHT - PAGE_LEFT; // usable width

// Visual theme — restrained, editorial monochrome (premium through typography
// and whitespace, not color). One charcoal ink, neutral gray fills, hairlines.
const ACCENT = "#20242a";        // charcoal ink: body data text, borders base
const PRIMARY = "#6e1b2a";       // deep maroon: school name, headings, rules, frame
const ACCENT_SOFT = "#20242a";   // (kept for API compatibility; no gradient now)
const GOLD = "#8a8f98";          // (kept name) muted slate used only for fine rules
const ACCENT_LIGHT = "#f1f1ee";  // light neutral gray for table-header fills
const HEADER_FILL = "#f1f1ee";   // table-header row fill
const HEADER_TEXT = "#20242a";   // header text (dark on light fill)
const ZEBRA = "#f8f8f5";         // ultra-faint neutral alternate-row stripe
const BORDER = "#dcdcd7";        // hairline grid lines
const MUTED = "#808080";         // secondary text
const LOGO_PATH = path.join(__dirname, "..", "assets", "logo.png");

// Parse a date of birth that may be stored day-first (DD.MM.YYYY, DD/MM/YYYY,
// DD-MM-YYYY — the format in this school's data) or in a native-parseable form
// (ISO YYYY-MM-DD etc.). Returns a Date or null.
function parseDob(dob) {
    if (!dob) return null;
    const s = String(dob).trim();
    const m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
    if (m) {
        const day = +m[1], mon = +m[2], yr = +m[3];
        if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) {
            const d = new Date(yr, mon - 1, day);
            if (!isNaN(d.getTime())) return d;
        }
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}

function ageFromDob(dob) {
    const d = parseDob(dob);
    if (!d) return "";
    const now = new Date();
    let a = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
    return a >= 0 && a < 120 ? String(a) : "";
}

// Draw one bordered table row across colWidths at (x,y). Returns next y.
// opts.aligns = per-column alignment (overrides opts.align); padding is 4px.
function drawRow(doc, x, y, colWidths, cells, opts = {}) {
    const h = opts.height || 18;
    const bold = opts.bold ? "Helvetica-Bold" : "Helvetica";
    const size = opts.size || 8;
    const fill = opts.fill;
    const border = opts.border || BORDER;
    const color = opts.color || "#000";
    const aligns = opts.aligns || null;
    let cx = x;
    doc.font(bold).fontSize(size);
    for (let i = 0; i < colWidths.length; i++) {
        const w = colWidths[i];
        if (fill) doc.rect(cx, y, w, h).fill(fill);
        doc.lineWidth(0.6).strokeColor(border).rect(cx, y, w, h).stroke();
        const txt = cells[i] == null ? "" : String(cells[i]);
        const al = aligns ? (aligns[i] || "center") : (opts.align || "center");
        doc.fillColor(color).text(txt, cx + 4, y + (h - size) / 2 - 1, {
            width: w - 8, align: al, lineBreak: false, ellipsis: true
        });
        cx += w;
    }
    doc.strokeColor("#000").lineWidth(1);
    return y + h;
}

// A styled section heading: charcoal label with a full-width hairline rule
// beneath (editorial look — restraint over colour).
function section(doc, title, y) {
    doc.fillColor(PRIMARY).fontSize(9.5).font("Helvetica-Bold")
        .text(title.toUpperCase(), PAGE_LEFT, y, { characterSpacing: 0.8 });
    doc.moveTo(PAGE_LEFT, y + 13).lineTo(PAGE_RIGHT, y + 13).lineWidth(0.8).strokeColor(PRIMARY).stroke();
    doc.strokeColor("#000").lineWidth(1).fillColor("#000");
    return y + 19;
}

// PROGRESS_CARD_BODY

function pcHeader(doc, data) {
    const { exam, meta = {} } = data;
    const trust = meta.trustName || "Al Asr Educational Trust (R)";
    const school = meta.schoolName || "THE AGE SCHOOL";
    const addr = meta.schoolAddress || "Basavakalyan, Dist. Bidar - 585327";
    const topY = 32;

    // School logo, top-left; the heading text stays centered across the page.
    if (fs.existsSync(LOGO_PATH)) {
        try { doc.image(LOGO_PATH, PAGE_LEFT, topY, { fit: [56, 56] }); } catch (_) { /* logo optional */ }
    }

    doc.fillColor(MUTED).fontSize(10).font("Helvetica")
        .text(trust, PAGE_LEFT, topY + 2, { width: PAGE_WIDTH, align: "center", characterSpacing: 0.5 });
    doc.fillColor(PRIMARY).fontSize(19).font("Helvetica-Bold")
        .text(school, PAGE_LEFT, doc.y + 1, { width: PAGE_WIDTH, align: "center", characterSpacing: 1 });
    doc.fillColor(MUTED).fontSize(9).font("Helvetica")
        .text(addr, { width: PAGE_WIDTH, align: "center" });
    if (meta.affiliation) doc.text(meta.affiliation, { width: PAGE_WIDTH, align: "center" });

    let y = Math.max(doc.y, topY + 56) + 10;
    // Title — centered, letter-spaced, framed by two hairline rules (no fill).
    doc.moveTo(PAGE_LEFT, y).lineTo(PAGE_RIGHT, y).lineWidth(1).strokeColor(PRIMARY).stroke();
    doc.fillColor(PRIMARY).fontSize(10.5).font("Helvetica-Bold")
        .text("STUDENT ACADEMIC PROGRESS CARD", PAGE_LEFT, y + 5, { width: PAGE_WIDTH, align: "center", characterSpacing: 2 });
    y = doc.y + 4;
    doc.moveTo(PAGE_LEFT, y).lineTo(PAGE_RIGHT, y).lineWidth(0.5).strokeColor(BORDER).stroke();
    doc.strokeColor("#000").lineWidth(1);
    y += 4;
    if (exam.academicYear) {
        doc.fillColor(MUTED).fontSize(9).font("Helvetica")
            .text(`Academic Year: ${exam.academicYear}`, PAGE_LEFT, y + 2, { width: PAGE_WIDTH, align: "center" });
        y = doc.y;
    }
    doc.fillColor("#000");
    return y + 8;
}

// Two-column profile grid.
function pcProfile(doc, data, y) {
    const { student = {}, exam } = data;
    y = section(doc, "Student Details", y);
    const rows = [
        [`Name: ${student.studentName || "-"}`, `Class/Sec: ${student.className || exam.className || "-"}${student.section ? " / " + student.section : ""}`],
        [`Father's Name: ${student.fatherName || "-"}`, `Roll No: ${student.rollNumber || "-"}`],
        [`Mother's Name: ${student.motherName || "-"}`, `Adm No: ${student.admissionNumber || "-"}`],
        [`DOB: ${student.dob || "-"}   Age: ${ageFromDob(student.dob) || "-"}`, `SATS No: ${student.satsNumber || "-"}`],
        [`Gender: ${student.gender || "-"}`, `Phone: ${student.contact1 || "-"}`],
        [`Address: ${student.address || "-"}`, ""]
    ];
    const half = PAGE_WIDTH / 2;
    let ry = y;
    for (const r of rows) ry = drawRow(doc, PAGE_LEFT, ry, [half, half], r, { align: "left", size: 9, height: 16 });
    return ry + 8;
}

// PROGRESS_CARD_TERMS

function ensureSpace(doc, y, need) {
    if (y + need > 800) { doc.addPage(); return 50; }
    return y;
}

function cellMarks(cell) {
    if (!cell) return "NA";
    if (cell.status === "absent") return "AB";
    if (cell.status === "exempted") return "EX";
    if (cell.status === "medical_leave") return "ML";
    if (cell.status === "not_applicable") return "NA";
    if (cell.obtained == null) return "-";
    return `${cell.obtained}/${cell.max}`;
}

function pcTerm(doc, term, y) {
    y = ensureSpace(doc, y, 60);
    y = section(doc, `${term.label} — Scholastic`, y);

    const asmts = term.assessments || [];
    const subjCol = 108;
    const tailCols = 2; // Aggregate %, Grade
    const dynCount = asmts.length + tailCols;
    const dynW = Math.max(38, (PAGE_WIDTH - subjCol) / dynCount);
    const colWidths = [subjCol, ...asmts.map(() => dynW), dynW, dynW];

    const header = ["Subject", ...asmts.map((a) => a.examName), "Aggregate %", "Grade"];
    y = drawRow(doc, PAGE_LEFT, y, colWidths, header, { bold: true, fill: HEADER_FILL, color: PRIMARY, height: 22, size: 7 });

    const bodyAligns = colWidths.map((_, i) => (i === 0 ? "left" : "center"));
    term.subjects.forEach((s, idx) => {
        y = ensureSpace(doc, y, 18);
        const row = [s.subjectName, ...asmts.map((a) => cellMarks(s.cells[a.examId])),
            s.aggregatePercent == null ? "-" : s.aggregatePercent, s.aggregateGrade || "-"];
        y = drawRow(doc, PAGE_LEFT, y, colWidths, row, { aligns: bodyAligns, size: 8, height: 16, fill: idx % 2 ? ZEBRA : null });
    });
    y += 10;

    // Co-scholastic
    if (term.coScholastic && term.coScholastic.length) {
        y = ensureSpace(doc, y, 50);
        y = section(doc, `${term.label} — Co-Scholastic`, y);
        const cw = [PAGE_WIDTH * 0.6, PAGE_WIDTH * 0.4];
        y = drawRow(doc, PAGE_LEFT, y, cw, ["Area", "Grade"], { bold: true, fill: HEADER_FILL, color: PRIMARY, height: 18, size: 8 });
        term.coScholastic.forEach((cs, idx) => {
            y = drawRow(doc, PAGE_LEFT, y, cw, [cs.area, cs.aggregateGrade || "-"], { aligns: ["left", "center"], size: 8, height: 16, fill: idx % 2 ? ZEBRA : null });
        });
        y += 8;
    }

    y = pcTermMeta(doc, term, y);
    return y + 10;
}

function pcTermMeta(doc, term, y) {
    const m = term.meta || {};
    y = ensureSpace(doc, y, 40);
    const half = PAGE_WIDTH / 2;
    const att = (m.workingDays != null || m.daysAttended != null)
        ? `Attendance: ${m.daysAttended ?? "-"} / ${m.workingDays ?? "-"} days`
        : "Attendance: - / - days";
    const stature = `Height: ${m.heightCm != null ? m.heightCm + " cm" : "-"}   Weight: ${m.weightKg != null ? m.weightKg + " kg" : "-"}`;
    y = drawRow(doc, PAGE_LEFT, y, [half, half], [att, stature], { align: "left", size: 8, height: 16 });
    if (m.remark) {
        y = drawRow(doc, PAGE_LEFT, y, [PAGE_WIDTH], [`Class Teacher's Remark: ${m.remark}`], { align: "left", size: 8, height: 16 });
    }
    if (m.promotionStatus) {
        const promo = m.promotedToClass
            ? `Result: ${m.promotionStatus} — Promoted to ${m.promotedToClass}`
            : `Result: ${m.promotionStatus}`;
        y = drawRow(doc, PAGE_LEFT, y, [PAGE_WIDTH], [promo], { align: "left", size: 8, height: 16, bold: true });
    }
    return y;
}

function pcFinal(doc, final, y) {
    if (!final) return y;
    y = ensureSpace(doc, y, 60);
    y = section(doc, "Final Average (Term I 50% + Term II 50%)", y);
    const c0 = 150;
    const rest = (PAGE_WIDTH - c0) / 4;
    const cw = [c0, rest, rest, rest, rest];
    y = drawRow(doc, PAGE_LEFT, y, cw, ["Subject", "Term I %", "Term II %", "Final %", "Grade"], { bold: true, fill: HEADER_FILL, color: PRIMARY, height: 20, size: 8 });
    final.subjects.forEach((s, idx) => {
        y = ensureSpace(doc, y, 16);
        y = drawRow(doc, PAGE_LEFT, y, cw,
            [s.subjectName, s.termIPercent ?? "-", s.termIIPercent ?? "-", s.finalPercent ?? "-", s.grade || "-"],
            { aligns: ["left", "center", "center", "center", "center"], size: 8, height: 16, fill: idx % 2 ? ZEBRA : null });
    });
    y += 4;
    y = drawRow(doc, PAGE_LEFT, y, [c0 + rest * 2, rest, rest],
        ["Overall", final.aggregatePercent ?? "-", final.grade || "-"], { bold: true, fill: HEADER_FILL, color: PRIMARY, height: 18, size: 8, aligns: ["left", "center", "center"] });
    const fm = final.meta || {};
    if (fm.promotionStatus) {
        y += 4;
        const promo = fm.promotedToClass
            ? `Result: ${fm.promotionStatus} — Promoted to ${fm.promotedToClass}`
            : `Result: ${fm.promotionStatus}`;
        y = drawRow(doc, PAGE_LEFT, y, [PAGE_WIDTH], [promo], { align: "left", size: 9, height: 18, bold: true });
    }
    return y + 8;
}

// Grading reference — condensed to a single compact legend line (the full
// three-column table was visually heavy and dominated the card).
function pcGrading(doc, bands, y) {
    if (!bands || !bands.length) return y;
    y = ensureSpace(doc, y, 26);
    const parts = bands.map((b) => `${b.grade} ${b.minPercent}-${b.maxPercent == null ? 100 : b.maxPercent}`);
    doc.fillColor(MUTED).fontSize(7.5).font("Helvetica-Oblique");
    doc.text("Grading Scale:  " + parts.join("    "), PAGE_LEFT, y, { width: PAGE_WIDTH, align: "left" });
    doc.fillColor("#000").font("Helvetica");
    return doc.y + 4;
}

// Signature line + generation stamp, anchored near the page foot.
function pcFooter(doc, y) {
    y = ensureSpace(doc, y, 70);
    y = Math.max(y + 26, 760);
    const third = PAGE_WIDTH / 3;
    const labels = ["Class Teacher", "Principal", "Parent / Guardian"];
    doc.lineWidth(0.6).strokeColor("#999999");
    for (let i = 0; i < 3; i++) {
        const cx = PAGE_LEFT + i * third;
        doc.moveTo(cx + 12, y).lineTo(cx + third - 12, y).stroke();
        doc.fillColor("#000").fontSize(8).font("Helvetica").text(labels[i], cx, y + 3, { width: third, align: "center" });
    }
    doc.strokeColor("#000").lineWidth(1);
    doc.fillColor(MUTED).fontSize(7).font("Helvetica-Oblique")
        .text(`Generated on ${new Date().toLocaleDateString()}`, PAGE_LEFT, y + 20, { width: PAGE_WIDTH, align: "center" });
    doc.fillColor("#000").font("Helvetica");
    return y;
}

function renderProgressCard(doc, data) {
    const { model } = data;
    // A single restrained hairline frame.
    doc.save();
    doc.roundedRect(28, 22, 539, 798, 4).lineWidth(0.8).strokeColor(PRIMARY).stroke();
    doc.restore();
    doc.strokeColor("#000").lineWidth(1).fillColor("#000");
    let y = pcHeader(doc, data);
    y = pcProfile(doc, data, y);
    for (const term of (model.terms || [])) y = pcTerm(doc, term, y);
    if (model.final) y = pcFinal(doc, model.final, y);
    y = pcGrading(doc, model.bands, y);
    pcFooter(doc, y);
}

function generateProgressCardBuffer(data) {
    return new Promise((resolve, reject) => {
        try {
            // Faithful 4-page CCE booklet renderer (school's printed format).
            const { renderProgressCard: renderBooklet } = require("./progressCardPdf");
            const doc = new PDFDocument({ size: "A4", margin: 40, autoFirstPage: true });
            const chunks = [];
            doc.on("data", (c) => chunks.push(c));
            doc.on("end", () => resolve(Buffer.concat(chunks)));
            doc.on("error", reject);
            renderBooklet(doc, data);
            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

// Single-page blue card for a Formative Assessment (unit_test) download.
function generateFaCardBuffer(data) {
    return new Promise((resolve, reject) => {
        try {
            const { renderSingleCard } = require("./progressCardPdf");
            const doc = new PDFDocument({ size: "A4", margin: 40, autoFirstPage: true });
            const chunks = [];
            doc.on("data", (c) => chunks.push(c));
            doc.on("end", () => resolve(Buffer.concat(chunks)));
            doc.on("error", reject);
            renderSingleCard(doc, data);
            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

// All students' cards for one exam, back-to-back in a single PDF (class print).
// entries = [{ student, model }]; `single` picks the FA card vs the booklet.
function generateCombinedCardsBuffer({ exam, entries, meta, single }) {
    return new Promise((resolve, reject) => {
        try {
            const { renderProgressCard, renderSingleCard } = require("./progressCardPdf");
            const doc = new PDFDocument({ size: "A4", margin: 40, autoFirstPage: true });
            const chunks = [];
            doc.on("data", (c) => chunks.push(c));
            doc.on("end", () => resolve(Buffer.concat(chunks)));
            doc.on("error", reject);
            const list = entries || [];
            if (list.length === 0) {
                doc.fontSize(12).text("No students to report.", 50, 60);
            } else {
                list.forEach((en, i) => {
                    if (i > 0) doc.addPage(); // fresh page before each student's card
                    const data = { exam, student: en.student, model: en.model, meta };
                    if (single) renderSingleCard(doc, data);
                    else renderProgressCard(doc, data);
                });
            }
            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

// Write a single student's NEW card (FA single page or term/final booklet) to
// a file in REPORTS_DIR and return its path — for the WhatsApp delivery flow,
// which needs a fetchable file/URL (MSG91 document link). `single` picks the FA
// card vs the booklet. Mirrors generateMarksheet's file output contract.
async function generateCardFile(data) {
    const { renderProgressCard, renderSingleCard } = require("./progressCardPdf");
    ensureReportsDir();
    const buf = await new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", margin: 40, autoFirstPage: true });
        const chunks = [];
        doc.on("data", (c) => chunks.push(c));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
        if (data.single) renderSingleCard(doc, data);
        else renderProgressCard(doc, data);
        doc.end();
    });
    const exam = data.exam || {};
    const student = data.student || {};
    const fileName = `ReportCard_exam${exam.id}_student${student.id}_${Date.now()}.pdf`;
    const filePath = path.join(REPORTS_DIR, fileName);
    fs.writeFileSync(filePath, buf);
    return filePath;
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
    generateProgressCardBuffer,
    generateFaCardBuffer,
    generateCombinedCardsBuffer,
    generateCardFile,
    REPORTS_DIR
};
