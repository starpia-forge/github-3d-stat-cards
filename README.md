# Milky Way Card

Your GitHub history as a galaxy. Every repository you have committed to becomes a Body on a
Milky Way Band that runs from your first commit (far left, receding into the distance) to today
(nearest). Small projects are Starlight and Stars, larger ones are banded Planets, and the biggest
are Nebulae, all coloured by the Languages they are written in.

<a href="https://github.com/starpia-forge">
  <img src="https://github-3d-stat-cards.vercel.app/api/milky-way?theme=light#gh-light-mode-only" alt="starpia-forge's Milky Way" width="100%">
  <img src="https://github-3d-stat-cards.vercel.app/api/milky-way?theme=dark#gh-dark-mode-only" alt="starpia-forge's Milky Way" width="100%">
</a>

> **This deployment is personal.** The Card above is drawn for its Host, starpia-forge, and the
> deployment only ever draws that one person. There is no `?username=` parameter. To get your
> own Card, fork this repository and deploy your own copy: it takes about five minutes and costs
> nothing on Vercel's Hobby plan.

## Get your own Card

1. **Fork** this repository and edit `card.config.json` in your fork:

   ```json
   {
     "username": "your-github-login",
     "hide": [],
     "private": "off"
   }
   ```

2. **Import** the fork into [Vercel](https://vercel.com/new) and add one environment variable,
   `GITHUB_TOKEN` (see [Tokens](#tokens)). Nothing else needs setting up: the Card keeps its data
   in Vercel's Runtime Cache and refreshes it once a day with Vercel Cron.

   Or use the button. It **copies** this repository into a new one under your account rather
   than forking it, so you will not receive later changes from upstream automatically.

   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fstarpia-forge%2Fgithub-3d-stat-cards&env=GITHUB_TOKEN&envDescription=A%20GitHub%20token%20for%20reading%20your%20contributions&envLink=https%3A%2F%2Fgithub.com%2Fstarpia-forge%2Fgithub-3d-stat-cards%23tokens)

3. **Embed** it in your profile README (the repository named after your login). Replace
   `your-deployment` with your Vercel domain:

   ```html
   <img src="https://your-deployment.vercel.app/api/milky-way?theme=light#gh-light-mode-only" alt="My Milky Way" width="100%">
   <img src="https://your-deployment.vercel.app/api/milky-way?theme=dark#gh-dark-mode-only" alt="My Milky Way" width="100%">
   ```

   The two images follow the theme a Visitor has chosen on GitHub. The first render after a
   deployment can take a few seconds; if you see "Charting the Milky Way…", reload in a minute.

Open `https://your-deployment.vercel.app/` to see the light and dark Cards side by side.

## `card.config.json`

| Field | Required | What it does |
|---|---|---|
| `username` | yes | The GitHub login whose commits the Card maps. Organizations are not supported. |
| `displayName` | no | Replaces the login in the header. Latin characters only: if it contains anything the Card's fonts cannot draw (for example Hangul or CJK), the login is shown instead. Long names are cut with an ellipsis. |
| `hide` | no | Languages to leave out of the colours and the legend, for example `["HTML", "Jupyter Notebook"]`. Bodies stay; a repository whose only Languages are hidden is drawn uncoloured (silver in dark mode, ink in light mode). The remaining shares are renormalised. |
| `private` | no | `off` (default): public Activity only. `owned`: also your own private repositories. `all`: also private repositories of organizations and companies you commit to. Private repository names are never drawn or stored. |

`all` can reveal the language mix of an employer's private code. Use it only if that is fine.

## Tokens

`GITHUB_TOKEN` is the only secret. Create it on the account named in `username`.

| `private` | Token |
|---|---|
| `off` | A [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new) with **Public repositories (read-only)** access and no extra permissions. A classic token with no scopes works too. |
| `owned`, `all` | Try a fine-grained token first: **All repositories**, with read-only **Contents** and **Metadata**. If your private Activity does not appear, use a [classic token](https://github.com/settings/tokens/new) with `repo` and `read:user` instead. |

> **Warning:** the classic `repo` scope also grants *write* access to every repository you can
> reach. The Card only ever reads, but a leaked token could do more. Prefer the fine-grained
> token when it works, keep the token only in Vercel, and give it an expiry date.

With `private` set to `owned` or `all`, the token must belong to `username`. If it belongs to
someone else, no private data is fetched and the Card explains why.

<!-- Token types for owned/all are verified in issue #14; update this section with the result. -->

## URL parameters

| Parameter | Effect |
|---|---|
| `theme=light` / `theme=dark` | Forces a theme. Without it the Card follows the viewer's system setting (`prefers-color-scheme`). |
| `animate=false` | A still frame. The Card also stops moving for Visitors who prefer reduced motion. |

## How it works

- **Data:** your commit contributions, read from GitHub's GraphQL API one contribution year at a
  time (filled in month by month when GitHub's limits cut a year short), summed per repository
  and month. Each repository's Language Mix comes from its current bytes per Language.
- **Time:** the Band blends calendar time with your Activity, so busy stretches get more room;
  quiet runs longer than three months shrink into Rifts.
- **Rendering:** a hand-written one-point perspective projection to SVG, with text drawn as
  paths (Fraunces and Inter), within 100 KB per Card. Narrow images (phones) switch to fewer,
  larger labels.
- **Caching:** the Card is rendered from stored data in milliseconds. Stored data older than
  12 hours is refreshed in the background, and a daily cron refreshes it as well. CDNs and
  GitHub's image proxy cache each Card for 6 hours.

The domain language is in [GLOSSARY.md](GLOSSARY.md) and the decisions in [docs/adr](docs/adr).

## Development

```sh
npm install
npm run check                                  # type check, tests, SVG snapshots, size budget
npx tsx scripts/render-fixture.ts .scratch/out # render the recorded fixture to SVG files
npm run glyphs                                 # rebuild the glyph paths from the fonts
```

## License

[MIT](LICENSE). The glyph paths come from [Fraunces](https://github.com/undercasetype/Fraunces)
and [Inter](https://github.com/rsms/inter), both under the SIL Open Font License 1.1.
