/* ============================================================
   Kyodo Landlord Assistant  —  application logic
   A 100% client-side single-page app. No server, no build step.
   - Data lives in the browser (localStorage), so it survives refreshes.
   - The assistant reads a tenant message and classifies it (whole-word
     matching, so "back door lock" is NOT read as an A/C emergency).
   - Data can be exported to / imported from real Excel (.xlsx) via SheetJS.
   ============================================================ */

"use strict";

const STORE_KEY = "rentaldesk_robot_v1";

/* ---------- small helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const num = (v) => {
  // forgiving money parser: "$1,200.50" -> 1200.5, junk -> 0
  const cleaned = String(v ?? "").replace(/[^0-9.\-]/g, "");
  const f = parseFloat(cleaned);
  return isNaN(f) ? 0 : f;
};
// Robust form-field reader (avoids fragile form.fieldName named access).
const fval = (form, name) => { const el = form.querySelector(`[name="${name}"]`); return el ? el.value : ""; };
const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const daysUntil = (iso) => { const d = new Date(iso); return isNaN(d) ? null : Math.round((d - new Date()) / 86400000); };

function toast(msg) {
  let t = $("#toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ============================================================
   THE ASSISTANT  —  message understanding
   Whole-word matching avoids the classic bug where "ac" matches
   inside "bACk", "replACe" or "contACt".
   ============================================================ */
function wb(text, phrase) {
  return new RegExp("\\b" + phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(text);
}
const anyWord = (text, list) => list.some((w) => wb(text, w));

const CATEGORY_KEYWORDS = {
  appliance: ["dishwasher", "refrigerator", "fridge", "freezer", "oven", "stove", "range", "microwave", "washer", "dryer", "garbage disposal", "ice maker"],
  hvac: ["air conditioner", "air conditioning", "a/c", "hvac", "furnace", "thermostat", "heat pump", "condenser", "no heat", "no cooling", "not cooling", "blowing warm", "blowing hot", "warm air", "heat", "cooling"],
  plumbing: ["leak", "leaking", "sink", "toilet", "clog", "clogged", "drain", "pipe", "plumbing", "water heater", "shower", "faucet", "sewage", "no hot water", "low water pressure", "overflow", "water"],
  electrical: ["outlet", "breaker", "electrical", "spark", "sparks", "smoke alarm", "smoke detector", "no power", "power out", "power outage", "wiring", "fuse", "light fixture", "flickering", "lights out"],
  roof: ["roof", "shingle", "attic", "ceiling leak", "gutter"],
  lock: ["lock", "deadbolt", "door knob", "doorknob", "latch", "door", "key", "keys", "window", "windows"],
  pest: ["bug", "bugs", "roach", "roaches", "mouse", "mice", "rat", "rats", "ants", "pest", "termite", "bedbug"],
};
// A specifically named appliance is a strong signal, so it outweighs the
// generic plumbing words ("leak"/"water") that often appear in the same line.
const CATEGORY_WEIGHT = { appliance: 5 };
const URGENT = ["flood", "fire", "sparks", "smoke", "no heat", "no ac", "no cooling", "sewage", "burst", "gas smell", "gas leak", "cannot lock", "can't lock", "unsafe", "injury", "carbon monoxide"];
const LOW = ["small", "minor", "cosmetic", "when convenient", "not urgent", "whenever", "no rush"];
const CATEGORY_LABEL = { appliance: "Appliance", hvac: "HVAC", plumbing: "Plumbing", electrical: "Electrical", roof: "Roof / ceiling", lock: "Door / lock / window", pest: "Pest", general: "General maintenance" };

function classify(message) {
  const t = (message || "").toLowerCase();
  const scores = {};
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    const w = CATEGORY_WEIGHT[cat] || 1;
    scores[cat] = words.reduce((acc, kw) => acc + (wb(t, kw) ? w : 0), 0);
  }
  let category = "general", best = 0;
  for (const cat of Object.keys(CATEGORY_KEYWORDS)) {
    if (scores[cat] > best) { best = scores[cat]; category = cat; }
  }
  let priority = "Medium";
  if (anyWord(t, URGENT)) priority = "Urgent";
  else if (["hvac", "plumbing", "electrical", "lock"].includes(category)) priority = "High";
  if (priority !== "Urgent" && anyWord(t, LOW)) priority = "Low";
  return { category, priority, summary: summarize(t, message) };
}

function summarize(t, original) {
  if (anyWord(t, ["warm air", "not cooling", "blowing warm", "blowing hot", "no cooling"])) return "AC/HVAC not cooling properly";
  if (wb(t, "no heat") || wb(t, "furnace")) return "Heating / HVAC issue reported";
  for (const a of ["dishwasher", "refrigerator", "fridge", "freezer", "oven", "stove", "range", "microwave", "washer", "dryer", "garbage disposal", "ice maker"])
    if (wb(t, a)) return a.charAt(0).toUpperCase() + a.slice(1) + " issue reported";
  if (wb(t, "leak") || wb(t, "leaking")) return "Possible plumbing leak";
  if (wb(t, "clog") || wb(t, "clogged") || wb(t, "drain")) return "Clogged or slow drain";
  if (anyWord(t, ["spark", "sparks", "outlet", "breaker", "no power", "electrical"])) return "Electrical issue reported";
  if (anyWord(t, ["lock", "deadbolt", "door", "window"])) return "Door, lock, or window issue reported";
  if (anyWord(t, CATEGORY_KEYWORDS.pest)) return "Pest issue reported";
  const text = (original || "").trim();
  return text.length > 70 ? text.slice(0, 70) + "…" : (text || "Tenant request needs review");
}

