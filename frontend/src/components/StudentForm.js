import { useEffect, useState } from "react";
import api from "../services/api";

function StudentForm({ student, onClose }) {

    const [formData, setFormData] = useState({
        studentName: "",
        className: "",
        fatherName: "",
        contact1: "",
        previousDues: "",
        tuitionFee: ""
    });

    const [loading, setLoading] = useState(false);

    useEffect(() => {

        if (student) {

            setFormData({

                studentName: student.studentName || "",

                className: student.className || "",

                fatherName: student.fatherName || "",

                contact1: student.contact1 || "",

                previousDues: student.previousDues || "",

                tuitionFee: student.tuitionFee || ""

            });

        }

    }, [student]);

    const handleChange = (e) => {

        setFormData({

            ...formData,

            [e.target.name]: e.target.value

        });

    };

    const handleSubmit = async (e) => {

        e.preventDefault();

        try {

            setLoading(true);

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

        }

        catch (error) {

            alert(

                error.response?.data?.message ||

                "Operation Failed"

            );

        }

        finally {

            setLoading(false);

        }

    };

    return (

        <div className="modal-overlay">

            <div className="student-modal">

                <div className="modal-header">

                    <h2>

                        {

                            student

                                ?

                                "Edit Student"

                                :

                                "Add Student"

                        }

                    </h2>

                    <button

                        className="close-btn"

                        onClick={onClose}

                    >

                        ✕

                    </button>

                </div>

                <form

                    onSubmit={handleSubmit}

                    className="student-form"

                >

                    <div className="form-group">

                        <label>

                            Student Name

                        </label>

                        <input

                            type="text"

                            name="studentName"

                            value={formData.studentName}

                            onChange={handleChange}

                            required

                        />

                    </div>

                    <div className="form-group">

                        <label>

                            Class

                        </label>

                        <input

                            type="text"

                            name="className"

                            value={formData.className}

                            onChange={handleChange}

                            required

                        />

                    </div>

                    <div className="form-group">

                        <label>

                            Father Name

                        </label>

                        <input

                            type="text"

                            name="fatherName"

                            value={formData.fatherName}

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

                            value={formData.contact1}

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

                            name="previousDues"

                            value={formData.previousDues}

                            onChange={handleChange}

                        />

                    </div>

                    <div className="form-group">

                        <label>

                            Tuition Fee

                        </label>

                        <input

                            type="number"

                            name="tuitionFee"

                            value={formData.tuitionFee}

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

                        >

                            {

                                loading

                                    ?

                                    "Saving..."

                                    :

                                    student

                                        ?

                                        "Update Student"

                                        :

                                        "Save Student"

                            }

                        </button>

                    </div>

                </form>

            </div>

        </div>

    );

}

export default StudentForm;