/* MOBILE Exams — definition cards, open detail in a sheet with read-only status. */
import { useEffect, useState } from "react";
import api from "../../services/api";
import { toast } from "../../services/notify";
import { MobileCard, MobileList, MobileSheet } from "../../components/mobile/MobileUI";

export default function ExamResultsPageMobile() {
    const [defs, setDefs] = useState([]);
    const [selected, setSelected] = useState(null);
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get("/exams/definitions")
            .then((r) => setDefs(r.data.definitions || []))
            .catch((e) => toast(e.response?.data?.message || "Unable to load exams."))
            .finally(() => setLoading(false));
    }, []);

    const openDetail = async (d) => {
        setSelected(d); setDetail(null);
        try {
            const r = await api.get(`/exams/definitions/${d.id}`);
            setDetail(r.data);
        } catch (e) { toast(e.response?.data?.message || "Unable to load exam."); }
    };

    return (
        <div>
            <h2>Exams &amp; Results</h2>
            <p className="m-page-lead">Exams are configured on desktop. View status here.</p>
            {loading ? <div className="m-empty">Loading…</div> : (
                <MobileList empty="No exams yet.">
                    {defs.map((d) => (
                        <button type="button" key={d.id} className="m-card" onClick={() => openDetail(d)} style={{ width: "100%", textAlign: "left" }}>
                            <span className="m-card-title">{d.examCategory || d.examType || "Exam"}</span>
                            <strong className="m-card-value">{d.name}</strong>
                            <small className="m-card-sub">{d.academicYear || ""} · {d.classCount || 0} class(es)</small>
                        </button>
                    ))}
                </MobileList>
            )}
            <MobileSheet open={!!selected} onClose={() => setSelected(null)} title={selected?.name || "Exam"}>
                {!detail ? <div className="m-empty">Loading…</div> : (
                    <div className="m-list">
                        <MobileCard title="Academic year" value={detail.definition?.academicYear || "—"} />
                        <MobileCard title="Category" value={detail.definition?.examCategory || "—"} />
                        <h3>Classes</h3>
                        {(detail.classes || []).map((c) => (
                            <MobileCard key={c.id} title={c.className} value={`${c.enteredCells || 0} / ${c.expectedCells || 0} marks`} sub={c.status || ""} />
                        ))}
                    </div>
                )}
            </MobileSheet>
        </div>
    );
}
