import { useEffect, useState } from "react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import StudentForm from "../components/StudentForm";
import StudentSearch from "../components/StudentSearch";

import api from "../services/api";

function StudentsPage() {

    const [students, setStudents] = useState([]);

    const [filteredStudents, setFilteredStudents] = useState([]);

    const [selectedStudent, setSelectedStudent] = useState(null);

    const [showForm, setShowForm] = useState(false);

    useEffect(() => {

        fetchStudents();

    }, []);

    const fetchStudents = async () => {

        try {

            const res = await api.get("/students");

            setStudents(res.data);

            setFilteredStudents(res.data);

        }

        catch (error) {

            console.log(error);

        }

    };

    const handleSearch = (keyword) => {

        const search = keyword.toLowerCase();

        const result = students.filter((student) =>

            student.studentName.toLowerCase().includes(search) ||

            student.className.toLowerCase().includes(search) ||

            student.fatherName.toLowerCase().includes(search)

        );

        setFilteredStudents(result);

    };

    const handleEdit = (student) => {

        setSelectedStudent(student);

        setShowForm(true);

    };

    const handleDelete = async (id) => {

        const confirmDelete = window.confirm(

            "Delete this student?"

        );

        if (!confirmDelete) return;

        try {

            await api.delete(`/students/${id}`);

            fetchStudents();

        }

        catch (error) {

            console.log(error);

        }

    };

    const handleAddStudent = () => {

        setSelectedStudent(null);

        setShowForm(true);

    };

    return (

        <div className="dashboard">

            <Sidebar />

            <div className="main-content">

                <Navbar />

                <div className="page-content">

                    <div className="page-header">

                        <h2>Students</h2>

                        <button

                            className="primary-btn"

                            onClick={handleAddStudent}

                        >

                            + Add Student

                        </button>

                    </div>

                    <StudentSearch

                        onSearch={handleSearch}

                    />

                    <div className="table-container">

                        <table>

                            <thead>

                                <tr>

                                    <th>Name</th>

                                    <th>Class</th>

                                    <th>Father</th>

                                    <th>Contact</th>

                                    <th>Fee</th>

                                    <th>Actions</th>

                                </tr>

                            </thead>

                            <tbody>

                                {

                                    filteredStudents.length === 0 ?

                                        (

                                            <tr>

                                                <td

                                                    colSpan="6"

                                                    style={{

                                                        textAlign: "center"

                                                    }}

                                                >

                                                    No Students Found

                                                </td>

                                            </tr>

                                        )

                                        :

                                        filteredStudents.map((student) => (

                                            <tr

                                                key={student.id}

                                            >

                                                <td>

                                                    {student.studentName}

                                                </td>

                                                <td>

                                                    {student.className}

                                                </td>

                                                <td>

                                                    {student.fatherName}

                                                </td>

                                                <td>

                                                    {student.contact1}

                                                </td>

                                                <td>

                                                    ₹ {student.tuitionFee}

                                                </td>

                                                <td>

                                                    <button

                                                        className="edit-btn"

                                                        onClick={() =>

                                                            handleEdit(student)

                                                        }

                                                    >

                                                        Edit

                                                    </button>

                                                    <button

                                                        className="delete-btn"

                                                        onClick={() =>

                                                            handleDelete(student.id)

                                                        }

                                                    >

                                                        Delete

                                                    </button>

                                                </td>

                                            </tr>

                                        ))

                                }

                            </tbody>

                        </table>

                    </div>

                </div>

            </div>

            {

                showForm && (

                    <StudentForm

                        student={selectedStudent}

                        onClose={() => {

                            setShowForm(false);

                            fetchStudents();

                        }}

                    />

                )

            }

        </div>

    );

}

export default StudentsPage;