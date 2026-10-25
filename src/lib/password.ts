export type RuleState = "pending" | "met" | "failed";

export type PasswordRule = { id: string; label: string; state: RuleState };

type Options = {
  /** Words the password must not contain (name, email local part). */
  personal?: string[];
  /** Adds “Not one of your last 5 passwords”. Only the server can check it, so it stays pending. */
  checkHistory?: boolean;
  /** After a submit attempt, unmet rules show as failed instead of pending. */
  showFailures?: boolean;
};

const CHARACTER_RULES = [
  { id: "length", label: "At least 12 characters", test: (p: string) => p.length >= 12 },
  {
    id: "case",
    label: "Upper and lower case letters",
    test: (p: string) => /[a-z]/.test(p) && /[A-Z]/.test(p),
  },
  { id: "number", label: "At least one number", test: (p: string) => /\d/.test(p) },
  {
    id: "symbol",
    label: "At least one symbol (e.g. ! # @)",
    test: (p: string) => /[^A-Za-z0-9\s]/.test(p),
  },
];

function containsPersonal(password: string, personal: string[]) {
  const lower = password.toLowerCase();
  return personal.some((word) => word.length >= 3 && lower.includes(word.toLowerCase()));
}

/** Live checklist under password fields (Password rule component). */
export function evaluatePassword(password: string, opts: Options = {}): PasswordRule[] {
  const unmet: RuleState = opts.showFailures ? "failed" : "pending";
  const rules: PasswordRule[] = CHARACTER_RULES.map((r) => ({
    id: r.id,
    label: r.label,
    state: password && r.test(password) ? "met" : unmet,
  }));

  if (opts.personal) {
    rules.push({
      id: "personal",
      label: "Doesn’t include your name or email",
      state: !password
        ? "pending"
        : containsPersonal(password, opts.personal)
          ? "failed"
          : "met",
    });
  }
  if (opts.checkHistory) {
    rules.push({ id: "history", label: "Not one of your last 5 passwords", state: "pending" });
  }
  return rules;
}

export type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string; tone: "critical" | "success" };

/** 4-segment meter: one per character rule; personal info caps it at Weak. */
export function passwordStrength(password: string, personal: string[] = []): Strength {
  let score = CHARACTER_RULES.filter((r) => r.test(password)).length as Strength["score"];
  if (containsPersonal(password, personal)) score = Math.min(score, 2) as Strength["score"];
  if (score <= 2) return { score, label: "Weak", tone: "critical" };
  return { score, label: score === 3 ? "Good" : "Strong", tone: "success" };
}

export function personalWords(email: string, name?: string) {
  const local = email.split("@")[0] ?? "";
  return [...local.split(/[._-]/), ...(name ? name.split(/\s+/) : [])].filter(Boolean);
}
