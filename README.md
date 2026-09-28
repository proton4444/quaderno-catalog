# Quaderno — catalogo ricette

Static site (plain HTML/CSS/JS, no framework, no server code) published with GitHub Pages:
https://proton4444.github.io/quaderno-catalog/

Everything needed to rebuild the generated data lives in this repo (`tools/`). Nothing is invented: recipe data is
parsed from the hand-written pages, pairing data comes from downloaded, checksummed datasets.

## Quick start

```bash
git clone https://github.com/proton4444/quaderno-catalog.git
cd quaderno-catalog
python -m pip install -r tools/requirements.txt   # beautifulsoup4 (only needed to rebuild recipes.json)
python tools/build.py                              # rebuild all generated data + run the site checks
python -m http.server 8000                         # preview at http://localhost:8000/
```

Windows (PowerShell or cmd, Python 3.10+ from python.org, with the `py` launcher):

```bat
git clone https://github.com/proton4444/quaderno-catalog.git
cd quaderno-catalog
py -m pip install -r tools\requirements.txt
py tools\build.py
py -m http.server 8000
```

Then open http://localhost:8000/ (use a real server, not `file://`: pages fetch JSON).

## Structure

| path | what | edited by |
|---|---|---|
| `index.html` | home page with the recipe cards | hand |
| `<slug>.html` | recipe card (“scheda”) | hand |
| `<slug>-tutorial.html` | step-by-step tutorial | hand |
| `steps/<slug>-NN.jpg` | tutorial illustrations | hand |
| `app.html`, `js/app*.js`, `css/app.css` | app view (reads `data/recipes.json`) | hand |
| `pairings.html`, `js/pairings.js`, `css/pairings.css` | “Abbinamenti” (flavour pairings) page | hand |
| `sw.js`, `manifest.webmanifest`, `icons/` | service worker / PWA | hand |
| `data/recipes.json` | all recipes as data | **generated** by `tools/build_recipes.py` |
| `data/pairings-v4.json` (+ `pairings-v2.json`, `pairings.json` legacy copies) | notebook-mode pairings (95 notebook ingredients) | **generated** by `tools/build_pairings.py` |
| `data/ing-index.json`, `data/ing/<id>.json`, `data/compounds.json` | full-dataset mode (1,525 ingredients) | **generated** by `tools/build_pairings.py` |
| `tools/` | build scripts + source datasets (not published: excluded in `_config.yml`) | |
| `vercel.json` | clean-URL rewrites for the Vercel mirror | hand |

Tools:

| script | does |
|---|---|
| `tools/build.py` | runs everything: recipes → pairings → `check_site.py`. `--check` builds into a temp dir and fails if the committed data is out of date; `--skip-recipes`; `-v` |
| `tools/build_recipes.py` | parses scheda + tutorial HTML into `data/recipes.json`. The list of sections/recipes (`SECTIONS`) lives at the top of this file |
| `tools/catalog.py` | the 95-ish canonical notebook ingredients (`C`: id, IT, EN, type, regex), types, staples, `MAP` (notebook id → Ahn ingredient) and `UNMAPPED_WHY` |
| `tools/flavordata.py` | loads the Ahn et al. 2011 tables and verifies all 221,777 pairs against the official supplementary file |
| `tools/fetch_flavordata.py` | re-downloads the source files and checks SHA-256 (`--force` to re-download) |
| `tools/build_pairings.py` | writes notebook-mode and full-mode pairing JSON |
| `tools/check_site.py` | checks local links/images, JSON validity, index ↔ per-ingredient files, JS data URLs |
| `tools/fetch_sources.py`, `tools/build_db.py` | pairing database (see below) |
| `tools/flavordata/` | source data + `SOURCES.md` (licence, URLs, checksums) |

## Pairing database (`tools/pairings.db`)

One SQLite file that collects every pairing source behind a master ingredient table. The site stays static: the
JSON files under `data/` are exported from the database by `tools/build_pairings.py --from-db` (the export is
byte-identical to building straight from the TSV files, which `python tools/build.py --no-db` still does).

```bash
python tools/fetch_sources.py                     # verify sources; downloads the pinned FoodOn file (10 MB, not committed)
python tools/build_db.py                          # -> tools/pairings.db (~12.5 MB, committed) + tools/pairings_review.csv
python tools/build_pairings.py --from-db          # export site JSON from the database
python tools/fetch_sources.py --refresh-wikidata  # re-query Wikidata (snapshot + checksums change; review the diff)
```

`python tools/build.py` runs all of this. The database is deterministic (same inputs → identical file), so
`build.py --check` also detects a stale `pairings.db`. Offline, the committed database is used as is.

Sources and licences (details: `tools/sources/SOURCES.md`, `tools/flavordata/SOURCES.md`):

| source id | provides | licence |
|---|---|---|
| `ahn2011` | flavour compounds, pair scores (shared compounds, Jaccard) | CC BY-NC-SA 3.0 |
| `wikidata` | QIDs, EN/IT labels + aliases, food classes, FoodOn cross-links | CC0 |
| `foodon` | FoodOn class ids, labels, exact synonyms, parent classes | CC BY 4.0 |
| `catalog` | the notebook's ingredients (`tools/catalog.py`) | — |

Schema (stage 1):

