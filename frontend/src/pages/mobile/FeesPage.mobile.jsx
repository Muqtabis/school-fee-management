/* MOBILE Fees — academic years and class fee structures, read-friendly. */
import { useEffect, useState } from "react";
import api from "../../services/api";
import { toast } from "../../services/notify";
import { MobileCard, MobileList } from "../../components/mobile/MobileUI";

export default function FeesPageMobile() {
    const [years, setYears] = useState([]);
    const [yearId, setYearId] = useState("");
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get("/fees/academic-years").then((r) => {
            const list = Array.isArray(r.data) ? r.data : [];
            setYears(list);
            const active = list.find((y) => y.status === "active");
            setYearId(String(active?.id || list[0]?.id || ""));
        }).catch(() => {}).finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!yearId) { setClasses([]); return; }
        api.get("/fees/structures", { params: { academicYearId: yearId } })
            .then((r) => setClasses(Array.isArray(r.data) ? r.data : []))
            .catch((e) => toast(e.response?.data?.message || "Unable to load fee structures."));
    }, [yearId]);

    const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;

    return (
        <div>
            <h2>Fee Structure</h2>
            <p className="m-page-lead">Class-wise fee components</p>
            <div className="m-chips">
                {years.map((y) => (
                    <button type="button" key={y.id} className={"m-chip" + (String(yearId) === String(y.id) ? " m-chip-active" : "")} onClick={() => setYearId(String(y.id))}>
                        {y.name}{y.status === "active" ? " · active" : ""}
                    </button>
                ))}
            </div>
            {loading ? <div className="m-empty">Loading…</div> : (
                <MobileList empty="No fee structures for this year.">
                    {classes.map((c) => (
                        <MobileCard key={c.id || c.className} title={c.className} value={money(c.totalAmount || c.total || 0)} sub={`${(c.items || []).length} component(s)`} />
                    ))}
                </MobileList>
            )}
        </div>
    );
}