function matchWarranty(propertyAddress, category, message) {
  const text = (message || "").toLowerCase();
  const list = db.warranties.filter((w) => w.property === propertyAddress);
  let found = list.find((w) => w.category === category || (w.item && wb(text, w.item.toLowerCase())));
  if (!found) return { warranty: null, label: "No warranty match", step: "No warranty record found. Use a normal vendor, or add a warranty record if one exists." };
  const left = daysUntil(found.expires);
  if (left !== null && left >= 0)
    return { warranty: found, label: "Active warranty match", step: `Call ${found.vendor || found.company || "the warranty provider"} first. Phone: ${found.phone || "not saved"}.` };
  return { warranty: found, label: "Warranty found but may be expired", step: `A warranty record exists but appears expired on ${found.expires}. Compare repair vs replacement before paying.` };
}

function suggestedReply(tenant, category, label) {
  const first = (tenant || "there").split(" ")[0];
  if (label.includes("Active")) return `Hi ${first}, thanks for letting me know. I'm checking the warranty information now and will follow up shortly with the next step.`;
  if (category === "hvac") return `Hi ${first}, thanks for reporting the heating/cooling issue. I'll review the details and arrange service.`;
  if (category === "plumbing") return `Hi ${first}, thanks for reporting the plumbing issue. I received your message and will work on the next step.`;
  return `Hi ${first}, thanks for letting me know. I received your request and will review what needs to be done next.`;
}

function repairVsReplace(repair, replace, priorRepairs = 0, warrantyActive = false) {
  repair = num(repair); replace = num(replace);
  if (warrantyActive) return ["Check warranty first", "A warranty appears active, so call the warranty company or installer before paying out of pocket."];
  if (replace <= 0) return ["Need a replacement estimate", "Add a replacement estimate so the assistant can compare repair vs replacement."];
  const pct = (repair / replace) * 100;
  if (pct >= 50 || priorRepairs >= 2) return ["Consider replacement", `Repair is about ${pct.toFixed(0)}% of replacement cost, and repeated repairs may make replacement smarter.`];
  return ["Repair may make sense", `Repair is about ${pct.toFixed(0)}% of replacement cost.`];
}

/* ============================================================
   DATA  —  seed + persistence
   Records are linked by property *address* so the Excel sheets
   stay human-readable (no opaque ID columns).
   ============================================================ */
function seedData() {
  return {
    properties: [
      { id: uid(), address: "45 Maple Ave", name: "45 Maple Ave", monthly_rent: 1850, mortgage: 1050, taxes: 230, insurance: 115, notes: "Single-family rental" },
      { id: uid(), address: "88 Oak Dr", name: "88 Oak Dr", monthly_rent: 1650, mortgage: 925, taxes: 210, insurance: 110, notes: "Single-family rental" },
      { id: uid(), address: "123 Pine St", name: "123 Pine St", monthly_rent: 1450, mortgage: 800, taxes: 175, insurance: 95, notes: "Starter rental" },
    ],
    tenants: [
      { id: uid(), name: "Robert Hill", property: "45 Maple Ave", email: "robert@example.com", phone: "555-0101", lease_end: plusDays(45), rent_status: "late", balance_due: 1850 },
      { id: uid(), name: "Sarah Johnson", property: "88 Oak Dr", email: "sarah@example.com", phone: "555-0102", lease_end: plusDays(160), rent_status: "paid", balance_due: 0 },
      { id: uid(), name: "Amanda Lee", property: "123 Pine St", email: "amanda@example.com", phone: "555-0103", lease_end: plusDays(20), rent_status: "paid", balance_due: 0 },
    ],
    warranties: [
      { id: uid(), item: "HVAC / Air Conditioner", property: "45 Maple Ave", category: "hvac", brand: "Carrier", model: "Comfort 15", expires: "2028-05-12", company: "Manufacturer warranty", vendor: "CoolAir Heating & Cooling", phone: "555-222-1111", policy: "HVAC-7782", replacement_cost: 7500, notes: "Parts covered. Call installer first." },
      { id: uid(), item: "Dishwasher", property: "88 Oak Dr", category: "appliance", brand: "Whirlpool", model: "WDF331", expires: "2027-03-05", company: "HomeShield Warranty", vendor: "ABC Appliance Repair", phone: "555-333-2222", policy: "HW-88721", replacement_cost: 685, notes: "Parts and labor with $75 service fee." },
      { id: uid(), item: "Water Heater", property: "123 Pine St", category: "plumbing", brand: "Rheem", model: "Classic Plus", expires: "2026-08-01", company: "Manufacturer warranty", vendor: "Reliable Plumbing", phone: "555-444-3333", policy: "WH-44410", replacement_cost: 1800, notes: "Tank warranty only." },
    ],
    requests: [],
    expenses: [
      { id: uid(), date: plusDays(-10), property: "45 Maple Ave", category: "repair", amount: 350, vendor: "CoolAir Heating & Cooling", receipt_missing: false, notes: "HVAC diagnostic" },
      { id: uid(), date: plusDays(-18), property: "88 Oak Dr", category: "repair", amount: 425, vendor: "ABC Appliance Repair", receipt_missing: true, notes: "Dishwasher estimate" },
      { id: uid(), date: plusDays(-33), property: "123 Pine St", category: "plumbing", amount: 175, vendor: "Reliable Plumbing", receipt_missing: true, notes: "Toilet repair" },
    ],
  };
}

