/* Notice Board — placeholder while the feature is being rebuilt. */
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

export default function NoticeBoardPage() {
    return (
        <div className="dashboard">
            <Sidebar />
            <div className="main-content">
                <Navbar />
                <div className="page-content">
                    <div className="settings-card" style={{ textAlign: "center", padding: "60px 20px" }}>
                        <h2 style={{ margin: 0 }}>Still in development</h2>
                    </div>
                </div>
            </div>
        </div>
    );
}
