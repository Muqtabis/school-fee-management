const express = require("express");

const router = express.Router();

const studentController =
    require("../controllers/studentController");


/*
GET ALL STUDENTS

Examples:

/students

/students?className=LKG

/students?className=5

/students?search=rahul

/students?className=5&search=rahul
*/

router.get(
    "/",
    studentController.getStudents
);


/*
GET SINGLE STUDENT
*/

router.get(
    "/:id",
    studentController.getStudent
);


/*
ADD STUDENT
*/

router.post(
    "/",
    studentController.addStudent
);


/*
UPDATE STUDENT
*/

router.put(
    "/:id",
    studentController.updateStudent
);


/*
DELETE STUDENT
*/

router.delete(
    "/:id",
    studentController.deleteStudent
);


module.exports = router;