| table | columns |
|---|---|
| `ingredient` | `id` (stable, = site id: catalog id or Ahn name with `_`→`-`), `name_en`, `name_it`, `name_it_source`, `category` (the 9 page types), `in_notebook`, `wikidata`, `wikidata_match`, `foodon`, `foodon_match`, `review` |
| `synonym` | `ingredient_id`, `lang`, `name`, `source` |
| `ingredient_category` | `ingredient_id`, `source`, `code`, `label` (Ahn category, Wikidata food class, FoodOn parent) |
| `xref` | `source`, `ext_id`, `ingredient_id`, `match`, `note` (`ahn2011` names and `catalog` ids → master ids) |
| `compound`, `ingredient_compound` | Ahn et al. compounds (`id`, `name`, `cas`) and ingredient ↔ compound links |
| `pair_score` | `source`, `a`, `b` (a < b), `shared`, `jaccard`, `cooc` — `ahn2011`: all 221,777 pairs sharing ≥ 1 compound |
| `source`, `meta` | provenance (licence, URL, version, SHA-256) and counts |

Matching (automatic, conservative): an ingredient is looked up by name (notebook ingredients by their English and
Italian names, dataset ingredients by the Ahn name). Only Wikidata items that are food/drink (subclass of Q2095/Q40050)
or taxa count. `wikidata_match` = `unique` (one candidate), `ranked` (clear winner: matches in both languages, food
over taxon, label over alias, FoodOn link, sitelinks), `ambiguous`, or `manual`. FoodOn comes from Wikidata's P6767
link, else a unique exact label / exact synonym. Anything doubtful gets a `review` reason and a row in
`tools/pairings_review.csv` (with the candidates found); decisions go in `tools/sources/overrides.csv`
(`id,wikidata,foodon,name_it,note`; `-` = none) and win over the automatic choice. Italian names from Wikidata are
stored in the database but **not** used on the site until reviewed.

Example queries:

```sql
-- best ahn2011 partners of tomato ('pomodoro')
SELECT CASE WHEN a='pomodoro' THEN b ELSE a END AS partner, shared, jaccard
FROM pair_score WHERE source='ahn2011' AND (a='pomodoro' OR b='pomodoro') ORDER BY jaccard DESC LIMIT 10;
-- notebook ingredients still waiting for a decision
SELECT id, name_it, review FROM ingredient WHERE in_notebook=1 AND review IS NOT NULL;
```

## Adding a recipe

1. Write `<slug>.html` (copy an existing scheda; keep the same markup: ingredient list, method, notes).
2. Optional: `<slug>-tutorial.html` plus images `steps/<slug>-01.jpg …`, linked from the scheda.
3. Add a card in `index.html` (copy an existing `<article>` card).
4. Add the slug to the right section in `SECTIONS` at the top of `tools/build_recipes.py`.
5. Add clean-URL rewrites for the new pages to `vercel.json` (only matters for Vercel).
6. Run `python tools/build.py -v`. It regenerates `data/recipes.json` and the pairing data and reports problems
   (missing tutorial images, broken links …).
7. Ingredients: pairings only know the canonical ingredients in `tools/catalog.py` (`C`, matched by regex on the
   Italian ingredient text). A new ingredient that matches no regex is simply not on the pairings page. To add it,
   append a row to `C`, then either map it in `MAP` to an entry of `tools/flavordata/ingr_info.tsv` (same food only)
   or give the reason in `UNMAPPED_WHY`. The build stops if a matched ingredient is in neither.
8. Preview, then commit and push (below).

## Publish

```bash
python tools/build.py --check    # must say up to date
git add -A && git commit -m "..." && git push origin main
```

GitHub Pages rebuilds in about a minute. Use plain pushes (no force-push). All links are relative so the site works
under `/quaderno-catalog/`.

### Caching (important when changing JS/CSS/data)

The service worker (`sw.js`) caches pages for offline use. When you change a file:

- bump the query string in the HTML that loads it (e.g. `js/pairings.js?v=5` → `?v=6`);
- if the **shape** of a data file changes, give it a new file name (e.g. `pairings-v6.json`) and update `DATA_URLS` /
  `DATA_V` in `js/pairings.js`, so old code never meets new data;
- bump `VERSION` in `sw.js` (e.g. `quaderno-app-v3` → `v4`) so returning visitors drop old caches.
  Data under `data/pairings*`, `data/ing-index.json`, `data/compounds.json` and `data/ing/` is fetched network-first.

## Pairings page

Two modes (toggle under the type chips, remembered in the browser; `?mode=all` or `?mode=nb` in the URL):

- **Solo quaderno / Notebook only**: the notebook's ingredients; every pair sharing at least one aroma compound,
  ranked by Jaccard (shared ÷ union of compounds), plus recipes where they appear together.
- **Tutti gli ingredienti / All ingredients**: all 1,525 ingredients of the dataset (loaded lazily, one small JSON
  file per ingredient). Per ingredient the top 25 partners by Jaccard; partners need ≥ 3 known compounds (or be in the
  notebook) and ≥ 2 shared compounds; near-duplicates (Jaccard ≥ 0.9 with a partner already listed) are skipped. If nothing reaches the threshold, partners sharing 1 compound are shown as "weak pairings"; 18 ingredients share no compound with any other and say so.
  Ingredients not in the notebook are drawn pale with a dashed outline and labelled “non nel quaderno”.

Sizes: 1,525 files ≈ 1.13 MB in total (median ≈ 0.9 KB), index 81 KB, compounds 25 KB.

## Licences

- Recipe texts and illustrations are not covered by the data licence below; ask the repository owner before reusing them.
- Pairing data derives from Ahn et al., *Flavor network and the principles of food pairing*, Sci. Rep. 1:196 (2011),
  CC BY-NC-SA 3.0 — see `tools/flavordata/SOURCES.md`. The generated pairing JSON is shared under the same licence
  (attribution, non-commercial, share-alike).
