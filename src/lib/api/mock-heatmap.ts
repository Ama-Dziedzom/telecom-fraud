import "server-only";

/**
 * Heatmap (FD_API_MOCK=1 only). The collection has GET /heatmap returning
 * {area, alerts, confirmed_fraud, change_pct}; this serves the richer shape the
 * screens need (proposed): KPIs, per-area buckets, hotspots and a ranking.
 */

type Fixture = { status: number; body: unknown };
type Row = { id: string; name: string; parent?: string; sub: string; value: number; change: number | null };

const UPDATED = "2026-10-20T09:44:00Z";

const kpi = (label: string, value: string, sub: string, icon: string, tone?: "critical" | "medium") => ({ label, value, sub, icon, tone });

const COUNTRY = {
  area: { id: "ghana", name: "Ghana", level: "country", path: [] as Array<{ id: string; name: string }> },
  kpis: [
    kpi("Alerts · 24h", "125", "▲ 32% vs yesterday", "alert", "critical"),
    kpi("Hottest area", "Adum, Kumasi", "38 alerts · 9 agents", "pin"),
    kpi("Confirmed fraud", "GHS 61,200", "14 cases closed today", "wallet"),
    kpi("New since 08:00", "+17", "mostly Accra Central", "activity", "medium"),
  ],
  shapes: { ashanti: 4, "greater-accra": 4, central: 2, eastern: 2, northern: 2, western: 2, bono: 1, volta: 1, "western-north": 1 } as Record<string, number>,
  ranking: {
    title: "Hotspots",
    tabs: ["Towns", "Regions"],
    rows: [
      { id: "adum-kumasi", name: "Adum, Kumasi", parent: "Ashanti", sub: "SIM swap to MoMo", value: 38, change: 21 },
      { id: "accra-central", name: "Accra Central", parent: "Greater Accra", sub: "SIM swap to MoMo", value: 31, change: 9 },
      { id: "tema", name: "Tema", parent: "Greater Accra", sub: "Wallet takeover", value: 13, change: 2 },
      { id: "takoradi", name: "Takoradi", parent: "Western", sub: "Wallet takeover", value: 12, change: 4 },
      { id: "kasoa", name: "Kasoa", parent: "Central", sub: "Wallet takeover", value: 8, change: -1 },
      { id: "tamale", name: "Tamale", parent: "Northern", sub: "Agent fraud", value: 6, change: 0 },
      { id: "ho", name: "Ho", parent: "Volta", sub: "Agent fraud", value: 4, change: 1 },
    ] as Row[],
    regions: [
      { id: "ashanti", name: "Ashanti", sub: "Kumasi, Obuasi, Ejisu", value: 41, change: 8 },
      { id: "greater-accra", name: "Greater Accra", sub: "Accra Central, Tema", value: 44, change: 11 },
      { id: "western", name: "Western", sub: "Takoradi", value: 12, change: 4 },
      { id: "central", name: "Central", sub: "Kasoa", value: 8, change: -1 },
      { id: "northern", name: "Northern", sub: "Tamale", value: 6, change: 0 },
      { id: "eastern", name: "Eastern", sub: "Koforidua", value: 7, change: 2 },
      { id: "volta", name: "Volta", sub: "Ho", value: 4, change: 1 },
    ] as Row[],
    footer: null as string | null,
  },
  legend: "Alerts per region · last 24h",
  agents: [] as Array<{ id: string; hot: boolean }>,
};

