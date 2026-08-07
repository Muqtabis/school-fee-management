import { useState } from "react";

import { Link, useNavigate } from "react-router-dom";

import api from "../services/api";

import "./Auth.css";

export default function SignupPage() {

    const navigate = useNavigate();

    const [form, setForm] = useState({

        name: "",

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

            await api.post("/auth/signup", form);

            alert("Account Created");

            navigate("/login");

        }

        catch (err) {

            alert(

                err.response?.data?.message ||

                "Signup Failed"

            );

        }

        finally {

            setLoading(false);

        }

    };

    return (

        <div className="auth-container">

            <div className="auth-card">

                <h1>Create Account</h1>

                <form onSubmit={handleSubmit}>

                    <input

                        type="text"

                        placeholder="Name"

                        name="name"

                        value={form.name}

                        onChange={handleChange}

                        required

                    />

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

                                "Creating..."

                                :

                                "Signup"

                        }

                    </button>

                </form>

                <p>

                    Already have an account?

                    <Link to="/login">

                        Login

                    </Link>

                </p>

            </div>

        </div>

    );

}