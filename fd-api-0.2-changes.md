# FraudDetection API 0.2: what changed from the frontend proposals

25 Oct 2026. For the web app. The proposals collection ("FraudDetection App API: proposed additions") has been merged into `fd-app-api.yaml` 0.2 and `fd-auth-api.yaml` 0.2. Everything the screens asked for is in; where the shape differs from the proposal, it is listed below.

## Re-import

- Import `FraudDetection-mock.postman_collection.json` again. It now holds the App API **and** sign-in (folders Auth and Account security), so one mock server answers both. Update your existing mock server to use it (or create a new one) and keep `baseUrl` = mock URL + `/app/v1`.
- Every saved example answers one exact path and query. Other states on the same path: send `x-mock-response-code` (for example `409`) or `x-mock-response-name` (the example name).
- The fixes the proposal listed for the old collection (status-less error examples served as 200, noisy numbers like risk 8934) came from the collection Postman builds from the YAML import. Use this collection, not an import of the YAML.

## Rules applied everywhere

1. **Data, not display.** Responses carry ISO 8601 dates, `Money` (minor units), `PersonRef` and codes. The app writes labels, sub-lines, colours and icons. Gone from responses: `label`, `sub`, `tone`, `badge`, `badge_tone`, `icon`, `template_label`, and strings like "12 Aug 2023", "today 08:02", "agent since 2021", "Efua · due 16:00".
2. **Text written by the engine stays text**: verdicts, insights, findings, risk reasons, timeline `label`/`detail`, notification `title`/`body`, the case brief.
3. **No tuple arrays.** `[["Opened", "11 days ago"]]` became named fields.
4. **One cast.** Supervisor Efua Owusu-Ansah, Head of Fraud Nana Agyei, analysts Kofi Boateng, Yaw Darko, Abena Ofori, Akosua Nyarko (on leave), Kwame Asante (nights 00:00-08:00), IT admin Kojo Asare, second IT admin Esi Badu.
5. **IDs.** Wallets are `wal_8812` (not `w_8812`). Timestamps have no milliseconds.
6. **Pagination.** Lists shown with page numbers can send `page` instead of `cursor`; the response then has `page` and `total`.
7. **Error codes.** Lock held by someone else: `locked` (423). Over a limit: `limit_exceeded`. New: `case_merged`, `case_changed`, `not_enough_events`, `export_too_large`, `upstream_timeout` (map and widget timeouts), `recipient_cannot_view`.

## Moved

| Proposed | Now |
|---|---|
| `GET /me/security`, `DELETE /me/sessions`, `DELETE /me/sessions/{id}`, `PATCH`/`DELETE /me/authenticators/{id}` | Sign-in spec, folder **Account security**. Dates are `added_at`, `last_used_at`, `generated_at`, `last_active_at`, `password.changed_at`. `sign_in` is an object. `DELETE /me/sessions` takes `?change_password_next=true` (no body on DELETE). |
| `GET /watchlist/mine`, `POST /watchlist` (personal) | `GET`/`POST /me/watchlist`. `/watchlist` stays case monitoring after closing. |
| Prospects through `POST /cases` with `stage: prospect` | `/prospects`. They still show in the board's prospect column; promoting opens a normal FD case. |

## Field changes by screen

**Me and settings**
- `/me/profile`: `managed` is an object: `email`, `role` (code), `team {id, name}`, `supervisor`, `it_admin` (PersonRef).
- `/me/notification-preferences`: rows are `{id, category, in_app, email, push, locked: ["in_app"]}`. No `label`/`detail`/`type`. `quiet_hours {enabled, from, to, critical_sla_still_notify}`.
- `/me/preferences`: `start_page: "queue"`, `locale`, `money_format: "code" | "symbol"`.
- `/me/watchlist` items: `entity_id, entity_type, identifier, case_id, reason, until, status, hits`.
- `/notifications`: `actor` is a full PersonRef or null; no `icon`; `unread` count.
- `/help`: guides have `read_minutes`, `url`; contacts have `kind`, `value`. System status comes from `/status/integrations`.

