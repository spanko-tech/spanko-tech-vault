---
tags:
  - fabrica/infra-system
---

# Infrastructure

```datacorejsx
const V = await dc.require("Toolkit/Datacore/Vault.js");
const { NewForm, EditText, SearchableSelect, useSortBy, SortBar, useLintState, LintPanel, lintColumn } = await dc.require("Toolkit/Datacore/UI.jsx");
const setField = V.setField;

const SERVICE_STATUS = ["Planned", "Stable", "Needs Attention"];
const SERVICE_STATUS_COLOR = { Planned: "#888", Stable: "var(--color-green)", "Needs Attention": "var(--color-orange)" };
const SERVICE_TYPES  = ["infra", "app", "game"];
const NETWORK_TYPES  = ["wireguard", "docker-subnet"];
const DEFAULT_NETWORK_LABEL = "— host bridge —";

function getNetworks(item) {
    const v = item.value("network");
    if (Array.isArray(v)) return v.map(String).filter(Boolean);
    if (v == null || v === "") return [];
    return [String(v)];
}

function NetworkPicker({ item, networkNames }) {
    const current = getNetworks(item);
    const remaining = networkNames.filter(n => !current.includes(n));
    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
            {current.length === 0 && <span style={{ opacity: 0.55, fontStyle: "italic", fontSize: "0.85em" }}>host</span>}
            {current.map(n => (
                <span key={n} style={{ background: "var(--background-modifier-hover)", padding: "1px 6px", borderRadius: "10px", fontSize: "0.85em", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    {n}
                    <a onClick={() => setField(item, "network", current.filter(x => x !== n))}
                       style={{ cursor: "pointer", opacity: 0.6, fontWeight: "bold" }}>×</a>
                </span>
            ))}
            {remaining.length > 0 && (
                <dc.VanillaSelect value=""
                    options={[{value:"",label:"+ add"}, ...remaining.map(n => ({value:n,label:n}))]}
                    onValueChange={v => { if (v) setField(item, "network", [...current, v]); }} />
            )}
        </div>
    );
}

const SAFE = s => "n_" + String(s).replace(/[^a-zA-Z0-9]/g, "_");

function svcLabel(svc, ipField = "ip") {
    const ip = String(svc.value(ipField) ?? "").trim();
    const pp = String(svc.value("port_public") ?? "").trim();
    const ip_ = String(svc.value("port_internal") ?? "").trim();
    const portStr = pp && ip_ && pp !== ip_ ? `${pp}→${ip_}` : (pp || ip_ || "");
    const tail = [ip, portStr].filter(Boolean).join(":");
    const type = String(svc.value("type") ?? "");
    const lines = [svc.$name];
    if (type) lines.push(`<small>${type}</small>`);
    if (tail) lines.push(`<small><code>${tail}</code></small>`);
    return lines.join("<br/>");
}
function svcClass(svc) {
    return "st_" + String(svc.value("status") ?? "Planned").replace(/\s+/g, "_");
}
const STATUS_CLASSES = [
    "  classDef st_Stable fill:#1f4d2e,stroke:#2faa5b,color:#e8ffe8",
    "  classDef st_Planned fill:#3a3a3a,stroke:#888,color:#ddd",
    "  classDef st_Needs_Attention fill:#5a3a1f,stroke:#d28b3a,color:#ffe8cf",
    "  classDef empty fill:transparent,stroke:transparent,color:transparent"
];
const wrapMermaid = lines => "```mermaid\n" + lines.join("\n") + "\n```";

function lintInfra(servers, services, networks) {
    const serverNames = new Set(servers.map(s => s.$name));
    const netByName = new Map(networks.map(n => [n.$name, n]));
    const issues = new Map();
    const add = (item, code, severity, message) => {
        const arr = issues.get(item.$path) ?? [];
        arr.push({ code, severity, message });
        issues.set(item.$path, arr);
    };

    for (const srv of servers) {
        if (!String(srv.value("public_ip") ?? "").trim()) add(srv, "no-public-ip", "warn", "missing public_ip");
        if (!String(srv.value("role") ?? "").trim())      add(srv, "no-role",      "warn", "missing role");
    }

    for (const net of networks) {
        const type = String(net.value("type") ?? "");
        const subnet = String(net.value("subnet") ?? "").trim();
        const server = String(net.value("server") ?? "").trim();
        if (type === "docker-subnet") {
            if (!server) add(net, "subnet-no-server", "error", "docker-subnet has no server");
            else if (!serverNames.has(server)) add(net, "subnet-bad-server", "error", `unknown server "${server}"`);
            if (!subnet) add(net, "subnet-no-cidr", "warn", "no subnet CIDR set");
        }
        if (type === "wireguard" && !subnet) add(net, "mesh-no-cidr", "warn", "no mesh subnet set");
        const used = services.some(s => getNetworks(s).includes(net.$name));
        if (!used) add(net, "unused", "warn", "no services attached");
    }

    for (const svc of services) {
        const server = String(svc.value("server") ?? "").trim();
        const nets = getNetworks(svc);
        if (!server) add(svc, "no-server", "error", "no server set");
        else if (!serverNames.has(server)) add(svc, "bad-server", "error", `unknown server "${server}"`);
        for (const n of nets) {
            if (!netByName.has(n)) add(svc, "bad-network", "error", `unknown network "${n}"`);
        }
        const onWg     = nets.some(n => String(netByName.get(n)?.value("type") ?? "") === "wireguard");
        const onDocker = nets.some(n => String(netByName.get(n)?.value("type") ?? "") === "docker-subnet");
        if (onWg     && !String(svc.value("wg_ip") ?? "").trim()) add(svc, "wg-no-wg-ip",  "warn", "on a WG mesh but no wg_ip");
        if (onDocker && !String(svc.value("ip")    ?? "").trim()) add(svc, "docker-no-ip", "warn", "on a docker-subnet but no ip");
        if (!String(svc.value("image") ?? "").trim()) add(svc, "no-image", "warn", "no image set");
    }

    const counts = { error: 0, warn: 0 };
    for (const arr of issues.values()) for (const i of arr) counts[i.severity]++;
    return { issues, counts };
}

// 1) MESH: every server (with public IP), WG containers inside, edges to WG networks
function buildMeshGraph(servers, services, networks, meshFilter = "all") {
    let wgNets = networks.filter(n => String(n.value("type") ?? "") === "wireguard");
    if (meshFilter !== "all") wgNets = wgNets.filter(n => n.$name === meshFilter);
    const wgSet = new Set(wgNets.map(n => n.$name));

    const visibleServers = meshFilter === "all"
        ? servers
        : servers.filter(srv => services.some(s =>
            String(s.value("server") ?? "") === srv.$name &&
            getNetworks(s).some(n => wgSet.has(n))
          ));

    const lines = [
        "%%{init: {'flowchart': {'defaultRenderer': 'elk'}}}%%",
        "flowchart LR"
    ];

    for (const srv of visibleServers) {
        const sid = SAFE(srv.$name);
        lines.push(`  subgraph ${sid}["${srv.$name}"]`);
        const wgServices = services.filter(s =>
            String(s.value("server") ?? "") === srv.$name &&
            getNetworks(s).some(n => wgSet.has(n))
        );
        if (wgServices.length === 0) {
            lines.push(`    ${sid}_empty["(not on mesh)"]:::empty_box`);
        } else {
            for (const s of wgServices) {
                lines.push(`    ${SAFE("wg_" + s.$name)}(["${svcLabel(s, "wg_ip")}"]):::${svcClass(s)}`);
            }
        }
        lines.push(`  end`);
    }

    for (const wg of wgNets) {
        lines.push(`  ${SAFE("net_" + wg.$name)}{{"${wg.$name}"}}`);
    }

    for (const s of services) {
        for (const n of getNetworks(s).filter(n => wgSet.has(n))) {
            lines.push(`  ${SAFE("wg_" + s.$name)} --- ${SAFE("net_" + n)}`);
        }
    }

    lines.push(...STATUS_CLASSES);
    lines.push("  classDef empty_box fill:transparent,stroke:#555,color:#888,stroke-dasharray: 3 3");
    return wrapMermaid(lines);
}

// 2) PER-SERVER: server box → subnet boxes (containing services) → external WG nets
function buildServerGraph(server, services, networks) {
    const svcsHere = services.filter(s => String(s.value("server") ?? "") === server.$name);
    const localSubnets = networks.filter(n =>
        String(n.value("type") ?? "") === "docker-subnet" &&
        String(n.value("server") ?? "") === server.$name
    );
    const localSet = new Set(localSubnets.map(n => n.$name));
    const wgNets = networks.filter(n => String(n.value("type") ?? "") === "wireguard");
    const wgSet = new Set(wgNets.map(n => n.$name));

    const buckets = new Map();
    const placed = new Map();
    for (const svc of svcsHere) {
        const local = getNetworks(svc).find(n => localSet.has(n));
        const key = local ?? "__host__";
        if (local) placed.set(svc.$name, local);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(svc);
    }

    const lines = [
        "%%{init: {'flowchart': {'defaultRenderer': 'elk'}}}%%",
        "flowchart LR"
    ];
    const sid = SAFE(server.$name);
    lines.push(`  subgraph ${sid}["${server.$name}"]`);
    for (const subnet of localSubnets) {
        const subId = SAFE("subnet_" + subnet.$name);
        lines.push(`    subgraph ${subId}["${subnet.$name}"]`);
        const inside = buckets.get(subnet.$name) ?? [];
        if (inside.length === 0) lines.push(`      ${subId}_empty[" "]:::empty`);
        else for (const s of inside) lines.push(`      ${SAFE("svc_" + s.$name)}(["${svcLabel(s)}"]):::${svcClass(s)}`);
        lines.push(`    end`);
    }
    const hostSvcs = buckets.get("__host__") ?? [];
    if (hostSvcs.length > 0) {
        lines.push(`    subgraph ${sid}_host["host bridge"]`);
        for (const s of hostSvcs) lines.push(`      ${SAFE("svc_" + s.$name)}(["${svcLabel(s)}"]):::${svcClass(s)}`);
        lines.push(`    end`);
    }
    lines.push(`  end`);

    const wgUsed = new Set();
    for (const s of svcsHere) for (const n of getNetworks(s)) if (wgSet.has(n)) wgUsed.add(n);
    for (const wgName of wgUsed) {
        lines.push(`  ${SAFE("net_" + wgName)}{{"${wgName}"}}`);
    }
    for (const s of svcsHere) {
        const primary = placed.get(s.$name);
        for (const n of getNetworks(s)) {
            if (n === primary) continue;
            if (wgSet.has(n)) lines.push(`  ${SAFE("svc_" + s.$name)} --- ${SAFE("net_" + n)}`);
        }
    }

    lines.push(...STATUS_CLASSES);
    return wrapMermaid(lines);
}

return function View() {
    const servers  = dc.useQuery('@page and #fabrica/server  and path("Systems/Infrastructure")');
    const services = dc.useQuery('@page and #fabrica/service and path("Systems/Infrastructure")');
    const networks = dc.useQuery('@page and #fabrica/network and path("Systems/Infrastructure")');

    const serverNames  = dc.useMemo(() => servers.map(s => s.$name), [servers]);
    const networkNames = dc.useMemo(() => networks.map(n => n.$name), [networks]);

    // Service filters (debounced search)
    const [searchInput, setSearchInput] = dc.useState("");
    const [search, setSearch] = dc.useState("");
    const [serverFilter, setServerFilter] = dc.useState("all");
    const [statusFilter, setStatusFilter] = dc.useState("all");
    const [typeFilter,   setTypeFilter]   = dc.useState("all");
    dc.useEffect(() => {
        const t = setTimeout(() => setSearch(searchInput.toLowerCase()), 200);
        return () => clearTimeout(t);
    }, [searchInput]);

    const filteredServices = dc.useMemo(() => {
        return services.filter(s => {
            if (serverFilter !== "all" && String(s.value("server") ?? "") !== serverFilter) return false;
            if (statusFilter !== "all" && String(s.value("status") ?? "Planned") !== statusFilter) return false;
            if (typeFilter   !== "all" && String(s.value("type")   ?? "")        !== typeFilter)   return false;
            if (search) {
                const hay = (s.$name + " " + String(s.value("image") ?? "")).toLowerCase();
                if (!hay.includes(search)) return false;
            }
            return true;
        });
    }, [services, search, serverFilter, statusFilter, typeFilter]);

    const resetFilters = () => { setSearchInput(""); setSearch(""); setServerFilter("all"); setStatusFilter("all"); setTypeFilter("all"); };
    const filtersActive = !!(search || serverFilter !== "all" || statusFilter !== "all" || typeFilter !== "all");

    const SERVICE_SORT_FIELDS = [
        { value: "$name",   label: "Name" },
        { value: "server",  label: "Server" },
        { value: "status",  label: "Status" },
        { value: "type",    label: "Type" },
        { value: "image",   label: "Image" },
    ];
    const { sorted: sortedServices, sortField: svcSortField, setSortField: setSvcSortField, sortDir: svcSortDir, setSortDir: setSvcSortDir } = useSortBy(filteredServices, SERVICE_SORT_FIELDS);

    const SERVER_SORT_FIELDS = [
        { value: "$name",     label: "Name" },
        { value: "role",      label: "Role" },
        { value: "public_ip", label: "IP" },
    ];
    const { sorted: sortedServers, sortField: srvSortField, setSortField: setSrvSortField, sortDir: srvSortDir, setSortDir: setSrvSortDir } = useSortBy(servers, SERVER_SORT_FIELDS);

    const NET_SORT_FIELDS = [
        { value: "$name",  label: "Name" },
        { value: "type",   label: "Type" },
        { value: "subnet", label: "Subnet" },
        { value: "server", label: "Server" },
    ];
    const { sorted: sortedNetworks, sortField: netSortField, setSortField: setNetSortField, sortDir: netSortDir, setSortDir: setNetSortDir } = useSortBy(networks, NET_SORT_FIELDS);

    const [showTopo, setShowTopo] = dc.useState(false);
    const [meshFilter, setMeshFilter]     = dc.useState("all");
    const [topoServerFilter, setTopoServerFilter] = dc.useState("all");
    const wgNetworkNames = dc.useMemo(
        () => networks.filter(n => String(n.value("type") ?? "") === "wireguard").map(n => n.$name),
        [networks]
    );
    const meshGraph    = dc.useMemo(() => buildMeshGraph(servers, services, networks, meshFilter),
        [servers, services, networks, meshFilter]);
    const serverGraphs = dc.useMemo(
        () => servers
            .filter(srv => topoServerFilter === "all" || srv.$name === topoServerFilter)
            .map(srv => ({ name: srv.$name, src: buildServerGraph(srv, services, networks) })),
        [servers, services, networks, topoServerFilter]
    );

    const lint = dc.useMemo(() => lintInfra(servers, services, networks), [servers, services, networks]);
    const { issueFilter: srvIssueFilter, setIssueFilter: setSrvIssueFilter, issueCounts: srvIssueCounts, totalIssues: srvTotalIssues, itemsWithLint: srvWithLint } =
        useLintState(servers, lint.issues);
    const { issueFilter: svcIssueFilter, setIssueFilter: setSvcIssueFilter, issueCounts: svcIssueCounts, totalIssues: svcTotalIssues, itemsWithLint: svcWithLint } =
        useLintState(services, lint.issues);
    const { issueFilter: netIssueFilter, setIssueFilter: setNetIssueFilter, issueCounts: netIssueCounts, totalIssues: netTotalIssues, itemsWithLint: netWithLint } =
        useLintState(networks, lint.issues);

    return (
        <div>
            <h3>Servers ({servers.length})</h3>
            <NewForm label="+ Server" folder='Systems/Infrastructure/Servers' tag={["fabrica/server"]}
                fields={[
                    { name: "name", placeholder: "Hostname", width: "200px" },
                    { name: "role", placeholder: "Role", width: "160px" },
                    { name: "public_ip", placeholder: "Public IP", width: "140px" }
                ]}
            />
            <LintPanel totalIssues={srvTotalIssues} itemsWithLint={srvWithLint}
                issueCounts={srvIssueCounts} issueFilter={srvIssueFilter} setIssueFilter={setSrvIssueFilter}
                icon="🖥" noun="server" />
            <div style={{ marginBottom: "6px" }}>
                <SortBar fields={SERVER_SORT_FIELDS} field={srvSortField} setField={setSrvSortField} dir={srvSortDir} setDir={setSrvSortDir} />
            </div>
            <dc.Table paging={20} rows={srvIssueFilter === "All" ? sortedServers : sortedServers.filter(s => (lint.issues.get(s.$path) ?? []).some(i => i.code === srvIssueFilter))}
                columns={[
                    { id: "Server", value: s => s.$link },
                    { id: "Role", value: s => String(s.value("role") ?? ""), render: (_, s) => <EditText item={s} field="role" /> },
                    { id: "Public IP", value: s => String(s.value("public_ip") ?? ""), render: (_, s) => <EditText item={s} field="public_ip" mono /> },
                    lintColumn(lint.issues, srvIssueFilter, setSrvIssueFilter)
                ]} />

            <h3>Services ({filteredServices.length}{filtersActive ? ` of ${services.length}` : ""})</h3>
            <NewForm label="+ Service" folder='Systems/Infrastructure/Services' tag={["fabrica/service"]}
                initialValues={{
                    server: serverFilter !== "all" ? serverFilter : undefined,
                    status: statusFilter !== "all" ? statusFilter : undefined,
                    type:   typeFilter   !== "all" ? typeFilter   : undefined
                }}
                fields={[
                    { name: "name", placeholder: "Service name", width: "200px" },
                    { name: "server",  type: "select", options: serverNames,  default: serverNames[0] ?? "" },
                    { name: "type",    type: "select", options: SERVICE_TYPES, default: "app" },
                    { name: "network", type: "multiselect", options: networkNames, default: [], emptyLabel: "host" },
                    { name: "image", placeholder: "Image", width: "180px" },
                    { name: "ip",            placeholder: "Subnet IP",   width: "130px" },
                    { name: "wg_ip",         placeholder: "WG mesh IP",  width: "130px" },
                    { name: "port_public",   placeholder: "Public port", width: "100px" },
                    { name: "port_internal", placeholder: "Internal port", width: "110px" },
                    { name: "status",  type: "select", options: SERVICE_STATUS, default: "Planned" }
                ]}
            />
            <LintPanel totalIssues={svcTotalIssues} itemsWithLint={svcWithLint}
                issueCounts={svcIssueCounts} issueFilter={svcIssueFilter} setIssueFilter={setSvcIssueFilter}
                icon="📦" noun="service" />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", margin: "6px 0 10px 0" }}>
                <input type="text" placeholder="Search name or image…" value={searchInput}
                    onChange={e => setSearchInput(e.target.value)} style={{ width: "200px" }} />
                <SearchableSelect value={serverFilter}
                    options={[{value:"all",label:"All servers"}, ...serverNames.map(n => ({value:n,label:n}))]}
                    onValueChange={setServerFilter} />
                <SearchableSelect value={statusFilter}
                    options={[{value:"all",label:"All statuses"}, ...SERVICE_STATUS.map(o => ({value:o,label:o}))]}
                    onValueChange={setStatusFilter} />
                <SearchableSelect value={typeFilter}
                    options={[{value:"all",label:"All types"}, ...SERVICE_TYPES.map(o => ({value:o,label:o}))]}
                    onValueChange={setTypeFilter} />
                {filtersActive && <button onClick={resetFilters}>Reset</button>}
                <SortBar fields={SERVICE_SORT_FIELDS} field={svcSortField} setField={setSvcSortField} dir={svcSortDir} setDir={setSvcSortDir} />
            </div>
            <dc.Table paging={20} rows={svcIssueFilter === "All" ? sortedServices : sortedServices.filter(s => (lint.issues.get(s.$path) ?? []).some(i => i.code === svcIssueFilter))}
                columns={[
                    { id: "•", value: s => String(s.value("status") ?? "Planned"), render: (_, s) => <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", background: SERVICE_STATUS_COLOR[s.value("status") ?? "Planned"] ?? "#aaa" }}></span> },
                    { id: "Service", value: s => s.$link },
                    { id: "Server", value: s => String(s.value("server") ?? ""),
                      render: (_, s) => <dc.VanillaSelect value={String(s.value("server") ?? "")}
                          options={serverNames.map(n => ({value:n,label:n}))}
                          onValueChange={v => setField(s, "server", v)} /> },
                    { id: "Type", value: s => String(s.value("type") ?? ""),
                      render: (_, s) => <dc.VanillaSelect value={String(s.value("type") ?? "app")}
                          options={SERVICE_TYPES.map(o => ({value:o,label:o}))}
                          onValueChange={v => setField(s, "type", v)} /> },
                    { id: "Network", value: s => getNetworks(s).join(", "),
                      render: (_, s) => <NetworkPicker item={s} networkNames={networkNames} /> },
                    { id: "Image", value: s => String(s.value("image") ?? ""), render: (_, s) => <EditText item={s} field="image" mono /> },
                    { id: "IP", value: s => String(s.value("ip") ?? ""), render: (_, s) => <EditText item={s} field="ip" mono width="110px" /> },
                    { id: "WG IP", value: s => String(s.value("wg_ip") ?? ""), render: (_, s) => <EditText item={s} field="wg_ip" mono width="110px" /> },
                    { id: "Ports", value: s => `${s.value("port_public") ?? ""}:${s.value("port_internal") ?? ""}`,
                      render: (_, s) => <span style={{ display: "inline-flex", alignItems: "center", gap: "2px", fontFamily: "var(--font-monospace)", fontSize: "0.85em" }}>
                          <EditText item={s} field="port_public"   mono width="50px" />
                          :
                          <EditText item={s} field="port_internal" mono width="50px" />
                      </span> },
                    { id: "Status", value: s => String(s.value("status") ?? ""),
                      render: (_, s) => <dc.VanillaSelect value={String(s.value("status") ?? "Planned")}
                          options={SERVICE_STATUS.map(o => ({value:o,label:o}))}
                          onValueChange={v => setField(s, "status", v)} /> },
                    lintColumn(lint.issues, svcIssueFilter, setSvcIssueFilter)
                ]} />

            <h3>Networks ({networks.length})</h3>
            <NewForm label="+ Network" folder='Systems/Infrastructure/Networks' tag={["fabrica/network"]}
                fields={[
                    { name: "name", placeholder: "Network name", width: "200px" },
                    { name: "type", type: "select", options: NETWORK_TYPES, default: "docker-subnet" },
                    { name: "subnet", placeholder: "10.0.0.0/24 (blank = host bridge)", width: "220px" },
                    { name: "server", type: "select", options: ["", ...serverNames], default: "" }
                ]}
            />
            <LintPanel totalIssues={netTotalIssues} itemsWithLint={netWithLint}
                issueCounts={netIssueCounts} issueFilter={netIssueFilter} setIssueFilter={setNetIssueFilter}
                icon="🌐" noun="network" />
            <div style={{ marginBottom: "6px" }}>
                <SortBar fields={NET_SORT_FIELDS} field={netSortField} setField={setNetSortField} dir={netSortDir} setDir={setNetSortDir} />
            </div>
            <dc.Table paging={20} rows={netIssueFilter === "All" ? sortedNetworks : sortedNetworks.filter(n => (lint.issues.get(n.$path) ?? []).some(i => i.code === netIssueFilter))}
                columns={[
                    { id: "Network", value: n => n.$link },
                    { id: "Type", value: n => String(n.value("type") ?? ""),
                      render: (_, n) => <dc.VanillaSelect value={String(n.value("type") ?? "docker-subnet")}
                          options={NETWORK_TYPES.map(o => ({value:o,label:o}))}
                          onValueChange={v => setField(n, "type", v)} /> },
                    { id: "Subnet", value: n => String(n.value("subnet") ?? ""),
                      render: (_, n) => {
                          const v = String(n.value("subnet") ?? "");
                          if (!v) return <span style={{ opacity: 0.55, fontStyle: "italic" }}>host bridge</span>;
                          return <EditText item={n} field="subnet" mono />;
                      } },
                    { id: "Server", value: n => String(n.value("server") ?? ""),
                      render: (_, n) => <dc.VanillaSelect value={String(n.value("server") ?? "")}
                          options={[{value:"",label:"—"}, ...serverNames.map(sv => ({value:sv,label:sv}))]}
                          onValueChange={v => setField(n, "server", v)} /> },
                    lintColumn(lint.issues, netIssueFilter, setNetIssueFilter)
                ]} />

            <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "20px 0 6px 0" }}>
                <h3 style={{ margin: 0 }}>Topology</h3>
                <button onClick={() => setShowTopo(v => !v)} style={{ fontSize: "0.85em" }}>{showTopo ? "Hide" : "Show"}</button>
            </div>
            {showTopo && <div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", marginBottom: "8px" }}>
                    <label style={{ fontSize: "0.85em" }}>Mesh:</label>
                    <SearchableSelect value={meshFilter}
                        options={[{value:"none",label:"None"}, {value:"all",label:"All meshes"}, ...wgNetworkNames.map(n => ({value:n,label:n}))]}
                        onValueChange={setMeshFilter} />
                    <label style={{ fontSize: "0.85em", marginLeft: "8px" }}>Server:</label>
                    <SearchableSelect value={topoServerFilter}
                        options={[{value:"none",label:"None"}, {value:"all",label:"All servers"}, ...serverNames.map(n => ({value:n,label:n}))]}
                        onValueChange={setTopoServerFilter} />
                </div>
                {meshFilter !== "none" && <>
                    <h4 style={{ marginBottom: "4px" }}>🌐 Mesh{meshFilter !== "all" ? ` · ${meshFilter}` : ""}</h4>
                    <div style={{ padding: "8px", background: "var(--background-secondary)", borderRadius: "6px", marginBottom: "12px", overflowX: "auto" }}>
                        <dc.Markdown content={meshGraph} />
                    </div>
                </>}
                {topoServerFilter !== "none" && serverGraphs.map(g => (
                    <div key={g.name}>
                        <h4 style={{ marginBottom: "4px" }}>🖥 {g.name}</h4>
                        <div style={{ padding: "8px", background: "var(--background-secondary)", borderRadius: "6px", marginBottom: "12px", overflowX: "auto" }}>
                            <dc.Markdown content={g.src} />
                        </div>
                    </div>
                ))}
            </div>}
        </div>
    );
};
```

