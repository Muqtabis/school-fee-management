import { useEffect, useState } from "react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import StudentForm from "../components/StudentForm";
import StudentSearch from "../components/StudentSearch";

import api from "../services/api";


function StudentsPage() {

    const [students, setStudents] =
        useState([]);

    const [filteredStudents, setFilteredStudents] =
        useState([]);

    const [selectedStudent, setSelectedStudent] =
        useState(null);

    const [showForm, setShowForm] =
        useState(false);

    const [selectedClass, setSelectedClass] =
        useState("All");

    const [searchKeyword, setSearchKeyword] =
        useState("");


    const [historyStudent, setHistoryStudent] =
        useState(null);


    const classes = [

        "LKG",
        "UKG",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10"

    ];


    useEffect(() => {

        fetchStudents();

    }, []);


    const fetchStudents = async () => {

        try {

            const res =
                await api.get("/students");

            setStudents(res.data);

            setFilteredStudents(res.data);

        } catch (error) {

            console.error(error);

        }

    };


    const filterStudents = (
        search,
        classFilter
    ) => {

        const keyword =
            search.toLowerCase().trim();


        const result =
            students.filter((student) => {

                const matchesSearch =
                    !keyword ||

                    student.studentName
                        ?.toLowerCase()
                        .includes(keyword) ||

                    student.rollNumber
                        ?.toLowerCase()
                        .includes(keyword) ||

                    student.className
                        ?.toLowerCase()
                        .includes(keyword) ||

                    student.fatherName
                        ?.toLowerCase()
                        .includes(keyword) ||

                    student.contact1
                        ?.toLowerCase()
                        .includes(keyword);


                const matchesClass =
                    classFilter === "All" ||
                    student.className === classFilter;


                return (
                    matchesSearch &&
                    matchesClass
                );

            });


        setFilteredStudents(result);

    };


    const handleSearch = (value) => {

        setSearchKeyword(value);

        filterStudents(
            value,
            selectedClass
        );

    };


    const handleClassChange = (e) => {

        const value = e.target.value;

        setSelectedClass(value);

        filterStudents(
            searchKeyword,
            value
        );

    };


    const handleEdit = (student) => {

        setSelectedStudent(student);

        setShowForm(true);

    };


    const handleDelete = async (id) => {

        const confirmDelete =
            window.confirm(
                "Delete this student?"
            );


        if (!confirmDelete) return;


        try {

            await api.delete(
                `/students/${id}`
            );

            fetchStudents();

        } catch (error) {

            alert(
                error.response?.data?.message ||
                "Unable to delete student."
            );

        }

    };


    const handleAddStudent = () => {

        setSelectedStudent(null);

        setShowForm(true);

    };


    const getClassDisplay = (className) => {

        if (
            className === "LKG" ||
            className === "UKG"
        ) {

            return className;

        }


        return `${className} Standard`;

    };


    return (

        <div className="dashboard">

            <Sidebar />


            <div className="main-content">

                <Navbar />


                <div className="page-content">

                    <div className="page-header">

                        <div>

                            <h2>
                                Students
                            </h2>

                            <p>
                                Manage students,
                                classes and fee details.
                            </p>

                        </div>


                        <button
                            className="primary-btn"
                            onClick={
                                handleAddStudent
                            }
                        >

                            + Add Student

                        </button>

                    </div>


                    <div className="student-filters">

                        <StudentSearch
                            onSearch={
                                handleSearch
                            }
                        />


                        <select
                            className="filter-select"
                            value={selectedClass}
                            onChange={
                                handleClassChange
                            }
                        >

                            <option value="All">
                                All Classes
                            </option>


                            {classes.map(
                                (className) => (

                                    <option
                                        key={className}
                                        value={className}
                                    >

                                        {
                                            getClassDisplay(
                                                className
                                            )
                                        }

                                    </option>

                                )
                            )}

                        </select>

                    </div>


                    <div className="table-container">

                        <table>

                            <thead>

                                <tr>

                                    <th>#</th>

                                    <th>
                                        Roll No.
                                    </th>

                                    <th>
                                        Student
                                    </th>

                                    <th>
                                        Class
                                    </th>

                                    <th>
                                        Father
                                    </th>

                                    <th>
                                        Contact
                                    </th>

                                    <th>
                                        Fee
                                    </th>

                                    <th>
                                        Actions
                                    </th>

                                </tr>

                            </thead>


                            <tbody>

                                {filteredStudents.length === 0 ? (

                                    <tr>

                                        <td
                                            colSpan="8"
                                            style={{
                                                textAlign:
                                                    "center"
                                            }}
                                        >

                                            No students found.

                                        </td>

                                    </tr>

                                ) : (

                                    filteredStudents.map(
                                        (student, index) => (

                                            <tr
                                                key={
                                                    student.id
                                                }
                                            >

                                                <td>
                                                    {index + 1}
                                                </td>


                                                <td>

                                                    <strong>
                                                        {
                                                            student.rollNumber ||
                                                            "-"
                                                        }
                                                    </strong>

                                                </td>


                                                <td>
                                                    {
                                                        student.studentName
                                                    }
                                                </td>


                                                <td>

                                                    {
                                                        getClassDisplay(
                                                            student.className
                                                        )
                                                    }

                                                </td>


                                                <td>
                                                    {
                                                        student.fatherName
                                                    }
                                                </td>


                                                <td>
                                                    {
                                                        student.contact1
                                                    }
                                                </td>


                                                <td>

                                                    ₹{" "}
                                                    {Number(
                                                        student.tuitionFee ||
                                                        0
                                                    ).toLocaleString(
                                                        "en-IN"
                                                    )}

                                                </td>


                                                <td>

                                                    <div
                                                        className="action-buttons"
                                                    >

                                                        <button
                                                            className="history-btn"
                                                            onClick={() =>
                                                                setHistoryStudent(
                                                                    student
                                                                )
                                                            }
                                                        >

                                                            History

                                                        </button>


                                                        <button
                                                            className="edit-btn"
                                                            onClick={() =>
                                                                handleEdit(
                                                                    student
                                                                )
                                                            }
                                                        >

                                                            Edit

                                                        </button>


                                                        <button
                                                            className="delete-btn"
                                                            onClick={() =>
                                                                handleDelete(
                                                                    student.id
                                                                )
                                                            }
                                                        >

                                                            Delete

                                                        </button>

                                                    </div>

                                                </td>

                                            </tr>

                                        )
                                    )

                                )}

                            </tbody>

                        </table>

                    </div>

                </div>

            </div>


            {showForm && (

                <StudentForm
                    student={selectedStudent}

                    onClose={() => {

                        setShowForm(false);

                        fetchStudents();

                    }}
                />

            )}


            {historyStudent && (

                <FeeHistory
                    student={
                        historyStudent
                    }
                    onClose={() =>
                        setHistoryStudent(null)
                    }
                />

            )}

        </div>

    );

}