const ASHANTI = {
  area: { id: "ashanti", name: "Ashanti", level: "region", path: [{ id: "ghana", name: "Ghana" }] },
  kpis: [
    kpi("Alerts · Ashanti", "41", "▲ 24% vs yesterday", "alert", "critical"),
    kpi("Hottest district", "Kumasi Metro", "29 alerts · 5 agents", "pin"),
    kpi("Moved out", "GHS 44,600", "across 31 wallets", "wallet"),
    kpi("Agents involved", "9", "3 with swaps that became fraud", "building", "medium"),
  ],
  shapes: {} as Record<string, number>,
  ranking: {
    title: "Ashanti · by district",
    tabs: [] as string[],
    rows: [
      { id: "kumasi", name: "Kumasi Metropolitan", sub: "Adum, Kejetia, Asafo", value: 29, change: 14 },
      { id: "suame", name: "Suame", sub: "Suame Magazine", value: 4, change: 2 },
      { id: "obuasi", name: "Obuasi Municipal", sub: "Obuasi", value: 2, change: 0 },
      { id: "old-tafo", name: "Old Tafo", sub: "Tafo", value: 2, change: 1 },
      { id: "asokwa", name: "Asokwa", sub: "Asokwa", value: 2, change: 1 },
      { id: "ejisu", name: "Ejisu", sub: "Ejisu", value: 1, change: 0 },
      { id: "oforikrom", name: "Oforikrom", sub: "Ayigya", value: 1, change: -1 },
    ] as Row[],
    regions: [] as Row[],
    footer: "36 other districts had no alerts today.",
  },
  legend: "Alerts per district · last 24h",
  agents: [] as Array<{ id: string; hot: boolean }>,
};

const KUMASI = {
  area: { id: "kumasi", name: "Kumasi", level: "district", path: [{ id: "ghana", name: "Ghana" }, { id: "ashanti", name: "Ashanti" }] },
  kpis: [
    kpi("Alerts · Kumasi", "38", "▲ 31% vs yesterday", "alert", "critical"),
    kpi("Hottest neighbourhood", "Adum", "22 alerts · 3 agents", "pin"),
    kpi("Moved out", "GHS 41,900", "across 27 wallets", "wallet"),
    kpi("Agents in view", "5", "3 with swaps that became fraud", "building", "medium"),
  ],
  shapes: { "kumasi-metro": 4, suame: 3, asokwa: 2, "old-tafo": 2, ejisu: 1, oforikrom: 1 } as Record<string, number>,
  ranking: {
    title: "Kumasi · neighbourhoods",
    tabs: ["Neighbourhoods", "Agents"],
    rows: [
      { id: "adum", name: "Adum", sub: "Kumasi Metro · 3 agents", value: 22, change: 13 },
      { id: "kejetia", name: "Kejetia", sub: "Kumasi Metro · 1 agent", value: 5, change: 2 },
      { id: "suame", name: "Suame", sub: "Suame · 1 agent", value: 4, change: 2 },
      { id: "tafo", name: "Tafo", sub: "Old Tafo", value: 2, change: 0 },
      { id: "asafo", name: "Asafo", sub: "Kumasi Metro · 1 agent", value: 2, change: 1 },
      { id: "asokwa", name: "Asokwa", sub: "Asokwa", value: 2, change: 0 },
      { id: "ayigya", name: "Ayigya", sub: "Oforikrom", value: 1, change: -1 },
    ] as Row[],
    regions: [
      { id: "AG-2231", name: "AG-2231", sub: "Adum · 3 to fraud", value: 11, change: 8 },
      { id: "AG-2402", name: "AG-2402", sub: "Adum · 1 to fraud", value: 7, change: 3 },
      { id: "AG-1987", name: "AG-1987", sub: "Kejetia · 1 to fraud", value: 5, change: 2 },
      { id: "AG-2410", name: "AG-2410", sub: "Adum", value: 4, change: 0 },
      { id: "AG-1774", name: "AG-1774", sub: "Suame", value: 3, change: 1 },
    ] as Row[],
    footer: null as string | null,
  },
  legend: "Alerts per district · last 24h",
  agents: [
    { id: "AG-2231", hot: true },
    { id: "AG-2402", hot: true },
    { id: "AG-1987", hot: true },
    { id: "AG-2410", hot: false },
    { id: "AG-1774", hot: false },
  ],
};

const LEVELS = { ghana: COUNTRY, ashanti: ASHANTI, kumasi: KUMASI };