function addRequest({ tenant, property, message, repair_estimate, replacement_estimate }) {
  const c = classify(message);
  const m = matchWarranty(property, c.category, message);
  const r = {
    id: uid(), created_at: today(), tenant: tenant || "Tenant", property: property || "",
    message, summary: c.summary, category: c.category, priority: c.priority, status: "new",
    warranty_match: m.label, next_step: m.step, reply: suggestedReply(tenant, c.category, m.label),
    repair_estimate: num(repair_estimate), replacement_estimate: num(replacement_estimate),
  };
  db.requests.unshift(r); save(); return r.id;
}

let db = null;
function load() {
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) { db = JSON.parse(raw); return; } } catch (e) {}
  db = seedData();
  // create two example tickets so the dashboard isn't empty on first open
  addRequestSilent("Robert Hill", "45 Maple Ave", "The AC is blowing warm air and the house is getting hot. Can someone come out?", 350, 7500);
  addRequestSilent("Sarah Johnson", "88 Oak Dr", "The dishwasher is leaking water from the bottom and will not drain.", 425, 685);
  save();
}
function addRequestSilent(tenant, property, message, re, rep) {
  const c = classify(message); const m = matchWarranty(property, c.category, message);
  db.requests.unshift({ id: uid(), created_at: today(), tenant, property, message, summary: c.summary, category: c.category, priority: c.priority, status: "new", warranty_match: m.label, next_step: m.step, reply: suggestedReply(tenant, c.category, m.label), repair_estimate: re, replacement_estimate: rep });
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch (e) { toast("Could not save to this browser."); } }

/* ---------- derived numbers for the dashboard ---------- */
function stats() {
  return {
    open: db.requests.filter((r) => ["new", "waiting", "scheduled"].includes(r.status)).length,
    late: db.tenants.filter((t) => t.rent_status !== "paid" || num(t.balance_due) > 0).length,
    warranty: db.requests.filter((r) => /active/i.test(r.warranty_match || "")).length,
    leases: db.tenants.filter((t) => { const d = daysUntil(t.lease_end); return d !== null && d <= 60; }).length,
    receipts: db.expenses.filter((e) => e.receipt_missing).length,
    requests: db.requests.filter((r) => r.status === "new").length,
  };
}

/* ============================================================
   VIEWS  —  rendered into <main id="view">
   ============================================================ */
const state = { tab: "dashboard", currentId: null };
const view = () => $("#view");

