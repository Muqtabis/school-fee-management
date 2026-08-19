const db = require("../db");


// =====================================================
// AUDIT LOGGER
// =====================================================

function logAudit({
    userId,
    action,
    entityType,
    entityId,
    details
}) {

    return new Promise(
        (resolve) => {

            db.run(
                `
                INSERT INTO audit_logs
                (
                    userId,
                    action,
                    entityType,
                    entityId,
                    details
                )
                VALUES (?, ?, ?, ?, ?)
                `,
                [
                    userId || null,
                    action,
                    entityType,
                    entityId || null,
                    details
                        ? JSON.stringify(details)
                        : null
                ],
                (err) => {

                    if (err) {

                        console.error(
                            "Audit log error:",
                            err.message
                        );

                    }

                    resolve();

                }
            );

        }
    );

}


module.exports = logAudit;