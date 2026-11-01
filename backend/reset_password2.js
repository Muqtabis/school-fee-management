const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/school.db');

db.run('UPDATE users SET password = ? WHERE email = ?', ['$2b$10$N7d0la0wAenlT1PaQTBFNOgwBZ3HK7f7nmrUHy0bWMDWs1B1IAbGq', 'accountant@tas'], function(err) {
    if (err) {
        console.error('Error updating password:', err.message);
    } else {
        console.log(`Password reset for accountant@tas. Rows updated: ${this.changes}`);
    }
    db.close();
});