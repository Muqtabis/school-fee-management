import {
    useEffect,
    useState
} from "react";

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

    const [showArchived, setShowArchived] =
        useState(false);


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


    // =====================================================
    // LOAD STUDENTS
    // =====================================================

    useEffect(() => {

        fetchStudents();

    }, [showArchived]);


    const fetchStudents = async () => {

        try {

            const res =
                await api.get(
                    "/students",
                    {
                        params: {
                            status:
                                showArchived
                                    ? "archived"
                                    : "active"
                        }
                    }
                );


            const data =
                Array.isArray(
                    res.data
                )
                    ? res.data
                    : [];


            setStudents(data);

            setFilteredStudents(data);

        } catch (error) {

            console.error(
                "Unable to fetch students:",
                error
            );

            setStudents([]);

            setFilteredStudents([]);

        }

    };


    // =====================================================
    // FILTER
    // =====================================================

    const filterStudents = (
        search,
        classFilter
    ) => {

        const keyword =
            String(
                search || ""
            )
                .toLowerCase()
                .trim();


        const result =
            students.filter(
                student => {

                    const matchesSearch =
                        !keyword ||

                        student.studentName
                            ?.toLowerCase()
                            .includes(
                                keyword
                            ) ||

                        student.rollNumber
                            ?.toLowerCase()
                            .includes(
                                keyword
                            ) ||

                        student.className
                            ?.toLowerCase()
                            .includes(
                                keyword
                            ) ||

                        student.fatherName
                            ?.toLowerCase()
                            .includes(
                                keyword
                            ) ||

                        student.contact1
                            ?.toLowerCase()
                            .includes(
                                keyword
                            );


                    const matchesClass =
                        classFilter === "All" ||
                        student.className ===
                            classFilter;


                    return (
                        matchesSearch &&
                        matchesClass
                    );

                }
            );


        setFilteredStudents(
            result
        );

    };


    // =====================================================
    // SEARCH
    // =====================================================

    const handleSearch = (
        value
    ) => {

        setSearchKeyword(
            value
        );


        filterStudents(
            value,
            selectedClass
        );

    };


    // =====================================================
    // CLASS FILTER
    // =====================================================

    const handleClassChange = (
        e
    ) => {

        const value =
            e.target.value;


        setSelectedClass(
            value
        );


        filterStudents(
            searchKeyword,
            value
        );

    };


    // =====================================================
    // ACTIVE / ARCHIVED
    // =====================================================

    const handleStatusToggle = (
        archived
    ) => {

        setShowArchived(
            archived
        );

        setSelectedClass(
            "All"
        );

        setSearchKeyword(
            ""
        );

    };


    // =====================================================
    // EDIT
    // =====================================================

    const handleEdit = (
        student
    ) => {

        if (
            student.status ===
            "archived"
        ) {

            alert(
                "Archived students cannot be edited. Restore the student first."
            );

            return;

        }


        setSelectedStudent(
            student
        );

        setShowForm(
            true
        );

    };


    // =====================================================
    // ARCHIVE
    // =====================================================

    const handleArchive = async (
        student
    ) => {

        const reason =
            window.prompt(
                `Why are you archiving ${student.studentName}?`
            );


        if (
            !reason ||
            !reason.trim()
        ) {

            return;

        }


        const confirmed =
            window.confirm(

                `Archive ${student.studentName}?\n\n` +

                `Class: ${
                    getClassDisplay(
                        student.className
                    )
                }\n` +

                `Roll No: ${
                    student.rollNumber ||
                    "-"
                }\n\n` +

                `Reason: ${
                    reason.trim()
                }\n\n` +

                `The student will NOT be deleted. Their fee and payment history will remain.`

            );


        if (!confirmed) {

            return;

        }


        try {

            await api.post(

                `/students/${student.id}/archive`,

                {
                    reason:
                        reason.trim()
                }

            );


            alert(
                "Student archived successfully."
            );


            fetchStudents();

        } catch (error) {

            alert(
                error.response?.data?.message ||
                "Unable to archive student."
            );

        }

    };


    // =====================================================
    // RESTORE
    // =====================================================

    const handleRestore = async (
        student
    ) => {

        const confirmed =
            window.confirm(

                `Restore ${student.studentName}?\n\n` +

                `Class: ${
                    getClassDisplay(
                        student.className
                    )
                }\n` +

                `Roll No: ${
                    student.rollNumber ||
                    "-"
                }`

            );


        if (!confirmed) {

            return;

        }


        try {

            await api.post(
                `/students/${student.id}/restore`
            );


            alert(
                "Student restored successfully."
            );


            fetchStudents();

        } catch (error) {

            alert(
                error.response?.data?.message ||
                "Unable to restore student."
            );

        }

    };


    // =====================================================
    // ADD STUDENT
    // =====================================================

    const handleAddStudent = () => {

        setSelectedStudent(
            null
        );

        setShowForm(
            true
        );

    };


    // =====================================================
    // CLASS DISPLAY
    // =====================================================

    const getClassDisplay = (
        className
    ) => {

        if (
            className === "LKG" ||
            className === "UKG"
        ) {

            return className;

        }


        return `${className} Standard`;

    };


    // =====================================================
    // MONEY
    // =====================================================

    const money =
        value =>
            `₹${Number(
                value || 0
            ).toLocaleString(
                "en-IN",
                {
                    minimumFractionDigits:
                        2,

                    maximumFractionDigits:
                        2
                }
            )}`;


    return (

        <div className="dashboard">

            <Sidebar />


            <div className="main-content">

                <Navbar />


                <div className="page-content">

                    {/* HEADER */}

                    <div className="page-header">

                        <div>

                            <h2>
                                Students
                            </h2>

                            <p>
                                Manage students,
                                classes and fee accounts.
                            </p>

                        </div>


                        {!showArchived && (

                            <button
                                className="primary-btn"
                                onClick={
                                    handleAddStudent
                                }
                            >

                                + Add Student

                            </button>

                        )}

                    </div>


                    {/* STATUS */}

                    <div
                        style={{
                            display:
                                "flex",

                            gap:
                                "10px",

                            marginBottom:
                                "20px"
                        }}
                    >

                        <button
                            type="button"
                            className={
                                !showArchived
                                    ? "primary-btn"
                                    : "clear-btn"
                            }
                            onClick={() =>
                                handleStatusToggle(
                                    false
                                )
                            }
                        >

                            Active Students

                        </button>


                        <button
                            type="button"
                            className={
                                showArchived
                                    ? "primary-btn"
                                    : "clear-btn"
                            }
                            onClick={() =>
                                handleStatusToggle(
                                    true
                                )
                            }
                        >

                            Archived Students

                        </button>

                    </div>


                    {/* FILTER */}

                    <div
                        className="student-filters"
                    >

                        <StudentSearch
                            onSearch={
                                handleSearch
                            }
                        />


                        <select
                            className="filter-select"
                            value={
                                selectedClass
                            }
                            onChange={
                                handleClassChange
                            }
                        >

                            <option value="All">
                                All Classes
                            </option>


                            {
                                classes.map(
                                    className => (

                                        <option
                                            key={
                                                className
                                            }
                                            value={
                                                className
                                            }
                                        >

                                            {
                                                getClassDisplay(
                                                    className
                                                )
                                            }

                                        </option>

                                    )
                                )
                            }

                        </select>

                    </div>


                    {/* TABLE */}

                    <div
                        className="table-container"
                    >

                        <table>

                            <thead>

                                <tr>

                                    <th>
                                        #
                                    </th>

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
                                        Status
                                    </th>

                                    <th>
                                        Actions
                                    </th>

                                </tr>

                            </thead>


                            <tbody>

                                {
                                    filteredStudents.length ===
                                    0 ? (

                                        <tr>

                                            <td
                                                colSpan="8"
                                                style={{
                                                    textAlign:
                                                        "center"
                                                }}
                                            >

                                                {
                                                    showArchived
                                                        ? "No archived students found."
                                                        : "No active students found."
                                                }

                                            </td>

                                        </tr>

                                    ) : (

                                        filteredStudents.map(
                                            (
                                                student,
                                                index
                                            ) => (

                                                <tr
                                                    key={
                                                        student.id
                                                    }
                                                    style={
                                                        student.status ===
                                                        "archived"
                                                            ? {
                                                                opacity:
                                                                    0.65
                                                            }
                                                            : {}
                                                    }
                                                >

                                                    <td>
                                                        {
                                                            index + 1
                                                        }
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
                                                        <strong>
                                                            {
                                                                student.studentName
                                                            }
                                                        </strong>
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
                                                            student.fatherName ||
                                                            "-"
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            student.contact1 ||
                                                            "-"
                                                        }
                                                    </td>

                                                    <td>

                                                        {
                                                            student.status ===
                                                            "archived" ? (

                                                                <span className="payment-badge mode-default">
                                                                    Archived
                                                                </span>

                                                            ) : (

                                                                <span className="payment-badge mode-upi">
                                                                    Active
                                                                </span>

                                                            )
                                                        }

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


                                                            {
                                                                student.status ===
                                                                "archived" ? (

                                                                    <button
                                                                        className="edit-btn"
                                                                        onClick={() =>
                                                                            handleRestore(
                                                                                student
                                                                            )
                                                                        }
                                                                    >

                                                                        Restore

                                                                    </button>

                                                                ) : (

                                                                    <>

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
                                                                                handleArchive(
                                                                                    student
                                                                                )
                                                                            }
                                                                        >

                                                                            Archive

                                                                        </button>

                                                                    </>

                                                                )
                                                            }

                                                        </div>

                                                    </td>

                                                </tr>

                                            )
                                        )

                                    )
                                }

                            </tbody>

                        </table>

                    </div>

                </div>

            </div>


            {/* STUDENT FORM */}

            {
                showForm && (

                    <StudentForm

                        student={
                            selectedStudent
                        }

                        onClose={() => {

                            setShowForm(
                                false
                            );

                            setSelectedStudent(
                                null
                            );

                            fetchStudents();

                        }}

                    />

                )
            }


            {/* FEE HISTORY */}

            {
                historyStudent && (

                    <FeeHistory

                        student={
                            historyStudent
                        }

                        onClose={() =>
                            setHistoryStudent(
                                null
                            )
                        }

                    />

                )
            }

        </div>

    );

}


