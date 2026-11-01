const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/school.db');

db.run('UPDATE users SET password = ? WHERE email = ?', ['$2b$10$EsEPnUMICj4hW.bZgKfj8OMf8rb0blgRuevJo6oEUS4Lb6gQMjz6.', 'accountant@tas'], function(err) {
    if (err) {
        console.error('Error updating password:', err.message);
    } else {
        console.log(`Password reset for accountant@tas. Rows updated: ${this.changes}`);
    }
    db.close();
});