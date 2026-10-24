// =====================================================
// PROGRESS CARD PDF — faithful to the school's printed
// CCE booklet (The Age School). Four sides:
//   1. Cover + student profile
//   2. I Term  — scholastic + co-scholastic
//   3. II Term — scholastic + co-scholastic
//   4. Average result + promotion + grading system
//
// Royal-blue headers, pink-red term banners, shield logo.
// Rendered from utils/progressCard.buildProgressCardModel.
// =====================================================

const fs = require("fs");
const path = require("path");

const LOGO_PATH = path.join(__dirname, "..", "assets", "logo.png");

// ---- Palette (matches the printed card) ----
const BLUE = "#2730a0";       // royal blue: table headers, pills, labels
const BLUE_DK = "#1b2170";    // darker blue (shield / strong accents)
const BLUE_SOFT = "#eef0fb";  // pale blue cell tint
const BANNER_A = "#ec3f63";   // term banner gradient (start)
const BANNER_B = "#f4808f";   // term banner gradient (end)
const INK = "#20306e";        // dark-blue body/label text
const GRID = "#9aa2dc";       // blue table grid lines
const WHITE = "#ffffff";
const MUTED = "#6b6b6b";

// Fixed template rows (the printed form lists these verbatim).
const SUBJECTS = ["English", "Kannada", "Urdu / Hindi", "Mathematics", "Science / EVS", "Social Science", "Gen. Knowledge"];
const CO_AREAS = ["Art Education", "Physical & Health Education", "Work Experience", "Attitude and Values"];

// Map a data subject name onto a fixed template row (case/alias-insensitive).
function normSubject(name) {
    const n = String(name || "").trim().toLowerCase();
    if (/eng/.test(n)) return "English";
    if (/kann/.test(n)) return "Kannada";
    if (/urdu|hindi/.test(n)) return "Urdu / Hindi";
    if (/math/.test(n)) return "Mathematics";
    if (/sci|evs/.test(n)) return "Science / EVS";
    if (/social|sst|^soc/.test(n)) return "Social Science";
    if (/g\.?\s*k|general|knowledge/.test(n)) return "Gen. Knowledge";
    return null;
}

// Grading bands exactly as printed on the card's GRADING SYSTEM table.
// Threshold = minimum value for the grade on each weighting column.
const GRADE_ROWS = [
    { g: "A+", t: { 10: 9, 15: 13.5, 20: 18, 30: 27, 50: 45, 100: 90 }, perf: "Outstanding", res: "Distinction" },
    { g: "A", t: { 10: 7, 15: 10.5, 20: 14, 30: 21, 50: 35, 100: 70 }, perf: "Excellent", res: "First Division" },
    { g: "B+", t: { 10: 5, 15: 7.5, 20: 10, 30: 15, 50: 25, 100: 50 }, perf: "Very Good", res: "Second Division" },
    { g: "B", t: { 10: 3, 15: 4.5, 20: 6, 30: 9, 50: 15, 100: 30 }, perf: "Good", res: "Third Division" },
    { g: "C", t: { 10: 1, 15: 1, 20: 1, 30: 1, 50: 1, 100: 1 }, perf: "Poor", res: "Scope for Improvement" }
];

// Grade for a value on a given weighting scale (10/15/20/30/50/100).
function gradeFor(value, scale) {
    if (value == null || isNaN(value)) return "";
    for (const r of GRADE_ROWS) if (value >= r.t[scale]) return r.g;
    return "";
}