/** Map pins carry the value; the client knows where each one sits. */
const PINS: Record<string, Array<{ id: string; name: string; value: number }>> = {
  ghana: COUNTRY.ranking.rows.map((r) => ({ id: r.id, name: r.name, value: r.value })),
  ashanti: [
    { id: "kumasi", name: "Kumasi", value: 38 },
    { id: "obuasi", name: "Obuasi", value: 2 },
    { id: "ejisu", name: "Ejisu", value: 1 },
  ],
  kumasi: KUMASI.ranking.rows.map((r) => ({ id: r.id, name: r.name, value: r.value })),
};

const AREA_DETAIL = {
  id: "adum",
  name: "Adum, Kumasi",
  path: "Kumasi Metro · Ashanti",
  summary: "22 alerts in the last 24h. 5× the usual for Adum. Mostly SIM swaps at agents followed by fast MoMo cash-out.",
  tiles: [
    ["22", "alerts · 24h", "critical"],
    ["3", "agents in Adum", null],
    ["GHS 26,300", "moved out", "critical"],
  ],
  drivers: [
    { label: "SIM swap to MoMo", value: 18, tone: "critical" },
    { label: "Wallet takeover", value: 3, tone: "high" },
    { label: "Agent float abuse", value: 1, tone: "medium" },
  ],
  agents: [
    { id: "AG-2231", where: "Adum · Prempeh II St", today: 11, to_fraud: 3, hot: true },
    { id: "AG-2402", where: "Adum · Kingsway", today: 7, to_fraud: 1, hot: false },
    { id: "AG-2410", where: "Adum · Bank Rd", today: 4, to_fraud: 0, hot: false },
  ],
  untriaged: {
    total: 8,
    data: [
      { id: "AL-88240", risk: 94, title: "SIM swap to MoMo · +233 24 *** 1190" },
      { id: "AL-88236", risk: 88, title: "SIM swap to MoMo · +233 55 *** 0427" },
      { id: "AL-88229", risk: 76, title: "Wallet takeover · +233 54 *** 7712" },
    ],
  },
};

export function mockHeatmapFixture(method: string, path: string, search: URLSearchParams): Fixture | undefined {
  if (method !== "GET") return undefined;
  const area = (search.get("area") ?? "ghana") as keyof typeof LEVELS;
  const type = search.get("fraud_type") ?? "";
  const region = search.get("region") ?? "";

  if (path === "heatmap") {
    const level = LEVELS[area] ?? COUNTRY;
    // G25: nothing for this filter.
    if (type === "account_takeover" && region === "northern") {
      return {
        status: 200,
        body: {
          ...COUNTRY,
          kpis: [
            kpi("Alerts · 24h", "0", "none matching", "alert"),
            kpi("Hottest area", "—", "no activity", "pin"),
            kpi("Confirmed fraud", "GHS 0", "in Northern today", "wallet"),
            kpi("New since 08:00", "0", "—", "activity"),
          ],
          shapes: {},
          ranking: { ...COUNTRY.ranking, rows: [], regions: [], tabs: [] },
          legend: "Account takeover · Northern · last 24h",
          empty: { title: "No account takeover in Northern today", detail: "There were 2 in the last 7 days, both in Tamale.", focus: "northern" },
          updated_at: UPDATED,
        },
      };
    }
    return { status: 200, body: { ...level, updated_at: UPDATED, refresh_seconds: 300 } };
  }
  // PROPOSED: GET /heatmap/layers — what the map draws. Fails on its own (G27); the numbers keep working.
  if (path === "heatmap/layers") {
    if (search.get("demo") === "map-error") return { status: 504, body: { status: 504, code: "map_timeout", title: "The map didn’t load" } };
    const empty = type === "account_takeover" && region === "northern";
    const level = LEVELS[area] ?? COUNTRY;
    return { status: 200, body: { shapes: empty ? {} : level.shapes, pins: empty ? [] : PINS[area] ?? [], agents: level.agents } };
  }
  // PROPOSED: GET /heatmap/areas/{id} — the drill-down drawer (G24).
  if (path.startsWith("heatmap/areas/")) return { status: 200, body: AREA_DETAIL };
  return undefined;
}
