import "server-only";

/**
 * Shell-level data (FD_API_MOCK=1 only): the ⌘K palette search, notifications,
 * account settings, feedback and help. GET /me, GET /notifications and
 * GET /search are in the collection; the rest are proposed additions.
 */

type Fixture = { status: number; body: unknown };

const NOTIFICATIONS = [
  { id: "ntf_9", kind: "case.sent_back", category: "cases", actor: { initials: "EO", name: "Efua" }, title: "Efua sent back FD-3044", body: "“Add the call log with the subscriber before I sign off.”", link: "/cases/FD-3044", at: "2026-10-20T09:26:00Z", read: false },
  { id: "ntf_8", kind: "sla.at_risk", category: "cases", icon: "timer", title: "SLA at risk · FD-3047", body: "First response due in 8 minutes.", link: "/cases/FD-3047", at: "2026-10-20T09:22:00Z", read: false },
  { id: "ntf_7", kind: "mention", category: "mentions", actor: { initials: "KA", name: "Kwame" }, title: "Kwame mentioned you on FD-3044", body: "“@Ama the agent float pattern matches what you saw last week”", link: "/cases/FD-3044?tab=timeline", at: "2026-10-20T09:04:00Z", read: false },
  { id: "ntf_6", kind: "report.ready", category: "system", icon: "file", title: "Report ready", body: "My cases · 1-20 Oct · CSV", link: "/reports/rp_closed_oct", at: "2026-10-20T08:57:00Z", read: false },
  { id: "ntf_5", kind: "rule.tuned", category: "system", icon: "sliders", title: "Rule R-211 tuned", body: "Velocity thresholds changed after your feedback.", link: "/overview?period=7d", at: "2026-10-19T15:00:00Z", read: true },
  { id: "ntf_4", kind: "connector.recovered", category: "system", icon: "plug", title: "MoMo connector recovered", body: "MoMo connector back to normal at 03:12.", link: "/help", at: "2026-10-19T03:12:00Z", read: true },
];
let readAll = false;

const SECURITY = {
  password: { changed_days_ago: 42, rotate_days: 90 },
  two_step: { status: "on", required: true },
  authenticators: [
    { id: "auth_1", name: "Google Authenticator · Pixel 7", primary: true, added: "12 Aug 2023", last_used: "today 08:02" },
    { id: "auth_2", name: "Microsoft Authenticator · iPad", primary: false, added: "3 Feb 2026", last_used: "9 days ago" },
  ],
  recovery_codes: { left: 7, total: 10, generated: "12 Aug 2023" },
  sessions: [
    { id: "ses_1", device: "Chrome on Windows", kind: "desktop", location: "Kumasi · 41.66.x.x", last_active: null, current: true },
    { id: "ses_2", device: "Chrome on Android", kind: "phone", location: "Kumasi · 154.160.x.x", last_active: "2 hours ago", current: false },
    { id: "ses_3", device: "Safari on iPad", kind: "phone", location: "Accra · 102.176.x.x", last_active: "9 days ago", current: false },
  ],
  sign_in: [
    ["Email", "ama.mensah@kasamobile.com.gh"],
    ["Method", "Password + authenticator"],
    ["SSO", "Not enabled for Kasa Mobile"],
    ["Session timeout", "30 min idle · set by IT"],
  ],
  it_admin: "Kojo Asare",
};
let sessions = SECURITY.sessions;

const PROFILE = {
  display_name: "Ama Mensah",
  callback_phone: "+233 24 555 0142",
  managed: [
    ["Work email", "ama.mensah@kasamobile.com.gh"],
    ["Role", "Fraud Analyst"],
    ["Team", "Fraud · Kumasi"],
    ["Supervisor", "Efua Owusu-Ansah"],
  ],
  it_admin: "Kojo Asare (IT admin)",
};

const NOTIFICATION_PREFS = {
  events: [
    { id: "case_assigned", label: "Case assigned to me", detail: "When an alert is promoted or a colleague hands one over", type: "Cases", in_app: true, email: true, push: true },
    { id: "sent_back", label: "Supervisor sent a case back", detail: "Needs changes before sign-off", type: "Cases", in_app: "locked", email: true, push: true },
    { id: "signoff", label: "Sign-off decision", detail: "Efua approved or rejected your resolution", type: "Cases", in_app: true, email: true, push: false },
    { id: "sla_risk", label: "SLA at risk", detail: "10 minutes before first-response or close SLA", type: "SLA", in_app: "locked", email: false, push: true },
    { id: "critical_alert", label: "New critical alert in my regions", detail: "Risk 90+ · auto-opened as a case", type: "Alerts", in_app: true, email: false, push: true },
    { id: "mention", label: "Someone mentions me", detail: "In a case note or timeline comment", type: "Mentions", in_app: true, email: true, push: false },
    { id: "report", label: "Report ready or failed", detail: "Including scheduled reports", type: "Reports", in_app: true, email: true, push: false },
    { id: "connector", label: "Connector or feed problems", detail: "MoMo, HLR, CDR feed delays", type: "System", in_app: true, email: false, push: false },
  ],
  quiet_hours: { enabled: true, label: "Off shift: 16:00-08:00 · critical SLA warnings still come through" },
};

const PREFERENCES = { start_page: "/queue", density: "comfortable", time_format: "24h", language: "en-GH", money_format: "GHS 18,400.00", critical_sound: true };

