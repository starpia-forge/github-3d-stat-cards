# Milky Way is the v1 Card concept

The v1 Card depicts the Subject's repositories as celestial Bodies embroidered along a Milky Way Band that runs from their first Activity on the left to today on the right. Each Body sits at the commit-weighted middle of its Activity and grows through four Tiers by the Subject's commit count there: Starlight (1–9), Star (10–49), Planet (50–199) and Nebula (200+). Starlight and Stars take their repository's Primary Language colour; Planets and Nebulae show its whole Language Mix. The Band's brightness is monthly Activity, and quiet stretches longer than three months become shortened Rifts. The Host wanted a space concept in which every piece of work is a star. Space-themed profile cards already exist (GitHub Planet, CodeNebula, github-profile-orbit, galaxy-profile), but they show only today's language mix, so what keeps this Card new is that every Body is placed in time along the Band.

## Considered Options

- **Language River** (ADR-0003): time as a river with a Stream per Language. It was dropped for a space concept before an art direction was picked.
- **Ringed Planet** (rings as time), **Comet** (the tail as time) and **Orrery** (one orbit per Language): all kept time, but none made each repository a visible object of its own.

## Consequences

- The Card needs per-repository Activity and Language Mix, not just per-Language totals.
- Tier thresholds are absolute, so a Nebula means the same thing on every Card; a young history is honestly made of Starlight.
- Only public Nebulae carry their repository name; a private repository's name is never drawn.
