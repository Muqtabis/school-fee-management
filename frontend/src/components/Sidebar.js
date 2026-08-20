import {
    NavLink,
    useNavigate
} from "react-router-dom";

import {
    useAuth
} from "../context/AuthContext";


function Sidebar() {

    const navigate =
        useNavigate();


    const {
        user,
        logout
    } =
        useAuth();


    // =====================================================
    // BASE MENU
    // =====================================================

    const menuItems = [

        {
            name:
                "Students",

            path:
                "/students",

            icon:
                "👨‍🎓"

        },

        {

            name:
                "Fee Management",

            path:
                "/fees",

            icon:
                "📚"

        },

        {

            name:
                "Payments",

            path:
                "/payments",

            icon:
                "💰"

        },

        {

            name:
                "Expenses",

            path:
                "/expenses",

            icon:
                "💸"

        },

        {

            name:
                "Reports",

            path:
                "/reports",

            icon:
                "📊"

        },

        {

            name:
                "Notifications",

            path:
                "/notifications",

            icon:
                "🔔"

        },

        {

            name:
                "Settings",

            path:
                "/settings",

            icon:
                "⚙️"

        }

    ];


    // =====================================================
    // ADMIN ONLY MENU
    // =====================================================

    if (
        user?.role ===
        "admin"
    ) {

        menuItems.unshift({

            name:
                "Dashboard",

            path:
                "/dashboard",

            icon:
                "🏠"

        });


        menuItems.push({

            name:
                "Users",

            path:
                "/users",

            icon:
                "👥"

        });

    }


    // =====================================================
    // LOGOUT
    // =====================================================

    const handleLogout =
        () => {

            logout();

            navigate(
                "/login"
            );

        };


    // =====================================================
    // UI
    // =====================================================

    return (

        <aside
            className="sidebar"
        >


            <div
                className="sidebar-header"
            >

                <h2>
                    THE AGE SCHOOL
                </h2>

                <p>
                    Fee Management
                </p>

            </div>


            <nav
                className="sidebar-menu"
            >

                {

                    menuItems.map(
                        item => (

                            <NavLink

                                key={
                                    item.path
                                }

                                to={
                                    item.path
                                }

                                className={
                                    ({
                                        isActive
                                    }) =>

                                        isActive

                                            ? "menu-item active"

                                            : "menu-item"

                                }

                            >

                                <span
                                    className="menu-icon"
                                >

                                    {
                                        item.icon
                                    }

                                </span>


                                <span>

                                    {
                                        item.name
                                    }

                                </span>

                            </NavLink>

                        )
                    )

                }

            </nav>


            <div
                className="sidebar-footer"
            >

                <button

                    className="logout-btn"

                    onClick={
                        handleLogout
                    }

                >

                    Logout

                </button>

            </div>


        </aside>

    );

}


export default Sidebar;