// =====================================================
// FEE HISTORY
// =====================================================

function FeeHistory({
    student,
    onClose
}) {

    const [
        history,
        setHistory
    ] = useState(null);


    const [
        loading,
        setLoading
    ] = useState(true);


    useEffect(() => {

        loadHistory();

    }, [student]);


    const loadHistory =
        async () => {

            try {

                setLoading(
                    true
                );


                const res =
                    await api.get(
                        `/payments/history/student/${student.id}`
                    );


                setHistory(
                    res.data
                );

            } catch (error) {

                console.error(
                    "Fee History Error:",
                    error
                );

                setHistory(
                    null
                );

            } finally {

                setLoading(
                    false
                );

            }

        };


    const money =
        value =>
            `₹${Number(
                value || 0
            ).toLocaleString(
                "en-IN",
                {
                    minimumFractionDigits:
                        2,

                    maximumFractionDigits:
                        2
                }
            )}`;


    return (

        <div
            className="modal-overlay"
        >

            <div
                className="history-modal"
            >

                {/* HEADER */}

                <div
                    className="modal-header"
                >

                    <div>

                        <h2>
                            Fee Account
                        </h2>

                        <p>

                            {
                                student.studentName
                            }

                            {" • "}

                            {
                                student.rollNumber ||
                                "-"
                            }

                            {" • "}

                            {
                                student.className
                                    === "LKG" ||
                                student.className
                                    === "UKG"
                                    ? student.className
                                    : `${student.className} Standard`
                            }

                        </p>

                    </div>


                    <button
                        type="button"
                        className="close-btn"
                        onClick={
                            onClose
                        }
                    >

                        ✕

                    </button>

                </div>


                {
                    loading ? (

                        <div className="history-loading">
                            Loading fee account...
                        </div>

                    ) : history ? (

                        <>

                            {/* ACADEMIC YEAR */}

                            <div
                                className="fee-summary"
                                style={{
                                    marginBottom:
                                        "15px"
                                }}
                            >

                                <div>

                                    <span>
                                        Academic Year
                                    </span>

                                    <strong>
                                        {
                                            history.academicYear?.name ||
                                            "-"
                                        }
                                    </strong>

                                </div>


                                <div>

                                    <span>
                                        Account
                                    </span>

                                    <strong>
                                        Active
                                    </strong>

                                </div>

                            </div>


                            {/* SUMMARY */}

                            <div
                                className="fee-summary"
                            >

                                <div>

                                    <span>
                                        Total Fee
                                    </span>

                                    <strong>
                                        {
                                            money(
                                                history.totalFee
                                            )
                                        }
                                    </strong>

                                </div>


                                <div>

                                    <span>
                                        Total Paid
                                    </span>

                                    <strong className="fee-paid">
                                        {
                                            money(
                                                history.totalPaid
                                            )
                                        }
                                    </strong>

                                </div>


                                <div>

                                    <span>
                                        Balance
                                    </span>

                                    <strong className="fee-remaining">
                                        {
                                            money(
                                                history.balance
                                            )
                                        }
                                    </strong>

                                </div>

                            </div>


                            {/* FEE BREAKDOWN */}

                            <div
                                style={{
                                    marginTop:
                                        "20px"
                                }}
                            >

                                <h3>
                                    Fee Breakdown
                                </h3>


                                <div
                                    className="table-container"
                                >

                                    <table>

                                        <thead>

                                            <tr>

                                                <th>
                                                    Component
                                                </th>

                                                <th>
                                                    Type
                                                </th>

                                                <th>
                                                    Amount
                                                </th>

                                            </tr>

                                        </thead>


                                        <tbody>

                                            {
                                                history.items?.length ===
                                                0 ? (

                                                    <tr>

                                                        <td
                                                            colSpan="3"
                                                        >
                                                            No fee components found.
                                                        </td>

                                                    </tr>

                                                ) : (

                                                    history.items?.map(
                                                        item => (

                                                            <tr
                                                                key={
                                                                    item.id
                                                                }
                                                            >

                                                                <td>
                                                                    {
                                                                        item.componentName
                                                                    }
                                                                </td>

                                                                <td>
                                                                    {
                                                                        item.itemType ===
                                                                        "carry_forward"
                                                                            ? "Previous Dues"
                                                                            : item.itemType
                                                                    }
                                                                </td>

                                                                <td>
                                                                    <strong>
                                                                        {
                                                                            money(
                                                                                item.amount
                                                                            )
                                                                        }
                                                                    </strong>
                                                                </td>

                                                            </tr>

                                                        )
                                                    )

                                                )
                                            }

                                        </tbody>

                                    </table>

                                </div>

                            </div>


                            {/* PAYMENTS */}

                            <div
                                style={{
                                    marginTop:
                                        "20px"
                                }}
                            >

                                <h3>
                                    Payment History
                                </h3>


                                <div
                                    className="table-container"
                                >

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
                                                    Status
                                                </th>

                                                <th>
                                                    Remarks
                                                </th>

                                            </tr>

                                        </thead>


                                        <tbody>

                                            {
                                                history.payments?.length ===
                                                0 ? (

                                                    <tr>

                                                        <td
                                                            colSpan="5"
                                                        >
                                                            No payments found.
                                                        </td>

                                                    </tr>

                                                ) : (

                                                    history.payments.map(
                                                        payment => (

                                                            <tr
                                                                key={
                                                                    payment.id
                                                                }
                                                                style={
                                                                    payment.status ===
                                                                    "reversed"
                                                                        ? {
                                                                            opacity:
                                                                                0.6
                                                                        }
                                                                        : {}
                                                                }
                                                            >

                                                                <td>
                                                                    {
                                                                        payment.paymentDate ||
                                                                        "-"
                                                                    }
                                                                </td>

                                                                <td>

                                                                    <strong>
                                                                        {
                                                                            money(
                                                                                payment.amount
                                                                            )
                                                                        }
                                                                    </strong>

                                                                </td>

                                                                <td>
                                                                    {
                                                                        payment.paymentMode ||
                                                                        "-"
                                                                    }
                                                                </td>

                                                                <td>

                                                                    {
                                                                        payment.status ===
                                                                        "reversed" ? (

                                                                            <span className="payment-badge mode-default">
                                                                                Reversed
                                                                            </span>

                                                                        ) : (

                                                                            <span className="payment-badge mode-upi">
                                                                                Completed
                                                                            </span>

                                                                        )
                                                                    }

                                                                </td>

                                                                <td>

                                                                    {
                                                                        payment.remarks ||
                                                                        "-"
                                                                    }


                                                                    {
                                                                        payment.status ===
                                                                        "reversed" &&
                                                                        payment.voidReason && (

                                                                            <div
                                                                                style={{
                                                                                    marginTop:
                                                                                        "5px",

                                                                                    fontSize:
                                                                                        "12px",

                                                                                    color:
                                                                                        "#b91c1c"
                                                                                }}
                                                                            >

                                                                                Reason:
                                                                                {" "}

                                                                                {
                                                                                    payment.voidReason
                                                                                }

                                                                            </div>

                                                                        )
                                                                    }

                                                                </td>

                                                            </tr>

                                                        )
                                                    )

                                                )
                                            }

                                        </tbody>

                                    </table>

                                </div>

                            </div>

                        </>

                    ) : (

                        <p>
                            Unable to load fee account.
                        </p>

                    )
                }

            </div>

        </div>

    );

}


export default StudentsPage;