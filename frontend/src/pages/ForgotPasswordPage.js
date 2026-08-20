import {
    useState
} from "react";

import {
    Link
} from "react-router-dom";

import api
    from "../services/api";


export default function ForgotPasswordPage() {

    const [
        email,
        setEmail
    ] = useState("");


    const [
        loading,
        setLoading
    ] = useState(false);


    const [
        message,
        setMessage
    ] = useState("");


    const [
        error,
        setError
    ] = useState("");


    const handleSubmit =
        async (e) => {

            e.preventDefault();

            setMessage("");
            setError("");


            try {

                setLoading(true);


                const res =
                    await api.post(
                        "/auth/forgot-password",
                        {
                            email:
                                email.trim()
                        }
                    );


                setMessage(
                    res.data.message
                );


            } catch (error) {

                setError(
                    error.response?.data?.message ||
                    "Unable to process request."
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
                        Forgot Password
                    </h2>


                    <p
                        style={{
                            margin: "0",
                            color: "#6b7280",
                            fontSize: "14px",
                            lineHeight: "1.6"
                        }}
                    >
                        Enter your administrator
                        email to receive a
                        password reset link.
                    </p>

                </div>


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
                        Administrator Email
                    </label>


                    <input
                        type="email"
                        name="email"
                        placeholder="Enter administrator email"
                        value={
                            email
                        }
                        onChange={
                            e =>
                                setEmail(
                                    e.target.value
                                )
                        }
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
                                ? "Sending..."
                                : "Send Reset Link"
                        }

                    </button>

                </form>


                {
                    message && (

                        <div
                            style={{
                                marginTop: "18px",
                                padding: "12px",
                                borderRadius: "8px",
                                background: "#ecfdf5",
                                border:
                                    "1px solid #a7f3d0",
                                color: "#047857",
                                fontSize: "14px",
                                lineHeight: "1.5"
                            }}
                        >
                            {message}
                        </div>

                    )
                }


                {
                    error && (

                        <div
                            style={{
                                marginTop: "18px",
                                padding: "12px",
                                borderRadius: "8px",
                                background: "#fef2f2",
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

            </div>

        </div>

    );

}