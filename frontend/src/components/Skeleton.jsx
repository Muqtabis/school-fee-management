/* Skeleton loaders — drop-in placeholders while data loads. */
export function SkeletonCard() {
    return (
        <div className="skel-card">
            <div className="skel skel-line short" />
            <div className="skel skel-line tall" />
            <div className="skel skel-line short" />
        </div>
    );
}
export function SkeletonGrid({ count = 4 }) {
    return (
        <div className="cards">
            {Array.from({ length: count }, (_, i) => <SkeletonCard key={i} />)}
        </div>
    );
}
export function SkeletonTable({ rows = 5 }) {
    return (
        <div className="table-container">
            {Array.from({ length: rows }, (_, i) => (
                <div className="skel skel-block" key={i} />
            ))}
        </div>
    );
}
