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

        password: "",

        role: "receptionist"

    });


    const loadUsers =
        async () => {

            try {

                setLoading(
                    true
                );

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

                setLoading(
                    false
                );

            }

        };


    useEffect(
        () => {

            loadUsers();

        },
        []
    );


    const handleChange =
        (e) => {

            setForm({

                ...form,

                [e.target.name]:
                    e.target.value

            });

        };


    const createUser =
        async (e) => {

            e.preventDefault();


            try {

                await api.post(
                    "/users",
                    form
                );


                alert(
                    "User created successfully."
                );


                setForm({

                    name: "",

                    email: "",

                    password: "",

                    role:
                        "receptionist"

                });


                loadUsers();

            } catch (
                error
            ) {

                alert(
                    error.response?.data?.message ||
                    "Unable to create user."
                );

            }

        };


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
                                Admin can create
                                and manage school
                                staff accounts.
                            </p>

                        </div>

                    </div>


                    <div
                        className="settings-card"
                    >

                        <h3>
                            Create User
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
                                placeholder="Password"
                                minLength="6"
                                required
                            />


                            <select
                                name="role"
                                value={
                                    form.role
                                }
                                onChange={
                                    handleChange
                                }
                            >

                                <option
                                    value="receptionist"
                                >
                                    Receptionist
                                </option>

                                <option
                                    value="admin"
                                >
                                    Admin
                                </option>

                            </select>


                            <button
                                type="submit"
                                className="primary-btn"
                            >
                                Create User
                            </button>

                        </form>

                    </div>


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

                                </tr>

                            </thead>


                            <tbody>

                                {
                                    loading ? (

                                        <tr>

                                            <td
                                                colSpan="4"
                                            >
                                                Loading...
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