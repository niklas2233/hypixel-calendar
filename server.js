// SkyBlock calendar server: serves the pages, caches the Hypixel election API, and sends Discord webhook reminders.
// No dependencies; settings and the sent-message log live in one JSON file on the data volume.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const SB = require("./public/skyblock.js");

const PORT = Number(process.env.PORT) || 8124;
const DATA_FILE = path.join(process.env.DATA_DIR || path.join(__dirname, "data"), "state.json");
const PASSWORD = process.env.SETTINGS_PASSWORD || "";
const PUBLIC = path.join(__dirname, "public");
const ELECTION_API = "https://api.hypixel.net/v2/resources/skyblock/election";
const LEADS = [1440, 180, 60, 30, 15, 10, 5, 0]; // reminder options, minutes before an event starts
const GRACE = 5 * 60000; // a reminder may go out this late (restart, slow tick), never later
const WEBHOOK_RE = /^https:\/\/(?:canary\.|ptb\.)?(?:discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/;

const defaultSettings = () => ({
  webhook: "", roleId: "", mayorChange: true,
  events: Object.fromEntries(SB.ALL_TYPES.map(e => [e.id, { enabled: true, leads: [10] }])),
});

// ---- State ----
function loadState() {
  const d = defaultSettings();
  try {
    const s = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return { settings: { ...d, ...s.settings, events: { ...d.events, ...s.settings?.events } }, sent: s.sent || {}, lastMayor: s.lastMayor || null };
  } catch {
    return { settings: d, sent: {}, lastMayor: null };
  }
}
let state = loadState();
function saveState() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE + ".tmp", JSON.stringify(state, null, 2));
  fs.renameSync(DATA_FILE + ".tmp", DATA_FILE);
}

// ---- Reminders ----
// Which reminders should go out at `now`: each enabled lead time whose moment has come within the grace window and wasn't sent.
function dueNotifications(now, settings, events, sent) {
  const due = [];
  for (const o of SB.occurrences(now - GRACE, now + LEADS[0] * 60000 + 1, events)) {
    const cfg = settings.events[o.id];
    if (!cfg?.enabled) continue;
    for (const lead of cfg.leads) {
      const at = o.start - lead * 60000, key = `${o.id}:${o.start}:${lead}`;
      if (now >= at && now < at + GRACE && !sent[key]) due.push({ key, o, lead });
    }
  }
  return due;
}

const plain = s => s.replace(/§./g, "");
const withRole = (msg, roleId) => roleId
  ? { content: `<@&${roleId}>`, allowed_mentions: { roles: [roleId] }, ...msg }
  : { allowed_mentions: { parse: [] }, ...msg };

// Discord renders <t:unix:…> in each reader's own timezone.
function eventMessage({ o, lead }, roleId) {
  const s = Math.floor(o.start / 1000), e = Math.floor(o.end / 1000), sb = SB.sbDate(o.start);
  return withRole({ embeds: [{
    title: o.name,
    color: parseInt(SB.MC[o.mc].slice(1), 16),
    description: lead ? `Starts <t:${s}:R>, at <t:${s}:t>. Ends at <t:${e}:t>.` : `Started <t:${s}:R>. Ends <t:${e}:R>, at <t:${e}:t>.`,
    footer: { text: `${SB.MONTHS[sb.month]} ${SB.ord(sb.day)}, Year ${o.year}` },
  }] }, roleId);
}

function mayorMessage(m, roleId) {
  const lines = m.perks.map(p => `**${p.name}**: ${plain(p.description)}`);
  if (m.minister) lines.push(`**Minister ${m.minister.name}, ${m.minister.perk.name}**: ${plain(m.minister.perk.description)}`);
  return withRole({ embeds: [{ title: `New mayor: ${m.name}`, color: 0xffaa00, description: lines.join("\n") }] }, roleId);
}

async function post(webhook, body) {
  const r = await fetch(webhook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Discord answered ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

let election = null;
async function refreshElection() {
  try {
    const j = await (await fetch(ELECTION_API)).json();
    if (j.success) election = j;
  } catch (e) {
    console.error("Hypixel API:", e.message);
  }
}

let ticking = false;
async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    const { settings, sent } = state, now = Date.now();
    for (const k in sent) if (sent[k] < now - 3 * 86400000) delete sent[k];

    const m = election?.mayor;
    if (m && state.lastMayor !== m.name) {
      // The first mayor seen is only remembered; announce changes after that. A failed post retries next tick.
      if (state.lastMayor && settings.webhook && settings.mayorChange) await post(settings.webhook, mayorMessage(m, settings.roleId));
      state.lastMayor = m.name;
      saveState();
    }

    if (!settings.webhook) return;
    for (const n of dueNotifications(now, settings, [...SB.EVENTS, ...SB.mayorEvents(election)], sent)) {
      await post(settings.webhook, eventMessage(n, settings.roleId));
      sent[n.key] = now;
      saveState();
      console.log("Sent", n.key);
    }
  } catch (e) {
    console.error("Notify:", e.message);
  } finally {
    ticking = false;
  }
}

