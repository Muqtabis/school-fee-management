import {
    useState
} from "react";

import {
    Link,
    useNavigate
} from "react-router-dom";

import {
    useAuth
} from "../context/AuthContext";

import api from "../services/api";


export default function LoginPage() {

    const navigate = useNavigate();

    const {
        login
    } = useAuth();


    const [form, setForm] = useState({

        email: "",
        password: ""

    });


    const [loading, setLoading] =
        useState(false);


    const [showPassword, setShowPassword] =
        useState(false);


    // =====================================================
    // INPUT CHANGE
    // =====================================================

    const handleChange = (e) => {

        setForm({

            ...form,

            [e.target.name]:
                e.target.value

        });

    };


    // =====================================================
    // LOGIN
    // =====================================================

    const handleSubmit = async (e) => {

        e.preventDefault();


        try {

            setLoading(true);


            const res =
                await api.post(
                    "/auth/login",
                    form
                );


            const {
                token,
                user
            } = res.data;


            login(
                token,
                user
            );


            // =================================================
            // ADMIN
            // =================================================

            if (
                user.role === "admin"
            ) {

                navigate(
                    "/dashboard",
                    {
                        replace: true
                    }
                );

                return;

            }


            // =================================================
            // RECEPTIONIST
            // =================================================

            if (
                user.role === "receptionist"
            ) {

                navigate(
                    "/fees",
                    {
                        replace: true
                    }
                );

                return;

            }


            // =================================================
            // INVALID ROLE
            // =================================================

            alert(
                "Your account does not have a valid system role."
            );


            navigate(
                "/login",
                {
                    replace: true
                }
            );


        }

        catch (err) {

            console.error(
                "Login Error:",
                err.response?.data ||
                err.message
            );


            alert(
                err.response?.data?.message ||
                "Login Failed"
            );

        }

        finally {

            setLoading(false);

        }

    };


    return (

        <div
            style={{

                minHeight: "100vh",

                display: "flex",

                alignItems: "center",

                justifyContent: "center",

                background: "#f5f6f8",

                padding: "20px",

                fontFamily:
                    "Arial, Helvetica, sans-serif"

            }}
        >

            <div
                style={{

                    width: "100%",

                    maxWidth: "380px",

                    background: "#ffffff",

                    padding: "35px",

                    borderRadius: "10px",

                    boxSizing: "border-box",

                    boxShadow:
                        "0 4px 20px rgba(0,0,0,0.08)"

                }}
            >

                {/* =================================================
                    SCHOOL HEADER
                ================================================= */}

                <div
                    style={{

                        textAlign: "center",

                        marginBottom: "30px"

                    }}
                >

                    <div
                        style={{

                            width: "55px",

                            height: "55px",

                            margin:
                                "0 auto 12px",

                            borderRadius: "50%",

                            background:
                                "#17365d",

                            color: "#ffffff",

                            display: "flex",

                            alignItems: "center",

                            justifyContent: "center",

                            fontWeight: "bold",

                            fontSize: "17px"

                        }}
                    >

                        TAS

                    </div>


                    <h1
                        style={{

                            margin: "0",

                            fontSize: "22px",

                            color: "#17365d",

                            fontWeight: "600"

                        }}
                    >

                        THE AGE SCHOOL

                    </h1>


                    <p
                        style={{

                            margin:
                                "6px 0 0",

                            color: "#888",

                            fontSize: "13px"

                        }}
                    >

                        Fee Management System

                    </p>

                </div>


                {/* =================================================
                    LOGIN TITLE
                ================================================= */}

                <h2
                    style={{

                        margin:
                            "0 0 6px",

                        fontSize: "21px",

                        color: "#222"

                    }}
                >

                    Sign In

                </h2>


                <p
                    style={{

                        margin:
                            "0 0 25px",

                        color: "#777",

                        fontSize: "13px"

                    }}
                >

                    Enter your ERP account details

                </p>


                {/* =================================================
                    LOGIN FORM
                ================================================= */}

                <form
                    onSubmit={
                        handleSubmit
                    }
                >

                    {/* EMAIL */}

                    <label
                        style={{

                            display: "block",

                            marginBottom: "7px",

                            color: "#333",

                            fontSize: "13px",

                            fontWeight: "600"

                        }}
                    >

                        Email

                    </label>


                    <input

                        type="email"

                        name="email"

                        placeholder=
                            "Enter your email"

                        value={
                            form.email
                        }

                        onChange={
                            handleChange
                        }

                        autoComplete="username"

                        required

                        style={{

                            width: "100%",

                            height: "45px",

                            padding:
                                "0 12px",

                            boxSizing:
                                "border-box",

                            border:
                                "1px solid #ddd",

                            borderRadius:
                                "6px",

                            outline: "none",

                            fontSize: "14px",

                            marginBottom:
                                "18px"

                        }}

                    />


                    {/* PASSWORD */}

                    <label
                        style={{

                            display: "block",

                            marginBottom: "7px",

                            color: "#333",

                            fontSize: "13px",

                            fontWeight: "600"

                        }}
                    >

                        Password

                    </label>


                    <div
                        style={{

                            position:
                                "relative",

                            marginBottom:
                                "8px"

                        }}
                    >

                        <input

                            type={
                                showPassword
                                    ? "text"
                                    : "password"
                            }

                            name="password"

                            placeholder=
                                "Enter your password"

                            value={
                                form.password
                            }

                            onChange={
                                handleChange
                            }

                            autoComplete="current-password"

                            required

                            style={{

                                width: "100%",

                                height: "45px",

                                padding:
                                    "0 45px 0 12px",

                                boxSizing:
                                    "border-box",

                                border:
                                    "1px solid #ddd",

                                borderRadius:
                                    "6px",

                                outline: "none",

                                fontSize: "14px"

                            }}

                        />


                        {/* EYE BUTTON */}

                        <button

                            type="button"

                            onClick={() =>
                                setShowPassword(
                                    !showPassword
                                )
                            }

                            aria-label={
                                showPassword
                                    ? "Hide password"
                                    : "Show password"
                            }

                            style={{

                                position:
                                    "absolute",

                                right: "8px",

                                top: "50%",

                                transform:
                                    "translateY(-50%)",

                                border: "none",

                                background:
                                    "transparent",

                                cursor:
                                    "pointer",

                                fontSize:
                                    "17px",

                                padding: "5px"

                            }}
                        >

                            {showPassword
                                ? "🙈"
                                : "👁️"
                            }

                        </button>

                    </div>


                    {/* =================================================
                        FORGOT PASSWORD
                    ================================================= */}

                    <div
                        style={{

                            textAlign:
                                "right",

                            marginBottom:
                                "22px"

                        }}
                    >

                        <Link

                            to="/forgot-password"

                            style={{

                                color:
                                    "#17365d",

                                fontSize:
                                    "13px",

                                fontWeight:
                                    "600",

                                textDecoration:
                                    "none"

                            }}

                        >

                            Forgot Password?

                        </Link>

                    </div>


                    {/* =================================================
                        LOGIN BUTTON
                    ================================================= */}

                    <button

                        type="submit"

                        disabled={
                            loading
                        }

                        style={{

                            width: "100%",

                            height: "45px",

                            border: "none",

                            borderRadius: "6px",

                            background:
                                loading
                                    ? "#8fa1b5"
                                    : "#17365d",

                            color:
                                "#ffffff",

                            fontSize: "14px",

                            fontWeight: "600",

                            cursor:
                                loading
                                    ? "not-allowed"
                                    : "pointer"

                        }}

                    >

                        {loading
                            ? "Signing In..."
                            : "Sign In"
                        }

                    </button>

                </form>


                {/* =================================================
                    SECURITY MESSAGE
                ================================================= */}

                <div
                    style={{

                        marginTop: "22px",

                        paddingTop: "18px",

                        borderTop:
                            "1px solid #eee",

                        textAlign:
                            "center"

                    }}
                >

                    <p
                        style={{

                            margin: "0",

                            color: "#888",

                            fontSize: "12px",

                            lineHeight: "1.5"

                        }}
                    >

                        This system is restricted to
                        authorized school staff.

                    </p>

                </div>


                {/* =================================================
                    FOOTER
                ================================================= */}

                <p
                    style={{

                        textAlign: "center",

                        margin:
                            "20px 0 0",

                        color: "#aaa",

                        fontSize: "11px"

                    }}
                >

                    © 2026 The Age School

                </p>

            </div>


            {/* =================================================
                SMALL CSS
            ================================================= */}

            <style>

                {`

                    input:focus {

                        border-color:
                            #17365d !important;

                        box-shadow:
                            0 0 0 2px
                            rgba(23,54,93,0.08);

                    }

                    button[type="submit"]:hover {

                        background:
                            #102a43 !important;

                    }

                    a:hover {

                        text-decoration:
                            underline !important;

                    }

                `}

            </style>

        </div>

    );

}