// Shared SkyBlock calendar math, used by the pages (window.SB) and the Node server (require).
(function (root) {
  // Year 1, Early Spring 1 began at this real timestamp.
  const EPOCH = 1560275700000, DAY = 20 * 60000, MONTH = 31 * DAY, YEAR = 12 * MONTH;
  const MONTHS = ["Early Spring","Spring","Late Spring","Early Summer","Summer","Late Summer",
                  "Early Autumn","Autumn","Late Autumn","Early Winter","Winter","Late Winter"];

  // Recurring yearly events: month index (0-11), start day (1-31), length in SkyBlock days, optional name and grid label.
  const EVENTS = [
    { id: "hoppity", name: "Hoppity's Hunt",    short: "Hoppity", color: "var(--green)",  mc: "a", at: [[0, 1, 93]] },
    { id: "zoo",     name: "Traveling Zoo",     color: "var(--yellow)", mc: "e", at: [[3, 1, 3, "Summer Traveling Zoo", "Zoo ☀"], [9, 1, 3, "Winter Traveling Zoo", "Zoo ❄"]] },
    { id: "elect",   name: "Election Results",  short: "Elec. results", color: "var(--red)",    mc: "c", at: [[2, 27, 1]] },
    { id: "booth",   name: "Election Opens",    short: "Elec. opens", color: "var(--red)",    mc: "c", at: [[5, 27, 1]] },
    { id: "spooky",  name: "Spooky Festival",   short: "Spooky", color: "var(--gold)",   mc: "6", at: [[8, 29, 3]] },
    { id: "jerry",   name: "Season of Jerry",   short: "Jerry", color: "var(--aqua)",   mc: "b", at: [[11, 24, 3]] },
    { id: "newyear", name: "New Year Celebration", short: "New Year", color: "var(--pink)", mc: "d", at: [[11, 29, 3]] },
  ];
  // Marina's Fishing Festival: the 1st–3rd of every month, only during her term (see mayorEvents).
  const FISHING = { id: "fishing", mayor: true, name: "Fishing Festival", short: "Fishing", color: "#00aaaa", mc: "3",
                    at: MONTHS.map((_, i) => [i, 1, 3]) };
  // Every event type someone can configure, including mayor events that may not be active right now.
  const ALL_TYPES = [...EVENTS, FISHING];

  // Minecraft § color codes.
  const MC = { 0:"#000000",1:"#0000aa",2:"#00aa00",3:"#00aaaa",4:"#aa0000",5:"#aa00aa",6:"#ffaa00",7:"#aaaaaa",
               8:"#555555",9:"#5555ff",a:"#55ff55",b:"#55ffff",c:"#ff5555",d:"#ff55ff",e:"#ffff55",f:"#ffffff" };

  function occurrences(from, to, events = EVENTS) {
    const out = [];
    const y0 = Math.floor((from - EPOCH) / YEAR) - 1, y1 = Math.floor((to - EPOCH) / YEAR);
    for (let y = y0; y <= y1; y++) {
      const ys = EPOCH + y * YEAR;
      for (const e of events) {
        for (const [m, d, len, label, short] of e.at) {
          const start = ys + m * MONTH + (d - 1) * DAY, end = start + len * DAY;
          if (e.within && (end <= e.within[0] || start >= e.within[1])) continue;
          if (end > from && start < to) out.push({ ...e, name: label || e.name, short: short || e.short, start, end, year: y + 1 });
        }
      }
    }
    return out.sort((a, b) => a.start - b.start);
  }

  function sbDate(t) {
    const ms = t - EPOCH, year = Math.floor(ms / YEAR) + 1;
    const inYear = ms - (year - 1) * YEAR;
    const month = Math.floor(inYear / MONTH), day = Math.floor((inYear % MONTH) / DAY) + 1;
    const mins = Math.floor((inYear % DAY) / DAY * 1440);
    return { year, month, day, h: Math.floor(mins / 60), m: mins % 60 };
  }

  const ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");

  // Late Spring 27th of a SkyBlock year (1-based): when election results are announced.
  const resultsAt = year => EPOCH + (year - 1) * YEAR + 2 * MONTH + 26 * DAY;

  // Extra events the current mayor (or minister) adds, limited to their term. `data` is the Hypixel election response.
  function mayorEvents(data) {
    const m = data && data.mayor;
    if (!m) return [];
    const termStart = resultsAt(m.election.year + 1);
    const perks = [...m.perks, ...(m.minister ? [m.minister.perk] : [])];
    return perks.some(p => p.name === "Fishing Festival") ? [{ ...FISHING, within: [termStart, termStart + YEAR] }] : [];
  }

  const SB = { EPOCH, DAY, MONTH, YEAR, MONTHS, EVENTS, ALL_TYPES, MC, occurrences, sbDate, ord, resultsAt, mayorEvents };
  if (typeof module === "object" && module.exports) module.exports = SB; else root.SB = SB;
})(this);
