/**
 * Help centre content (I19 · Help centre, I20 · Guide). Guides are product
 * copy the app owns, like its labels: GET /help only returns a handful of
 * titles with external links, so the catalogue and guide text live here.
 * Copy is taken from the Figma frames; a guide without `sections` has no
 * written text yet and its page says so.
 */

export type GuideBlock =
  | { kind: "p"; text: string }
  | { kind: "keys"; keys: string[]; label: string }
  | { kind: "tip"; title: string; text: string }
  | { kind: "rows"; rows: Array<[string, string]> };

export type GuideSection = { id: string; title: string; blocks: GuideBlock[] };

export type Guide = {
  id: string;
  /** The matching GET /help guide id, when the API knows this guide. */
  apiId?: string;
  title: string;
  detail: string;
  minutes?: number;
  icon: string;
  updated?: string;
  intro?: { title: string; text: string };
  sections?: GuideSection[];
  related?: string[];
};

export type GuideGroup = { id: string; title: string; unit: "guides" | "playbooks"; guides: Guide[] };

export const HELP_GROUPS: GuideGroup[] = [
  {
    id: "daily",
    title: "Daily work",
    unit: "guides",
    guides: [
      {
        id: "triage",
        apiId: "triage",
        title: "Triage a live alert",
        detail: "Pick up, check, then dismiss, add to a case or open one",
        minutes: 3,
        icon: "app/icon-alert-triangle-secondary-18",
        updated: "2026-10-12",
        intro: {
          title: "Every live alert gets one of three outcomes",
          text: "A live alert is a signal, not a case yet. Your job is to decide quickly whether it’s fraud, harmless, or part of something you’re already working on. Most alerts take under two minutes.",
        },
        sections: [
          {
            id: "pick-it-up",
            title: "Pick it up",
            blocks: [
              {
                kind: "p",
                text: "Open the alert from Live alerts or My queue. Picking it up tells the team you have it, so nobody else spends time on it. If someone already has it, you see their name and can ask to take over.",
              },
              { kind: "keys", keys: ["C"], label: "Pick up the open alert" },
            ],
          },
          {
            id: "check-the-signals",
            title: "Check the signals",
            blocks: [
              {
                kind: "p",
                text: "The Summary tab shows the risk score, money out and what the alert looks like. Read the timeline from the top: the order of events usually tells you more than any single number.",
              },
              {
                kind: "tip",
                title: "Tip: a SIM swap followed by a transfer within 24 hours is the strongest signal",
                text: "If you see it, protect first and investigate second. You can undo a freeze; you cannot undo a cash-out.",
              },
            ],
          },
          {
            id: "decide",
            title: "Decide what happens next",
            blocks: [
              {
                kind: "rows",
                rows: [
                  ["Dismiss", "It is clearly harmless. Pick a reason so the rules learn."],
                  ["Add to a case", "It belongs to something you or a colleague already has open."],
                  ["Open a case", "It needs investigating. The alert becomes the first piece of evidence."],
                ],
              },
              { kind: "keys", keys: ["D", "E"], label: "Dismiss, or escalate" },
            ],
          },
          {
            id: "unsure",
            title: "If you’re unsure",
            blocks: [
              {
                kind: "p",
                text: "Escalate to your supervisor with one line on what you see and what you need. The alert stays with you, and the clock pauses while they answer.",
              },
            ],
          },
        ],
        related: ["queue", "escalate", "playbook-sim-swap"],
      },
      { id: "queue", title: "Work your queue and SLAs", detail: "What “Needs you now” means and how SLAs run", minutes: 4, icon: "app/icon-inbox-secondary-18" },
      { id: "handover", title: "Hand over your shift", detail: "What to write so the next analyst can act", minutes: 2, icon: "app/icon-users-secondary-18" },
    ],
  },
  {
    id: "investigate",
    title: "Investigate",
    unit: "guides",
    guides: [
      { id: "case-summary", title: "Read the case summary", detail: "What happened, who is involved, what to do next", minutes: 3, icon: "app/icon-file-secondary-18" },
      { id: "follow-the-money", title: "Follow the money", detail: "Read the network and spot mule wallets", minutes: 5, icon: "app/icon-network-secondary-18" },
      { id: "device-check", title: "Check a device", detail: "IMEI check digits, model and stolen lists", minutes: 3, icon: "app/icon-laptop-secondary-18" },
      { id: "sim-box", title: "Spot a SIM box", detail: "Call flow, tell-tale signs and what to send IT", minutes: 4, icon: "app/icon-sim-secondary-16" },
    ],
  },
  {
    id: "act",
    title: "Act and decide",
    unit: "guides",
    guides: [
      { id: "protect", title: "Freeze, suspend and block", detail: "What each action does and how to undo it", minutes: 3, icon: "app/icon-shield-secondary-18" },
      { id: "reversal", apiId: "reversal", title: "Request a MoMo reversal", detail: "Limits, timings and partial recoveries", minutes: 3, icon: "app/icon-refresh-secondary-18" },
      { id: "escalate", title: "Escalate to your supervisor", detail: "When to escalate and what to write", minutes: 2, icon: "app/icon-bell-secondary-18" },
      { id: "close", apiId: "close", title: "Close a case with evidence", detail: "What reviewers look for before signing off", minutes: 4, icon: "app/icon-folder-secondary-16" },
    ],
  },
  {
    id: "playbooks",
    title: "Playbooks",
    unit: "playbooks",
    guides: [
      { id: "playbook-sim-swap", apiId: "playbooks", title: "SIM swap to MoMo", detail: "From the swap to the cash-out, step by step", icon: "app/icon-activity-secondary-18" },
      { id: "playbook-wangiri", apiId: "playbooks", title: "Wangiri and IRSF", detail: "Missed-call scams and premium-rate fraud", icon: "app/icon-phone-secondary-18" },
      { id: "playbook-agent", apiId: "playbooks", title: "Agent fraud", detail: "Float abuse, fake KYC and swap farms", icon: "app/icon-user-x-secondary-18" },
      { id: "playbook-kyc", apiId: "playbooks", title: "KYC mismatches", detail: "When the Ghana Card and the subscriber disagree", icon: "app/icon-key-secondary-18" },
    ],
  },
];

export const ALL_GUIDES = HELP_GROUPS.flatMap((g) => g.guides.map((guide) => ({ ...guide, group: g })));

export const findGuide = (id: string) => ALL_GUIDES.find((g) => g.id === id);

/** “3 min” for guides; playbooks are read step by step. */
export const guideLength = (g: Guide) => (g.minutes ? `${g.minutes} min` : "Step by step");
