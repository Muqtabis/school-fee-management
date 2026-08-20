import {
    createContext,
    useContext,
    useEffect,
    useState
} from "react";

import api from "../services/api";


const AuthContext =
    createContext();


export const useAuth =
    () =>
        useContext(
            AuthContext
        );


export default function AuthProvider({
    children
}) {

    const [
        user,
        setUser
    ] =
        useState(null);


    const [
        loading,
        setLoading
    ] =
        useState(true);


    // =====================================================
    // RESTORE LOGIN
    // =====================================================

    useEffect(() => {

        const token =
            localStorage.getItem(
                "token"
            );


        if (!token) {

            setLoading(false);

            return;

        }


        api
            .get(
                "/auth/profile"
            )

            .then(
                (res) => {

                    console.log(
                        "Authenticated user:",
                        res.data.user
                    );

                    setUser(
                        res.data.user
                    );

                }
            )

            .catch(
                (err) => {

                    console.error(
                        "Profile Error:",
                        err.response?.data ||
                        err.message
                    );


                    localStorage.removeItem(
                        "token"
                    );


                    setUser(null);

                }
            )

            .finally(
                () => {

                    setLoading(false);

                }
            );

    }, []);


    // =====================================================
    // LOGIN
    // =====================================================

    const login =
        (
            token,
            userData
        ) => {

            localStorage.setItem(
                "token",
                token
            );


            setUser(
                userData
            );

        };


    // =====================================================
    // LOGOUT
    // =====================================================

    const logout =
        () => {

            localStorage.removeItem(
                "token"
            );


            setUser(null);

        };


    return (

        <AuthContext.Provider
            value={{

                user,

                login,

                logout,

                loading

            }}
        >

            {
                children
            }

        </AuthContext.Provider>

    );

}