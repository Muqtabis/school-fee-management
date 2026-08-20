import {
    useEffect,
    useState
} from "react";

import Sidebar
    from "../components/Sidebar";

import Navbar
    from "../components/Navbar";

import api
    from "../services/api";


function UsersPage() {

    const [
        users,
        setUsers
    ] = useState([]);


    const [
        loading,
        setLoading
    ] = useState(true);


    const [
        form,
        setForm
    ] = useState({

        name: "",

        email: "",

        password: ""

    });


    // =====================================================
    // LOAD USERS
    // =====================================================

    const loadUsers =
        async () => {

            try {

                setLoading(true);

                const res =
                    await api.get(
                        "/users"
                    );

                setUsers(
                    res.data
                );

            } catch (
                error
            ) {

                alert(
                    error.response?.data?.message ||
                    "Unable to load users."
                );

            } finally {

                setLoading(false);

            }

        };


    useEffect(
        () => {

            loadUsers();

        },
        []
    );


    // =====================================================
    // INPUT CHANGE
    // =====================================================

    const handleChange =
        (e) => {

            setForm({

                ...form,

                [e.target.name]:
                    e.target.value

            });

        };


    // =====================================================
    // CREATE RECEPTIONIST
    // =====================================================

    const createUser =
        async (e) => {

            e.preventDefault();

            try {

                await api.post(
                    "/users",
                    form
                );


                alert(
                    "Receptionist created successfully."
                );


                setForm({

                    name: "",

                    email: "",

                    password: ""

                });


                loadUsers();

            } catch (
                error
            ) {

                alert(
                    error.response?.data?.message ||
                    "Unable to create receptionist."
                );

            }

        };


    // =====================================================
    // RESET RECEPTIONIST PASSWORD
    // =====================================================

    const resetPassword =
        async (user) => {

            const newPassword =
                window.prompt(
                    `Enter a new password for ${user.name}:`
                );


            if (
                newPassword === null
            ) {

                return;

            }


            if (
                newPassword.length < 8
            ) {

                alert(
                    "Password must contain at least 8 characters."
                );

                return;

            }


            const confirmPassword =
                window.prompt(
                    "Confirm the new password:"
                );


            if (
                confirmPassword !==
                newPassword
            ) {

                alert(
                    "Passwords do not match."
                );

                return;

            }


            try {

                await api.put(
                    `/users/${user.id}/password`,
                    {
                        password:
                            newPassword
                    }
                );


                alert(
                    "Receptionist password reset successfully."
                );

            } catch (
                error
            ) {

                alert(
                    error.response?.data?.message ||
                    "Unable to reset password."
                );

            }

        };


    // =====================================================
    // DELETE RECEPTIONIST
    // =====================================================

    const deleteUser =
        async (user) => {

            const confirmed =
                window.confirm(
                    `Are you sure you want to delete ${user.name}?\n\nThis will remove their ERP login.`
                );


            if (
                !confirmed
            ) {

                return;

            }


            try {

                await api.delete(
                    `/users/${user.id}`
                );


                alert(
                    "Receptionist deleted successfully."
                );


                loadUsers();

            } catch (
                error
            ) {

                alert(
                    error.response?.data?.message ||
                    "Unable to delete receptionist."
                );

            }

        };


    // =====================================================
    // UI
    // =====================================================

    return (

        <div
            className="dashboard"
        >

            <Sidebar />


            <div
                className="main-content"
            >

                <Navbar />


                <div
                    className="page-content"
                >

                    <div
                        className="page-header"
                    >

                        <div>

                            <h2>
                                User Management
                            </h2>

                            <p>
                                Admin can create and
                                manage school staff
                                accounts.
                            </p>

                        </div>

                    </div>


                    {/* =================================================
                        CREATE RECEPTIONIST
                    ================================================= */}

                    <div
                        className="settings-card"
                    >

                        <h3>
                            Create Receptionist
                        </h3>


                        <form
                            onSubmit={
                                createUser
                            }
                            style={{
                                display:
                                    "grid",

                                gap:
                                    "12px",

                                marginTop:
                                    "20px",

                                maxWidth:
                                    "500px"
                            }}
                        >

                            <input
                                name="name"
                                value={
                                    form.name
                                }
                                onChange={
                                    handleChange
                                }
                                placeholder="Full name"
                                required
                            />


                            <input
                                type="email"
                                name="email"
                                value={
                                    form.email
                                }
                                onChange={
                                    handleChange
                                }
                                placeholder="Email"
                                required
                            />


                            <input
                                type="password"
                                name="password"
                                value={
                                    form.password
                                }
                                onChange={
                                    handleChange
                                }
                                placeholder="Initial password"
                                minLength="8"
                                required
                            />


                            <button
                                type="submit"
                                className="primary-btn"
                            >
                                Create Receptionist
                            </button>

                        </form>

                    </div>


                    {/* =================================================
                        USERS TABLE
                    ================================================= */}

                    <div
                        className="table-container"
                        style={{
                            marginTop:
                                "25px"
                        }}
                    >

                        <table>

                            <thead>

                                <tr>

                                    <th>
                                        Name
                                    </th>

                                    <th>
                                        Email
                                    </th>

                                    <th>
                                        Role
                                    </th>

                                    <th>
                                        Created
                                    </th>

                                    <th>
                                        Actions
                                    </th>

                                </tr>

                            </thead>


                            <tbody>

                                {
                                    loading ? (

                                        <tr>

                                            <td
                                                colSpan="5"
                                            >
                                                Loading...
                                            </td>

                                        </tr>

                                    ) : users.length === 0 ? (

                                        <tr>

                                            <td
                                                colSpan="5"
                                            >
                                                No users found.
                                            </td>

                                        </tr>

                                    ) : (

                                        users.map(
                                            user => (

                                                <tr
                                                    key={
                                                        user.id
                                                    }
                                                >

                                                    <td>
                                                        {
                                                            user.name
                                                        }
                                                    </td>


                                                    <td>
                                                        {
                                                            user.email
                                                        }
                                                    </td>


                                                    <td>
                                                        {
                                                            user.role
                                                        }
                                                    </td>


                                                    <td>
                                                        {
                                                            user.createdAt
                                                        }
                                                    </td>


                                                    <td>

                                                        {
                                                            user.role ===
                                                            "receptionist"
                                                                ? (

                                                                    <div
                                                                        style={{
                                                                            display:
                                                                                "flex",

                                                                            gap:
                                                                                "8px",

                                                                            flexWrap:
                                                                                "wrap"
                                                                        }}
                                                                    >

                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                resetPassword(
                                                                                    user
                                                                                )
                                                                            }
                                                                        >
                                                                            Reset Password
                                                                        </button>


                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                deleteUser(
                                                                                    user
                                                                                )
                                                                            }
                                                                        >
                                                                            Delete
                                                                        </button>

                                                                    </div>

                                                                )
                                                                : (

                                                                    <span>
                                                                        Current Admin
                                                                    </span>

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

            </div>

        </div>

    );

}


export default UsersPage;