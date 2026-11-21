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
            prevDuesRow,
            netFeeRow,
            concessionRow,
            paymentRow,
            expenseRow,
            incomeRow,
            tcCollectedRow
        ] = await Promise.all([
            one(
                `SELECT COUNT(*) AS total
                 FROM student_enrollments se
                 INNER JOIN students s ON s.id = se.studentId
                 WHERE se.academicYearId = ? AND se.status = 'active'
                   AND (s.status IS NULL OR s.status = 'active')`,
                [year.id]
            ),
            one(
                `SELECT COUNT(*) AS total FROM users WHERE role = 'teacher'`
            ),
            // All fee items for the active year. "carry_forward"/"previous"
            // items are skipped here because previous-year dues are added
            // separately from the student record below (no double counting).
            one(
                `SELECT COALESCE(SUM(
                            CASE WHEN sfi.itemType = 'carry_forward'
                                  OR LOWER(COALESCE(fc.componentName, '')) LIKE '%previous%'
                                 THEN 0 ELSE sfi.amount END), 0) AS totalFee
                 FROM student_fee_items sfi
                 INNER JOIN student_fee_accounts sfa ON sfa.id = sfi.feeAccountId
                 INNER JOIN student_enrollments se ON se.id = sfa.enrollmentId
                 INNER JOIN students s ON s.id = se.studentId
                 LEFT JOIN fee_components fc ON fc.id = sfi.componentId
                 WHERE se.academicYearId = ? AND se.status = 'active'
                   AND (s.status IS NULL OR s.status = 'active')`,
                [year.id]
            ),
            // Previous-year dues carried by the same active students.
            one(
                `SELECT COALESCE(SUM(MAX(COALESCE(s.previousDues, 0) - COALESCE(s.previousDuesConcession, 0), 0)), 0) AS total
                 FROM student_enrollments se
                 INNER JOIN students s ON s.id = se.studentId
                 WHERE se.academicYearId = ? AND se.status = 'active'
                   AND (s.status IS NULL OR s.status = 'active')`,
                [year.id]
            ),
            // Net demand using the SAME per-student rule as Reports and the
            // student profile: previous dues + max(fee items - concession, 0).
            // A concession larger than a student's fee is floored (not carried
            // into another student's total), so every page agrees.
            one(
                `SELECT COALESCE(SUM(
                            MAX(COALESCE(s.previousDues, 0) - COALESCE(s.previousDuesConcession, 0), 0)
                            + MAX(COALESCE(d.standardNet, 0) - COALESCE(s.concessionAmount, 0), 0)
                        ), 0) AS total
                 FROM student_enrollments se
                 INNER JOIN students s ON s.id = se.studentId
                 LEFT JOIN student_fee_accounts sfa ON sfa.enrollmentId = se.id
                 LEFT JOIN (
                     SELECT sfi.feeAccountId,
                            COALESCE(SUM(CASE WHEN sfi.itemType = 'carry_forward'
                                               OR LOWER(COALESCE(fc.componentName, '')) LIKE '%previous%'
                                               THEN 0 ELSE sfi.amount END), 0) AS standardNet
                     FROM student_fee_items sfi
                     INNER JOIN fee_components fc ON fc.id = sfi.componentId
                     GROUP BY sfi.feeAccountId
                 ) d ON d.feeAccountId = sfa.id
                 WHERE se.academicYearId = ? AND se.status = 'active'
                   AND (s.status IS NULL OR s.status = 'active')`,
                [year.id]
            ),
            one(
                `SELECT COALESCE(SUM(s.concessionAmount), 0) AS totalConcessions
                 FROM student_enrollments se
                 INNER JOIN students s ON s.id = se.studentId
                 WHERE se.academicYearId = ? AND se.status = 'active'
                   AND (s.status IS NULL OR s.status = 'active')`,
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
                 WHERE (status IS NULL OR status != 'reversed')
                   AND substr(COALESCE(expenseDate,''),1,4) = substr(?,1,4)`,
                [year.name]
            ),
            one(
                `SELECT COUNT(*) AS totalIncomes,
                        COALESCE(SUM(amount), 0) AS totalIncomeAmount
                 FROM incomes
                 WHERE (status IS NULL OR status != 'reversed')
                   AND substr(COALESCE(incomeDate,''),1,4) = substr(?,1,4)`,
                [year.name]
            ),
            // Cash actually collected at the TC counter (active year only).
            one(
                `SELECT COALESCE(SUM(amountCollected), 0) AS total
                 FROM transfer_certificates
                 WHERE academicYear = ?`,
                [year.name]
            )
        ]);

        // "Total Fees" is the sum of everything owed: current-year fee items
        // plus previous-year dues (matching Reports and the student profile).
        const totalFee = Number(feeRow.totalFee || 0) + Number(prevDuesRow.total || 0);
        const totalConcessions = Number(concessionRow.totalConcessions || 0);
        const totalCollection = Number(paymentRow.totalCollection || 0);
        const netFee = Math.max(0, Number(netFeeRow.total || 0));
        const pendingFees = Math.max(0, netFee - totalCollection);
        const totalExpenseAmount = Number(expenseRow.totalExpenseAmount || 0);
        const totalIncomeAmount = Number(incomeRow.totalIncomeAmount || 0);
        const tcCollected = Number(tcCollectedRow.total || 0);

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
            tcCollected: restricted ? 0 : tcCollected,
            totalCollection: restricted ? 0 : totalCollection,
            pendingFees: restricted ? 0 : pendingFees,
            totalExpenses: restricted ? 0 : Number(expenseRow.totalExpenses || 0),
            totalExpenseAmount: restricted ? 0 : totalExpenseAmount,
            totalIncomes: restricted ? 0 : Number(incomeRow.totalIncomes || 0),
            totalIncomeAmount: restricted ? 0 : totalIncomeAmount,
            netBalance: restricted ? 0 : totalCollection + totalIncomeAmount - totalExpenseAmount
        });
    } catch (error) {
        console.error("Dashboard Summary Error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to load dashboard summary."
        });
    }
};
