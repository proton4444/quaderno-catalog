#!/usr/bin/env python3
"""Build tools/pairings.db: one SQLite file with a master ingredient table and per-source pairing scores.

  python tools/fetch_sources.py      # verify / download sources first (FoodOn pinned file, Wikidata snapshot)
  python tools/build_db.py [-o tools/pairings.db]

Stage 1 contents
  ingredient           master table: stable id (= site id), EN/IT names, 9-way category, Wikidata QID, FoodOn id
  synonym              names per ingredient and language, with the source they come from
  ingredient_category  source categories (ahn2011 category, Wikidata food class, FoodOn parent class)
  xref                 how source entities map to the master table (source 'catalog' = notebook ids, 'ahn2011')
  compound, ingredient_compound   Ahn et al. 2011 flavour compounds
  pair_score           pairing scores per source; source 'ahn2011' = shared compounds + Jaccard index
  source, meta         provenance: licences, URLs, checksums, counts
Everything is rebuilt from scratch each run (deterministic: same inputs -> same rows).
Rows needing a human decision are written to tools/pairings_review.csv; decisions go in tools/sources/overrides.csv.
"""
import argparse, collections, csv, json, os, re, sqlite3, sys, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from catalog import C, MAP, UNMAPPED_WHY, ingredient_id  # noqa: E402
from flavordata import load as load_ahn, cname  # noqa: E402
import fetch_sources as fs  # noqa: E402
from build_pairings import CAT_TYPE, load_names_it  # noqa: E402

SRC = fs.SRC
DB = os.path.join(HERE, 'pairings.db')
REVIEW = os.path.join(HERE, 'pairings_review.csv')
OVERRIDES = os.path.join(SRC, 'overrides.csv')

SCHEMA = '''
CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE source(id TEXT PRIMARY KEY, name TEXT NOT NULL, licence TEXT NOT NULL, url TEXT NOT NULL, version TEXT, sha256 TEXT);
CREATE TABLE ingredient(
  id TEXT PRIMARY KEY,              -- stable id, same as the site (catalog id, or Ahn name with '_' -> '-')
  name_en TEXT NOT NULL,
  name_it TEXT,
  name_it_source TEXT,              -- 'catalog' | 'wikidata' | 'reviewed' | 'manual' (see sources/names_it.csv)
  category TEXT NOT NULL,           -- verdure|erbe|mare|carne|latticini|cereali|frutta|condimenti|altro
  in_notebook INTEGER NOT NULL,     -- 1 = one of the notebook (catalog) ingredients
  wikidata TEXT,                    -- QID
  wikidata_match TEXT,              -- unique|ranked|ambiguous|manual  (see README)
  foodon TEXT,                      -- e.g. FOODON_03301453
  foodon_match TEXT,                -- wikidata-P6767|label|exact-synonym|manual
  review TEXT                       -- NULL, or why a human should check this row
);
CREATE TABLE synonym(ingredient_id TEXT NOT NULL REFERENCES ingredient(id), lang TEXT NOT NULL, name TEXT NOT NULL, source TEXT NOT NULL,
  PRIMARY KEY(ingredient_id, lang, name, source)) WITHOUT ROWID;
CREATE TABLE ingredient_category(ingredient_id TEXT NOT NULL REFERENCES ingredient(id), source TEXT NOT NULL, code TEXT NOT NULL, label TEXT,
  PRIMARY KEY(ingredient_id, source, code)) WITHOUT ROWID;
CREATE TABLE xref(source TEXT NOT NULL, ext_id TEXT NOT NULL, ingredient_id TEXT NOT NULL REFERENCES ingredient(id), match TEXT NOT NULL, note TEXT,
  PRIMARY KEY(source, ext_id)) WITHOUT ROWID;
CREATE TABLE compound(id INTEGER PRIMARY KEY, name TEXT NOT NULL, cas TEXT);
CREATE TABLE ingredient_compound(ingredient_id TEXT NOT NULL REFERENCES ingredient(id), compound_id INTEGER NOT NULL REFERENCES compound(id),
  source TEXT NOT NULL, PRIMARY KEY(ingredient_id, compound_id, source)) WITHOUT ROWID;
CREATE TABLE pair_score(source TEXT NOT NULL, a TEXT NOT NULL, b TEXT NOT NULL,   -- a < b; look up both columns
  shared INTEGER, jaccard REAL,     -- ahn2011: shared compounds, Jaccard index
  cooc INTEGER,                     -- recipe co-occurrence count (recipe-based sources; NULL for ahn2011)
  PRIMARY KEY(source, a, b), CHECK(a < b)) WITHOUT ROWID;
CREATE INDEX xref_ing ON xref(ingredient_id);
'''