**Queue, overview, SLAs**
- `/insights/me`: `resolved`, `resolved_avg`, `first_response_median_minutes`, `first_response_sla_minutes`.
- `/insights/overview`: `scope=operator` (not `org`). KPI = `{key, unit, value, money, change, breakdown, spark}` (+ `basis`, `noisiest_rule`). Example: alerts today `value 128, breakdown {open: 23, critical: 9}`; money protected `money`, `breakdown {frozen, recovered}`. `fraud_mix` has no label. `daily[].date` is a date. `rules[] {id, name, hits, precision_pct, your_fp_feedback}`. `widget_errors {hotspots: {code, retry_after_seconds}}`. `right_now` items are AlertSummary.
- `/insights/sla`: `first_response {met, total}`, `critical_closed {met, total}`, `sent_back_case_ids`.
- `/status/integrations`: adds `id`, `lag_seconds`.

**Alerts**
- `/alerts`: `summary {by_severity, by_fraud_type, by_region}`; items add `fraud_type`, `money_out` (null when no money moved).
- Dismiss reasons: `legitimate_activity, duplicate, system_noise, insufficient_evidence, other`. Response is the AlertSummary plus `undo_until`.
- Transactions (alert, case, subscriber): `counterparty_new` (boolean) and `counterparty_case_id` replace `counterparty_note`.
- `/case-suggestions`: `reason` (engine text) and `match_kinds` (codes); `case` includes `stage`.
- `/alerts/bulk`: `failed[] {id, code, locked_by}`.

**Cases**
- `POST /cases/{id}/start` returns CaseSummary plus `first_response {met, minutes, sla_minutes}`, not the full case.
- `GET /cases/{id}` adds `counts, contact, sla, latest_action, reversal, escalation, handover, rejection, monitoring`. 404 `case_merged` has `merged_by` as PersonRef.
- `?view=mine`: `counts {mine, team_queue, all, by_status}`, `closed_this_month`, `capacity`. Items add `region`; decide-stage items add `decision_due_at`, `reviewer`. No `card` block.
- Board (`?group_by=stage`): `{stages: [{stage, total, items}]}`. Items are CaseListItem or ProspectListItem (`kind: prospect`). Stage descriptions are app copy. Extra item fields: `decision_due_at`, `reviewer`, `watch_days_left`, `closed_at`.
- Linked alerts: `link {kind: opened | auto | manual, by, at}`.
- Log a call: `outcome: reached | no_answer | wrong_number | call_back_later`, `answers [{question_id, answer: yes | no | unsure}]`, `note` (singular).
- Resolve: `reason` is an enum; `rule_feedback` boolean plus `rule_feedback_note`.
- Reopen returns `status: reopened`, `stage: investigate`.
- Add a note, 409 `case_changed`: `changes [{field: "assignee", from: PersonRef, to: PersonRef}]`, `changed_by`, `changed_at`.
- Evidence (JSON): `item_count` instead of `summary`. Download: `watermark {text, viewer, at}`.
- Close and watch: `include_recipients: true` instead of the `"recipients"` pseudo-ID.
- Brief: same chapters, but every tuple is an object: `stats [{value, label, severity}]`, `visual.facts [{kind, title, detail}]`, `by_day [{date, count}]`, `bars [{at, amount}]`, `destinations [...]`, `tiles [{kind, amount}]`, `next [{done, title, at, by, due_at}]`. Icons became `kind` codes. Export `url` is absolute; 413 has `limit_bytes`.

