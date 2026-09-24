// =====================================================
// FEE RECEIPT PDF GENERATOR
//
// Builds a one-page fee receipt PDF for a single payment
// and returns it as an in-memory Buffer (for zipping into
// the report export). Uses pdfkit (already a dependency).
// =====================================================

const PDFDocument = require("pdfkit");

const money = (value) =>
    "Rs. " +
    Number(value || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

// Sanitize a value for use in a filename.
function safeName(value) {
    return String(value || "")
        .replace(/[^a-z0-9._-]+/gi, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 60);
}

// A friendly filename for one receipt, e.g. "REC-42_Roll-7_Asha.pdf"
function receiptFileName(payment) {
    const rec = `REC-${payment.id}`;
    const roll = payment.rollNumber ? `Roll-${safeName(payment.rollNumber)}` : "NoRoll";
    const name = safeName(payment.studentName || "student");
    return `${rec}_${roll}_${name}.pdf`;
}

// =====================================================
// GENERATE ONE RECEIPT -> Buffer
//
// data = {
//   schoolName,
//   academicYear,
//   payment: { id, paymentDate, amount, paymentMode, remarks, status,
//              studentName, rollNumber, className, fatherName, lineItems: [] },
//   account: { totalDemand, totalPaid, balance }  // snapshot as of export
// }
// =====================================================
function generateReceiptBuffer(data) {
    return new Promise((resolve, reject) => {
        try {
            const { schoolName, academicYear, payment, account } = data;

            const doc = new PDFDocument({ size: "A4", margin: 50 });
            const chunks = [];
            doc.on("data", (c) => chunks.push(c));
            doc.on("end", () => resolve(Buffer.concat(chunks)));
            doc.on("error", reject);

            const isReversed = payment.status === "reversed";

            // ---- Header ----
            doc.fontSize(20).font("Helvetica-Bold")
                .text(schoolName || "The Age School", { align: "center" });
            doc.moveDown(0.2).fontSize(13).font("Helvetica")
                .text("Fee Payment Receipt", { align: "center" });
            if (academicYear) {
                doc.moveDown(0.1).fontSize(10).font("Helvetica")
                    .text(`Academic Session: ${academicYear}`, { align: "center" });
            }

            doc.moveDown(1);
            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
            doc.moveDown(0.8);

            // ---- Receipt meta ----
            const metaTop = doc.y;
            doc.fontSize(11).font("Helvetica");
            doc.text(`Receipt No: REC-${payment.id}`, 50, metaTop);
            doc.text(
                `Date: ${payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString("en-IN") : "-"}`,
                320, metaTop
            );
            doc.moveDown(1.4);

            // ---- Student details ----
            const detailTop = doc.y;
            doc.text(`Student: ${payment.studentName || "-"}`, 50, detailTop);
            doc.text(`Class: ${payment.className || "-"}`, 320, detailTop);
            doc.text(`Roll No: ${payment.rollNumber || "-"}`, 50, detailTop + 18);
            doc.text(`Guardian: ${payment.fatherName || "-"}`, 320, detailTop + 18);

            doc.moveDown(2.4);

            // ---- Line items table ----
            const tableTop = doc.y + 5;
            const colItem = 50;
            const colAmt = 420;

            doc.font("Helvetica-Bold").fontSize(11);
            doc.text("Fee Component", colItem, tableTop);
            doc.text("Amount", colAmt, tableTop, { width: 125, align: "right" });
            doc.moveTo(colItem, tableTop + 15).lineTo(545, tableTop + 15).stroke();

            let y = tableTop + 22;
            doc.font("Helvetica").fontSize(11);

            const lineItems = Array.isArray(payment.lineItems) ? payment.lineItems : [];
            if (lineItems.length > 0) {
                lineItems.forEach((li) => {
                    doc.text(li.componentName || "Fee", colItem, y, { width: 350 });
                    doc.text(money(li.amount), colAmt, y, { width: 125, align: "right" });
                    y += 20;
                });
            } else {
                // Un-itemized (legacy) payment — show the lump sum.
                doc.text("Fee Payment", colItem, y, { width: 350 });
                doc.text(money(payment.amount), colAmt, y, { width: 125, align: "right" });
                y += 20;
            }

            doc.moveTo(colItem, y).lineTo(545, y).stroke();
            y += 8;

            // ---- This payment total ----
            doc.font("Helvetica-Bold").fontSize(12);
            doc.text("Amount Paid", colItem, y);
            doc.text(money(payment.amount), colAmt, y, { width: 125, align: "right" });
            y += 24;

            doc.font("Helvetica").fontSize(11);
            doc.text(`Payment Mode: ${(payment.paymentMode || "Cash")}`, colItem, y);
            y += 18;
            if (payment.remarks) {
                doc.text(`Remarks: ${payment.remarks}`, colItem, y, { width: 495 });
                y += 18;
            }

            // ---- Account position as it stood right after this payment ----
            if (account) {
                y += 10;
                doc.moveTo(colItem, y).lineTo(545, y).stroke();
                y += 12;
                doc.font("Helvetica-Bold").fontSize(10)
                    .text("Account Position (after this payment)", colItem, y);
                y += 18;
                doc.font("Helvetica").fontSize(11);
                doc.text("Total Fee Demand", colItem, y);
                doc.text(money(account.totalDemand), colAmt, y, { width: 125, align: "right" });
                y += 18;
                doc.text("Paid Through This Receipt", colItem, y);
                doc.text(money(account.totalPaid), colAmt, y, { width: 125, align: "right" });
                y += 18;
                doc.font("Helvetica-Bold");
                doc.text("Balance After This Payment", colItem, y);
                doc.text(money(account.balance), colAmt, y, { width: 125, align: "right" });
                y += 20;
            }

            // ---- Reversed watermark note ----
            if (isReversed) {
                doc.moveDown(1);
                doc.font("Helvetica-Bold").fontSize(13).fillColor("#DC2626")
                    .text("*** THIS PAYMENT WAS REVERSED / VOIDED ***", 50, doc.y, { align: "center", width: 495 });
                doc.fillColor("#000000");
            }

            // ---- Footer ----
            doc.font("Helvetica-Oblique").fontSize(9)
                .text(`Generated on ${new Date().toLocaleString("en-IN")}`, 50, 790, { align: "center", width: 495 });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = { generateReceiptBuffer, receiptFileName, safeName };
