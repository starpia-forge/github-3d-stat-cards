---
status: superseded by ADR-0004
---

# Language River is the v1 Card concept

The v1 Card depicts a Subject's Language History as a River flowing across a long Diorama, from their first Activity on the left to today on the right. The River's width is monthly Activity and each Language is a Stream sized by its share. New Languages join as Tributaries, abandoned ones leave as Distributaries, quiet stretches become Shallows, and the right end is a Cut Face showing the latest composition. We chose it because the Card must fill the full width of a GitHub profile README (846px at most). The river is the one metaphor we considered where time runs in reading direction and taking up or putting down a Language has a natural visual. Its animation, water flowing along the Streams, carries meaning and is also the cheapest and most reliable kind of animation an SVG loaded as an image can do.

## Considered Options

- **Vessel** (a pot whose silhouette is Activity): the most personal shape, but vertical, so it wastes a full-width banner.
- **Ring Slab** (tree rings): the cheapest true rotation, but shares become angles and it reads as a 3D donut chart, which already exists.
- **Language Ridges** (one mountain range per Language): the clearest per-Language rise and fall, but no sense of total Activity and the least motion.
- **Split Core / Core Scan** (a drill core showing sediment): the most legible and complete when static, but the least striking; at heart a stacked area chart on a cylinder.
- **Glass Monolith** and **Woven Silk**: the most sensuous materials, but overlapping panes or folds hide parts of the timeline.

## Consequences

- The renderer, the glossary's River terms and the visual tests are all built around this metaphor, so changing the concept means rewriting the renderer, not re-theming it.
