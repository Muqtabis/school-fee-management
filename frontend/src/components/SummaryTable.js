import { useEffect, useState } from "react";
import api from "../services/api";

function SummaryTable({ payments = [], onReverse }) {
    const formatDate = (date) => {
        if (!date) return "-";
        return new Date(date).toLocaleDateString("en-IN");
    };

    const getModeClass = (mode) => {
        switch (mode?.toLowerCase()) {
            case "cash": return "mode-cash";
            case "upi": return "mode-upi";
            case "card": return "mode-card";
            case "bank transfer": return "mode-bank";
            default: return "mode-default";
        }
    };

    const printReceipt = async (paymentId) => {
        try {
            const response = await api.get(`/payments/receipt/${paymentId}`);
            const payment = response.data;

            let feeItems = [];
            let prevDues = 0;
            let concession = 0;
            let balanceDue = 0;

            try {
                const studentRes = await api.get(`/students/${payment.studentId}`);
                const student = studentRes.data;
                prevDues = Number(student?.previousDues || 0);
                concession = Number(student?.concessionAmount || 0);
                
                const historyRes = await api.get(`/payments/history/student/${payment.studentId}`);
                const history = historyRes.data;

                feeItems = Array.isArray(history?.items) ? history.items : [];

                let standardTotal = feeItems.reduce((sum, item) => {
                    if (item.itemType === "carry_forward" || item.componentName?.toLowerCase().includes("previous")) return sum;
                    return sum + Number(item.amount || 0);
                }, 0);

                const netAcademicFee = Math.max(0, standardTotal - concession);
                const totalDemand = prevDues + netAcademicFee;
                const totalPaid = Number(history?.totalPaid || 0);
                balanceDue = Math.max(0, totalDemand - totalPaid);
            } catch (err) {
                console.error("Could not fetch detailed fee breakdown for receipt:", err);
            }

            const receiptWindow = window.open("", "_blank", "width=900,height=1100");
            if (!receiptWindow) {
                alert("Please allow popups to print the receipt.");
                return;
            }

            const receiptNumber = `REC-${payment.id}`;
            const studentName = payment.studentName || "-";
            const rollNumber = payment.rollNumber || "-";
            const className = payment.className || "-";
            const fatherName = payment.fatherName || "-";
            const academicYear = payment.academicYearName || "-";
            const paymentDate = formatDate(payment.paymentDate);
            const paymentMode = payment.paymentMode || "-";
            const remarks = payment.remarks || "-";
            
            const formatMoney = (val) => Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const paidAmount = formatMoney(payment.amount);
            const formattedBalance = formatMoney(balanceDue);

            const logoUrl = window.location.origin + "/logo.png";

            let feeRowsHTML = "";
            if (prevDues > 0) {
                feeRowsHTML += `<tr><td>Previous Dues (Carry Forward)</td><td style="text-align:right;">₹ ${formatMoney(prevDues)}</td></tr>`;
            }
            feeItems.forEach(item => {
                if (item.itemType !== "carry_forward" && !item.componentName?.toLowerCase().includes("previous")) {
                    feeRowsHTML += `<tr><td>${item.componentName}</td><td style="text-align:right;">₹ ${formatMoney(item.amount)}</td></tr>`;
                }
            });
            if (concession > 0) {
                feeRowsHTML += `<tr style="color: #16a34a;"><td>Fee Concession (${payment.concessionReason || "Discount"})</td><td style="text-align:right;">- ₹ ${formatMoney(concession)}</td></tr>`;
            }

            const buildReceiptHTML = (copyType) => `
                <div class="receipt">
                    <div class="school-header">
                        <img src="${logoUrl}" alt="Logo" class="school-logo" onerror="this.style.display='none'" />
                        <div class="school-info">
                            <h1>THE AGE SCHOOL</h1>
                            <p>Contact: +91 9590952550, +91 8143782068 | Email: theageschool@gmail.com</p>
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

                    <div class="breakdown-title">Fee Structure Breakdown</div>
                    <table class="fee-breakdown-table">
                        <thead>
                            <tr>
                                <th>Fee Component</th>
                                <th style="text-align:right;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${feeRowsHTML || `<tr><td colspan="2" style="text-align:center;">Standard Structured Fees</td></tr>`}
                        </tbody>
                    </table>

                    <table class="receipt-table" style="margin-top: 4px;">
                        <tr class="amount-row">
                            <td class="label">Amount Paid Now</td>
                            <td style="text-align:right;"><span class="amount-value">₹ ${paidAmount}</span></td>
                        </tr>
                        <tr>
                            <td class="label">Remaining Balance Due</td>
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
                        body {
                            margin: 0;
                            padding: 0;
                            background: #ffffff;
                            color: #111111;
                            font-family: Arial, Helvetica, sans-serif;
                        }
                        .page { 
                            width: 100%; 
                            max-width: 195mm; 
                            height: 285mm; 
                            margin: 0 auto; 
                            display: flex; 
                            flex-direction: column; 
                            justify-content: space-between;
                        }
                        .receipt {
                            width: 100%;
                            height: 48.5%;
                            border: 1.5px solid #111111;
                            padding: 4mm 6mm;
                            position: relative;
                            display: flex;
                            flex-direction: column;
                        }
                        .cut-line {
                            height: 3%;
                            display: flex;
                            align-items: center;
                            gap: 6px;
                            color: #555;
                            font-size: 9px;
                            justify-content: center;
                        }
                        .cut-line::before, .cut-line::after {
                            content: "";
                            flex: 1;
                            border-top: 1px dashed #666;
                        }

                        .school-header {
                            position: relative;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            border-bottom: 2px solid #111111;
                            padding-bottom: 6px;
                            margin-bottom: 4px;
                            min-height: 45px;
                        }
                        .school-logo {
                            position: absolute;
                            left: 0;
                            top: 50%;
                            transform: translateY(-50%);
                            width: 44px;
                            height: 44px;
                            object-fit: contain;
                        }
                        .school-info { text-align: center; width: 100%; }
                        .school-info h1 {
                            margin: 0;
                            font-size: 19px;
                            font-weight: 800;
                            letter-spacing: 0.5px;
                        }
                        .school-info p {
                            margin: 2px 0 0;
                            font-size: 9.5px;
                            color: #222;
                        }
                        .copy-title {
                            text-align: center;
                            font-size: 11px;
                            font-weight: 800;
                            margin: 3px 0;
                            letter-spacing: 1px;
                            text-transform: uppercase;
                        }
                        .receipt-top {
                            display: flex;
                            justify-content: space-between;
                            font-size: 10.5px;
                            margin-bottom: 3px;
                        }
                        .receipt-meta-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 3px;
                        }
                        .receipt-meta-table td {
                            padding: 3px 5px;
                            border: 1px solid #cbd5e1;
                            font-size: 10px;
                        }
                        .breakdown-title {
                            font-size: 10px;
                            font-weight: 700;
                            background: #f1f5f9;
                            padding: 3px 5px;
                            border: 1px solid #cbd5e1;
                            border-bottom: none;
                            margin-top: 3px;
                        }
                        .fee-breakdown-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 3px;
                        }
                        .fee-breakdown-table th, .fee-breakdown-table td {
                            padding: 3px 5px;
                            border: 1px solid #cbd5e1;
                            font-size: 9.5px;
                        }
                        .fee-breakdown-table th {
                            background: #f8fafc;
                            text-align: left;
                        }
                        .receipt-table {
                            width: 100%;
                            border-collapse: collapse;
                        }
                        .receipt-table td {
                            padding: 3px 5px;
                            border: 1px solid #cbd5e1;
                            font-size: 10px;
                            vertical-align: middle;
                        }
                        .receipt-table .label {
                            width: 50%;
                            font-weight: 700;
                            background: #f8fafc;
                        }
                        .amount-row td {
                            font-size: 12px;
                            font-weight: 700;
                        }
                        .amount-value { font-size: 13px; color: #16a34a; }
                        .balance-value { font-size: 12px; color: #dc2626; font-weight: 700; }
                        
                        .payment-section { margin-top: 3px; font-size: 9.5px; }
                        .payment-details {
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 4px;
                        }
                        .payment-box {
                            border: 1px solid #cbd5e1;
                            padding: 3px 5px;
                            font-size: 9.5px;
                            background: #fdfdfd;
                        }
                        .remarks {
                            margin-top: 3px;
                            border: 1px solid #cbd5e1;
                            padding: 3px 5px;
                            min-height: 18px;
                            font-size: 9.5px;
                            background: #fdfdfd;
                        }

                        .push-bottom {
                            margin-top: auto;
                        }

                        .signatures {
                            display: flex;
                            justify-content: space-between;
                            gap: 20px;
                            margin-top: 8px;
                        }
                        .signature-box {
                            width: 40%;
                            text-align: center;
                            font-size: 9px;
                        }
                        .signature-line {
                            border-top: 1px solid #111111;
                            margin-top: 16px;
                            padding-top: 2px;
                        }
                        .receipt-footer {
                            margin-top: 4px;
                            padding-top: 2px;
                            border-top: 1px solid #e2e8f0;
                            text-align: center;
                            font-size: 8px;
                            color: #4b5563;
                        }
                        @media print {
                            body { background: #ffffff; }
                            .receipt { page-break-inside: avoid; }
                        }
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
            
            setTimeout(() => {
                receiptWindow.focus();
                receiptWindow.print();
            }, 600);

        } catch (error) {
            console.error("Receipt Error:", error);
            alert(error.response?.data?.message || error.message || "Unable to generate receipt.");
        }
    };

    return (
        <div className="table-container">
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Student</th>
                        <th>Roll No.</th>
                        <th>Class</th>
                        <th>Academic Year</th>
                        <th>Amount</th>
                        <th>Date</th>
                        <th>Mode</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {payments.length === 0 ? (
                        <tr>
                            <td colSpan="10" className="empty-row" style={{ textAlign: "center", padding: "20px" }}>
                                No payment records found.
                            </td>
                        </tr>
                    ) : (
                        payments.map((payment, index) => (
                            <tr key={payment.id} style={payment.status === "reversed" ? { opacity: 0.6 } : {}}>
                                <td>{index + 1}</td>
                                <td>{payment.studentName || "-"}</td>
                                <td>{payment.rollNumber || "-"}</td>
                                <td>{payment.className || "-"}</td>
                                <td>{payment.academicYearName || "-"}</td>
                                <td><strong>₹ {Number(payment.amount || 0).toLocaleString("en-IN")}</strong></td>
                                <td>{formatDate(payment.paymentDate)}</td>
                                <td>
                                    <span className={`payment-badge ${getModeClass(payment.paymentMode)}`}>
                                        {payment.paymentMode}
                                    </span>
                                </td>
                                <td>
                                    {payment.status === "reversed" ? (
                                        <span className="payment-badge mode-default">Reversed</span>
                                    ) : (
                                        <span className="payment-badge mode-upi">Completed</span>
                                    )}
                                </td>
                                <td>
                                    <div className="action-buttons">
                                        {payment.status !== "reversed" && (
                                            <button className="receipt-btn" onClick={() => printReceipt(payment.id)}>
                                                Receipt
                                            </button>
                                        )}
                                        {payment.status !== "reversed" && (
                                            <button className="delete-btn" onClick={() => onReverse(payment)}>
                                                Reverse
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

export default SummaryTable;