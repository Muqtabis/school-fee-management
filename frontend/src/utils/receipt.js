// Shared receipt model + printer (extracted from SummaryTable).
import { toast } from "../services/notify";
import api from "../services/api";

export const formatMoney = (val) =>
    Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-IN");
};

const buildReceiptModel = async (paymentId) => {
    const response = await api.get(`/payments/receipt/${paymentId}`);
    const payment = response.data;

    let feeItems = [];
    let prevDues = 0;
    let concession = 0;
    let balanceDue = 0;
    let totalDemand = 0;
    let history = null;

    try {
        const studentRes = await api.get(`/students/${payment.studentId}`);
        const student = studentRes.data;
        prevDues = Number(student?.previousDues || 0);
        concession = Number(student?.concessionAmount || 0);

        const historyRes = await api.get(`/payments/history/student/${payment.studentId}`);
        history = historyRes.data;

        feeItems = Array.isArray(history?.items) ? history.items : [];

        let standardTotal = feeItems.reduce((sum, item) => {
            if (item.itemType === "carry_forward" || item.componentName?.toLowerCase().includes("previous")) return sum;
            return sum + Number(item.amount || 0);
        }, 0);

        totalDemand = prevDues + Math.max(0, standardTotal - concession);
        let totalPaidSoFar = 0;

        if (Array.isArray(history?.payments)) {
            const chronologicalPayments = [...history.payments].reverse();
            for (const p of chronologicalPayments) {
                if (p.id === payment.id) break;
                if (p.status !== "reversed") totalPaidSoFar += Number(p.amount || 0);
            }
        } else {
            totalPaidSoFar = Math.max(0, Number(history?.totalPaid || 0) - Number(payment.amount || 0));
        }

        balanceDue = Math.max(0, totalDemand - (totalPaidSoFar + Number(payment.amount || 0)));
    } catch (err) {
        console.error("Could not fetch detailed fee breakdown for receipt:", err);
    }

    // =====================================================
    // PRECISE ITEMIZED RECEIPT LEDGER LOOKUP
    // =====================================================
    const componentLedger = [];
    const pastPaidMap = { "previous dues": 0, "tuition fee": 0 };
    let unassignedPastPool = 0;

    if (Array.isArray(history?.payments)) {
        const chronologicalPayments = [...history.payments].reverse();
        for (const p of chronologicalPayments) {
            if (p.id === payment.id) break;
            if (p.status !== "reversed") {
                if (p.lineItems && p.lineItems.length > 0) {
                    p.lineItems.forEach(li => {
                        const n = (li.componentName || "").toLowerCase().trim();
                        if (n.includes("previous")) pastPaidMap["previous dues"] += li.amount;
                        else if (n.includes("tuition") || n.includes("tution") || n.includes("term")) pastPaidMap["tuition fee"] += li.amount;
                        else pastPaidMap[n] = (pastPaidMap[n] || 0) + li.amount;
                    });
                } else {
                    unassignedPastPool += Number(p.amount || 0);
                }
            }
        }
    }

    const getPaidTodayForComponent = (compName) => {
        let sum = 0;
        let modes = new Set();
        let dates = new Set();
        (payment.lineItems || []).forEach(li => {
            const ln = (li.componentName || "").toLowerCase();
            const cn = compName.toLowerCase();
            if (ln.includes(cn) || cn.includes(ln)) {
                sum += Number(li.amount || 0);
                if (li.mode) modes.add(li.mode);
                if (li.paidOn) dates.add(li.paidOn);
            }
        });
        return {
            sum,
            mode: modes.size > 0 ? Array.from(modes).join(", ") : null,
            date: dates.size > 0 ? Array.from(dates).map(d => formatDate(d)).join(", ") : null
        };
    };

    // 1. Process Previous Dues explicitly
    if (prevDues > 0) {
        let pastPaid = pastPaidMap["previous dues"];
        if (unassignedPastPool > 0) {
            let applyPrev = Math.min(prevDues - pastPaid, unassignedPastPool);
            if (applyPrev > 0) { pastPaid += applyPrev; unassignedPastPool -= applyPrev; }
        }
        const paidInfo = getPaidTodayForComponent("previous");
        if (prevDues > 0 || paidInfo.sum > 0) {
            componentLedger.push({
                name: "Previous Dues (Carry Forward)",
                total: prevDues,
                paidNow: paidInfo.sum,
                balance: Math.max(0, prevDues - pastPaid - paidInfo.sum),
                mode: paidInfo.mode,
                date: paidInfo.date
            });
        }
    }

    // 2. Tuition / Terms and Others
    let tuitionTotal = 0;
    const others = [];

    feeItems.forEach(item => {
        if (item.itemType === "carry_forward" || item.componentName?.toLowerCase().includes("previous")) return;
        const amt = Number(item.amount || 0);
        if (amt <= 0) return;

        const cName = String(item.componentName).toLowerCase();
        if (cName.includes("tution") || cName.includes("tuition")) {
            tuitionTotal += amt;
        } else {
            others.push(item);
        }
    });

    if (tuitionTotal > 0) {
        const netTuition = Math.max(0, tuitionTotal - concession);
        let pastPaid = pastPaidMap["tuition fee"];
        if (unassignedPastPool > 0) {
            let applyT = Math.min(netTuition - pastPaid, unassignedPastPool);
            if (applyT > 0) { pastPaid += applyT; unassignedPastPool -= applyT; }
        }

        let paidInfo = getPaidTodayForComponent("tuition");
        if (paidInfo.sum === 0) {
            paidInfo = getPaidTodayForComponent("tution");
        }
        if (paidInfo.sum === 0) {
            paidInfo = getPaidTodayForComponent("term");
        }

        componentLedger.push({
            name: "Tuition Fee",
            total: netTuition,
            paidNow: paidInfo.sum,
            balance: Math.max(0, netTuition - pastPaid - paidInfo.sum),
            mode: paidInfo.mode,
            date: paidInfo.date
        });
    }

    others.forEach(item => {
        const n = item.componentName.toLowerCase().trim();
        let pastPaid = pastPaidMap[n] || 0;
        if (unassignedPastPool > 0) {
            let applyO = Math.min(item.amount - pastPaid, unassignedPastPool);
            if (applyO > 0) { pastPaid += applyO; unassignedPastPool -= applyO; }
        }

        const paidInfo = getPaidTodayForComponent(item.componentName);
        componentLedger.push({
            name: item.componentName,
            total: item.amount,
            paidNow: paidInfo.sum,
            balance: Math.max(0, item.amount - pastPaid - paidInfo.sum),
            mode: paidInfo.mode,
            date: paidInfo.date
        });
    });

    return {
        payment,
        receiptNumber: `REC-${payment.id}`,
        studentName: payment.studentName || "-",
        rollNumber: payment.rollNumber || "-",
        className: payment.className || "-",
        fatherName: payment.fatherName || "-",
        academicYear: payment.academicYearName || "-",
        paymentDate: formatDate(payment.paymentDate),
        paymentMode: payment.paymentMode || "-",
        remarks: payment.remarks || "-",
        paidAmountNum: Number(payment.amount || 0),
        balanceDueNum: balanceDue,
        concession,
        componentLedger
    };
};

