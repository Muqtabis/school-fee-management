const db = require('./db');

async function resetFees() {
    try {
        console.log("Sweeping out old fee components and test structures...");
        
        // 1. Delete the student bills that are locking the components
        await db.runQuery("DELETE FROM student_fee_items");
        
        // 2. Delete the class structures that are locking the components
        await db.runQuery("DELETE FROM class_fee_items");
        await db.runQuery("DELETE FROM class_fee_structures");
        
        // 3. Now it is 100% safe to delete the old master components
        await db.runQuery("DELETE FROM fee_components");
        
        console.log("\n✅ Success! All old fee components have been completely purged.");
        console.log("Your Admin account, Academic Years, and Students were NOT touched.\n");
        
        process.exit(0);
    } catch (error) {
        console.error("Error cleaning database:", error);
        process.exit(1);
    }
}

// Give the database 1 second to connect before running
setTimeout(resetFees, 1000);