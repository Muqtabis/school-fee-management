import {
    useState
} from "react";

import Sidebar
    from "../components/Sidebar";

import Navbar
    from "../components/Navbar";

import { useAuth }
    from "../context/AuthContext";

import api
    from "../services/api";


function SettingsPage() {

    const { user } =
        useAuth();


    // =====================================================
    // PASSWORD FORM
    // =====================================================

    const [
        passwordForm,
        setPasswordForm
    ] = useState({

        currentPassword: "",

        newPassword: "",

        confirmPassword: ""

    });


    const [
        changingPassword,
        setChangingPassword
    ] = useState(false);


    // =====================================================
    // INPUT CHANGE
    // =====================================================

    const handlePasswordChange =
        (e) => {

            setPasswordForm({

                ...passwordForm,

                [e.target.name]:
                    e.target.value

            });

        };


    // =====================================================
    // CHANGE PASSWORD
    // =====================================================

    const handleChangePassword =
        async (e) => {

            e.preventDefault();


            if (
                passwordForm.newPassword.length < 8
            ) {

                alert(
                    "New password must contain at least 8 characters."
                );

                return;

            }


            if (
                passwordForm.newPassword !==
                passwordForm.confirmPassword
            ) {

                alert(
                    "New passwords do not match."
                );

                return;

            }


            if (
                passwordForm.currentPassword ===
                passwordForm.newPassword
            ) {

                alert(
                    "New password must be different from your current password."
                );

                return;

            }


            try {

                setChangingPassword(true);


                await api.put(
                    "/users/change-own-password",
                    {
                        currentPassword:
                            passwordForm.currentPassword,

                        newPassword:
                            passwordForm.newPassword
                    }
                );


                alert(
                    "Password changed successfully."
                );


                setPasswordForm({

                    currentPassword: "",

                    newPassword: "",

                    confirmPassword: ""

                });


            } catch (
                error
            ) {

                console.error(
                    "Change Password Error:",
                    error
                );


                alert(

                    error.response?.data?.message ||

                    "Unable to change password."

                );

            } finally {

                setChangingPassword(
                    false
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

                        <h2>
                            Settings
                        </h2>

                    </div>


                    {/* =================================================
                        PROFILE INFORMATION
                    ================================================= */}

                    <div
                        className="settings-card"
                    >

                        <h3>
                            Profile Information
                        </h3>

                        <br />


                        <p>

                            <strong>
                                Name :
                            </strong>

                            {" "}

                            {user?.name}

                        </p>

                        <br />


                        <p>

                            <strong>
                                Email :
                            </strong>

                            {" "}

                            {user?.email}

                        </p>

                        <br />


                        <p>

                            <strong>
                                Role :
                            </strong>

                            {" "}

                            {user?.role ||
                                "Administrator"}

                        </p>

                    </div>


                    {/* =================================================
                        CHANGE PASSWORD
                    ================================================= */}

                    <div
                        className="settings-card"
                        style={{
                            marginTop:
                                "25px"
                        }}
                    >

                        <h3>
                            Change Password
                        </h3>


                        <p
                            style={{
                                marginTop:
                                    "8px",

                                color:
                                    "#666"
                            }}
                        >
                            Change your ERP login
                            password securely.
                        </p>


                        <form
                            onSubmit={
                                handleChangePassword
                            }
                            style={{
                                display:
                                    "grid",

                                gap:
                                    "15px",

                                maxWidth:
                                    "500px",

                                marginTop:
                                    "20px"
                            }}
                        >

                            <div>

                                <label>
                                    Current Password
                                </label>

                                <input
                                    type="password"
                                    name="currentPassword"
                                    value={
                                        passwordForm.currentPassword
                                    }
                                    onChange={
                                        handlePasswordChange
                                    }
                                    placeholder="Enter current password"
                                    required
                                />

                            </div>


                            <div>

                                <label>
                                    New Password
                                </label>

                                <input
                                    type="password"
                                    name="newPassword"
                                    value={
                                        passwordForm.newPassword
                                    }
                                    onChange={
                                        handlePasswordChange
                                    }
                                    placeholder="Enter new password"
                                    minLength="8"
                                    required
                                />

                            </div>


                            <div>

                                <label>
                                    Confirm New Password
                                </label>

                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={
                                        passwordForm.confirmPassword
                                    }
                                    onChange={
                                        handlePasswordChange
                                    }
                                    placeholder="Confirm new password"
                                    minLength="8"
                                    required
                                />

                            </div>


                            <button
                                type="submit"
                                className="primary-btn"
                                disabled={
                                    changingPassword
                                }
                            >

                                {
                                    changingPassword

                                        ? "Changing Password..."

                                        : "Change Password"
                                }

                            </button>

                        </form>

                    </div>

                </div>

            </div>

        </div>

    );

}


export default SettingsPage;