def fold(s):
    s = unicodedata.normalize('NFKD', s.lower())
    return re.sub(r'\s+', ' ', ''.join(ch for ch in s if not unicodedata.combining(ch))).strip()


def read_tsv(rel):
    with open(os.path.join(SRC, rel), encoding='utf-8', newline='') as f:
        r = csv.reader(f, delimiter='\t', quoting=csv.QUOTE_NONE)
        hdr = next(r)
        return [dict(zip(hdr, row)) for row in r]


def load_foodon():
    """foodon-synonyms.tsv: ?class ?parent ?type ?label (SPARQL-style cells)."""
    lab, par, syn = {}, collections.defaultdict(set), collections.defaultdict(list)
    iri = lambda x: x.strip('<>').rsplit('/', 1)[-1]
    with open(os.path.join(SRC, 'foodon', 'foodon-synonyms.tsv'), encoding='utf-8') as f:
        next(f)
        for line in f:
            c = line.rstrip('\n').split('\t')
            if len(c) < 4:
                continue
            cls, parent, typ, val = iri(c[0]), c[1], c[2].strip('"'), c[3]
            if parent:
                par[cls].add(iri(parent))
            if typ and val:
                m = re.match(r'^"(.*)"(?:@([A-Za-z-]+))?$', val)
                if not m:
                    continue
                text, lang = m.group(1), (m.group(2) or 'en').lower()
                if typ == 'label' and lang.startswith('en'):
                    lab.setdefault(cls, text)
                syn[cls].append((typ, lang, text))
    by_label, by_syn = collections.defaultdict(set), collections.defaultdict(set)
    for cls, text in lab.items():
        if cls.startswith('FOODON_'):
            by_label[fold(text)].add(cls)
    for cls, items in syn.items():
        if cls.startswith('FOODON_'):
            for typ, lang, text in items:
                if typ in ('synonym (exact)', 'label (alternative)') and lang.startswith('en'):
                    by_syn[fold(text)].add(cls)
    return lab, par, syn, by_label, by_syn


