import {
    useState
} from "react";

import {
    Link,
    useNavigate,
    useParams
} from "react-router-dom";

import api
    from "../services/api";


export default function ResetPasswordPage() {

    const {
        token
    } = useParams();


    const navigate =
        useNavigate();


    const [
        password,
        setPassword
    ] = useState("");


    const [
        confirmPassword,
        setConfirmPassword
    ] = useState("");


    const [
        loading,
        setLoading
    ] = useState(false);


    const [
        error,
        setError
    ] = useState("");


    const [
        success,
        setSuccess
    ] = useState(false);


    const handleSubmit =
        async (e) => {

            e.preventDefault();

            setError("");
            setSuccess(false);


            if (!token) {

                setError(
                    "Invalid password reset link."
                );

                return;

            }


            if (
                password.length < 8
            ) {

                setError(
                    "Password must contain at least 8 characters."
                );

                return;

            }


            if (
                password !==
                confirmPassword
            ) {

                setError(
                    "Passwords do not match."
                );

                return;

            }


            try {

                setLoading(true);


                await api.post(
                    `/auth/reset-password/${token}`,
                    {
                        password
                    }
                );


                setSuccess(true);


                setPassword("");
                setConfirmPassword("");


                setTimeout(
                    () => {

                        navigate(
                            "/login",
                            {
                                replace: true
                            }
                        );

                    },
                    2000
                );


            } catch (error) {

                setError(
                    error.response?.data?.message ||
                    "Unable to reset password."
                );


            } finally {

                setLoading(false);

            }

        };


    return (

        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                background:
                    "linear-gradient(135deg, #eef2ff, #f8fafc)",
                padding: "20px",
                boxSizing: "border-box",
                fontFamily:
                    "Arial, Helvetica, sans-serif"
            }}
        >

            <div
                style={{
                    width: "100%",
                    maxWidth: "430px",
                    background: "#ffffff",
                    borderRadius: "16px",
                    padding: "35px",
                    boxSizing: "border-box",
                    boxShadow:
                        "0 10px 35px rgba(0,0,0,0.10)"
                }}
            >

                <div
                    style={{
                        textAlign: "center",
                        marginBottom: "28px"
                    }}
                >

                    <h1
                        style={{
                            margin: "0 0 10px",
                            fontSize: "26px",
                            fontWeight: "700",
                            color: "#1e3a8a"
                        }}
                    >
                        THE AGE SCHOOL
                    </h1>


                    <h2
                        style={{
                            margin: "0 0 10px",
                            fontSize: "22px",
                            color: "#111827"
                        }}
                    >
                        Reset Password
                    </h2>


                    <p
                        style={{
                            margin: "0",
                            color: "#6b7280",
                            fontSize: "14px",
                            lineHeight: "1.6"
                        }}
                    >
                        Create a new administrator
                        password.
                    </p>

                </div>


                {
                    success ? (

                        <div
                            style={{
                                padding: "18px",
                                borderRadius: "8px",
                                background: "#ecfdf5",
                                border:
                                    "1px solid #a7f3d0",
                                color: "#047857",
                                textAlign: "center",
                                lineHeight: "1.6",
                                fontSize: "14px"
                            }}
                        >

                            <strong>
                                Password reset successfully.
                            </strong>

                            <br />

                            Redirecting you to
                            the login page...

                        </div>

                    ) : (

                        <form
                            onSubmit={
                                handleSubmit
                            }
                        >

                            <label
                                style={{
                                    display: "block",
                                    marginBottom: "8px",
                                    fontSize: "14px",
                                    fontWeight: "600",
                                    color: "#374151"
                                }}
                            >
                                New Password
                            </label>


                            <input
                                type="password"
                                placeholder="Enter new password"
                                value={
                                    password
                                }
                                onChange={
                                    e =>
                                        setPassword(
                                            e.target.value
                                        )
                                }
                                minLength={8}
                                required
                                disabled={
                                    loading
                                }
                                style={{
                                    width: "100%",
                                    padding: "13px 14px",
                                    boxSizing: "border-box",
                                    border:
                                        "1px solid #d1d5db",
                                    borderRadius: "8px",
                                    fontSize: "15px",
                                    outline: "none",
                                    marginBottom: "16px"
                                }}
                            />


                            <label
                                style={{
                                    display: "block",
                                    marginBottom: "8px",
                                    fontSize: "14px",
                                    fontWeight: "600",
                                    color: "#374151"
                                }}
                            >
                                Confirm New Password
                            </label>


                            <input
                                type="password"
                                placeholder="Confirm new password"
                                value={
                                    confirmPassword
                                }
                                onChange={
                                    e =>
                                        setConfirmPassword(
                                            e.target.value
                                        )
                                }
                                minLength={8}
                                required
                                disabled={
                                    loading
                                }
                                style={{
                                    width: "100%",
                                    padding: "13px 14px",
                                    boxSizing: "border-box",
                                    border:
                                        "1px solid #d1d5db",
                                    borderRadius: "8px",
                                    fontSize: "15px",
                                    outline: "none",
                                    marginBottom: "16px"
                                }}
                            />


                            {
                                error && (

                                    <div
                                        style={{
                                            marginBottom: "16px",
                                            padding: "12px",
                                            borderRadius: "8px",
                                            background:
                                                "#fef2f2",
                                            border:
                                                "1px solid #fecaca",
                                            color: "#b91c1c",
                                            fontSize: "14px",
                                            lineHeight: "1.5"
                                        }}
                                    >
                                        {error}
                                    </div>

                                )
                            }


                            <button
                                type="submit"
                                disabled={
                                    loading
                                }
                                style={{
                                    width: "100%",
                                    padding: "13px",
                                    border: "none",
                                    borderRadius: "8px",
                                    background:
                                        loading
                                            ? "#93c5fd"
                                            : "#2563eb",
                                    color: "#ffffff",
                                    fontSize: "15px",
                                    fontWeight: "600",
                                    cursor:
                                        loading
                                            ? "not-allowed"
                                            : "pointer"
                                }}
                            >

                                {
                                    loading
                                        ? "Resetting..."
                                        : "Reset Password"
                                }

                            </button>

                        </form>

                    )
                }


                {
                    !success && (

                        <div
                            style={{
                                textAlign: "center",
                                marginTop: "22px"
                            }}
                        >

                            <Link
                                to="/login"
                                style={{
                                    color: "#2563eb",
                                    textDecoration: "none",
                                    fontSize: "14px",
                                    fontWeight: "600"
                                }}
                            >
                                ← Back to Login
                            </Link>

                        </div>

                    )
                }

            </div>

        </div>

    );

}