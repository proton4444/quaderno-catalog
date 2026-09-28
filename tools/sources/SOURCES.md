# External sources for `tools/pairings.db`

| source id | what | licence | how it is fetched / verified |
|---|---|---|---|
| `ahn2011` | Ahn et al. 2011 flavour compounds + official shared-compound pairs | CC BY-NC-SA 3.0 | committed in `tools/flavordata/` (see `SOURCES.md` there); all 221,777 pairs re-verified on every build |
| `wikidata` | item ids, English/Italian labels and aliases, FoodOn cross-references (P6767), food/drink class tree | CC0 1.0 (https://www.wikidata.org/wiki/Wikidata:Licensing) | SPARQL queries in `tools/fetch_sources.py` against https://query.wikidata.org/sparql; the results are **committed** in `wikidata/` and pinned by SHA-256 in `sources.lock.json` (Wikidata changes daily, so a snapshot is what makes the build reproducible) |
| `foodon` | FoodOn food ontology, `foodon-synonyms.tsv` (class, parent, label, synonyms) | CC BY 4.0 (https://github.com/FoodOntology/foodon/blob/master/LICENSE.txt) | downloaded from the pinned release tag `v2025-07-31` (https://raw.githubusercontent.com/FoodOntology/foodon/v2025-07-31/foodon-synonyms.tsv) to `foodon/` (not committed, 10 MB) and checked against the SHA-256 in `fetch_sources.py` |

Wikidata snapshot files:

- `wikidata/candidates.tsv`: every item whose English or Italian label/alias equals one of the looked-up names
  (all Ahn et al. ingredient names, plus the notebook's English and Italian names), with labels, FoodOn id,
  taxon name, number of sitelinks and direct P31/P279 classes.
- `wikidata/food_classes.tsv`: all subclasses of *food* (Q2095) and *drink* (Q40050). An item counts as food if it is an
  instance or subclass of one of these; otherwise it is only accepted when it is a taxon (P225).
- `wikidata/aliases.tsv`: English/Italian aliases of the eligible items (used as synonyms).
- `wikidata/class_labels.tsv`: labels of the food classes, used as a readable category.

`overrides.csv` holds manual decisions (one row per ingredient id: `wikidata` QID or `-` for none, `foodon` id or `-`,
`name_it`, `note`). The build applies them after the automatic matching; see `tools/pairings_review.csv` for the rows that
need a decision.

`names_it.csv` holds the Italian display names of the 1,463 ingredients that are not in the notebook (`id,en,it,origin,note`;
origin `wikidata` = Wikidata label kept, `reviewed` = Wikidata label corrected by hand, `manual` = hand translation).
It is an editorial file of this repository, not a download; the Wikidata labels it started from are in `wikidata/candidates.tsv`.

Attribution when publishing derived data: “Contains data from Wikidata (CC0) and FoodOn (CC BY 4.0,
https://foodon.org); flavour compounds from Ahn et al. 2011 (CC BY-NC-SA 3.0).”
