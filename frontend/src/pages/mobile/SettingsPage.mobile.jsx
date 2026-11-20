/* MOBILE Settings — profile + change password, card layout. */
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import { toast } from "../../services/notify";
import { MobileCard, MobileRow, MobileSheet } from "../../components/mobile/MobileUI";

export default function SettingsPageMobile() {
    const { user } = useAuth();
    const [sheet, setSheet] = useState(false);
    const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
    const [busy, setBusy] = useState(false);

    const changePassword = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            const r = await api.put("/users/change-own-password", pw);
            toast(r.data?.message || "Password changed.");
            setSheet(false);
            setPw({ currentPassword: "", newPassword: "" });
        } catch (err) { toast(err.response?.data?.message || "Unable to change password."); }
        finally { setBusy(false); }
    };

    return (
        <div>
            <h2>Settings</h2>
            <p className="m-page-lead">Your account</p>
            <h3>Profile</h3>
            <div className="m-list">
                <MobileRow label="Name" value={user?.name || "—"} />
                <MobileRow label="Email" value={user?.email || "—"} />
                <MobileRow label="Role" value={user?.role || "—"} />
            </div>
            <h3>Security</h3>
            <MobileCard title="Password" value="Change password" sub="Update your login password" onClick={() => setSheet(true)} tone="gold" />

            <MobileSheet open={sheet} onClose={() => setSheet(false)} title="Change password">
                <form onSubmit={changePassword}>
                    <label>Current password
                        <input type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required />
                    </label>
                    <label>New password
                        <input type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required minLength="6" />
                    </label>
                    <div className="m-sheet-actions">
                        <button className="m-btn m-btn-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
                        <button className="m-btn m-btn-ghost" type="button" onClick={() => setSheet(false)}>Cancel</button>
                    </div>
                </form>
            </MobileSheet>
        </div>
    );
}