**Subscriber and network**
- Subscriber 360: `frozen_by` PersonRef, `usual_recipients` number, `plan: prepaid`, `sim_history[].id_check {document, method, matched}`, `devices_on_wallet[] {wallets_24h, case_ids, last_seen}` (ISO), `risk_reasons[].rule_id`. Kojo's usual phone is a Samsung Galaxy A14 everywhere.
- `/recent`: `kind`, `flagged` (was `hot`), `amount`.
- `/behaviour`: `signals` is keyed (`place, device, active_hours, average_transfer, recipients`) with typed values (Money, numbers). `places[].today_only`. `verdict.kind`.
- `/sim-check`: phones have `index` (no "Phone A" label), `first_seen_at`, `last_seen_at`, `used_months`; `case {id, outcome}`.
- `/device-check`: `from_phone`, `first_seen_on_sim_at`, `tac {brand, model, year, matches_reported_model}`, `other_sims {window_days, data}`.
- Reveal: `reason` is an enum (`call_subscriber_back`, ...); `fields` optional (default all); `date_of_birth` is ISO.
- Network: nodes add `relation` (code), `hop`, `case_ids` instead of `role` text. `suggested_filters [{id, params, estimate}]`. Truncated graphs have `summary {seed_type, subscribers_swapped_30d, became_fraud_case_ids}`. `since` is a date-time.
- Node detail: `identifier`, `owner_name`, `flags` (codes), `facts {opened_at, opened_where, received_today, sent_on_today, sent_on_minutes, forwarded_to, case_ids}`.

**Actions**
- Bar SIMs over the limit: 403 `limit_exceeded {limit, requested, approver}`.
- Escalate: `target` and `priority`; `to_user_id` optional. Response adds `sent_at`.
- Accept loss returns `secured` and `accepted_loss`.

**Hunt**
- Prospects: `rule {metric, operator, value, area, period_days}`, `matches_count`. Matches: `agent_since` (date), `severity`, `flags [{kind, case_id | count}]`. Promote returns `{case, evidence_ids, linked_cases, remaining_matches}`. Drop takes `{reason}`.
- Search `type=all`: hits are `{kind, id, best}` plus `case`, `subscriber` or `alert` data. No `title`/`subtitle`/`badge`. No match: `max_case_id` and `did_you_mean`. Another operator's number: `other_operator {id, name}`.
- Lookups: `entity_id` (was `subscriber_id`), `type: msisdn | imei | wallet`. Bulk: `case_id` (not `reason`), `activated_on` (date), `status`.
- Operator requests: `operator_id`.
- Traces: `steps [{id, state, done, total}]`, `flow {in, sim, out, call_backs}`, `signs {avg_call_seconds, cells_used, call_backs, sim_age_days}`, `hourly_calls` (null for missing hours), `gaps {feed, delayed_since, covered_hours, missing_hours}`. Mock IDs: TR-7712 ready (FD-3061), TR-6610 running, TR-0047 partial, TR-8820 no calls.

**Heatmap**
- `/heatmap?area=&metric=&period=24h`: `kpis` is an object (`alerts, hottest_area, confirmed_fraud, new_since`, or `money_out, agents_in_view` for a district). `shapes [{id, intensity}]`, `towns`, `regions`, `agents`. No ranking titles, tabs or legend. Empty: `empty {focus_area_id, last_7d, last_7d_area_ids}`.
- `/heatmap/layers`: `shapes` list, `pins [{id, alerts}]`. `/heatmap/areas/{id}`: `drivers [{fraud_type, alerts}]`, `agent_list`, `untriaged` items carry `subscriber`.

**Reports**
- Report: `schedule {frequency, day_of_week | day_of_month, time, paused}`, `format` lowercase, `owner` PersonRef, `shared_with [{type: user | group, id, name}]`, `error {code, at}`. No `template_label`.
- Preview: `summary {cases, closed, open, confirmed_fraud, lost, false_positive, recovered}`; rows have `fraud_type`, `loss` (Money), `closed_at`.
- Share: `expires_in_days`; response `expires_at` (ISO).

## Not yet real examples

Auditor and IT Admin endpoints (audit log, archive, samples, admin users, rules) still return generated placeholders. They get real data in those persona reviews.
