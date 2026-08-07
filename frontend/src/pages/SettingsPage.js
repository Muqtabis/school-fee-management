import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

import { useAuth } from "../context/AuthContext";

function SettingsPage() {

    const { user } = useAuth();

    return (

        <div className="dashboard">

            <Sidebar />

            <div className="main-content">

                <Navbar />

                <div className="page-content">

                    <div className="page-header">

                        <h2>Settings</h2>

                    </div>

                    <div className="settings-card">

                        <h3>Profile Information</h3>

                        <br />

                        <p>

                            <strong>Name :</strong>

                            {user?.name}

                        </p>

                        <br />

                        <p>

                            <strong>Email :</strong>

                            {user?.email}

                        </p>

                        <br />

                        <p>

                            <strong>Role :</strong>

                            {user?.role || "Administrator"}

                        </p>

                    </div>

                </div>

            </div>

        </div>

    );

}

export default SettingsPage;