/*
====================================================
FEE HISTORY MODAL
====================================================
*/

function FeeHistory({
    student,
    onClose
}) {

    const [history, setHistory] =
        useState(null);

    const [loading, setLoading] =
        useState(true);


    useEffect(() => {

        fetchHistory();

    }, [student]);


    const fetchHistory = async () => {

        try {

            const res =
                await api.get(
                    `/payments/history/student/${student.id}`
                );

            setHistory(res.data);

        } catch (error) {

            console.error(error);

        } finally {

            setLoading(false);

        }

    };


    return (

        <div className="modal-overlay">

            <div className="history-modal">

                <div className="modal-header">

                    <div>

                        <h2>
                            Fee History
                        </h2>

                        <p>

                            {student.studentName}
                            {" • "}
                            Roll No:
                            {" "}
                            {student.rollNumber}

                        </p>

                    </div>


                    <button
                        className="close-btn"
                        onClick={onClose}
                    >

                        ✕

                    </button>

                </div>


                {loading ? (

                    <div className="history-loading">

                        Loading fee history...

                    </div>

                ) : history ? (

                    <>

                        <div className="fee-summary">

                            <div>

                                <span>
                                    Total Fee
                                </span>

                                <strong>
                                    ₹{" "}
                                    {Number(
                                        history.totalFee
                                    ).toLocaleString(
                                        "en-IN"
                                    )}
                                </strong>

                            </div>


                            <div>

                                <span>
                                    Total Paid
                                </span>

                                <strong>
                                    ₹{" "}
                                    {Number(
                                        history.totalPaid
                                    ).toLocaleString(
                                        "en-IN"
                                    )}
                                </strong>

                            </div>


                            <div>

                                <span>
                                    Balance
                                </span>

                                <strong>
                                    ₹{" "}
                                    {Number(
                                        history.balance
                                    ).toLocaleString(
                                        "en-IN"
                                    )}
                                </strong>

                            </div>

                        </div>


                        <div className="table-container">

                            <table>

                                <thead>

                                    <tr>

                                        <th>
                                            Date
                                        </th>

                                        <th>
                                            Amount
                                        </th>

                                        <th>
                                            Mode
                                        </th>

                                        <th>
                                            Remarks
                                        </th>

                                    </tr>

                                </thead>


                                <tbody>

                                    {history.payments.length === 0 ? (

                                        <tr>

                                            <td
                                                colSpan="4"
                                            >

                                                No payments
                                                found.

                                            </td>

                                        </tr>

                                    ) : (

                                        history.payments.map(
                                            (payment) => (

                                                <tr
                                                    key={
                                                        payment.id
                                                    }
                                                >

                                                    <td>
                                                        {
                                                            payment.paymentDate
                                                        }
                                                    </td>

                                                    <td>

                                                        ₹{" "}
                                                        {Number(
                                                            payment.amount
                                                        ).toLocaleString(
                                                            "en-IN"
                                                        )}

                                                    </td>

                                                    <td>
                                                        {
                                                            payment.paymentMode
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            payment.remarks ||
                                                            "-"
                                                        }
                                                    </td>

                                                </tr>

                                            )
                                        )

                                    )}

                                </tbody>

                            </table>

                        </div>

                    </>

                ) : (

                    <p>
                        Unable to load fee history.
                    </p>

                )}

            </div>

        </div>

    );

}


export default StudentsPage;