// ---- Settings API ----
const publicSettings = ({ webhook, ...rest }) => ({ ...rest, webhookSet: !!webhook, webhookHint: webhook ? "…" + webhook.slice(-6) : "" });

// Returns new settings from a request body, or throws a message the settings page can show.
function validate(body, current) {
  const next = structuredClone(current);
  if (body.webhook !== undefined) {
    if (body.webhook !== "" && !WEBHOOK_RE.test(String(body.webhook).trim()))
      throw new Error("That isn't a Discord webhook URL. Copy it from Server Settings → Integrations → Webhooks.");
    next.webhook = String(body.webhook).trim();
  }
  if (body.roleId !== undefined) {
    if (!/^\d{0,20}$/.test(String(body.roleId).trim())) throw new Error("The role ID should be digits only, or empty.");
    next.roleId = String(body.roleId).trim();
  }
  if (body.mayorChange !== undefined) next.mayorChange = !!body.mayorChange;
  for (const [id, cfg] of Object.entries(body.events || {})) {
    if (!next.events[id]) continue;
    const leads = [...new Set((cfg.leads || []).map(Number).filter(l => LEADS.includes(l)))];
    next.events[id] = { enabled: !!cfg.enabled, leads: leads.sort((a, b) => b - a) };
  }
  return next;
}

// ---- HTTP ----
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
const PROTECTED = new Set(["/settings", "/settings.html", "/api/settings", "/api/test"]);

function authorized(req) {
  if (!PASSWORD) return true;
  const [scheme, b64] = (req.headers.authorization || "").split(" ");
  const pass = scheme === "Basic" ? Buffer.from(b64 || "", "base64").toString().split(":").slice(1).join(":") : "";
  const hash = s => crypto.createHash("sha256").update(s).digest();
  return crypto.timingSafeEqual(hash(pass), hash(PASSWORD));
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let s = "";
    req.on("data", c => { s += c; if (s.length > 65536) { reject(new Error("Request too large.")); req.destroy(); } });
    req.on("end", () => { try { resolve(JSON.parse(s)); } catch { reject(new Error("Request body isn't valid JSON.")); } });
  });
}

async function handle(req, res) {
  const url = new URL(req.url, "http://x");
  let p = url.pathname;
  if (PROTECTED.has(p) && !authorized(req)) {
    res.writeHead(401, { "www-authenticate": 'Basic realm="SkyBlock calendar settings"' });
    return res.end("Password required.");
  }
  try {
    if (p === "/api/election") return election ? json(res, 200, election) : json(res, 503, { error: "No election data yet." });
    if (p === "/api/settings" && req.method === "GET") return json(res, 200, { settings: publicSettings(state.settings), leads: LEADS });
    if (p === "/api/settings" && req.method === "PUT") {
      state.settings = validate(await readJson(req), state.settings);
      saveState();
      return json(res, 200, { settings: publicSettings(state.settings), leads: LEADS });
    }
    if (p === "/api/test" && req.method === "POST") {
      if (!state.settings.webhook) return json(res, 400, { error: "Save a webhook URL first." });
      const next = SB.occurrences(Date.now(), Date.now() + SB.YEAR)[0];
      await post(state.settings.webhook, eventMessage({ o: next, lead: 1 }, state.settings.roleId));
      return json(res, 200, { ok: true });
    }
    if (p.startsWith("/api/")) return json(res, 404, { error: "Not found." });
  } catch (e) {
    return json(res, 400, { error: e.message });
  }

  // Static files from public/, no directory traversal.
  if (p === "/") p = "/index.html";
  if (p === "/settings") p = "/settings.html";
  const file = path.join(PUBLIC, path.normalize(p));
  if (!file.startsWith(PUBLIC + path.sep) || !TYPES[path.extname(file)]) { res.writeHead(404); return res.end("Not found"); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] });
    res.end(buf);
  });
}

if (require.main === module) {
  http.createServer(handle).listen(PORT, () => console.log(`SkyBlock calendar on http://localhost:${PORT}${PASSWORD ? " (settings password set)" : ""}`));
  refreshElection().then(tick);
  setInterval(refreshElection, 5 * 60000);
  setInterval(tick, 30000);
}

module.exports = { dueNotifications, validate, defaultSettings, eventMessage, LEADS };
