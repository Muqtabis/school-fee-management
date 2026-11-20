import { toast } from "../services/notify";
import { useEffect, useState, Fragment } from "react";
import api from "../services/api";
import { printReceipt } from "../utils/receipt";

const formatMoney = (val) =>
    Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function SummaryTable({ payments = [], onReverse, onEdit }) {
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

    // =====================================================
    // SHARED RECEIPT MODEL
    //
    // Fetches the payment, the student's dues/concession and
    // full fee history, then computes the per-component ledger
    // (Total Fee / Paid Now / Balance). Both the printed receipt
    // and the Excel export are built from this single result so
    // their numbers always agree.
    // =====================================================
    // Receipt model + printer live in ../utils/receipt.js (shared with the student profile).

    // =====================================================
    // EXCEL RECEIPT
    //
    // Removed: the per-payment Excel receipt export. PDF receipts
    // (printReceipt above) are the single receipt format now, so the
    // "Excel" button and this exporter were dropped from the Payments page.
    // =====================================================

    return (
        <div className="table-container">
            <table className="stack-sm">
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
                            <td colSpan="10" className="empty-row" style={{ textAlign: "center", padding: "20px" }}>No payment records found.</td>
                        </tr>
                    ) : (
                        payments.map((payment, index) => (
                            <Fragment key={payment.id}>
                                <tr style={payment.status === "reversed" ? { opacity: 0.6 } : {}}>
                                    <td data-label="#">{index + 1}</td>
                                    <td data-label="Student">{payment.studentName || "-"}</td>
                                    <td data-label="Roll No.">{payment.rollNumber || "-"}</td>
                                    <td data-label="Class">{payment.className || "-"}</td>
                                    <td data-label="Academic Year">{payment.academicYearName || "-"}</td>
                                    <td data-label="Amount"><strong>₹ {Number(payment.amount || 0).toLocaleString("en-IN")}</strong></td>
                                    <td data-label="Date">{formatDate(payment.paymentDate)}</td>
                                    <td data-label="Mode"><span className={`payment-badge ${getModeClass(payment.paymentMode)}`}>{payment.paymentMode}</span></td>
                                    <td data-label="Status">{payment.status === "reversed" ? <span className="payment-badge mode-default">Reversed</span> : <span className="payment-badge mode-upi">Completed</span>}</td>
                                    <td data-label="">
                                        <div className="action-buttons">
                                            {payment.status !== "reversed" && payment.editCount < 1 && <button className="edit-btn" onClick={() => onEdit(payment)}>Edit</button>}
                                            {payment.status !== "reversed" && <button className="receipt-btn" onClick={() => printReceipt(payment.id)}>Receipt</button>}
                                            {payment.status !== "reversed" && <button className="delete-btn" onClick={() => onReverse(payment)}>Reverse</button>}
                                        </div>
                                    </td>
                                </tr>
                                {payment.status === "reversed" && (
                                    <tr>
                                        <td colSpan="10" style={{ background: "var(--danger-bg)", padding: "7px 14px", fontSize: "12px", fontWeight: 600, color: "var(--danger)" }}>
                                            Reversed{payment.voidedAt ? ` on ${formatDate(payment.voidedAt)}` : ""} — Reason: {payment.voidReason || "Not recorded"}
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

export default SummaryTable;