function render() {
  $$(".topbar nav button").forEach((b) => b.classList.toggle("active", b.dataset.tab === state.tab));
  ({ dashboard: renderDashboard, requests: renderRequests, request: renderRequestDetail, properties: renderProperties, warranties: renderWarranties, calculators: renderCalculators }[state.tab] || renderDashboard)();
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
function go(tab, id = null) { state.tab = tab; state.currentId = id; render(); }

function pill(p) { return `<span class="pill ${esc((p || "").toLowerCase())}">${esc(p)}</span>`; }

function renderDashboard() {
  const s = stats();
  const recent = db.requests.slice(0, 8);
  view().innerHTML = `
    <section class="hero">
      <p class="eyebrow">Today's overview</p>
      <h2>Your landlord dashboard</h2>
      <p class="muted">Tenant requests, repairs, warranties, rent and reminders — in one place.</p>
    </section>
    <section class="cards">
      <div class="stat"><span class="label">New tenant requests</span><span class="num">${s.requests}</span></div>
      <div class="stat flag-warn"><span class="label">Late / unpaid rent</span><span class="num">${s.late}</span></div>
      <div class="stat"><span class="label">Open repairs</span><span class="num">${s.open}</span></div>
      <div class="stat flag-good"><span class="label">Warranty matches</span><span class="num">${s.warranty}</span></div>
      <div class="stat"><span class="label">Leases ending ≤60d</span><span class="num">${s.leases}</span></div>
      <div class="stat flag-warn"><span class="label">Missing receipts</span><span class="num">${s.receipts}</span></div>
    </section>

    <section class="panel">
      <div class="panel-head"><h3>Recent tenant requests</h3><button class="btn primary small" data-act="new">+ Paste a tenant message</button></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Issue</th><th>Property</th><th>Priority</th><th>Warranty</th><th></th></tr></thead>
        <tbody>
        ${recent.length ? recent.map((r) => `
          <tr>
            <td><strong>${esc(r.summary)}</strong><br><small>${esc(r.tenant)} · ${esc(r.created_at)}</small></td>
            <td>${esc(r.property || "Not selected")}</td>
            <td>${pill(r.priority)}</td>
            <td>${esc(r.warranty_match)}</td>
            <td><button class="btn small" data-view="${r.id}">View</button></td>
          </tr>`).join("") : `<tr><td colspan="5" class="empty">No requests yet — paste a tenant message to begin.</td></tr>`}
        </tbody>
      </table></div>
    </section>

    <section class="grid-two">
      <div class="panel">
        <h3>Rent &amp; lease alerts</h3>
        ${db.tenants.map((t) => { const d = daysUntil(t.lease_end); return `<div class="listitem"><strong>${esc(t.name)}</strong> · <span class="${t.rent_status !== "paid" ? "" : "muted"}">${esc(t.rent_status)}</span><br><small>${esc(t.property)} · balance ${money(t.balance_due)} · lease ends ${esc(t.lease_end)}${d !== null && d <= 60 ? " (soon)" : ""}</small></div>`; }).join("") || `<p class="empty">No tenants yet.</p>`}
      </div>
      <div class="panel">
        <h3>Warranty watch</h3>
        ${[...db.warranties].sort((a, b) => (a.expires || "").localeCompare(b.expires || "")).map((w) => `<div class="listitem"><strong>${esc(w.item)}</strong><br><small>${esc(w.property)} · expires ${esc(w.expires)} · ${esc(w.vendor || w.company || "")}</small></div>`).join("") || `<p class="empty">No warranties yet.</p>`}
      </div>
    </section>`;
  view().querySelector('[data-act="new"]').onclick = () => go("requests");
  $$("[data-view]", view()).forEach((b) => b.onclick = () => go("request", b.dataset.view));
}

function propertyOptions(selected = "") {
  return `<option value="">— Not sure / not listed —</option>` +
    db.properties.map((p) => `<option value="${esc(p.address)}"${p.address === selected ? " selected" : ""}>${esc(p.address)}</option>`).join("");
}

function renderRequests() {
  view().innerHTML = `
    <section class="hero"><p class="eyebrow">Tenant requests</p><h2>Paste a tenant email or text</h2>
      <p class="muted">The assistant reads it, figures out what's broken, checks warranties, and drafts a reply.</p></section>
    <section class="panel">
      <form class="form" id="reqForm">
        <label>Tenant name<input name="tenant" value="Tenant"></label>
        <label>Property<select name="property">${propertyOptions()}</select></label>
        <label>Tenant message<textarea name="message" required placeholder="Example: The AC is blowing warm air and the house is getting hot…"></textarea></label>
        <div class="form-row">
          <label>Repair estimate (optional)<input name="repair_estimate" placeholder="$0"></label>
          <label>Replacement estimate (optional)<input name="replacement_estimate" placeholder="$0"></label>
        </div>
        <div><button class="btn primary" type="submit">Let the assistant analyze it →</button></div>
      </form>
      <div style="margin-top:12px"><button class="btn" type="button" id="tenantLinkBtn">📨 Get a link to share with tenants</button></div>
      <div id="tenantLinkBox"></div>
    </section>
    <section class="panel">
      <div class="panel-head"><h3>All requests (${db.requests.length})</h3></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Issue</th><th>Tenant / property</th><th>Priority</th><th>Status</th><th></th></tr></thead>
        <tbody>${db.requests.map((r) => `<tr>
          <td><strong>${esc(r.summary)}</strong></td>
          <td>${esc(r.tenant)}<br><small>${esc(r.property || "—")}</small></td>
          <td>${pill(r.priority)}</td><td>${esc(r.status)}</td>
          <td><button class="btn small" data-view="${r.id}">View</button></td></tr>`).join("") || `<tr><td colspan="5" class="empty">No requests yet.</td></tr>`}
        </tbody></table></div>
    </section>`;
  $("#reqForm").onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    const id = addRequest({
      tenant: fval(f, "tenant").trim() || "Tenant", property: fval(f, "property"),
      message: fval(f, "message").trim(), repair_estimate: fval(f, "repair_estimate"), replacement_estimate: fval(f, "replacement_estimate"),
    });
    toast("Request analyzed and saved."); go("request", id);
  };
  { const tb = $("#tenantLinkBtn"); if (tb) tb.onclick = makeTenantLink; }
  $$("[data-view]", view()).forEach((b) => b.onclick = () => go("request", b.dataset.view));
}

