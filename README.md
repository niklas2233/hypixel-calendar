# SkyBlock Event Calendar

A dark, Minecraft-styled calendar for Hypixel SkyBlock events, shown in **your local time** instead of SkyBlock time, with Discord reminders.

- Spooky Festival, Season of Jerry, New Year Celebration, Traveling Zoo, Hoppity's Hunt, elections
- Current mayor, minister, perks and live election standings (from the public Hypixel API)
- Fishing Festival dates when Marina's perk is active
- Hypixel-style item tooltips for days, events and candidates
- **Discord webhook notifications**, with a settings page to pick which events notify and when (1 day, 3 hours, 1 hour, 30/15/10/5 minutes before, or at start). Optional role ping and new-mayor announcements.

## Run it

On a server with Docker, using the prebuilt image from GitHub Container Registry:

```bash
mkdir hypixel-calendar && cd hypixel-calendar
curl -O https://raw.githubusercontent.com/niklas2233/hypixel-calendar/main/docker-compose.yml
docker compose up -d
```

Open `http://<server>:8124`, then click **Discord notifications** to paste your webhook URL and choose events.

Settings and the sent-message log are stored in `./data/state.json`, so they survive updates. To update:

```bash
docker compose pull && docker compose up -d
```

### Configuration

| Variable | Default | What it does |
| --- | --- | --- |
| `SETTINGS_PASSWORD` | empty | Password for the settings page (any username). Set this if anyone else can reach the port. |
| `PORT` | `8124` | Port the server listens on inside the container. |
| `DATA_DIR` | `/data` | Where `state.json` is kept. |

## Develop

No dependencies, just Node 24:

```bash
node server.js   # http://localhost:8124
node test.js     # reminder logic self-check
```

`public/index.html` also works opened straight from disk; it then reads the Hypixel API directly and hides the notification settings.

## How times are calculated

SkyBlock Year 1 began at `1560275700000` (11 June 2019, 17:55 UTC). One SkyBlock day is 20 real minutes, a month is 31 days, and a year is 124 real hours. The math lives in `public/skyblock.js` and is shared by the page and the server.

Not affiliated with Hypixel or Mojang.
