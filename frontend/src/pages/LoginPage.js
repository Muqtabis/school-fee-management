import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

import "./Auth.css";

export default function LoginPage() {

    const navigate = useNavigate();

    const { login } = useAuth();

    const [form, setForm] = useState({
        email: "",
        password: ""
    });

    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {

        setForm({

            ...form,

            [e.target.name]: e.target.value

        });

    };

    const handleSubmit = async (e) => {

        e.preventDefault();

        try {

            setLoading(true);

            const res = await api.post("/auth/login", form);

            login(res.data.token, res.data.user);

            navigate("/dashboard");

        }

        catch (err) {

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

        <div className="auth-container">

            <div className="auth-card">

                <h1>THE AGE SCHOOL</h1>

                <h2>Fee Management System</h2>

                <p>Welcome Back 👋</p>

                <form onSubmit={handleSubmit}>

                    <input

                        type="email"

                        placeholder="Email"

                        name="email"

                        value={form.email}

                        onChange={handleChange}

                        required

                    />

                    <input

                        type="password"

                        placeholder="Password"

                        name="password"

                        value={form.password}

                        onChange={handleChange}

                        required

                    />

                    <button>

                        {

                            loading

                                ?

                                "Signing In..."

                                :

                                "Login"

                        }

                    </button>

                </form>

                <p>

                    Don't have an account?

                    <Link to="/signup">

                        Signup

                    </Link>

                </p>

            </div>

        </div>

    );

}