function parseDob(dob) {
    if (!dob) return null;
    const s = String(dob).trim();
    const m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
    if (m) {
        const d = new Date(+m[3], +m[2] - 1, +m[1]);
        if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}
function ageFromDob(dob) {
    const d = parseDob(dob);
    if (!d) return "";
    const now = new Date();
    let a = now.getFullYear() - d.getFullYear();
    const mo = now.getMonth() - d.getMonth();
    if (mo < 0 || (mo === 0 && now.getDate() < d.getDate())) a--;
    return a >= 0 && a < 120 ? String(a) : "";
}

const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

// Rounded blue "pill" badge with centered white text.
function pill(doc, text, x, y, w, h, size = 11) {
    doc.save().roundedRect(x, y, w, h, h / 2).fill(BLUE);
    doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(size)
        .text(text, x, y + (h - size) / 2 - 1, { width: w, align: "center", characterSpacing: 0.5 });
    doc.restore();
}

// Full-width pink-red term banner with centered white title.
function banner(doc, text, x, y, w, h = 20) {
    doc.save();
    try {
        const g = doc.linearGradient(x, y, x + w, y);
        g.stop(0, BANNER_A).stop(1, BANNER_B);
        doc.rect(x, y, w, h).fill(g);
    } catch (_) { doc.rect(x, y, w, h).fill(BANNER_A); }
    doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(10.5)
        .text(text, x, y + (h - 10.5) / 2 - 0.5, { width: w, align: "center", characterSpacing: 1 });
    doc.restore();
    return y + h;
}

// One table cell: optional fill, blue border, centered/aligned text.
function cell(doc, x, y, w, h, text, opts = {}) {
    const size = opts.size || 7.5;
    if (opts.fill) doc.save().rect(x, y, w, h).fill(opts.fill).restore();
    doc.lineWidth(0.6).strokeColor(GRID).rect(x, y, w, h).stroke();
    if (text != null && text !== "") {
        doc.fillColor(opts.color || INK).font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(size)
            .text(String(text), x + 2, y + (h - size) / 2 - 0.5,
                { width: w - 4, align: opts.align || "center", lineBreak: false, ellipsis: true });
    }
    doc.strokeColor("#000").fillColor("#000").lineWidth(1);
}

// A horizontal strip of cells. `cols` = [{w,text,fill,color,bold,align,size}].
function rowOf(doc, x, y, h, cols) {
    let cx = x;
    for (const c of cols) { cell(doc, cx, y, c.w, h, c.text, c); cx += c.w; }
    return y + h;
}

// Portrait page geometry.
const L = 42, R = 553, W = R - L;

// Decorative page background: a royal-blue border band with angled corner
// accents and a white rounded content panel — mirrors the printed booklet so
// pages read as "designed" rather than plain. Call right after each page starts.
function pageBg(doc, landscape) {
    const pw = landscape ? 841.89 : 595.28, ph = landscape ? 595.28 : 841.89;
    doc.save();
    doc.roundedRect(13, 13, pw - 26, ph - 26, 16).fill(BLUE);
    doc.fillColor(BLUE_DK).opacity(0.55);
    doc.moveTo(13, 95).lineTo(13, 13).lineTo(110, 13).closePath().fill();
    doc.moveTo(pw - 13, ph - 95).lineTo(pw - 13, ph - 13).lineTo(pw - 110, ph - 13).closePath().fill();
    doc.opacity(1).fillColor("#f4f6fd");
    doc.roundedRect(26, 26, pw - 52, ph - 52, 11).fill();
    doc.fillColor("#ffffff").roundedRect(29, 29, pw - 58, ph - 58, 9).fill();
    doc.restore().fillColor("#000").strokeColor("#000").lineWidth(1);
}

// A profile field: blue label, inked value, dotted underline to lineEnd.
function field(doc, label, value, x, y, lineEnd) {
    doc.fillColor(INK).font("Helvetica").fontSize(10).text(label, x, y, { lineBreak: false });
    const lx = x + doc.widthOfString(label) + 4;
    doc.fillColor("#111").font("Helvetica-Bold").fontSize(10).text(String(value || ""), lx, y, { lineBreak: false });
    doc.lineWidth(0.5).strokeColor("#9aa2dc").moveTo(lx, y + 12).lineTo(lineEnd, y + 12).stroke();
    doc.strokeColor("#000").fillColor("#000");
    return y + 20;
}

function coverPage(doc, data) {
    const { student = {}, exam, meta = {} } = data;
    const trust = meta.trustName || "Al Asr Educational Trust (R)";
    const school = meta.schoolName || "THE AGE SCHOOL";
    const addr = meta.schoolAddress || "Basavakalyan, Dist. Bidar - 585327";
    pageBg(doc, false);

    if (fs.existsSync(LOGO_PATH)) { try { doc.image(LOGO_PATH, 52, 46, { fit: [66, 66] }); } catch (_) {} }
    const hx = 130;
    doc.fillColor(INK).font("Helvetica").fontSize(10.5).text(trust, hx, 48);
    doc.fillColor(BLUE).font("Helvetica-Bold").fontSize(23).text(school, hx, doc.y - 1, { characterSpacing: 0.5 });
    doc.fillColor(INK).font("Helvetica").fontSize(9).text("Institute of Pre, Primary and Secondary Education", hx, doc.y + 1);
    doc.fontSize(9).text(addr, hx, doc.y + 1);
    doc.lineWidth(0.8).strokeColor(BLUE).moveTo(L, 122).lineTo(R, 122).stroke().strokeColor("#000");
    doc.fillColor(INK).font("Helvetica").fontSize(10).text("Recognised by Govt. of Karnataka", L, 126, { width: W, align: "center" });

    pill(doc, "STUDENT ACADEMIC PROGRESS CARD", L + 60, 150, W - 120, 24, 12);
    if (exam && exam.academicYear) doc.fillColor(INK).font("Helvetica-Bold").fontSize(10).text(exam.academicYear, L, 182, { width: W, align: "center" });

    // Photo box + STUDENT PROFILE pill.
    doc.lineWidth(0.8).strokeColor(BLUE).rect(L + W / 2 - 45, 200, 90, 104).stroke().strokeColor("#000");
    doc.fillColor(MUTED).font("Helvetica").fontSize(11).text("PHOTO", L + W / 2 - 45, 248, { width: 90, align: "center" });
    pill(doc, "STUDENT PROFILE", L, 318, 150, 18, 9.5);
    coverProfile(doc, student, exam);
}

function coverProfile(doc, s, exam) {
    let y = 348;
    y = field(doc, "Name of Student:", s.studentName, L, y, R);
    y = field(doc, "Father Name:", s.fatherName, L, y, R);
    y = field(doc, "Mother Name:", s.motherName, L, y, R);
    field(doc, "Class:", s.className || (exam && exam.className), L, y, L + 150);
    field(doc, "Sec:", s.section, L + 170, y, L + 290);
    y = field(doc, "Roll No:", s.rollNumber, L + 310, y, R);
    field(doc, "Date of Birth:", s.dob, L, y, L + 150);
    field(doc, "Age:", ageFromDob(s.dob), L + 170, y, L + 250);
    y = field(doc, "Gender:", s.gender, L + 270, y, R);
    field(doc, "SATS No:", s.satsNumber, L, y, L + 240);
    y = field(doc, "Adm. No:", s.admissionNumber, L + 270, y, R);
    y = field(doc, "Address:", s.address, L, y, R);
    y = field(doc, "Phone:", s.contact1, L, y, R);

    y += 6;
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(10).text("Dear Parent,", L, y);
    y = doc.y + 2;
    doc.font("Helvetica").fontSize(9.5).fillColor("#222").text(
        "The school years are the years of excitement for both parents and the students. Every student is unique and building the learning readiness in the student is the foremost purpose of school education. The aim is to ensure that the student reaches his/her full potential by the end of the school education.",
        L, y, { width: W, align: "justify" });
    y = doc.y + 8;
    doc.fillColor(BLUE).font("Helvetica-Bold").fontSize(10).text("The Student Academic Progress Card:", L, y);
    y = doc.y + 2;
    doc.font("Helvetica").fontSize(9.5).fillColor("#222").text(
        "This progress report card is a document designed to evaluate the student in all the categories of learning, i.e., Scholastic area and Co-Scholastic area. Our school follows the Karnataka State Curriculum guidelines of Continuous Comprehensive Evaluation (CCE). This report is sent to parents for their perusal and signature after every assessment. Please ensure that same is returned immediately after your comment and signature.",
        L, y, { width: W, align: "justify" });
}

// Landscape geometry.
const LL = 40, LR = 802, LW = LR - LL;

// Blue header cell with wrapped, centered white text.
function hcell(doc, x, y, w, h, text, size = 7) {
    doc.save().rect(x, y, w, h).fill(BLUE).restore();
    doc.lineWidth(0.6).strokeColor(GRID).rect(x, y, w, h).stroke().strokeColor("#000");
    doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(size);
    const th = doc.heightOfString(String(text), { width: w - 4, align: "center" });
    doc.text(String(text), x + 2, y + Math.max(1, (h - th) / 2), { width: w - 4, align: "center" });
    doc.fillColor("#000");
}

// One assessment's four columns for a subject: {max, obtd, scaled, grade}.
function asmtCells(m, asmt) {
    if (!asmt) return { max: "", obtd: "", scaled: "", grade: "" };
    const c = m ? m.cells[asmt.examId] : null;
    if (!c) return { max: asmt ? "" : "", obtd: "", scaled: "", grade: "" };
    const wt = asmt.weightage || 15;
    const status = c.status;
    const obtd = status === "absent" ? "AB" : status === "exempted" ? "EX"
        : status === "medical_leave" ? "ML" : status === "not_applicable" ? "NA"
        : (c.obtained == null ? "" : c.obtained);
    const scaled = (c.percent == null) ? "" : round1(c.percent / 100 * wt);
    const grade = (scaled === "") ? "" : gradeFor(scaled, [10, 15, 20, 30].includes(wt) ? wt : 15);
    return { max: c.max || "", obtd, scaled, grade, wt };
}

// Portrait scholastic-table columns (all pages are vertical A4).
const SW = 108, MW = 56, GW = 34, AW50 = 72, AWG = 61;

function termScholastic(doc, term, labels, y) {
    const faA = (term.assessments || []).filter((a) => a.category === "unit_test");
    const saA = (term.assessments || []).find((a) => a.category === "term") || null;
    const fa1 = faA[0] || null, fa2 = faA[1] || null;
    const grpW = MW + GW;
    const x0 = L, xFA1 = x0 + SW, xFA2 = xFA1 + grpW, xSA = xFA2 + grpW, xAGG = xSA + grpW;
    hcell(doc, x0, y, SW, 44, "SCHOLASTIC\nSUBJECTS", 8);
    hcell(doc, xFA1, y, grpW, 22, "FORMATIVE\nASSESSMENT - 1", 6.5);
    hcell(doc, xFA2, y, grpW, 22, "FORMATIVE\nASSESSMENT - 2", 6.5);
    hcell(doc, xSA, y, grpW, 22, "SUMMATIVE\nASSESSMENT - 1", 6.5);
    hcell(doc, xAGG, y, AW50 + AWG, 22, labels.aggTitle, 7);
    const sy = y + 22;
    [xFA1, xFA2, xSA].forEach((bx) => {
        hcell(doc, bx, sy, MW, 22, "Marks\n(Obt/Max)", 6);
        hcell(doc, bx + MW, sy, GW, 22, "Grade", 6.5);
    });
    hcell(doc, xAGG, sy, AW50, 22, "Total\n50%", 6.5);
    hcell(doc, xAGG + AW50, sy, AWG, 22, "Grade", 7);
    y = sy + 22;
    return termScholasticBody(doc, term, { fa1, fa2, saA }, y);
}

function termScholasticBody(doc, term, g, y) {
    const { fa1, fa2, saA } = g;
    const mk = (c) => (c.obtd === "" || c.obtd == null) ? "" : `${c.obtd} / ${c.max}`;
    for (const subj of SUBJECTS) {
        const m = (term.subjects || []).find((s) => normSubject(s.subjectName) === subj) || null;
        const c1 = asmtCells(m, fa1), c2 = asmtCells(m, fa2), cs = asmtCells(m, saA);
        const parts = [c1.scaled, c2.scaled, cs.scaled].filter((v) => typeof v === "number");
        const t50 = parts.length ? round1(parts.reduce((a, b) => a + b, 0)) : "";
        const gr50 = t50 === "" ? "" : gradeFor(t50, 50);
        y = rowOf(doc, L, y, 16, [
            { w: SW, text: subj, align: "left", size: 8, color: INK },
            { w: MW, text: mk(c1), size: 7 }, { w: GW, text: c1.grade, size: 7.5 },
            { w: MW, text: mk(c2), size: 7 }, { w: GW, text: c2.grade, size: 7.5 },
            { w: MW, text: mk(cs), size: 7 }, { w: GW, text: cs.grade, size: 7.5 },
            { w: AW50, text: t50, bold: true, size: 8 }, { w: AWG, text: gr50, bold: true, size: 8 }]);
    }
    for (const lbl of ["Total", "Result"]) {
        y = rowOf(doc, L, y, 16, [{ w: SW, text: lbl, align: "right", bold: true, size: 8, color: INK },
            { w: MW, text: "" }, { w: GW, text: "" }, { w: MW, text: "" }, { w: GW, text: "" },
            { w: MW, text: "" }, { w: GW, text: "" }, { w: AW50, text: "" }, { w: AWG, text: "" }]);
    }
    return termScholasticFooter(doc, term, y);
}

function termScholasticFooter(doc, term, y) {
    const wide = W - SW;
    const comment = (term.meta && term.meta.remark) ? term.meta.remark : "";
    const rows = [["Performance Comment", comment, 22], ["Class Teacher Sign", "", 18],
        ["Head Master Sign", "", 18], ["Parent Sign", "", 18]];
    for (const [lbl, val, h] of rows) {
        cell(doc, L, y, SW, h, lbl, { align: "left", bold: true, size: 8, color: INK });
        cell(doc, L + SW, y, wide, h, val, { align: "left", size: 8 });
        y += h;
    }
    return y;
}

function termCoScholastic(doc, term, labels, y) {
    const faA = (term.assessments || []).filter((a) => a.category === "unit_test");
    const saA = (term.assessments || []).find((a) => a.category === "term") || null;
    const ids = [faA[0], faA[1], saA].map((a) => (a ? a.examId : null));
    const subW = 200, gw = 104, gw2 = 104, gw3 = W - subW - gw - gw2;
    const xCo = L, xA = xCo + subW, xB = xA + gw, xC = xB + gw2;
    hcell(doc, xCo, y, subW, 24, "CO-SCHOLASTIC SUBJECTS", 8);
    hcell(doc, xA, y, gw, 24, "GRADE (" + labels.fa[0] + ")", 7.5);
    hcell(doc, xB, y, gw2, 24, "GRADE (" + labels.fa[1] + ")", 7.5);
    hcell(doc, xC, y, gw3, 24, "GRADE (" + labels.sa + ")", 7.5);
    y += 24;
    for (const area of CO_AREAS) {
        const co = (term.coScholastic || []).find((c) => c.area === area) || { cells: {} };
        cell(doc, xCo, y, subW, 16, area, { align: "left", size: 8, color: INK });
        cell(doc, xA, y, gw, 16, ids[0] ? (co.cells[ids[0]] || "") : "", { size: 8 });
        cell(doc, xB, y, gw2, 16, ids[1] ? (co.cells[ids[1]] || "") : "", { size: 8 });
        cell(doc, xC, y, gw3, 16, ids[2] ? (co.cells[ids[2]] || "") : "", { size: 8 });
        y += 16;
    }
    y += 10;
    // Attendance + physical stature strip (two label/value rows).
    const m = term.meta || {};
    const lw = 128, vw = W / 2 - lw;
    const strip = (l1, v1, l2, v2) => {
        cell(doc, L, y, lw, 18, l1, { align: "left", bold: true, size: 8, color: BLUE, fill: BLUE_SOFT });
        cell(doc, L + lw, y, vw, 18, v1 === null || v1 === undefined ? "" : v1, { size: 8 });
        cell(doc, L + lw + vw, y, lw, 18, l2, { align: "left", bold: true, size: 8, color: BLUE, fill: BLUE_SOFT });
        cell(doc, L + 2 * lw + vw, y, vw, 18, v2 === null || v2 === undefined ? "" : v2, { size: 8 });
        y += 18;
    };
    strip("Working Days", m.workingDays, "Days Attended", m.daysAttended);
    strip("Height (In)", m.heightCm, "Weight (Kg)", m.weightKg);
    return y;
}

function termPage(doc, term, labels) {
    doc.addPage();
    pageBg(doc, false);
    let y = 46;
    y = banner(doc, labels.scholTitle, L, y, W, 20) + 8;
    y = termScholastic(doc, term, labels, y) + 16;
    y = banner(doc, labels.coTitle, L, y, W, 20) + 8;
    termCoScholastic(doc, term, labels, y);
}

function averagePage(doc, model) {
    doc.addPage();
    pageBg(doc, false);
    const final = model.final;
    let y = 44;
    doc.save().rect(L, y, W, 20).fill(BLUE_SOFT).restore();
    doc.lineWidth(0.8).strokeColor(BLUE).rect(L, y, W, 20).stroke().strokeColor("#000");
    doc.fillColor(BLUE).font("Helvetica-Bold").fontSize(11).text("SCHOLASTIC AREA - AVERAGE RESULT", L, y + 5.5, { width: W, align: "center" });
    y += 20;

    const cw = [150, 85, 85, 95, 96];
    const head = ["Subjects", "I Term 50%", "II Term 50%", "Aggregate 100%", "Grade"];
    y = rowOf(doc, L, y, 22, head.map((t, i) => ({ w: cw[i], text: t, fill: BLUE, color: WHITE, bold: true, size: 8, align: "center" })));
    const fsub = (final && final.subjects) || [];
    for (const subj of SUBJECTS) {
        const m = fsub.find((s) => normSubject(s.subjectName) === subj);
        const i50 = m && m.termIPercent != null ? round1(m.termIPercent / 2) : "";
        const ii50 = m && m.termIIPercent != null ? round1(m.termIIPercent / 2) : "";
        const agg = m && m.finalPercent != null ? round1(m.finalPercent) : "";
        const gr = agg === "" ? "" : gradeFor(agg, 100);
        y = rowOf(doc, L, y, 17, [
            { w: cw[0], text: subj, align: "left", size: 8.5, color: INK },
            { w: cw[1], text: i50, size: 8 }, { w: cw[2], text: ii50, size: 8 },
            { w: cw[3], text: agg, size: 8 }, { w: cw[4], text: gr, size: 8 }]);
    }
    const aggAll = final && final.aggregatePercent != null ? round1(final.aggregatePercent) : "";
    y = rowOf(doc, L, y, 17, [{ w: cw[0], text: "Total", align: "right", bold: true, size: 8, color: INK },
        { w: cw[1], text: "" }, { w: cw[2], text: "" }, { w: cw[3], text: aggAll, bold: true, size: 8 }, { w: cw[4], text: final ? (final.grade || "") : "" }]);
    y = rowOf(doc, L, y, 17, [{ w: cw[0], text: "Result", align: "right", bold: true, size: 8, color: INK },
        { w: cw[1], text: "" }, { w: cw[2], text: "" }, { w: cw[3], text: "" }, { w: cw[4], text: "" }]);
    averagePageTail(doc, model, y + 10);
}

function averagePageTail(doc, model, y) {
    const t1 = (model.terms[0] && model.terms[0].meta) || {};
    const t2 = (model.terms[1] && model.terms[1].meta) || {};
    const fm = (model.final && model.final.meta) || {};
    const sum = (x, z) => (x == null && z == null) ? "" : (Number(x || 0) + Number(z || 0));

    doc.fillColor(INK).font("Helvetica-Bold").fontSize(10).text("Attendance Record", L, y, { width: W, align: "center" });
    y = doc.y + 3;
    const cw = [150, 90, 90, 90, 91];
    y = rowOf(doc, L, y, 18, ["Year Attendance", "I Term", "II Term", "Total", "Remarks"].map((t, i) => ({ w: cw[i], text: t, fill: BLUE, color: WHITE, bold: true, size: 8 })));
    y = rowOf(doc, L, y, 16, [{ w: cw[0], text: "Working Days", align: "left", size: 8, color: INK },
        { w: cw[1], text: t1.workingDays ?? "" }, { w: cw[2], text: t2.workingDays ?? "" }, { w: cw[3], text: sum(t1.workingDays, t2.workingDays) }, { w: cw[4], text: "" }]);
    y = rowOf(doc, L, y, 16, [{ w: cw[0], text: "Days Attended", align: "left", size: 8, color: INK },
        { w: cw[1], text: t1.daysAttended ?? "" }, { w: cw[2], text: t2.daysAttended ?? "" }, { w: cw[3], text: sum(t1.daysAttended, t2.daysAttended) }, { w: cw[4], text: "" }]);

    cell(doc, L, y, W, 16, "Over All Performance Comment", { fill: BLUE_SOFT, bold: true, size: 9, color: BLUE });
    y += 16;
    cell(doc, L, y, W, 30, fm.remark || t2.remark || t1.remark || "", { align: "left", size: 9 });
    y += 42;

    doc.fillColor(BLUE).font("Helvetica-Bold").fontSize(12).text("Promotion & School Reopen", L, y, { width: W, align: "center" });
    y = doc.y + 8;
    const promoted = fm.promotedToClass || "";
    doc.fillColor(INK).font("Helvetica").fontSize(10.5).text("Promoted to Class:", L, y, { lineBreak: false });
    doc.font("Helvetica-Bold").text(promoted, L + 110, y, { lineBreak: false });
    doc.font("Helvetica").text("in the year", L + 300, y, { lineBreak: false });
    doc.lineWidth(0.5).strokeColor("#9aa2dc").moveTo(L + 110, y + 13).lineTo(L + 290, y + 13).moveTo(L + 365, y + 13).lineTo(R, y + 13).stroke().strokeColor("#000");
    y += 24;
    doc.fillColor(INK).font("Helvetica").fontSize(10.5).text("School will re-open:", L, y, { lineBreak: false });
    doc.lineWidth(0.5).strokeColor("#9aa2dc").moveTo(L + 120, y + 13).lineTo(R, y + 13).stroke().strokeColor("#000");
    y += 30;

    const third = W / 3;
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(10);
    doc.text("Class Teacher", L, y, { width: third, align: "center" });
    doc.text("Principal", L + third, y, { width: third, align: "center" });
    doc.text("Parent", L + 2 * third, y, { width: third, align: "center" });
    gradingTable(doc, y + 26);
}

const GRADE_PRINT = [
    ["A+", "09 - 10", "13.5 - 15", "18 - 20", "27 - 30", "45 - 50", "90 - 100", "Outstanding", "Distinction"],
    ["A", "07 - 8.9", "10.5 - 13", "14 - 17.5", "21 - 26.5", "35 - 44", "70 - 89", "Excellent", "First Division"],
    ["B+", "5 - 6.9", "7.5 - 10", "10 - 13.5", "15 - 20.5", "25 - 34", "50 - 69", "Very Good", "Second Division"],
    ["B", "3 - 4.9", "4.5 - 07", "6 - 9.5", "9 - 14.5", "15 - 24", "30 - 49", "Good", "Third Division"],
    ["C", "1 - 2.9", "1 - 04", "1 - 5.5", "1 - 14", "1 - 14", "1 - 29", "Poor", "Scope for Improvement"]
];
function gradingTable(doc, y) {
    cell(doc, L, y, W, 16, "GRADING SYSTEM", { fill: BLUE, color: WHITE, bold: true, size: 9.5 });
    y += 16;
    const cw = [34, 46, 50, 50, 52, 50, 54, 83, 92];
    const head = ["Grade", "10%", "15%", "20%", "30%", "50%", "100%", "Performance Comment", "Result"];
    y = rowOf(doc, L, y, 24, head.map((t, i) => ({ w: cw[i], text: t, fill: BLUE_SOFT, color: BLUE, bold: true, size: 7.5 })));
    for (const r of GRADE_PRINT) {
        y = rowOf(doc, L, y, 18, r.map((t, i) => ({ w: cw[i], text: t, bold: i === 0, size: 7, color: INK, align: i >= 7 ? "left" : "center" })));
    }
    return y;
}

function renderProgressCard(doc, data) {
    const model = data.model || {};
    coverPage(doc, data);
    const terms = model.terms || [];
    const L1 = { scholTitle: "I TERM - SCHOLASTIC AREA", coTitle: "I TERM - CO SCHOLASTIC AREA", aggTitle: "I TERM AGGREGATE RESULT", fa: ["FA1", "FA2"], sa: "SA1" };
    const L2 = { scholTitle: "II TERM - SCHOLASTIC AREA", coTitle: "II TERM - CO SCHOLASTIC AREA", aggTitle: "II TERM AGGREGATE RESULT", fa: ["FA3", "FA4"], sa: "SA2" };
    if (terms[0]) termPage(doc, terms[0], L1);
    if (terms[1]) termPage(doc, terms[1], L2);
    if (model.final) {
        averagePage(doc, model);
    } else {
        doc.addPage();
        pageBg(doc, false);
        gradingTable(doc, 60);
    }
}

// =====================================================
// SINGLE-PAGE CARD — for a Formative Assessment (unit_test)
// download. Same blue identity as the booklet, condensed to
// one portrait sheet: header, student details, that term's
// scholastic table (dynamic assessment columns) + co-scholastic,
// attendance/stature, grading legend, signatures.
// =====================================================

function blueSection(doc, title, y) {
    doc.fillColor(BLUE).fontSize(10).font("Helvetica-Bold").text(title.toUpperCase(), L, y, { characterSpacing: 0.8 });
    doc.moveTo(L, y + 14).lineTo(R, y + 14).lineWidth(1).strokeColor(BLUE).stroke();
    doc.strokeColor("#000").lineWidth(1).fillColor("#000");
    return y + 20;
}

function singleHeader(doc, exam, meta) {
    const trust = meta.trustName || "Al Asr Educational Trust (R)";
    const school = meta.schoolName || "THE AGE SCHOOL";
    const addr = meta.schoolAddress || "Basavakalyan, Dist. Bidar - 585327";
    if (fs.existsSync(LOGO_PATH)) { try { doc.image(LOGO_PATH, 52, 44, { fit: [58, 58] }); } catch (_) {} }
    doc.fillColor(MUTED).font("Helvetica").fontSize(10).text(trust, L, 46, { width: W, align: "center" });
    doc.fillColor(BLUE).font("Helvetica-Bold").fontSize(19).text(school, L, doc.y, { width: W, align: "center", characterSpacing: 1 });
    doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(addr, { width: W, align: "center" });
    let y = Math.max(doc.y, 104) + 8;
    doc.moveTo(L, y).lineTo(R, y).lineWidth(1).strokeColor(BLUE).stroke();
    doc.fillColor(BLUE).font("Helvetica-Bold").fontSize(11).text("STUDENT ACADEMIC PROGRESS CARD", L, y + 5, { width: W, align: "center", characterSpacing: 2 });
    y = doc.y + 4;
    doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor(GRID).stroke().strokeColor("#000");
    if (exam && exam.academicYear) { doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(`Academic Year: ${exam.academicYear}`, L, y + 3, { width: W, align: "center" }); y = doc.y; }
    doc.fillColor("#000");
    return y + 8;
}

function singleProfile(doc, s, exam, y) {
    y = blueSection(doc, "Student Details", y);
    const rows = [
        [`Name: ${s.studentName || "-"}`, `Class/Sec: ${s.className || (exam && exam.className) || "-"}${s.section ? " / " + s.section : ""}`],
        [`Father's Name: ${s.fatherName || "-"}`, `Roll No: ${s.rollNumber || "-"}`],
        [`Mother's Name: ${s.motherName || "-"}`, `Adm No: ${s.admissionNumber || "-"}`],
        [`DOB: ${s.dob || "-"}   Age: ${ageFromDob(s.dob) || "-"}`, `SATS No: ${s.satsNumber || "-"}`],
        [`Gender: ${s.gender || "-"}`, `Phone: ${s.contact1 || "-"}`],
        [`Address: ${s.address || "-"}`, ""]
    ];
    const half = W / 2;
    for (const r of rows) {
        cell(doc, L, y, half, 16, r[0], { align: "left", size: 9, color: INK });
        cell(doc, L + half, y, half, 16, r[1], { align: "left", size: 9, color: INK });
        y += 16;
    }
    return y + 8;
}

function singleScholastic(doc, term, y) {
    y = blueSection(doc, `${term.label} — Scholastic`, y);
    const asmts = term.assessments || [];
    const subjW = 140, cw = (W - subjW) / (asmts.length + 2);
    const header = [{ w: subjW, text: "Subject", fill: BLUE, color: WHITE, bold: true, size: 8 }];
    asmts.forEach((a) => header.push({ w: cw, text: a.examName, fill: BLUE, color: WHITE, bold: true, size: 7.5 }));
    header.push({ w: cw, text: "Aggregate %", fill: BLUE, color: WHITE, bold: true, size: 7 });
    header.push({ w: cw, text: "Grade", fill: BLUE, color: WHITE, bold: true, size: 7.5 });
    y = rowOf(doc, L, y, 20, header);
    const amk = (c) => !c ? "" : (c.status === "absent" ? "AB" : c.status === "exempted" ? "EX" : c.status === "medical_leave" ? "ML" : c.status === "not_applicable" ? "NA" : (c.obtained == null ? "" : `${c.obtained}/${c.max}`));
    (term.subjects || []).forEach((s, idx) => {
        const z = idx % 2 ? "#f4f6fd" : null;
        const cols = [{ w: subjW, text: s.subjectName, align: "left", size: 8.5, color: INK, fill: z }];
        asmts.forEach((a) => cols.push({ w: cw, text: amk(s.cells[a.examId]), size: 8, fill: z }));
        cols.push({ w: cw, text: s.aggregatePercent == null ? "" : s.aggregatePercent, bold: true, size: 8, fill: z });
        cols.push({ w: cw, text: s.aggregateGrade || "", bold: true, size: 8, fill: z });
        y = rowOf(doc, L, y, 16, cols);
    });
    return y + 10;
}

function singleCo(doc, term, y) {
    y = blueSection(doc, `${term.label} — Co-Scholastic`, y);
    const aw = 360, gw = W - aw;
    y = rowOf(doc, L, y, 18, [{ w: aw, text: "Area", fill: BLUE, color: WHITE, bold: true, size: 8 }, { w: gw, text: "Grade", fill: BLUE, color: WHITE, bold: true, size: 8 }]);
    CO_AREAS.forEach((area, idx) => {
        const co = (term.coScholastic || []).find((c) => c.area === area) || {};
        const z = idx % 2 ? "#f4f6fd" : null;
        cell(doc, L, y, aw, 16, area, { align: "left", size: 8, color: INK, fill: z });
        cell(doc, L + aw, y, gw, 16, co.aggregateGrade || "", { size: 8, fill: z });
        y += 16;
    });
    y += 8;
    const m = term.meta || {};
    const half = W / 2;
    const att = `Attendance: ${m.daysAttended ?? "-"} / ${m.workingDays ?? "-"} days`;
    const stat = `Height: ${m.heightCm != null ? m.heightCm + " cm" : "-"}    Weight: ${m.weightKg != null ? m.weightKg + " kg" : "-"}`;
    cell(doc, L, y, half, 18, att, { align: "left", size: 8.5, color: INK });
    cell(doc, L + half, y, half, 18, stat, { align: "left", size: 8.5, color: INK });
    y += 18;
    cell(doc, L, y, W, 18, `Class Teacher's Remark: ${m.remark || ""}`, { align: "left", size: 8.5, color: INK });
    return y + 18;
}

function renderSingleCard(doc, data) {
    const { student = {}, exam, model = {}, meta = {} } = data;
    pageBg(doc, false);
    let y = singleHeader(doc, exam, meta);
    y = singleProfile(doc, student, exam, y);
    const term = (model.terms || [])[0];
    if (term) {
        y = singleScholastic(doc, term, y);
        y = singleCo(doc, term, y);
    }
    y += 6;
    doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(7.5)
        .text("Grading Scale:  A+ 90-100    A 80-89    B+ 70-79    B 60-69    C 50-59    D 35-49    F 0-34", L, y, { width: W });
    // Signatures near the foot.
    y = Math.max(doc.y + 30, 740);
    const third = W / 3;
    doc.lineWidth(0.6).strokeColor("#9aa2dc");
    for (let i = 0; i < 3; i++) doc.moveTo(L + i * third + 14, y).lineTo(L + (i + 1) * third - 14, y).stroke();
    doc.strokeColor("#000").fillColor(INK).font("Helvetica-Bold").fontSize(9);
    ["Class Teacher", "Principal", "Parent / Guardian"].forEach((t, i) => doc.text(t, L + i * third, y + 4, { width: third, align: "center" }));
    doc.fillColor("#000");
}

module.exports = { renderProgressCard, renderSingleCard };











