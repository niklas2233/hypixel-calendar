# SkyBlock Event Calendar

A dark, Minecraft-styled calendar for Hypixel SkyBlock events, shown in **your local time** instead of SkyBlock time.

- Spooky Festival, Season of Jerry, New Year Celebration, Traveling Zoo, Hoppity's Hunt, elections
- Current mayor, minister, perks and live election standings (from the public Hypixel API)
- Fishing Festival dates when Marina's perk is active
- Upcoming events with countdowns

It is a single static `index.html`. Open it directly in a browser, or run it with Docker.

## Run with Docker

```bash
docker build -t hypixel-calendar .
docker run -d -p 8080:80 --name hypixel-calendar hypixel-calendar
```

Then open http://localhost:8080.

Or use the prebuilt image, published to GitHub Container Registry on every push to `main`:

```bash
docker run -d -p 8080:80 --name hypixel-calendar ghcr.io/niklas2233/hypixel-calendar:latest
```

## How times are calculated

SkyBlock Year 1 began at `1560275700000` (11 June 2019, 17:55 UTC). One SkyBlock day is 20 real minutes, a month is 31 days, and a year is 124 real hours.

Not affiliated with Hypixel or Mojang.