/** ⌘K: cases, subscribers, alerts and actions in one list (I1); suggestions when nothing matches (I2). */
function palette(q: string): Fixture {
  const s = q.trim().toUpperCase();
  const caseMatch = s.match(/^FD-?(\d+)$/);
  if (caseMatch && Number(caseMatch[1]) > 3073) {
    return {
      status: 200,
      body: {
        data: [],
        empty: { title: `No case ${s.replace(/^FD-?/, "FD-")}`, detail: "Case numbers on Kasa Mobile currently go up to FD-3073." },
        did_you_mean: [
          { id: "FD-3051", kind: "case", title: "FD-3051", subtitle: "MoMo velocity spike · Kasoa · Investigating" },
          { id: "FD-3050", kind: "case", title: "FD-3050", subtitle: "SIM swap to MoMo · Closed" },
        ],
        try_instead: [{ kind: "action", id: "search_all_cases", title: `Search all cases for “${s.replace(/\D/g, "")}”`, subtitle: "Includes closed and other teams’ cases you can see" }],
      },
    };
  }
  const digits = s.replace(/\D/g, "");
  const data = [];
  if (digits.endsWith("3457") || s.includes("3050")) {
    data.push({ id: "FD-3050", kind: "case", title: "FD-3050", badge: "Critical", subtitle: "SIM swap to MoMo · +233 54 *** 3457 · Investigating", best: true });
  }
  if (digits.endsWith("3457")) {
    data.push(
      { id: "sub_8KQ2", kind: "subscriber", title: "+233 54 *** 3457", subtitle: "Kojo M. · Kumasi · 1 open case" },
      { id: "sub_3457a", kind: "subscriber", title: "+233 54 1** 3457", subtitle: "Akua S. · Tamale · no cases" },
      { id: "AL-88213", kind: "alert", title: "AL-88213", subtitle: "SIM swap followed by MoMo transfer · promoted to FD-3050" },
    );
  }
  if (caseMatch && !data.length) data.push({ id: s.replace(/^FD-?/, "FD-"), kind: "case", title: s.replace(/^FD-?/, "FD-"), subtitle: "Open the case", best: true });
  return { status: 200, body: { data, detected_type: digits.length >= 4 ? "msisdn" : "text" } };
}

export function mockAccountFixture(method: string, path: string, body: Record<string, unknown> | null, search: URLSearchParams): Fixture | undefined {
  if (method === "GET" && path === "search" && search.get("type") === "all") return palette(search.get("q") ?? "");
  if (method === "GET" && path === "notifications") {
    if (search.get("demo") === "none") return { status: 200, body: { data: [], unread: 0 } };
    const data = NOTIFICATIONS.map((n) => ({ ...n, read: readAll || n.read }));
    return { status: 200, body: { data, unread: data.filter((n) => !n.read).length } };
  }
  if (method === "POST" && path === "notifications/read-all") {
    readAll = true;
    return { status: 204, body: null };
  }
  if (method === "GET" && path === "me/profile") return { status: 200, body: PROFILE };
  if (method === "PATCH" && path === "me/profile") return { status: 200, body: { ...PROFILE, ...body } };
  if (method === "GET" && path === "me/security") return { status: 200, body: { ...SECURITY, sessions } };
  if (method === "DELETE" && path === "me/sessions") {
    const n = sessions.filter((s) => !s.current).length;
    sessions = sessions.filter((s) => s.current);
    return { status: 200, body: { signed_out: n, change_password_next: body?.change_password_next ?? false } };
  }
  const ses = path.match(/^me\/sessions\/([^/]+)$/);
  if (method === "DELETE" && ses) {
    sessions = sessions.filter((s) => s.id !== ses[1]);
    return { status: 204, body: null };
  }
  if (method === "GET" && path === "me/notification-preferences") return { status: 200, body: NOTIFICATION_PREFS };
  if (method === "PATCH" && path === "me/notification-preferences") return { status: 200, body: body ?? NOTIFICATION_PREFS };
  if (method === "GET" && path === "me/preferences") return { status: 200, body: PREFERENCES };
  if (method === "PATCH" && path === "me/preferences") return { status: 200, body: { ...PREFERENCES, ...body } };
  if (method === "POST" && path === "feedback") return { status: 201, body: { reference: "FB-0412" } };
  if (method === "GET" && path === "help") {
    return {
      status: 200,
      body: {
        status: { state: "operational", summary: "All systems operational · MoMo reversals API, CDR feed, NCA lookup" },
        guides: [
          { id: "triage", title: "Triage a live alert", detail: "Pick up, check, escalate or dismiss · 3 min read", icon: "alert" },
          { id: "close", title: "Close a case with evidence", detail: "What reviewers look for · 4 min", icon: "folder" },
          { id: "reversal", title: "Request a MoMo reversal", detail: "Limits, timings and partial recoveries · 3 min", icon: "refresh" },
          { id: "playbooks", title: "Fraud-type playbooks", detail: "SIM swap, Wangiri, IRSF, agent fraud, KYC", icon: "activity" },
          { id: "shortcuts", title: "Keyboard shortcuts", detail: "Press ? anywhere", icon: "command" },
        ],
        contacts: [
          { id: "oncall", title: "Fraud desk on-call", detail: "Live incident? Call 0302 555 900 · 24/7", icon: "bell" },
          { id: "it", title: "Raise an IT ticket", detail: "Access, sign-in or system problems · replies within 4 h", icon: "lock" },
          { id: "feedback", title: "Send feedback", detail: "Ideas or something that got in your way", icon: "message" },
        ],
      },
    };
  }
  return undefined;
}
