// Kanban-style board components.
// Loaded with: const B = await dc.require("Toolkit/Datacore/ui/Boards.jsx");

/**
 * Counts strip for kanban columns (no DnD, just totals).
 * @param {{
 *   items:any[], statuses:string[], colors?:Record<string,string>,
 *   getStatus?:(item:any)=>string, defaultStatus?:string
 * }} props
 */
function KanbanCounts({ items, statuses, colors = {}, getStatus, defaultStatus }) {
    const get = getStatus ?? (p => p.value("status") ?? defaultStatus ?? statuses[0]);
    const counts = {}; for (const s of statuses) counts[s] = 0;
    for (const p of items) { const s = get(p); if (counts[s] != null) counts[s]++; }
    return (
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
            {statuses.map(s => (
                <div key={s} style={{ flex: 1, minWidth: "100px", padding: "10px", background: "var(--background-secondary)", borderRadius: "6px", borderLeft: `3px solid ${colors[s] ?? "var(--background-modifier-border)"}` }}>
                    <div style={{ fontSize: "1.4em", fontWeight: "bold" }}>{counts[s]}</div>
                    <div style={{ fontSize: "0.78em", opacity: 0.7 }}>{s}</div>
                </div>
            ))}
        </div>
    );
}

/**
 * Drag-and-drop kanban board.
 * @param {{
 *   columns:(string|{id:string})[],
 *   items:any[],                           // already filtered to what should appear
 *   getCol:(item:any)=>string,             // which column an item belongs to
 *   onMove:(item:any, toCol:string)=>any,  // called on drop (await-safe)
 *   renderCard:(item:any, colId:string, draggingId:string|null)=>any,
 *   columnHeader?:(col:any, colItems:any[])=>any  // optional custom header
 * }} props
 */
function Kanban({ columns, items, getCol, onMove, renderCard, columnHeader }) {
    const [draggingId, setDraggingId] = dc.useState(null);
    return <div style={{ display: "flex", gap: "8px", overflowX: "auto" }}>
        {columns.map(col => {
            const colId = typeof col === "string" ? col : col.id;
            const colItems = items.filter(i => getCol(i) === colId);
            return <div key={colId} style={{ flex: "1 1 0", minWidth: "180px", background: "var(--background-secondary)", borderRadius: "6px", padding: "8px" }}
                onDragOver={e => e.preventDefault()}
                onDrop={async e => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain");
                    const item = items.find(i => i.$path === id);
                    if (item) await onMove(item, colId);
                    setDraggingId(null);
                }}>
                {columnHeader ? columnHeader(col, colItems) : <div style={{ fontSize: "0.78em", textTransform: "uppercase", opacity: 0.7, marginBottom: "6px" }}>{colId} ({colItems.length})</div>}
                {colItems.map(it => <div key={it.$path} draggable
                    onDragStart={e => { e.dataTransfer.setData("text/plain", it.$path); setDraggingId(it.$path); }}
                    onDragEnd={() => setDraggingId(null)}
                    style={{ opacity: draggingId === it.$path ? 0.4 : 1, cursor: "grab" }}>
                    {renderCard(it, colId, draggingId)}
                </div>)}
            </div>;
        })}
    </div>;
}

return { KanbanCounts, Kanban };
