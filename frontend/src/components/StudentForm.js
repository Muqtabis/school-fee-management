import {
    useEffect,
    useState
} from "react";

import api from "../services/api";


function StudentForm({
    student,
    onClose
}) {

    const [
        formData,
        setFormData
    ] = useState({

        studentName: "",

        rollNumber: "",

        className: "",

        fatherName: "",

        contact1: "",

        previousDues: "",

        tuitionFee: ""

    });


    const [
        loading,
        setLoading
    ] = useState(false);


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
    // LOAD STUDENT
    // =====================================================

    useEffect(() => {

        if (student) {

            setFormData({

                studentName:
                    student.studentName ||
                    "",

                rollNumber:
                    student.rollNumber ||
                    "",

                className:
                    student.className ||
                    "",

                fatherName:
                    student.fatherName ||
                    "",

                contact1:
                    student.contact1 ||
                    "",

                previousDues:
                    student.previousDues ||
                    "",

                tuitionFee:
                    student.tuitionFee ||
                    ""

            });

        } else {

            setFormData({

                studentName: "",

                rollNumber: "",

                className: "",

                fatherName: "",

                contact1: "",

                previousDues: "",

                tuitionFee: ""

            });

        }

    }, [student]);


    // =====================================================
    // INPUT CHANGE
    // =====================================================

    const handleChange = (
        e
    ) => {

        setFormData({

            ...formData,

            [e.target.name]:
                e.target.value

        });

    };


    // =====================================================
    // SUBMIT
    // =====================================================

    const handleSubmit = async (
        e
    ) => {

        e.preventDefault();


        if (
            !formData.studentName.trim()
        ) {

            alert(
                "Please enter the student name."
            );

            return;

        }


        if (
            !formData.rollNumber.trim()
        ) {

            alert(
                "Please enter the roll number."
            );

            return;

        }


        if (
            !formData.className
        ) {

            alert(
                "Please select the class."
            );

            return;

        }


        try {

            setLoading(
                true
            );


            const data = {

                studentName:
                    formData.studentName.trim(),

                rollNumber:
                    formData.rollNumber.trim(),

                className:
                    formData.className,

                fatherName:
                    formData.fatherName.trim(),

                contact1:
                    formData.contact1.trim(),

                previousDues:
                    Number(
                        formData.previousDues
                    ) || 0,

                tuitionFee:
                    Number(
                        formData.tuitionFee
                    ) || 0

            };


            if (student) {

                await api.put(
                    `/students/${student.id}`,
                    data
                );

            } else {

                await api.post(
                    "/students",
                    data
                );

            }


            onClose();

        } catch (
            error
        ) {

            console.error(
                "Student Save Error:",
                error
            );


            alert(
                error.response?.data?.message ||
                "Unable to save student."
            );

        } finally {

            setLoading(
                false
            );

        }

    };


    // =====================================================
    // DISPLAY CLASS
    // =====================================================

    const getClassDisplay =
        (className) => {

            if (
                className === "LKG" ||
                className === "UKG"
            ) {

                return className;

            }


            return `${className} Standard`;

        };


    return (

        <div
            className="modal-overlay"
        >

            <div
                className="student-modal"
            >

                {/* =================================================
                    HEADER
                ================================================= */}

                <div
                    className="modal-header"
                >

                    <div>

                        <h2>

                            {
                                student
                                    ? "Edit Student"
                                    : "Add Student"
                            }

                        </h2>


                        <p>

                            {
                                student
                                    ? "Update student information"
                                    : "Register a new student"
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


                {/* =================================================
                    FORM
                ================================================= */}

                <form
                    className="student-form"
                    onSubmit={
                        handleSubmit
                    }
                >

                    {/* =================================================
                        STUDENT NAME
                    ================================================= */}

                    <div
                        className="form-group"
                    >

                        <label>
                            Student Name
                        </label>


                        <input
                            type="text"
                            name="studentName"
                            value={
                                formData.studentName
                            }
                            onChange={
                                handleChange
                            }
                            placeholder="Enter student name"
                            required
                        />

                    </div>


                    {/* =================================================
                        ROLL NUMBER
                    ================================================= */}

                    <div
                        className="form-group"
                    >

                        <label>
                            Roll Number (within class)
                        </label>


                        <input
                            type="text"
                            name="rollNumber"
                            value={
                                formData.rollNumber
                            }
                            onChange={
                                handleChange
                            }
                            placeholder="Example: 1, 2, 3..."
                            required
                        />


                        <small
                            style={{
                                display:
                                    "block",

                                marginTop:
                                    "5px",

                                color:
                                    "#64748b"
                            }}
                        >

                            Roll numbers can repeat
                            in different classes.

                        </small>

                    </div>


                    {/* =================================================
                        CLASS
                    ================================================= */}

                    <div
                        className="form-group"
                    >

                        <label>
                            Class
                        </label>


                        <select
                            name="className"
                            value={
                                formData.className
                            }
                            onChange={
                                handleChange
                            }
                            required
                        >

                            <option value="">
                                Select Class
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


                    {/* =================================================
                        FATHER
                    ================================================= */}

                    <div
                        className="form-group"
                    >

                        <label>
                            Father Name
                        </label>


                        <input
                            type="text"
                            name="fatherName"
                            value={
                                formData.fatherName
                            }
                            onChange={
                                handleChange
                            }
                            placeholder="Enter father's name"
                            required
                        />

                    </div>


                    {/* =================================================
                        CONTACT
                    ================================================= */}

                    <div
                        className="form-group"
                    >

                        <label>
                            Contact Number
                        </label>


                        <input
                            type="tel"
                            name="contact1"
                            value={
                                formData.contact1
                            }
                            onChange={
                                handleChange
                            }
                            placeholder="Enter contact number"
                            required
                        />

                    </div>


                    {/* =================================================
                        PREVIOUS DUES
                    ================================================= */}

                    <div
                        className="form-group"
                    >

                        <label>
                            Previous Dues
                        </label>


                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            name="previousDues"
                            value={
                                formData.previousDues
                            }
                            onChange={
                                handleChange
                            }
                            placeholder="₹0"
                        />

                    </div>


                    {/* =================================================
                        CURRENT TUITION
                    ================================================= */}

                    <div
                        className="form-group"
                    >

                        <label>
                            Tuition Fee
                        </label>


                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            name="tuitionFee"
                            value={
                                formData.tuitionFee
                            }
                            onChange={
                                handleChange
                            }
                            placeholder="₹0"
                            required
                        />

                    </div>


                    {/* =================================================
                        ACTIONS
                    ================================================= */}

                    <div
                        className="modal-actions"
                    >

                        <button
                            type="button"
                            className="cancel-btn"
                            onClick={
                                onClose
                            }
                        >

                            Cancel

                        </button>


                        <button
                            type="submit"
                            className="save-btn"
                            disabled={
                                loading
                            }
                        >

                            {
                                loading
                                    ? "Saving..."
                                    : student
                                        ? "Update Student"
                                        : "Save Student"
                            }

                        </button>

                    </div>

                </form>

            </div>

        </div>

    );

}


export default StudentForm;