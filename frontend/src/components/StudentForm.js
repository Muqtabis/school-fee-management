import { useEffect, useState } from "react";

import api from "../services/api";


function StudentForm({ student, onClose }) {

    const [formData, setFormData] = useState({

        studentName: "",
        rollNumber: "",
        className: "",
        fatherName: "",
        contact1: "",
        previousDues: "",
        tuitionFee: ""

    });


    const [loading, setLoading] =
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


    useEffect(() => {

        if (student) {

            setFormData({

                studentName:
                    student.studentName || "",

                rollNumber:
                    student.rollNumber || "",

                className:
                    student.className || "",

                fatherName:
                    student.fatherName || "",

                contact1:
                    student.contact1 || "",

                previousDues:
                    student.previousDues || "",

                tuitionFee:
                    student.tuitionFee || ""

            });

        }

    }, [student]);


    const handleChange = (e) => {

        setFormData({

            ...formData,

            [e.target.name]:
                e.target.value

        });

    };


    const handleSubmit = async (e) => {

        e.preventDefault();

        setLoading(true);


        try {

            if (student) {

                await api.put(
                    `/students/${student.id}`,
                    formData
                );

            } else {

                await api.post(
                    "/students",
                    formData
                );

            }


            onClose();

        } catch (error) {

            alert(
                error.response?.data?.message ||
                "Unable to save student."
            );

        } finally {

            setLoading(false);

        }

    };


    return (

        <div className="modal-overlay">

            <div className="student-modal">

                <div className="modal-header">

                    <h2>

                        {student
                            ? "Edit Student"
                            : "Add Student"}

                    </h2>


                    <button
                        className="close-btn"
                        onClick={onClose}
                    >

                        ✕

                    </button>

                </div>


                <form
                    className="student-form"
                    onSubmit={handleSubmit}
                >

                    <div className="form-group">

                        <label>
                            Student Name
                        </label>

                        <input
                            type="text"
                            name="studentName"
                            value={
                                formData.studentName
                            }
                            onChange={handleChange}
                            required
                        />

                    </div>


                    <div className="form-group">

                        <label>
                            Roll Number
                        </label>

                        <input
                            type="text"
                            name="rollNumber"
                            value={
                                formData.rollNumber
                            }
                            onChange={handleChange}
                            placeholder="Example: 101"
                            required
                        />

                    </div>


                    <div className="form-group">

                        <label>
                            Class
                        </label>

                        <select
                            name="className"
                            value={
                                formData.className
                            }
                            onChange={handleChange}
                            required
                        >

                            <option value="">
                                Select Class
                            </option>


                            {classes.map(
                                (className) => (

                                    <option
                                        key={className}
                                        value={className}
                                    >

                                        {className === "1" ||
                                        className === "2" ||
                                        className === "3" ||
                                        className === "4" ||
                                        className === "5" ||
                                        className === "6" ||
                                        className === "7" ||
                                        className === "8" ||
                                        className === "9" ||
                                        className === "10"
                                            ? `${className} Standard`
                                            : className}

                                    </option>

                                )
                            )}

                        </select>

                    </div>


                    <div className="form-group">

                        <label>
                            Father Name
                        </label>

                        <input
                            type="text"
                            name="fatherName"
                            value={
                                formData.fatherName
                            }
                            onChange={handleChange}
                            required
                        />

                    </div>


                    <div className="form-group">

                        <label>
                            Contact Number
                        </label>

                        <input
                            type="text"
                            name="contact1"
                            value={
                                formData.contact1
                            }
                            onChange={handleChange}
                            required
                        />

                    </div>


                    <div className="form-group">

                        <label>
                            Previous Dues
                        </label>

                        <input
                            type="number"
                            min="0"
                            name="previousDues"
                            value={
                                formData.previousDues
                            }
                            onChange={handleChange}
                        />

                    </div>


                    <div className="form-group">

                        <label>
                            Tuition Fee
                        </label>

                        <input
                            type="number"
                            min="0"
                            name="tuitionFee"
                            value={
                                formData.tuitionFee
                            }
                            onChange={handleChange}
                            required
                        />

                    </div>


                    <div className="modal-actions">

                        <button
                            type="button"
                            className="cancel-btn"
                            onClick={onClose}
                        >

                            Cancel

                        </button>


                        <button
                            type="submit"
                            className="save-btn"
                            disabled={loading}
                        >

                            {loading
                                ? "Saving..."
                                : student
                                    ? "Update Student"
                                    : "Save Student"}

                        </button>

                    </div>

                </form>

            </div>

        </div>

    );

}

export default StudentForm;