def load_overrides():
    if not os.path.exists(OVERRIDES):
        return {}
    with open(OVERRIDES, encoding='utf-8', newline='') as f:
        return {r['id']: r for r in csv.DictReader(f) if r.get('id') and not r['id'].startswith('#')}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('-o', '--out', default=DB)
    ap.add_argument('--review', default=REVIEW)
    a = ap.parse_args()
    if not fs.ensure(verbose=False):
        sys.exit('sources missing or checksum mismatch: run  python tools/fetch_sources.py')
    A = load_ahn(verify=True)                     # verifies all 221,777 official pairs
    IC, comp, cat = A['IC'], A['comp'], A['cat']
    meta = {c[0]: c for c in C}
    rev = {an: cid for cid, (an, q, _) in MAP.items()}

    # ---------- master rows: every Ahn entity + every catalog ingredient ----------
    ing = {}                                       # id -> dict
    for an in sorted(A['ing'].values()):
        i = ingredient_id(an); nb = rev.get(an)
        ing[i] = {'id': i, 'ahn': an, 'nb': nb,
                  'en': meta[nb][2] if nb else cname(an), 'it': meta[nb][1] if nb else None,
                  'cat': meta[nb][3] if nb else CAT_TYPE.get(cat[an], 'altro')}
    for c in C:
        if c[0] not in ing:
            ing[c[0]] = {'id': c[0], 'ahn': None, 'nb': c[0], 'en': c[2], 'it': c[1], 'cat': c[3]}
    assert len(ing) == len(A['ing']) + len(UNMAPPED_WHY), 'master id collision'

    # ---------- Wikidata candidates ----------
    cands = collections.defaultdict(list)          # (lang, folded name) -> candidate rows
    for r in read_tsv('wikidata/candidates.tsv'):
        cands[(r['lang'], fold(r['name']))].append(r)
    food = {r['qid'] for r in read_tsv('wikidata/food_classes.tsv')}
    names_it = load_names_it()
    clab = {r['qid']: (r['label_en'], r['label_it']) for r in read_tsv('wikidata/class_labels.tsv')}
    aliases = collections.defaultdict(list)
    for r in read_tsv('wikidata/aliases.tsv'):
        aliases[r['qid']].append((r['lang'], r['alias']))
    lab, par, fsyn, by_label, by_syn = load_foodon()
    ovr = load_overrides()

    def wd_pick(g):
        """Pick the Wikidata item for ingredient g. Returns (row, how, review, candidates-summary).
        Lookup names: notebook ingredients use their own EN + IT names (the Ahn name only if MAP says 'exact');
        dataset ingredients use the Ahn name. Eligible: food/drink items and taxa. Rank: matches in more languages,
        food over taxon, label over alias, has FoodOn id, more sitelinks."""
        if g['nb']:
            qs = [('en', g['en']), ('it', g['it'])]
            if g['ahn'] and MAP[g['nb']][1] == 'exact': qs.append(('en', cname(g['ahn'])))
        else:
            qs = [('en', cname(g['ahn']))]
        seen = {}
        for lang, s in qs:
            for r in cands.get((lang, fold(s)), []):
                d = seen.setdefault(r['qid'], {'r': r, 'label': False, 'langs': set()})
                d['label'] |= r['match'] == 'label'; d['langs'].add(lang)
        el = []
        for q, d in seen.items():
            r = d['r']; cls = set(r['classes'].split())
            isfood = q in food or bool(cls & food)
            if not (isfood or r['taxon'] or 'Q16521' in cls):
                continue
            el.append(((len(d['langs']), isfood, d['label'], bool(r['foodon']), int(r['sitelinks'] or 0), -int(q[1:])), r, d))
        el.sort(key=lambda t: t[0], reverse=True)
        summ = '; '.join('%s %s (%s%s%s, %s sitelinks)' % (r['qid'], r['label_en'] or r['label_it'], 'food' if k[1] else 'taxon',
                         '' if k[2] else ', alias', ', EN+IT' if k[0] > 1 else '', r['sitelinks']) for k, r, d in el[:4])
        if not el:
            return None, None, 'no Wikidata food/taxon item with this name', summ
        k0, r0, d0 = el[0]
        why = []
        if not k0[2]:
            why.append('matched only through an alias')
        if g['nb'] and k0[0] < 2 and 'it' not in d0['langs'] and any('it' in d['langs'] and d['label'] for k, r, d in el):
            why.append('EN and IT names point to different items')
        if len(el) == 1:
            return r0, 'unique', '; '.join(why) or None, summ
        k1 = el[1][0]
        if k1[:3] == k0[:3] and k1[4] * 2 >= k0[4]:
            why.insert(0, 'several Wikidata items fit equally well')
            return r0, 'ambiguous', '; '.join(why), summ
        return r0, 'ranked', '; '.join(why) or None, summ

    rows, syn, cats, xref, review = [], set(), set(), [], []
    summaries = {}
    stats = collections.Counter()
    for i in sorted(ing):
        g = ing[i]; o = ovr.get(i, {})
        r, how, why, summ = wd_pick(g)
        summaries[i] = summ
        qid = r['qid'] if r else None
        if o.get('wikidata'):
            qid, how, why = (None if o['wikidata'] == '-' else o['wikidata']), 'manual', None
            r = next((x for lst in cands.values() for x in lst if x['qid'] == qid), None) if qid else None
        # FoodOn
        fo, fhow = None, None
        if r and r.get('foodon') and ('FOODON_' + r['foodon']) in lab:
            fo, fhow = 'FOODON_' + r['foodon'], 'wikidata-P6767'
        else:
            for s in [g['en']] + ([cname(g['ahn'])] if g['ahn'] else []):
                hit = by_label.get(fold(s), set())
                if len(hit) == 1:
                    fo, fhow = next(iter(hit)), 'label'; break
                hit = by_syn.get(fold(s), set())
                if len(hit) == 1:
                    fo, fhow = next(iter(hit)), 'exact-synonym'; break
        if o.get('foodon'):
            fo, fhow = (None if o['foodon'] == '-' else o['foodon']), 'manual'
        # Italian name: notebook name wins; else the reviewed name in tools/sources/names_it.csv
        # (a Wikidata label kept as is, a corrected Wikidata label, or a manual translation)
        it, its = g['it'], ('catalog' if g['it'] else None)
        if not it and i in names_it:
            it, its = names_it[i]
        if o.get('name_it'):
            it, its = o['name_it'], 'manual'
        if not qid and not fo:
            why = why or 'no Wikidata or FoodOn match'
        elif not qid:
            why = why or 'no Wikidata match (FoodOn only)'
        if o:
            why = None if o.get('wikidata') or o.get('foodon') else why
        rows.append((i, g['en'], it, its, g['cat'], 1 if g['nb'] else 0, qid, how if qid else None, fo, fhow, why))
        stats['wikidata' if qid else 'no_wikidata'] += 1; stats['foodon' if fo else 'no_foodon'] += 1
        stats['review' if why else 'ok'] += 1
        if g['nb']: stats['nb_wikidata' if qid else 'nb_no_wikidata'] += 1
        if g['ahn']: stats['ahn_wikidata' if qid else 'ahn_no_wikidata'] += 1
        # names
        syn.add((i, 'en', g['en'], 'catalog' if g['nb'] else 'ahn2011'))
        if g['ahn']: syn.add((i, 'en', cname(g['ahn']), 'ahn2011'))
        if g['nb']: syn.add((i, 'it', g['it'], 'catalog'))
        elif i in names_it: syn.add((i, 'it', names_it[i][0], 'names_it'))
        if r and qid:
            if r['label_en']: syn.add((i, 'en', r['label_en'], 'wikidata'))
            if r['label_it']: syn.add((i, 'it', r['label_it'], 'wikidata'))
            for lang, al in aliases.get(qid, []): syn.add((i, lang, al, 'wikidata'))
            for c in sorted(set(r['classes'].split()) & set(clab)):
                cats.add((i, 'wikidata', c, clab[c][0] or clab[c][1] or None))
        if fo:
            if fo in lab: syn.add((i, 'en', lab[fo], 'foodon'))
            for typ, lang, text in fsyn.get(fo, []):
                if typ in ('synonym (exact)', 'label (alternative)'): syn.add((i, lang[:2], text, 'foodon'))
            for p in sorted(par.get(fo, ())):
                cats.add((i, 'foodon', p, lab.get(p)))
        if g['ahn']:
            cats.add((i, 'ahn2011', cat[g['ahn']], cat[g['ahn']]))
            xref.append(('ahn2011', g['ahn'], i, 'exact' if not g['nb'] else MAP[g['nb']][1], None if not g['nb'] else MAP[g['nb']][2]))
        if g['nb']:
            xref.append(('catalog', g['nb'], i, 'id', None if g['ahn'] else 'no aroma data: ' + UNMAPPED_WHY[g['nb']]))
        if why:
            review.append({'id': i, 'name_en': g['en'], 'name_it': it or '', 'in_notebook': 1 if g['nb'] else 0, 'ahn2011_name': g['ahn'] or '',
                           'issue': why, 'wikidata_chosen': qid or '', 'wikidata_candidates': summ, 'foodon_chosen': fo or '',
                           'foodon_label': lab.get(fo, '') if fo else ''})

    # the same Wikidata item / FoodOn class on several ingredients: flag every one of them
    rows = [list(r) for r in rows]
    for col, lab_ in ((6, 'Wikidata item'), (8, 'FoodOn class')):
        use = collections.defaultdict(list)
        for r in rows:
            if r[col] and r[col + 1] != 'manual': use[r[col]].append(r[0])
        for r in rows:
            others = [x for x in use.get(r[col], []) if x != r[0]]
            if others:
                note = 'same %s as %s' % (lab_, ', '.join(others[:3]) + (' …' if len(others) > 3 else ''))
                r[10] = (r[10] + '; ' if r[10] else '') + note
    rows = [tuple(r) for r in rows]
    stats['review'] = sum(1 for r in rows if r[10]); stats['ok'] = len(rows) - stats['review']
    rv = {x['id']: x for x in review}
    for r in rows:
        if r[10] and r[0] not in rv:
            g = ing[r[0]]
            rv[r[0]] = {'id': r[0], 'name_en': r[1], 'name_it': r[2] or '', 'in_notebook': r[5], 'ahn2011_name': g['ahn'] or '',
                        'issue': r[10], 'wikidata_chosen': r[6] or '', 'wikidata_candidates': summaries[r[0]], 'foodon_chosen': r[8] or '',
                        'foodon_label': lab.get(r[8], '') if r[8] else ''}
        elif r[0] in rv:
            rv[r[0]]['issue'] = r[10]
    review = [rv[k] for k in sorted(rv)]

    # ---------- write ----------
    tmp = a.out + '.tmp'
    if os.path.exists(tmp): os.remove(tmp)
    db = sqlite3.connect(tmp)
    db.executescript(SCHEMA)
    lock = fs.read_lock()
    db.executemany('INSERT INTO source VALUES (?,?,?,?,?,?)', [
        ('ahn2011', 'Ahn et al. 2011, Flavor network and the principles of food pairing (Sci Rep 1:196)', 'CC BY-NC-SA 3.0',
         'https://doi.org/10.1038/srep00196', 'Supplementary Data 2 + ingredient-compound tables', 'see tools/flavordata/SOURCES.md'),
        ('wikidata', 'Wikidata (SPARQL snapshot)', 'CC0 1.0', 'https://query.wikidata.org/', lock.get('wikidata/candidates.tsv', {}).get('retrieved'),
         lock.get('wikidata/candidates.tsv', {}).get('sha256')),
        ('foodon', 'FoodOn food ontology (foodon-synonyms.tsv)', 'CC BY 4.0', fs.FOODON['foodon/foodon-synonyms.tsv'][0], fs.FOODON_TAG,
         fs.FOODON['foodon/foodon-synonyms.tsv'][1]),
        ('catalog', 'Quaderno notebook ingredients (tools/catalog.py)', 'see README', 'tools/catalog.py', None, None),
        ('names_it', 'Italian names of the dataset-only ingredients (reviewed Wikidata labels + manual translations)', 'same as the repository',
         'tools/sources/names_it.csv', None, None)])
    db.executemany('INSERT INTO ingredient VALUES (?,?,?,?,?,?,?,?,?,?,?)', rows)
    db.executemany('INSERT INTO synonym VALUES (?,?,?,?)', sorted(syn))
    db.executemany('INSERT INTO ingredient_category VALUES (?,?,?,?)', sorted(cats))
    db.executemany('INSERT INTO xref VALUES (?,?,?,?,?)', sorted(xref))
    db.executemany('INSERT INTO compound VALUES (?,?,?)', [(c, comp[c], None) for c in sorted(comp)])
    cas = {}
    for p in open(os.path.join(HERE, 'flavordata', 'comp_info.tsv'), encoding='utf-8'):
        if p.startswith('#') or not p.strip(): continue
        f = p.rstrip('\r\n').split('\t')
        if len(f) > 2 and f[2]: cas[int(f[0])] = f[2]
    db.executemany('UPDATE compound SET cas=? WHERE id=?', [(v, k) for k, v in sorted(cas.items())])
    db.executemany('INSERT INTO ingredient_compound VALUES (?,?,?)',
                   sorted((ingredient_id(an), c, 'ahn2011') for an, cs in IC.items() for c in cs))
    # ahn2011 pair scores: every pair sharing >= 1 compound
    names = sorted(n for n in IC if IC[n]); ids = {n: ingredient_id(n) for n in names}
    bits = {}
    for n in names:
        b = 0
        for c in IC[n]: b |= 1 << c
        bits[n] = b
    pairs = []
    for x in range(len(names)):
        n = names[x]; bn = bits[n]; sn = len(IC[n])
        for y in range(x + 1, len(names)):
            o = names[y]; k = (bn & bits[o]).bit_count()
            if k:
                p, q = sorted((ids[n], ids[o]))
                pairs.append(('ahn2011', p, q, k, round(k / (sn + len(IC[o]) - k), 6), None))
    pairs.sort()
    db.executemany('INSERT INTO pair_score VALUES (?,?,?,?,?,?)', pairs)
    m = {'schema_version': '1', 'stage': '1', 'ahn2011_pairs_verified': str(A['n_s2']), 'ahn2011_pairs_stored': str(len(pairs)),
         'ingredients': str(len(rows)), 'counts': json.dumps(dict(sorted(stats.items())))}
    db.executemany('INSERT INTO meta VALUES (?,?)', sorted(m.items()))
    db.commit(); db.execute('VACUUM'); db.close()
    os.replace(tmp, a.out)
    with open(a.review, 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(review[0].keys()) if review else ['id'], lineterminator='\n')
        w.writeheader(); w.writerows(review)
    size = os.path.getsize(a.out)
    print('pairings.db: %d ingredients (%d notebook), Wikidata %d, FoodOn %d, review %d; %d ahn2011 pairs; %.1f MB -> %s'
          % (len(rows), sum(1 for r in rows if r[5]), stats['wikidata'], stats['foodon'], stats['review'], len(pairs), size / 1e6,
             os.path.relpath(a.out)))
    print('  notebook: %d/%d with Wikidata; Ahn entities: %d/%d with Wikidata' % (stats['nb_wikidata'], len(C), stats['ahn_wikidata'], len(A['ing'])))
    print('  review list:', os.path.relpath(a.review))


if __name__ == '__main__':
    main()
