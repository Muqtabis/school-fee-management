// =====================================================
// DASHBOARD SUMMARY
//
// Single endpoint that feeds the Dashboard page.
//
// Why not reuse /payments/summary and /expenses/summary?
// Those live behind the "payments" / "expenses" PAGE guards,
// so a principal or manager who was only granted "dashboard"
// would get 403s and see an all-zero dashboard.
//
// Access: role-guarded only (admin, accountant, principal,
// manager). Financial figures (fees, collections, pending,
// concessions, expenses) are ZEROED for principal and
// manager — they only see head-count cards (Students,
// Teachers) on the dashboard.
// =====================================================

const db = require("../db");

const activePaymentCondition = `
    (
        status IS NULL
        OR status != 'reversed'
    )
`;

const getActiveYear = () =>
    new Promise((resolve, reject) => {
        db.get(
            `SELECT * FROM academic_years WHERE status = 'active' LIMIT 1`,
            [],
            (err, year) => (err ? reject(err) : resolve(year))
        );
    });

const one = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || {})));
    });

exports.summary = async (req, res) => {
    try {
        const year = await getActiveYear();
        if (!year) {
            return res.status(404).json({
                success: false,
                message: "No active academic year."
            });
        }

        // Principal and manager get a restricted view: no money figures.
        const restricted =
            req.user.role === "principal" || req.user.role === "manager";

        const [
            studentRow,
            teacherRow,
            feeRow,
            concessionRow,
            paymentRow,
            expenseRow
        ] = await Promise.all([
            one(
                `SELECT COUNT(*) AS total
                 FROM student_enrollments
                 WHERE academicYearId = ? AND status = 'active'`,
                [year.id]
            ),
            one(
                `SELECT COUNT(*) AS total FROM users WHERE role = 'teacher'`
            ),
            one(
                `SELECT COALESCE(SUM(sfi.amount), 0) AS totalFee
                 FROM student_fee_items sfi
                 INNER JOIN student_fee_accounts sfa ON sfa.id = sfi.feeAccountId
                 INNER JOIN student_enrollments se ON se.id = sfa.enrollmentId
                 WHERE se.academicYearId = ? AND se.status = 'active'`,
                [year.id]
            ),
            one(
                `SELECT COALESCE(SUM(s.concessionAmount), 0) AS totalConcessions
                 FROM student_enrollments se
                 INNER JOIN students s ON s.id = se.studentId
                 WHERE se.academicYearId = ? AND se.status = 'active'`,
                [year.id]
            ),
            one(
                `SELECT COUNT(*) AS totalPayments,
                        COALESCE(SUM(amount), 0) AS totalCollection
                 FROM payments
                 WHERE feeAccountId IN (
                     SELECT sfa.id FROM student_fee_accounts sfa
                     INNER JOIN student_enrollments se ON se.id = sfa.enrollmentId
                     WHERE se.academicYearId = ?
                 ) AND ${activePaymentCondition}`,
                [year.id]
            ),
            one(
                `SELECT COUNT(*) AS totalExpenses,
                        COALESCE(SUM(amount), 0) AS totalExpenseAmount
                 FROM expenses
                 WHERE status IS NULL OR status != 'reversed'`
            )
        ]);

        const totalFee = Number(feeRow.totalFee || 0);
        const totalConcessions = Number(concessionRow.totalConcessions || 0);
        const totalCollection = Number(paymentRow.totalCollection || 0);
        const netFee = Math.max(0, totalFee - totalConcessions);
        const pendingFees = Math.max(0, netFee - totalCollection);
        const totalExpenseAmount = Number(expenseRow.totalExpenseAmount || 0);

        res.json({
            success: true,
            academicYear: { id: year.id, name: year.name },
            // Head counts — visible to everyone.
            totalStudents: Number(studentRow.total || 0),
            totalTeachers: Number(teacherRow.total || 0),
            // Financial figures — zeroed for principal / manager.
            totalPayments: restricted ? 0 : Number(paymentRow.totalPayments || 0),
            totalFee: restricted ? 0 : totalFee,
            totalConcessions: restricted ? 0 : totalConcessions,
            netFee: restricted ? 0 : netFee,
            totalCollection: restricted ? 0 : totalCollection,
            pendingFees: restricted ? 0 : pendingFees,
            totalExpenses: restricted ? 0 : Number(expenseRow.totalExpenses || 0),
            totalExpenseAmount: restricted ? 0 : totalExpenseAmount,
            netBalance: restricted ? 0 : totalCollection - totalExpenseAmount
        });
    } catch (error) {
        console.error("Dashboard Summary Error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to load dashboard summary."
        });
    }
};