function renderRequestDetail() {
  const r = db.requests.find((x) => x.id === state.currentId);
  if (!r) { go("requests"); return; }
  const active = /active/i.test(r.warranty_match || "");
  const w = db.warranties.find((x) => x.property === r.property && (x.category === r.category || (x.item && wb((r.message || "").toLowerCase(), x.item.toLowerCase()))));
  const [decision, detail] = repairVsReplace(r.repair_estimate, r.replacement_estimate || (w ? w.replacement_cost : 0), 0, active);
  view().innerHTML = `
    <section class="hero spread">
      <div><p class="eyebrow">${esc(CATEGORY_LABEL[r.category] || r.category)} · Priority ${esc(r.priority)}</p>
      <h2>${esc(r.summary)}</h2><p class="muted">${esc(r.property || "No property")} · ${esc(r.tenant)} · ${esc(r.created_at)}</p></div>
      <button class="btn" data-back>← Back</button>
    </section>
    <section class="grid-two">
      <div class="panel">
        <h3>Original message</h3><blockquote>${esc(r.message)}</blockquote>
        <h3 style="margin-top:14px">Assistant summary</h3>
        <dl class="kv"><dt>Likely issue</dt><dd>${esc(r.summary)}</dd><dt>Category</dt><dd>${esc(CATEGORY_LABEL[r.category] || r.category)}</dd><dt>Priority</dt><dd>${pill(r.priority)}</dd><dt>Next step</dt><dd>${esc(r.next_step)}</dd></dl>
        <h3 style="margin-top:14px">Suggested tenant reply</h3>
        <div class="reply">${esc(r.reply)}</div>
        <p style="margin-top:10px"><button class="btn small" data-copy>Copy reply</button></p>
      </div>
      <div class="panel">
        <h3>Warranty match</h3><p><strong>${esc(r.warranty_match)}</strong></p>
        ${w ? `<dl class="kv"><dt>Item</dt><dd>${esc(w.item)}</dd><dt>Brand / model</dt><dd>${esc(w.brand)} ${esc(w.model)}</dd><dt>Expires</dt><dd>${esc(w.expires)}</dd><dt>Provider</dt><dd>${esc(w.company)}</dd><dt>Vendor</dt><dd>${esc(w.vendor)} · ${esc(w.phone)}</dd><dt>Policy #</dt><dd>${esc(w.policy)}</dd></dl>` : `<p class="muted">No matching warranty on file.</p>`}
        <h3 style="margin-top:14px">Repair vs replace</h3>
        <p><strong>${esc(decision)}</strong></p><p class="muted">${esc(detail)}</p>
        <h3 style="margin-top:14px">Update</h3>
        <div class="row">
          <select id="statusSel">${["new", "waiting", "scheduled", "completed"].map((s) => `<option${s === r.status ? " selected" : ""}>${s}</option>`).join("")}</select>
          <button class="btn small" id="saveStatus">Save status</button>
          <button class="btn small danger" id="delReq">Delete</button>
        </div>
      </div>
    </section>`;
  view().querySelector("[data-back]").onclick = () => go("requests");
  view().querySelector("[data-copy]").onclick = () => { navigator.clipboard?.writeText(r.reply); toast("Reply copied."); };
  $("#saveStatus").onclick = () => { r.status = $("#statusSel").value; save(); toast("Status updated."); };
  $("#delReq").onclick = () => { if (confirm("Delete this request?")) { db.requests = db.requests.filter((x) => x.id !== r.id); save(); go("requests"); } };
}

function renderProperties() {
  view().innerHTML = `
    <section class="hero"><p class="eyebrow">Properties</p><h2>Your rentals (${db.properties.length})</h2></section>
    <section class="panel"><div class="table-wrap"><table>
      <thead><tr><th>Address</th><th>Rent</th><th>Mortgage</th><th>Taxes</th><th>Insurance</th><th></th></tr></thead>
      <tbody>${db.properties.map((p) => `<tr><td><strong>${esc(p.address)}</strong><br><small>${esc(p.notes || "")}</small></td><td>${money(p.monthly_rent)}</td><td>${money(p.mortgage)}</td><td>${money(p.taxes)}</td><td>${money(p.insurance)}</td><td><button class="btn small danger" data-del="${p.id}">Remove</button></td></tr>`).join("") || `<tr><td colspan="6" class="empty">No properties yet.</td></tr>`}</tbody>
    </table></div></section>
    <section class="panel"><h3>Add a property</h3>
      <form class="form" id="propForm">
        <label>Address<input name="address" required placeholder="221 Birch Ln"></label>
        <div class="form-row"><label>Monthly rent<input name="monthly_rent" placeholder="$0"></label><label>Mortgage<input name="mortgage" placeholder="$0"></label></div>
        <div class="form-row"><label>Taxes (monthly)<input name="taxes" placeholder="$0"></label><label>Insurance (monthly)<input name="insurance" placeholder="$0"></label></div>
        <label>Notes<input name="notes"></label>
        <div><button class="btn primary" type="submit">Add property</button></div>
      </form></section>`;
  $("#propForm").onsubmit = (e) => {
    e.preventDefault(); const f = e.target;
    if (!fval(f, "address").trim()) return;
    db.properties.push({ id: uid(), address: fval(f, "address").trim(), name: fval(f, "address").trim(), monthly_rent: num(fval(f, "monthly_rent")), mortgage: num(fval(f, "mortgage")), taxes: num(fval(f, "taxes")), insurance: num(fval(f, "insurance")), notes: fval(f, "notes").trim() });
    save(); toast("Property added."); render();
  };
  $$("[data-del]", view()).forEach((b) => b.onclick = () => { db.properties = db.properties.filter((p) => p.id !== b.dataset.del); save(); render(); });
}

function renderWarranties() {
  view().innerHTML = `
    <section class="hero"><p class="eyebrow">Warranties</p><h2>Warranty records (${db.warranties.length})</h2></section>
    <section class="panel"><div class="table-wrap"><table>
      <thead><tr><th>Item</th><th>Property</th><th>Category</th><th>Expires</th><th>Vendor</th><th></th></tr></thead>
      <tbody>${db.warranties.map((w) => `<tr><td><strong>${esc(w.item)}</strong><br><small>${esc(w.brand)} ${esc(w.model)}</small></td><td>${esc(w.property)}</td><td>${esc(CATEGORY_LABEL[w.category] || w.category)}</td><td>${esc(w.expires)}</td><td>${esc(w.vendor)}<br><small>${esc(w.phone)}</small></td><td><button class="btn small danger" data-del="${w.id}">Remove</button></td></tr>`).join("") || `<tr><td colspan="6" class="empty">No warranties yet.</td></tr>`}</tbody>
    </table></div></section>
    <section class="panel"><h3>Add a warranty</h3>
      <form class="form" id="warForm">
        <div class="form-row"><label>Item<input name="item" required placeholder="Water heater"></label><label>Property<select name="property">${propertyOptions()}</select></label></div>
        <div class="form-row"><label>Category<select name="category">${Object.keys(CATEGORY_LABEL).filter((k) => k !== "general").map((k) => `<option value="${k}">${CATEGORY_LABEL[k]}</option>`).join("")}</select></label><label>Expires<input name="expires" type="date"></label></div>
        <div class="form-row"><label>Brand<input name="brand"></label><label>Model<input name="model"></label></div>
        <div class="form-row"><label>Vendor<input name="vendor"></label><label>Vendor phone<input name="phone"></label></div>
        <div class="form-row"><label>Replacement cost<input name="replacement_cost" placeholder="$0"></label><label>Policy #<input name="policy"></label></div>
        <div><button class="btn primary" type="submit">Add warranty</button></div>
      </form></section>`;
  $("#warForm").onsubmit = (e) => {
    e.preventDefault(); const f = e.target; if (!fval(f, "item").trim()) return;
    db.warranties.push({ id: uid(), item: fval(f, "item").trim(), property: fval(f, "property"), category: fval(f, "category"), brand: fval(f, "brand"), model: fval(f, "model"), expires: fval(f, "expires"), company: "", vendor: fval(f, "vendor"), phone: fval(f, "phone"), policy: fval(f, "policy"), replacement_cost: num(fval(f, "replacement_cost")), notes: "" });
    save(); toast("Warranty added."); render();
  };
  $$("[data-del]", view()).forEach((b) => b.onclick = () => { db.warranties = db.warranties.filter((w) => w.id !== b.dataset.del); save(); render(); });
}

function renderCalculators() {
  const calcs = [
    { id: "rr", title: "Repair vs replace", fields: [["a", "Repair estimate", "425"], ["b", "Replacement estimate", "685"], ["c", "Prior repairs (24 mo)", "2"]] },
    { id: "vac", title: "Vacancy cost", fields: [["a", "Monthly rent", "1850"], ["b", "Days vacant", "21"], ["c", "Utilities", "150"], ["d", "Advertising", "75"], ["e", "Turnover cost", "500"]] },
    { id: "capex", title: "CapEx reserve", fields: [["a", "Replacement cost", "12000"], ["b", "Years remaining", "8"]] },
    { id: "cf", title: "Monthly cash flow", fields: [["a", "Rent", "1850"], ["b", "Mortgage", "1050"], ["c", "Taxes", "230"], ["d", "Insurance", "115"], ["e", "Repair reserve", "185"], ["f", "Other", "0"]] },
    { id: "wv", title: "Warranty value", fields: [["a", "Warranty cost", "650"], ["b", "Service fees paid", "150"], ["c", "Covered repairs", "1450"]] },
  ];
  view().innerHTML = `
    <section class="hero"><p class="eyebrow">Calculators</p><h2>Smart landlord calculators</h2>
      <p class="muted">Planning helpers — not legal, tax, accounting, or financial advice.</p></section>
    <div id="calcResult"></div>
    <section class="calc-grid">${calcs.map((c) => `<form class="panel calc" data-calc="${c.id}"><h3>${c.title}</h3>${c.fields.map((f) => `<label>${f[1]}<input name="${f[0]}" value="${f[2]}"></label>`).join("")}<div style="margin-top:8px"><button class="btn primary small">Calculate</button></div></form>`).join("")}</section>`;
  $$("[data-calc]", view()).forEach((form) => form.onsubmit = (e) => {
    e.preventDefault(); const g = (k) => num(fval(form, k));
    let title = "", result = "", detail = "";
    switch (form.dataset.calc) {
      case "rr": { const [d, t] = repairVsReplace(g("a"), g("b"), parseInt(g("c"))); title = "Repair vs replace"; result = d; detail = t; break; }
      case "vac": { const v = (g("a") / 30) * g("b") + g("c") + g("d") + g("e"); title = "Vacancy cost"; result = money(v.toFixed(2)); detail = "Lost rent plus the utility, advertising and turnover costs you entered."; break; }
      case "capex": { const yrs = Math.max(g("b"), 1); const v = g("a") / (yrs * 12); title = "CapEx reserve"; result = money(v.toFixed(2)) + " / month"; detail = "Replacement cost spread over the months until expected replacement."; break; }
      case "cf": { const v = g("a") - g("b") - g("c") - g("d") - g("e") - g("f"); title = "Monthly cash flow"; result = money(v.toFixed(2)); detail = "Rent minus mortgage, taxes, insurance, reserves and other monthly costs."; break; }
      case "wv": { const v = g("c") - g("a") - g("b"); title = "Warranty value"; result = money(v.toFixed(2)); detail = v >= 0 ? "Positive: the warranty saved more than it cost." : "Negative: it cost more than it covered."; break; }
    }
    $("#calcResult").innerHTML = `<div class="result-banner"><span class="muted">${esc(title)}</span><strong>${esc(result)}</strong><span class="muted">${esc(detail)}</span></div>`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* ============================================================
   EXCEL  —  export to / import from .xlsx (via SheetJS / XLSX)
   ============================================================ */
const SHEETS = {
  Properties: { arr: "properties", cols: [["address", "Address"], ["name", "Name"], ["monthly_rent", "Monthly Rent"], ["mortgage", "Mortgage"], ["taxes", "Taxes (monthly)"], ["insurance", "Insurance (monthly)"], ["notes", "Notes"]] },
  Tenants: { arr: "tenants", cols: [["name", "Tenant"], ["property", "Property"], ["email", "Email"], ["phone", "Phone"], ["lease_end", "Lease End"], ["rent_status", "Rent Status"], ["balance_due", "Balance Due"]] },
  Warranties: { arr: "warranties", cols: [["item", "Item"], ["property", "Property"], ["category", "Category"], ["brand", "Brand"], ["model", "Model"], ["expires", "Expires"], ["company", "Warranty Company"], ["vendor", "Vendor"], ["phone", "Phone"], ["policy", "Policy #"], ["replacement_cost", "Replacement Cost"], ["notes", "Notes"]] },
  Requests: { arr: "requests", cols: [["created_at", "Date"], ["tenant", "Tenant"], ["property", "Property"], ["summary", "Issue Summary"], ["category", "Category"], ["priority", "Priority"], ["status", "Status"], ["warranty_match", "Warranty Match"], ["next_step", "Suggested Next Step"], ["repair_estimate", "Repair Estimate"], ["replacement_estimate", "Replacement Estimate"], ["message", "Original Message"]] },
  Expenses: { arr: "expenses", cols: [["date", "Date"], ["property", "Property"], ["category", "Category"], ["amount", "Amount"], ["vendor", "Vendor"], ["receipt_missing", "Receipt Missing"], ["notes", "Notes"]] },
};

function exportExcel() {
  if (typeof XLSX === "undefined") return toast("Excel library still loading — try again in a moment.");
  const wb = XLSX.utils.book_new();
  for (const [sheet, def] of Object.entries(SHEETS)) {
    const rows = (db[def.arr] || []).map((rec) => {
      const o = {}; def.cols.forEach(([k, label]) => o[label] = rec[k] ?? ""); return o;
    });
    const ws = XLSX.utils.json_to_sheet(rows, { header: def.cols.map((c) => c[1]) });
    XLSX.utils.book_append_sheet(wb, ws, sheet);
  }
  XLSX.writeFile(wb, "rentaldesk_export_" + today() + ".xlsx");
  toast("Excel file downloaded.");
}

function importExcel(file) {
  if (typeof XLSX === "undefined") return toast("Excel library still loading.");
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
      let imported = 0;
      for (const [sheet, def] of Object.entries(SHEETS)) {
        if (!wb.Sheets[sheet]) continue;
        const json = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: "" });
        if (!json.length) continue;
        const labelToKey = {}; def.cols.forEach(([k, label]) => labelToKey[label.toLowerCase()] = k);
        db[def.arr] = json.map((row) => {
          const rec = { id: uid() };
          for (const [header, val] of Object.entries(row)) {
            const key = labelToKey[String(header).trim().toLowerCase()];
            if (key) rec[key] = val;
          }
          if (def.arr === "expenses") rec.receipt_missing = /^(true|yes|1|missing)$/i.test(String(rec.receipt_missing));
          if (def.arr === "properties" && !rec.name) rec.name = rec.address;
          return rec;
        });
        imported++;
      }
      save(); render();
      toast(imported ? `Imported ${imported} sheet(s) from Excel.` : "No matching sheets found in that file.");
    } catch (err) { console.error(err); toast("Could not read that Excel file."); }
  };
  reader.readAsArrayBuffer(file);
}

/* ============================================================
   EXCEL HAND-OFF  —  export into the Kyodo Rental Property Suite format
   Maps RentalDesk data to the Suite's exact sheet columns so a buyer can
   move straight from the free tool into the paid spreadsheet.
   ============================================================ */
function exportForSuite() {
  if (typeof XLSX === "undefined") return toast("Excel library still loading — try again in a moment.");
  const wb = XLSX.utils.book_new();

  const guide = [
    { Step: "How to move this into the Kyodo Rental Property Suite" },
    { Step: "1. Open your Rental Property Suite spreadsheet (Excel or Google Sheets)." },
    { Step: "2. On the 'Expense Log' sheet here, copy the data rows and paste them into the Suite's Expense Log, below its yellow header." },
    { Step: "3. On the 'Setup' sheet here, copy the property rows into the Suite's Setup tab." },
    { Step: "Tip: paste as values. Don't have the Suite yet? Get it at kyodopartners.gumroad.com." },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(guide, { header: ["Step"] }), "How to import");

  const setupHeaders = ["Address", "Type", "Purchase Price", "Purchase Date", "Down Payment", "Loan Amount", "Interest Rate (%)", "Monthly Mortgage"];
  const setupRows = (db.properties || []).map((p) => ({
    "Address": p.address || "", "Type": "", "Purchase Price": "", "Purchase Date": "", "Down Payment": "", "Loan Amount": "", "Interest Rate (%)": "", "Monthly Mortgage": num(p.mortgage),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(setupRows, { header: setupHeaders }), "Setup");

  const expHeaders = ["Date", "Property", "Vendor", "Amount", "Category (Schedule E)", "Receipt?", "Notes"];
  const expRows = (db.expenses || []).map((x) => ({
    "Date": x.date || "", "Property": x.property || "", "Vendor": x.vendor || "", "Amount": num(x.amount), "Category (Schedule E)": x.category || "", "Receipt?": x.receipt_missing ? "No" : "Yes", "Notes": x.notes || "",
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expRows, { header: expHeaders }), "Expense Log");

  XLSX.writeFile(wb, "rentaldesk_for_rental_suite_" + today() + ".xlsx");
  toast("Exported in Rental Property Suite format.");
}

/* ============================================================
   TENANT INTAKE  —  shareable "report a problem" link (no server)
   The landlord shares a link; the tenant fills a form; it emails the
   landlord a clean, paste-ready request via mailto (fully client-side).
   ============================================================ */
function getParam(name) { try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; } }

function makeTenantLink() {
  let saved = "";
  try { saved = localStorage.getItem("rentaldesk_landlord_email") || ""; } catch (e) {}
  const email = (prompt("Your email — tenant reports will be sent here:", saved) || "").trim();
  if (!email) return;
  try { localStorage.setItem("rentaldesk_landlord_email", email); } catch (e) {}
  const link = location.origin + location.pathname + "?report=1&to=" + encodeURIComponent(email);
  const box = $("#tenantLinkBox");
  if (box) {
    box.innerHTML = `<div class="notice" style="margin-top:10px">Share this link with your tenants. When they submit, the request is emailed to <strong>${esc(email)}</strong>, formatted to paste straight into the box above.<br>
      <input readonly value="${esc(link)}" style="margin-top:8px" onclick="this.select()">
      <button class="btn small" type="button" id="copyTenantLink">Copy link</button></div>`;
    const cb = $("#copyTenantLink"); if (cb) cb.onclick = () => { if (navigator.clipboard) navigator.clipboard.writeText(link); toast("Link copied — share it with your tenants."); };
  }
}

function renderTenantReportMode() {
  const isReport = getParam("report") !== null || (location.hash || "").replace("#", "") === "report";
  if (!isReport) return false;
  const to = getParam("to") || "";
  const prop = getParam("p") || "";
  ["header.topbar", ".kyodo-cta", ".toolbar", "footer.site"].forEach((sel) => { const el = document.querySelector(sel); if (el) el.style.display = "none"; });
  document.title = "Report a problem — RentalDesk";
  const v = view();
  v.innerHTML = `
    <section class="hero"><p class="eyebrow">Maintenance request</p><h2>Report a problem</h2>
      <p class="muted">Fill this out and we'll send it straight to your landlord. Takes about a minute.</p></section>
    <section class="panel">
      <form class="form" id="tenantForm">
        <div class="form-row"><label>Your name<input name="name" required></label><label>Unit / property<input name="unit" value="${esc(prop)}"></label></div>
        <label>Best way to reach you (phone or email)<input name="contact"></label>
        <label>How urgent is it?<select name="urgency"><option>Not urgent</option><option selected>Soon</option><option>Emergency (no heat, flooding, safety)</option></select></label>
        <label>What's wrong?<textarea name="message" required placeholder="Describe the problem — what, where, and since when."></textarea></label>
        <div><button class="btn primary" type="submit">Send to my landlord →</button></div>
      </form>
      <div id="tenantDone" style="display:none;margin-top:14px">
        <div class="reply"><strong>Your email app should have opened.</strong> If it didn't, copy the text below and email it to your landlord:</div>
        <textarea id="tenantCopy" readonly style="margin-top:8px;min-height:140px"></textarea>
      </div>
    </section>
    <footer class="site" style="display:block"><p>Powered by Kyodo Landlord Assistant · © 2026 Kyodo Partners LLC</p></footer>`;
  const f = $("#tenantForm");
  f.onsubmit = (e) => {
    e.preventDefault();
    const name = fval(f, "name").trim() || "Tenant";
    const unit = fval(f, "unit").trim() || prop;
    const contact = fval(f, "contact").trim();
    const urgency = fval(f, "urgency");
    const msg = fval(f, "message").trim();
    if (!msg) return;
    const subject = "Maintenance request — " + (unit || "my unit") + " — " + name;
    const body = "Tenant: " + name + "\nProperty/Unit: " + unit + "\nBest contact: " + contact + "\nUrgency: " + urgency + "\n\nIssue:\n" + msg + "\n\n— Sent via RentalDesk";
    if (to) location.href = "mailto:" + encodeURIComponent(to) + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    $("#tenantCopy").value = subject + "\n\n" + body;
    $("#tenantDone").style.display = "block";
    toast("Opening your email app…");
  };
  return true;
}

/* ============================================================
   INIT
   ============================================================ */
function init() {
  if (renderTenantReportMode()) return;   // tenant-facing "report a problem" link
  load();
  $$(".topbar nav button").forEach((b) => b.onclick = () => go(b.dataset.tab));
  $("#exportBtn").onclick = exportExcel;
  { const esb = $("#exportSuiteBtn"); if (esb) esb.onclick = exportForSuite; }
  $("#importBtn").onclick = () => $("#importFile").click();
  $("#importFile").onchange = (e) => { if (e.target.files[0]) importExcel(e.target.files[0]); e.target.value = ""; };
  $("#resetBtn").onclick = () => { if (confirm("Reset everything back to the demo data? This clears your changes in this browser.")) { localStorage.removeItem(STORE_KEY); load(); render(); toast("Demo data restored."); } };
  render();
}
document.addEventListener("DOMContentLoaded", init);
