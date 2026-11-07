// Self-check for the reminder logic: `node test.js` prints "ok" or throws.
process.env.DATA_DIR = require("node:os").tmpdir(); // keep the real data file out of it
const assert = require("node:assert");
const SB = require("./public/skyblock.js");
const { dueNotifications, validate, defaultSettings, eventMessage } = require("./server.js");

const MIN = 60000;
const s = defaultSettings();
s.events.spooky.leads = [10, 0];
const spooky = SB.occurrences(Date.UTC(2026, 10, 1), Date.UTC(2026, 10, 10)).find(o => o.id === "spooky");
const leadsDue = (now, sent = {}) => dueNotifications(now, s, SB.EVENTS, sent).filter(n => n.o.id === "spooky").map(n => n.lead);

assert.deepStrictEqual(leadsDue(spooky.start - 10 * MIN - 1000), [], "too early");
assert.deepStrictEqual(leadsDue(spooky.start - 10 * MIN + 1000), [10], "10 minutes before");
assert.deepStrictEqual(leadsDue(spooky.start + 1000), [0], "at start");
assert.deepStrictEqual(leadsDue(spooky.start + 6 * MIN), [], "past the grace window");
assert.deepStrictEqual(leadsDue(spooky.start + 1000, { [`spooky:${spooky.start}:0`]: 1 }), [], "already sent");
s.events.spooky.enabled = false;
assert.deepStrictEqual(leadsDue(spooky.start + 1000), [], "disabled");

assert.throws(() => validate({ webhook: "https://evil.example/api/webhooks/1/x" }, s), /webhook/);
assert.throws(() => validate({ roleId: "<@&1>" }, s), /role/);
assert.deepStrictEqual(validate({ events: { spooky: { enabled: true, leads: [7, 10, "0", 10] } } }, s).events.spooky,
  { enabled: true, leads: [10, 0] }, "unknown lead times dropped, duplicates merged");
assert.strictEqual(validate({ events: { nope: { enabled: true } } }, s).events.nope, undefined, "unknown events ignored");

// Marina adds 12 Fishing Festivals, only inside her term.
const marina = { mayor: { name: "Marina", election: { year: 522 }, perks: [{ name: "Fishing Festival" }] } };
assert.strictEqual(SB.occurrences(0, Date.UTC(2030, 0, 1), SB.mayorEvents(marina)).length, 12);
assert.deepStrictEqual(SB.mayorEvents({ mayor: { name: "Paul", election: { year: 522 }, perks: [] } }), []);
const foxy = n => ({ mayor: { name: "Foxy", election: { year: 522 }, perks: [{ name: "Extra Event", description: `Schedules an extra §b${n}§7 event during the year.` }] } });
const bonus = SB.occurrences(0, Date.UTC(2030, 0, 1), SB.mayorEvents(foxy("Fishing Festival")));
assert.strictEqual(bonus.length, 1);
assert.deepStrictEqual([bonus[0].name, SB.sbDate(bonus[0].start).month, SB.sbDate(bonus[0].start).day, bonus[0].year], ["Bonus Fishing Festival", 5, 22, 523]);
assert.deepStrictEqual(SB.mayorEvents(foxy("Mining Fiesta")), []);

assert.match(eventMessage({ o: spooky, lead: 10 }, "123").content, /<@&123>/);
assert.deepStrictEqual(eventMessage({ o: spooky, lead: 10 }, "").allowed_mentions, { parse: [] });
console.log("ok");