export const printReceipt = async (paymentId) => {
    try {
        const model = await buildReceiptModel(paymentId);
        const {
            payment, receiptNumber, studentName, rollNumber, className, fatherName,
            academicYear, paymentDate, paymentMode, remarks, componentLedger, concession
        } = model;

        const receiptWindow = window.open("", "_blank", "width=900,height=1100");
        if (!receiptWindow) {
            toast("Please allow popups to print the receipt.");
            return;
        }

        const paidAmount = formatMoney(model.paidAmountNum);
        const formattedBalance = formatMoney(model.balanceDueNum);
        const logoUrl = window.location.origin + "/logo.png";

        let feeRowsHTML = "";
        componentLedger.forEach(item => {
            const tick = item.paidNow > 0 ? ` <span style="color: #16a34a; font-weight: 900; font-size: 13px; margin-left: 4px;">&#10003;</span>` : "";
            const paidNowDisplay = item.paidNow > 0 ? `₹ ${formatMoney(item.paidNow)}` : "-"; 
            const balanceColor = item.balance > 0 ? "#dc2626" : "#16a34a"; 
            const modeDisplay = item.paidNow > 0 ? (item.mode || paymentMode || "-") : "-";
            const dateDisplay = item.paidNow > 0 ? (item.date || paymentDate || "-") : "-";

            feeRowsHTML += `
                <tr>
                    <td>${item.name}${tick}</td>
                    <td style="text-align:right;">₹ ${formatMoney(item.total)}</td>
                    <td style="text-align:right; color:#16a34a; font-weight:bold;">${paidNowDisplay}</td>
                    <td style="text-align:center; font-size:9px;">${modeDisplay}</td>
                    <td style="text-align:center; font-size:9px;">${dateDisplay}</td>
                    <td style="text-align:right; color:${balanceColor};">₹ ${formatMoney(item.balance)}</td>
                </tr>
            `;
        });

        if (concession > 0) {
            feeRowsHTML += `
                <tr style="background-color: #f0fdf4;">
                    <td><strong>Concession (Discount)</strong></td>
                    <td style="text-align:right; color: #16a34a;" colspan="5"><strong>- ₹ ${formatMoney(concession)}</strong></td>
                </tr>
            `;
        }

        const buildReceiptHTML = (copyType) => `
            <div class="receipt">
                <div class="school-header">
                    <img src="${logoUrl}" alt="Logo" class="school-logo" onerror="this.style.display='none'" />
                    <div class="school-info">
                        <h1>THE AGE SCHOOL</h1>
                        <p>Contact: +91 9590952550, +91 9886288613 | Email: theageschool@gmail.com</p>
                        <p>UPI ID: <strong>headm84312627@barodampay</strong></p>
                    </div>
                </div>
                <div class="copy-title">${copyType}</div>
                
                <div class="receipt-top">
                    <div>Receipt No: <strong>${receiptNumber}</strong></div>
                    <div>Date: <strong>${paymentDate}</strong></div>
                </div>
                
                <table class="receipt-meta-table">
                    <tr>
                        <td><strong>Student Name:</strong> ${studentName}</td>
                        <td><strong>Academic Year:</strong> ${academicYear}</td>
                    </tr>
                    <tr>
                        <td><strong>Roll No / Class:</strong> ${rollNumber} &nbsp;|&nbsp; <strong>${className}</strong></td>
                        <td><strong>Father's Name:</strong> ${fatherName}</td>
                    </tr>
                </table>

                <div class="breakdown-title">Precise Fee Structure Breakdown</div>
                <table class="fee-breakdown-table">
                    <thead>
                        <tr>
                            <th>Fee Component</th>
                            <th style="text-align:right;">Total Fee</th>
                            <th style="text-align:right;">Paid Now</th>
                            <th style="text-align:center;">Mode</th>
                            <th style="text-align:center;">Date</th>
                            <th style="text-align:right;">Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${feeRowsHTML || `<tr><td colspan="6" style="text-align:center;">Standard Structured Fees</td></tr>`}
                    </tbody>
                </table>

                <table class="receipt-table" style="margin-top: 4px;">
                    <tr class="amount-row">
                        <td class="label">Total Amount Paid Now</td>
                        <td style="text-align:right;"><span class="amount-value">₹ ${paidAmount}</span></td>
                    </tr>
                    <tr>
                        <td class="label">Total Remaining Balance Due</td>
                        <td style="text-align:right;"><span class="balance-value">₹ ${formattedBalance}</span></td>
                    </tr>
                </table>

                <div class="payment-section">
                    <div class="payment-details">
                        <div class="payment-box"><strong>Payment Mode:</strong> ${paymentMode}</div>
                        <div class="payment-box"><strong>Status:</strong> Completed</div>
                    </div>
                </div>
                <div class="remarks"><strong>Remarks:</strong> ${remarks}</div>
                
                <div class="push-bottom">
                    <div class="signatures">
                        <div class="signature-box"><div class="signature-line">${copyType === 'STUDENT COPY' ? 'Parent / Guardian Signature' : 'Cashier / Receiver'}</div></div>
                        <div class="signature-box"><div class="signature-line">Authorized Signatory</div></div>
                    </div>
                    <div class="receipt-footer">${copyType === 'STUDENT COPY' ? 'Computer generated fee receipt • Retain for your records' : 'School Copy — Retain for administrative records'}</div>
                </div>
            </div>
        `;

        receiptWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Fee Receipt - ${receiptNumber}</title>
                <style>
                    * { box-sizing: border-box; }
                    @page { size: A4 portrait; margin: 4mm; }
                    body { margin: 0; padding: 0; background: #ffffff; color: #111111; font-family: Arial, Helvetica, sans-serif; }
                    .page { width: 100%; max-width: 195mm; height: 285mm; margin: 0 auto; display: flex; flex-direction: column; justify-content: space-between; }
                    .receipt { width: 100%; height: 48.5%; border: 1.5px solid #111111; padding: 4mm 6mm; position: relative; display: flex; flex-direction: column; }
                    .cut-line { height: 3%; display: flex; align-items: center; gap: 6px; color: #555; font-size: 9px; justify-content: center; }
                    .cut-line::before, .cut-line::after { content: ""; flex: 1; border-top: 1px dashed #666; }
                    .school-header { position: relative; display: flex; align-items: center; justify-content: center; border-bottom: 2px solid #111111; padding-bottom: 6px; margin-bottom: 4px; min-height: 45px; }
                    .school-logo { position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 44px; height: 44px; object-fit: contain; }
                    .school-info { text-align: center; width: 100%; }
                    .school-info h1 { margin: 0; font-size: 19px; font-weight: 800; letter-spacing: 0.5px; }
                    .school-info p { margin: 2px 0 0; font-size: 9.5px; color: #222; }
                    .copy-title { text-align: center; font-size: 11px; font-weight: 800; margin: 3px 0; letter-spacing: 1px; text-transform: uppercase; }
                    .receipt-top { display: flex; justify-content: space-between; font-size: 10.5px; margin-bottom: 3px; }
                    .receipt-meta-table { width: 100%; border-collapse: collapse; margin-bottom: 3px; }
                    .receipt-meta-table td { padding: 3px 5px; border: 1px solid #cbd5e1; font-size: 10px; }
                    .breakdown-title { font-size: 10px; font-weight: 700; background: #f1f5f9; padding: 3px 5px; border: 1px solid #cbd5e1; border-bottom: none; margin-top: 3px; }
                    .fee-breakdown-table { width: 100%; border-collapse: collapse; margin-bottom: 3px; }
                    .fee-breakdown-table th, .fee-breakdown-table td { padding: 3px 5px; border: 1px solid #cbd5e1; font-size: 9.5px; }
                    .fee-breakdown-table th { background: #f8fafc; text-align: left; }
                    .receipt-table { width: 100%; border-collapse: collapse; }
                    .receipt-table td { padding: 3px 5px; border: 1px solid #cbd5e1; font-size: 10px; vertical-align: middle; }
                    .receipt-table .label { width: 50%; font-weight: 700; background: #f8fafc; }
                    .amount-row td { font-size: 12px; font-weight: 700; }
                    .amount-value { font-size: 13px; color: #16a34a; }
                    .balance-value { font-size: 12px; color: #dc2626; font-weight: 700; }
                    .payment-section { margin-top: 3px; font-size: 9.5px; }
                    .payment-details { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
                    .payment-box { border: 1px solid #cbd5e1; padding: 3px 5px; font-size: 9.5px; background: #fdfdfd; }
                    .remarks { margin-top: 3px; border: 1px solid #cbd5e1; padding: 3px 5px; min-height: 18px; font-size: 9.5px; background: #fdfdfd; }
                    .push-bottom { margin-top: auto; }
                    .signatures { display: flex; justify-content: space-between; gap: 20px; margin-top: 8px; }
                    .signature-box { width: 40%; text-align: center; font-size: 9px; }
                    .signature-line { border-top: 1px solid #111111; margin-top: 16px; padding-top: 2px; }
                    .receipt-footer { margin-top: 4px; padding-top: 2px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 8px; color: #4b5563; }
                    @media screen and (max-width: 600px) {
                        body { overflow-x: auto; }
                        .receipt { padding: 2mm 3mm; }
                        .fee-breakdown-table, .receipt-meta-table, .receipt-table { font-size: 8px; }
                        .fee-breakdown-table th, .fee-breakdown-table td,
                        .receipt-meta-table td, .receipt-table td { padding: 2px 3px; }
                        .signatures { gap: 8px; }
                    }
                    @media print { body { background: #ffffff; } .receipt { page-break-inside: avoid; } }
                </style>
            </head>
            <body>
                <div class="page">
                    ${buildReceiptHTML("STUDENT COPY")}
                    <div class="cut-line"><span>✂</span> CUT HERE <span>✂</span></div>
                    ${buildReceiptHTML("SCHOOL COPY")}
                </div>
            </body>
            </html>
        `);

        receiptWindow.document.close();
        setTimeout(() => { receiptWindow.focus(); receiptWindow.print(); }, 600);
    } catch (error) {
        console.error("Receipt Error:", error);
        toast(error.response?.data?.message || error.message || "Unable to generate receipt.");
    }
};




// =====================================================
// TC FEE RECEIPT (simplified)
// A TC is normally the last payment for a student, so this
// receipt shows only three figures — overall outstanding at
// TC time, the amount paid now, and the conceded balance —
// instead of the full fee-component ledger.
// =====================================================
export const printTcReceipt = async (tc) => {
    try {
        if (!tc) return toast("No TC collection to receipt.");

        // Mode + payment date come from the real payment row when available.
        let mode = "Cash";
        let payDate = tc.issuedAt || new Date().toISOString();
        if (tc.paymentId) {
            try {
                const pay = await api.get("/payments/receipt/" + tc.paymentId);
                if (pay.data?.paymentMode) mode = pay.data.paymentMode;
                if (pay.data?.paymentDate) payDate = pay.data.paymentDate;
            } catch (e) { /* keep TC-level fallbacks */ }
        }

        const moneyText = (v) => "\u20B9 " + formatMoney(v);
        const outstanding = Number(tc.balance || 0);
        const paidNow = Number(tc.amountCollected || 0);
        const conceded = Number(tc.remainingAmount || 0);
        const tcNo = "TC/" + new Date(tc.issuedAt || Date.now()).getFullYear() + "/" + String(tc.id || "").padStart(4, "0");
        const school = "THE AGE SCHOOL";

        const body = (copy) => `
            <div class="receipt">
                <div class="school-info"><h1>${school}</h1><p>Fee Receipt &mdash; Transfer Certificate Settlement</p></div>
                <div class="copy-title">${copy}</div>
                <table class="meta">
                    <tr><td><b>Receipt No.</b> REC-${tc.paymentId || "-"}</td><td><b>Date</b> ${formatDate(payDate)}</td></tr>
                    <tr><td><b>TC No.</b> ${tcNo}</td><td><b>Session</b> ${tc.academicYear || "-"}</td></tr>
                </table>
                <table class="stu">
                    <tr><td><b>Student</b> ${tc.studentName || "-"}</td><td><b>Class</b> ${tc.className || "-"}</td></tr>
                    <tr><td><b>Roll / Admission</b> ${tc.rollNumber || "-"} / ${tc.admissionNumber || "-"}</td><td><b>Father</b> ${tc.fatherName || "-"}</td></tr>
                </table>
                <table class="amounts">
                    <tr><td>Overall outstanding fees at TC</td><td class="num">${moneyText(outstanding)}</td></tr>
                    <tr><td>Fees paid now</td><td class="num paid">${moneyText(paidNow)}</td></tr>
                    <tr><td>Conceded fee (written off)</td><td class="num conceded">${moneyText(conceded)}</td></tr>
                </table>
                <div class="note">Payment mode: <b>${mode}</b> &nbsp;|&nbsp; Collected at the TC counter.</div>
                <div class="sign"><span>Received by</span><span>Authorised Signatory</span></div>
            </div>`;

        const w = window.open("", "_blank", "width=760,height=900");
        if (!w) { toast("Please allow popups to print the receipt."); return; }
        w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>TC Fee Receipt - REC-${tc.paymentId || ""}</title>
            <style>
                * { box-sizing: border-box; }
                @page { size: A4 portrait; margin: 6mm; }
                body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; }
                .receipt { width: 100%; max-width: 180mm; min-height: 120mm; margin: 0 auto 8mm; border: 1.5px solid #111; padding: 6mm 8mm; }
                .school-info { text-align: center; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 6px; }
                .school-info h1 { margin: 0; font-size: 19px; font-weight: 800; letter-spacing: .5px; }
                .school-info p { margin: 2px 0 0; font-size: 10px; }
                .copy-title { text-align: center; font-size: 10px; font-weight: 800; letter-spacing: 1px; margin: 4px 0 8px; text-transform: uppercase; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
                td { padding: 5px 6px; border: 1px solid #cbd5e1; font-size: 11px; }
                .amounts td { font-size: 12px; padding: 8px 6px; }
                .amounts .num { text-align: right; font-weight: 700; white-space: nowrap; }
                .amounts .paid { color: #16a34a; }
                .amounts .conceded { color: #b45309; }
                .note { font-size: 10px; margin: 6px 0 18px; }
                .sign { display: flex; justify-content: space-between; font-size: 10px; }
                .sign span { width: 40%; text-align: center; border-top: 1px solid #111; padding-top: 4px; }
                .cut-line { text-align: center; font-size: 9px; color: #555; margin: 4px 0; }
                @media screen and (max-width: 600px) {
                    body { overflow-x: auto; }
                    .receipt { padding: 3mm; }
                    td { font-size: 10px; padding: 4px; }
                    .amounts td { font-size: 11px; }
                }
                @media print { .receipt { page-break-inside: avoid; } }
            </style></head><body>
                ${body("Student Copy")}
                <div class="cut-line">- - - - - - - - - - CUT HERE - - - - - - - - - -</div>
                ${body("School Copy")}
            </body></html>`);
        w.document.close();
        setTimeout(() => { w.focus(); w.print(); }, 600);
    } catch (error) {
        console.error("TC Receipt Error:", error);
        toast("Unable to generate TC receipt.");
    }
};
