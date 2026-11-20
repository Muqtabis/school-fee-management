// =====================================================
// TRANSFER CERTIFICATE PDF GENERATOR
// One-page TC from a pre-computed student model. Uses pdfkit
// (already a dependency). In-memory buffer; nothing stored.
// =====================================================
const PDFDocument = require("pdfkit");

function safeName(v) {
    return String(v || "").replace(/[^a-z0-9._-]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 60);
}

function generateTransferCertificateBuffer(data) {
    const s = data.student || {};
    const meta = data.meta || {};
    const schoolName = meta.schoolName || "The Age School";
    const trustName = meta.trustName || "";
    const address = meta.schoolAddress || "";
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));

    const W = doc.page.width - 96;
    doc.font("Helvetica-Bold").fontSize(19).text(schoolName, { align: "center" });
    if (trustName) doc.font("Helvetica").fontSize(10).text(trustName, { align: "center" });
    if (address) doc.fontSize(9).fillColor("#555").text(address, { align: "center" });
    doc.moveDown(0.4).font("Helvetica-Bold").fontSize(13).fillColor("#000").text("TRANSFER CERTIFICATE", { align: "center" });
    doc.moveTo(48, doc.y + 4).lineTo(48 + W, doc.y + 4).stroke();
    doc.moveDown(0.9);

    const row = (label, value) => {
        doc.font("Helvetica-Bold").fontSize(10).text(`${label}:`, 48, doc.y, { continued: true });
        doc.font("Helvetica").text(`  ${value || "-"}`);
        doc.moveDown(0.28);
    };
    const two = (l1, v1, l2, v2) => {
        const y = doc.y;
        doc.font("Helvetica-Bold").fontSize(10).text(`${l1}:`, 48, y, { continued: true });
        doc.font("Helvetica").text(`  ${v1 || "-"}`, 48 + 150, y, { width: 200 });
        doc.font("Helvetica-Bold").text(`${l2}:`, 48 + 310, y, { continued: true });
        doc.font("Helvetica").text(`  ${v2 || "-"}`, 48 + 410, y, { width: 150 });
        doc.y = y + 18;
    };

    row("Certificate No.", data.certificateNo || "-");
    two("Admission No.", s.admissionNumber, "Roll No.", s.rollNumber);
    two("Student Name", s.studentName, "Class", s.className);
    two("Father's Name", s.fatherName, "Mother's Name", s.motherName);
    two("Date of Birth", s.dob, "Gender", s.gender);
    two("Category", s.studentCategory, "Contact", s.contact1);
    if (s.address) row("Address", s.address);
    row("Academic Year", data.academicYear || "-");
    row("Date of Admission", s.admissionDate || "-");
    row("Reason for Leaving", data.reason || "-");
    row("Date of Leaving", data.leavingDate || "-");
    row("Conduct / Character", data.conduct || "Good");
    doc.moveDown(0.8);

    doc.font("Helvetica").fontSize(10).text(
        "This is to certify that the above-named student was a bonafide student of this institution and has been granted a transfer certificate on the date mentioned above.",
        { align: "justify", width: W }
    );
    doc.moveDown(1.6);

    const y = doc.y;
    doc.font("Helvetica").fontSize(10).text("Class Teacher", 48, y);
    doc.text("Principal", 48 + W - 90, y);
    doc.moveDown(2).font("Helvetica").fontSize(8).fillColor("#777")
        .text(`Generated on ${new Date().toLocaleDateString("en-IN")} · ${schoolName}`, { align: "center" });

    doc.end();
    return new Promise((resolve, reject) => {
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
    });
}

module.exports = { generateTransferCertificateBuffer, safeName };
