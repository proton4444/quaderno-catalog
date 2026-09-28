#!/usr/bin/env python3
"""Build the pairings data from the Ahn et al. 2011 aroma-compound table + data/recipes.json.

Notebook mode  data/pairings-v4.json (+ pairings-v2.json, pairings.json: same content)
               the 95 canonical notebook ingredients; pairs among the 67 with aroma data;
               strength = Jaccard of compound sets; recipe co-occurrence kept per pair.
Full mode      data/ing-index.json, data/compounds.json, data/ing/<id>.json
               every dataset ingredient with >= 1 compound: its top 25 partners from the whole
               dataset (~1,500 ingredients), lazily loaded by the page one file per ingredient.

Usage:  python tools/build_pairings.py [--out-dir DIR] [-v]
(stdlib only; paths are relative to the repository root, so it runs the same on Windows/macOS/Linux)
"""
import argparse, collections, itertools, json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from catalog import C, TYPES, STAPLES, EXCLUDE, MAP, UNMAPPED_WHY, norm, ingredient_id  # noqa: E402
from flavordata import load as load_ahn, cname, distinctive  # noqa: E402

SRC = os.path.join(ROOT, 'data', 'recipes.json')
NOTEBOOK_FILES = ('pairings-v4.json', 'pairings-v2.json', 'pairings.json')
N_EX = 4          # example compounds kept per pair (notebook mode)
MIN_SHARED = 1    # notebook mode keeps every pair with >= 1 shared compound
FULL_TOP = 25     # full mode: partners kept per ingredient
FULL_EX = 3       # full mode: example compounds per partner
FULL_POOL_MIN = 3 # full mode: partners must have >= 3 known compounds (or be notebook ingredients) ...
FULL_MIN_SHARED = 2  # ... and share >= 2 compounds (1 if the ingredient itself has a single compound)
FULL_VARIANT = 0.9   # a partner with Jaccard >= 0.9 to an already listed partner is a near-variant and skipped
# Ahn et al. category -> page type (colour); notebook ingredients keep their catalog type
CAT_TYPE = {'vegetable': 'verdure', 'herb': 'erbe', 'fish/seafood': 'mare', 'meat': 'carne', 'dairy': 'latticini',
            'animal product': 'latticini', 'cereal/crop': 'cereali', 'fruit': 'frutta', 'nut/seed/pulse': 'frutta',
            'spice': 'condimenti', 'alcoholic beverage': 'altro', 'plant': 'altro', 'plant derivative': 'altro', 'flower': 'altro'}
VERBOSE = False


def log(*a):
    if VERBOSE:
        print(*a)


def write_json(path, obj, indent=None):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        if indent:
            json.dump(obj, f, ensure_ascii=False, indent=indent)
        else:
            json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))


def build_notebook(A, out_dir, generated_from):
    ing, cat, comp, IC, deg, n_s2 = A['ing'], A['cat'], A['comp'], A['IC'], A['deg'], A['n_s2']
    for k, (a, q, _) in MAP.items(): assert a in IC, (k, a)
    with open(SRC, encoding='utf-8') as f: data = json.load(f)
    recs = data['recipes']
    order = [r['slug'] for r in recs]
    comp_rx = [(c, re.compile(c[4])) for c in C]
    rec_ings = {}
    for r in recs:
        found = set(); texts = []
        for g in r['ingredients']:
            if g.get('title') and g['title'].get('it'): texts.append(g['title']['it'])
            for it in g['items']: texts.append(it['it'])
        for t in texts:
            n = norm(t).strip()
            for c, rx in comp_rx:
                if c[0] in EXCLUDE.get(r['slug'], ()): continue
                if rx.search(n): found.add(c[0])
        rec_ings[r['slug']] = found
    cnt = {c[0]: sum(1 for s in rec_ings if c[0] in rec_ings[s]) for c in C}
    ings = [c for c in C if cnt[c[0]] >= 1]
    ids = [c[0] for c in ings]
    unm = [i for i in ids if i not in MAP]
    for i in unm: assert i in UNMAPPED_WHY, i
    cooc = collections.defaultdict(list)
    for s in order:
        for a, b in itertools.combinations(sorted(rec_ings[s]), 2): cooc[(a, b)].append(s)
    mapped = [i for i in ids if i in MAP]
    CS = {i: IC[MAP[i][0]] for i in mapped}
    out_ing = []; allpairs = []; CL = []; CI = {}
    def cidx(k):
        if k not in CI: CI[k] = len(CL); CL.append(cname(comp[k]))
        return CI[k]
    for c in ings:
        i = c[0]; ms = []
        if i in MAP:
            for o in mapped:
                if o == i: continue
                sh = CS[i] & CS[o]
                if len(sh) < MIN_SHARED: continue
                jac = len(sh) / len(CS[i] | CS[o])
                ex = distinctive(sh, comp, deg, N_EX)
                key = tuple(sorted((i, o)))
                ms.append({'id': o, 'n': len(sh), 'score': round(jac, 4),
                           'ex': [cidx(k) for k in ex], 'staple': False,
                           'recipes': cooc.get(key, [])})
                if i < o: allpairs.append((i, o, len(sh), jac, [cname(comp[k]) for k in ex], cooc.get(key, [])))
            # rank: Jaccard similarity of compound sets, ties by shared count, then name
            ms.sort(key=lambda m: (-m['score'], -m['n'], m['id']))
        e = {'id': i, 'it': c[1], 'en': c[2], 'type': c[3], 'n': cnt[i], 'staple': i in STAPLES,
             'recipes': [s for s in order if i in rec_ings[s]], 'matches': ms}
        if i in MAP:
            e['ahn'] = MAP[i][0]; e['nc'] = len(CS[i])
            if MAP[i][1] != 'exact': e['approx'] = True
        out_ing.append(e)
    # featured drops: mapped ingredients with compound partners first (by #partners, recipes), fill with the rest
    def fkey(x): return (0 if x['matches'] else 1, x['staple'], -x['n'], -len(x['matches']), x['it'])
    ranked = sorted(out_ing, key=fkey)
    featured = [x['id'] for x in ranked][:50]
    # key ingredients ("hubs") for the start ring: mapped, not a staple, used in >=2 catalog recipes;
    # ranked by compound strength = sum of Jaccard scores to all other mapped catalog ingredients;
    # greedy pick: first at most 1 per type, then at most 2 per type, skipping near-duplicates
    # (Jaccard >= 0.5 with an already chosen hub, e.g. cheeses / cured pork); max 12, ring order = pick order.
    E = {x['id']: x for x in out_ing}
    strength = {x['id']: sum(m['score'] for m in x['matches']) for x in out_ing if x['id'] in MAP}
    def jac(a, b):
        for m in E[a]['matches']:
            if m['id'] == b: return m['score']
        return 0
    cand = sorted([i for i in strength if E[i]['n'] >= 2 and not E[i]['staple'] and E[i]['matches']], key=lambda i: (-strength[i], i))
    hubs = []
    for cap in (1, 2):
        for i in cand:
            if len(hubs) >= 12: break
            if i in hubs or sum(1 for h in hubs if E[h]['type'] == E[i]['type']) >= cap: continue
            if any(jac(i, h) >= 0.5 for h in hubs): continue
            hubs.append(i)
    for x in out_ing:
        if x['id'] in strength: x['hub'] = round(strength[x['id']], 3)
    log('HUBS:', [(h, E[h]['type'], E[h]['n'], round(strength[h], 2)) for h in hubs])
    unm_list = [{'id': i, 'it': dict((c[0], c) for c in C)[i][1], 'en': dict((c[0], c) for c in C)[i][2]} for i in unm]
    out = {
        'version': 2,
        'generatedFrom': generated_from,
        'mode': 'compounds',
        'method': {
            'it': 'I fili collegano ingredienti che condividono composti aromatici (il principio del “food pairing” / Flavor Matrix). '
                  'Forza = composti in comune ÷ composti totali dei due (indice di Jaccard), così gli ingredienti ricchissimi di composti '
                  '(vino, birra, cacao, formaggi) non dominano; accanto è indicato il numero di composti in comune. '
                  '“Insieme nel quaderno” elenca le ricette dove i due compaiono davvero insieme.',
            'en': 'Threads link ingredients that share aroma compounds (the “food pairing” / Flavor Matrix principle). '
                  'Strength = shared compounds ÷ all compounds of the two (Jaccard index), so compound-rich ingredients '
                  '(wine, beer, cocoa, cheeses) do not dominate; the shared-compound count is shown alongside. '
                  '“Together in the notebook” lists the recipes where the two actually appear together.'},
        'source': {
            'label': 'Ahn, Ahnert, Bagrow & Barabási (2011), Flavor network and the principles of food pairing, Sci. Rep. 1:196',
            'short': 'Ahn et al. 2011 · Sci. Rep.',
            'url': 'https://doi.org/10.1038/srep00196',
            'license': 'CC BY-NC-SA 3.0', 'licenseUrl': 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
            'files': ['https://media.springernature.com/original/springer-static/esm/art%3A10.1038%2Fsrep00196/MediaObjects/41598_2011_BFsrep00196_MOESM2_ESM.zip',
                      'https://raw.githubusercontent.com/lingcheng99/Flavor-Network/master/data/ingr_comp.tsv (+ ingr_info.tsv, comp_info.tsv)'],
            'verified': 'ingredient–compound table reproduces all %d shared-compound pairs of the official Supplementary Data 2' % n_s2,
            'compounds': len(comp), 'ingredients': len(IC)},
        'mappedCount': len(mapped), 'unmapped': unm_list,
        'recipeCount': len(recs),
        'types': [{'id': t[0], 'it': t[1], 'en': t[2], 'color': t[3]} for t in TYPES],
        'recipes': [{'slug': r['slug'], 'title': r['title'], 'short': r.get('shortTitle') or r['title'], 'cover': (r.get('cover') or {}).get('src')} for r in recs],
        'featured': featured,
        'hubs': hubs,
        'hubRule': {
            'it': 'Ingredienti principali: tra i 67 ingredienti con dati aromatici, quelli usati in almeno 2 ricette del quaderno, ordinati per “forza aromatica” (somma degli indici di Jaccard con tutti gli altri); al massimo uno per tipo, poi due, saltando i quasi-doppioni (Jaccard ≥ 0,5 con uno già scelto). 12 sul computer, i primi 8 sul telefono.',
            'en': 'Key ingredients: among the 67 ingredients with aroma data, those used in at least 2 notebook recipes, ranked by “aroma strength” (sum of Jaccard scores with all the others); at most one per type, then two, skipping near-duplicates (Jaccard ≥ 0.5 with one already chosen). 12 on desktop, the first 8 on phones.'},
        'compounds': CL,
        'ingredients': out_ing,
    }
    # the same content under 3 names: js/pairings.js loads pairings-v4.json (a name no old service-worker cache holds);
    # pairings-v2.json / pairings.json keep older cached pages working. Bump the name when the JS needs new fields.
    for name in NOTEBOOK_FILES:
        write_json(os.path.join(out_dir, 'data', name), out)
    # mapping report
    rep = {'mapped': {i: {'ahn': MAP[i][0], 'quality': MAP[i][1], 'note': MAP[i][2], 'compounds': len(CS[i])} for i in mapped},
           'unmapped': {i: UNMAPPED_WHY[i] for i in unm}}
    write_json(os.path.join(out_dir, 'tools', 'flavordata', 'mapping_report.json'), rep, indent=1)
    log('notebook: catalog ingredients', len(ids), 'mapped', len(mapped), 'unmapped', len(unm), 'pairs', len(allpairs))
    log('UNMAPPED:', ', '.join(unm))
    if VERBOSE:
        for p in sorted(allpairs, key=lambda p: -p[3])[:10]: log('  %-12s %-12s n=%3d J=%.3f %s' % (p[0], p[1], p[2], p[3], p[4]))
    return {'ids': ids, 'mapped': mapped, 'unmapped': unm, 'cnt': cnt, 'rec_ings': rec_ings, 'order': order}


def build_full(A, nb, out_dir):
    """Per-ingredient files for 'Tutti gli ingredienti' mode."""
    comp, IC, deg, cat = A['comp'], A['IC'], A['deg'], A['cat']
    rev = {a: cid for cid, (a, q, _) in MAP.items()}           # Ahn entity -> catalog id
    assert len(rev) == len(MAP), 'two catalog ingredients map to the same dataset entity'
    meta = {c[0]: c for c in C}
    ents = sorted(n for n in IC if IC[n])
    eid = {}
    for n in ents:
        i = ingredient_id(n)
        assert re.fullmatch(r'[a-z0-9-]+', i), i
        eid[n] = i
    assert len(set(eid.values())) == len(eid), 'id collision between catalog ids and dataset slugs'
    cids = sorted(comp)                                        # compound id -> index in compounds.json
    cix = {c: k for k, c in enumerate(cids)}
    bits = {n: sum(1 << cix[c] for c in IC[n]) for n in ents}
    size = {n: len(IC[n]) for n in ents}
    pool = [n for n in ents if size[n] >= FULL_POOL_MIN or n in rev]
    ing_dir = os.path.join(out_dir, 'data', 'ing')
    if os.path.isdir(ing_dir):
        shutil.rmtree(ing_dir)                                 # drop files of ingredients no longer produced
    os.makedirs(ing_dir)
    total = 0; empty = 0
    weak = 0
    for n in ents:
        need = FULL_MIN_SHARED if size[n] >= 2 else 1
        bn = bits[n]
        def candidates(among, need):
            out = []
            for o in among:
                if o == n: continue
                k = (bn & bits[o]).bit_count()
                if k < need: continue
                out.append((k / (size[n] + size[o] - k), k, eid[o], o))
            return out
        cand = candidates(pool, need)
        fb = False
        if not cand:   # fallback: nothing reaches the threshold -> any dataset ingredient sharing >= 1 compound
            cand = candidates(ents, 1); fb = bool(cand)
        cand.sort(key=lambda t: (-t[0], -t[1], t[3] not in rev, len(t[2]), t[2]))
        ms = []; chosen = []
        for jac, k, oid, o in cand:
            if len(chosen) >= FULL_TOP: break
            # skip near-variants of a partner already listed (the dataset has e.g. a dozen almost identical teas)
            bo = bits[o]
            if any((bo & bits[c]).bit_count() >= FULL_VARIANT * (size[o] + size[c] - (bo & bits[c]).bit_count()) for c in chosen):
                continue
            chosen.append(o)
            ex = distinctive(IC[n] & IC[o], comp, deg, FULL_EX)
            ms.append([oid, k, round(jac, 4), [cix[c] for c in ex]])
        if not ms: empty += 1
        weak += fb
        i = eid[n]; nbid = rev.get(n)
        obj = {'id': i, 'en': meta[nbid][2] if nbid else cname(n), 'ahn': n, 'cat': cat[n],
               'type': meta[nbid][3] if nbid else CAT_TYPE.get(cat[n], 'altro'), 'nc': size[n], 'nb': bool(nbid), 'm': ms}
        if fb: obj['fb'] = 1   # weak pairings (fallback rule)
        if nbid: obj['it'] = meta[nbid][1]
        path = os.path.join(ing_dir, i + '.json')
        write_json(path, obj)
        total += os.path.getsize(path)
    # search index: every dataset ingredient + the notebook ingredients without aroma data
    items = []
    for n in ents:
        nbid = rev.get(n)
        if nbid:
            items.append([eid[n], meta[nbid][1], meta[nbid][2], meta[nbid][3], size[n], 1])
        else:
            items.append([eid[n], None, cname(n), CAT_TYPE.get(cat[n], 'altro'), size[n], 0])
    for i in nb['unmapped']:
        items.append([i, meta[i][1], meta[i][2], meta[i][3], 0, 2])
    items.sort(key=lambda r: (-r[5] if r[5] else 0, r[2]))
    index = {'version': 1, 'fields': ['id', 'it', 'en', 'type', 'compounds', 'notebook(1=aroma data,2=no aroma data,0=dataset only)'],
             'top': FULL_TOP,
             'rule': {'it': 'Tutti gli ingredienti: per ogni ingrediente del dataset (Ahn et al. 2011) i %d con indice di Jaccard più alto, tra gli ingredienti con almeno %d composti noti (o del quaderno) che ne condividono almeno %d; le quasi-varianti (Jaccard ≥ 0,9 con uno già in lista, es. decine di tè) sono saltate. Se nessuno raggiunge la soglia, mostro gli ingredienti che ne condividono 1 (abbinamenti deboli).' % (FULL_TOP, FULL_POOL_MIN, FULL_MIN_SHARED),
                      'en': 'All ingredients: for every dataset ingredient (Ahn et al. 2011) the %d with the highest Jaccard index, among ingredients with at least %d known compounds (or in the notebook) sharing at least %d; near-variants (Jaccard ≥ 0.9 with one already listed, e.g. dozens of teas) are skipped. If none reaches the threshold, ingredients sharing 1 compound are shown (weak pairings).' % (FULL_TOP, FULL_POOL_MIN, FULL_MIN_SHARED)},
             'items': items}
    write_json(os.path.join(out_dir, 'data', 'ing-index.json'), index)
    write_json(os.path.join(out_dir, 'data', 'compounds.json'), [cname(comp[c]) for c in cids])
    idx_size = os.path.getsize(os.path.join(out_dir, 'data', 'ing-index.json'))
    cmp_size = os.path.getsize(os.path.join(out_dir, 'data', 'compounds.json'))
    print('full mode: %d ingredient files (%.0f KB, %d without partners, %d with weak pairings only), index %.0f KB, compounds %.0f KB'
          % (len(ents), total / 1024, empty, weak, idx_size / 1024, cmp_size / 1024))
    return {'files': len(ents), 'bytes': total, 'index': idx_size, 'compounds': cmp_size}


def load_from_db(path):
    """Same structure as flavordata.load(), read from pairings.db (source 'ahn2011')."""
    import sqlite3
    if not os.path.exists(path):
        raise SystemExit('%s not found: run  python tools/build_db.py' % path)
    db = sqlite3.connect(path)
    q = lambda sql: db.execute(sql).fetchall()
    ing2ahn = dict(q("SELECT ingredient_id, ext_id FROM xref WHERE source='ahn2011'"))
    cat = {a: c for a, c in q("SELECT x.ext_id, c.code FROM xref x JOIN ingredient_category c ON c.ingredient_id=x.ingredient_id "
                              "AND c.source='ahn2011' WHERE x.source='ahn2011'")}
    comp = dict(q('SELECT id, name FROM compound'))
    IC = collections.defaultdict(set)
    for i, c in q("SELECT ingredient_id, compound_id FROM ingredient_compound WHERE source='ahn2011'"):
        IC[ing2ahn[i]].add(c)
    n_s2 = int(q("SELECT value FROM meta WHERE key='ahn2011_pairs_verified'")[0][0])
    db.close()
    deg = collections.Counter(c for s in IC.values() for c in s)
    return {'ing': dict(enumerate(sorted(ing2ahn.values()))), 'cat': cat, 'comp': comp, 'IC': dict(IC), 'deg': deg, 'n_s2': n_s2}


def main(argv=None):
    global VERBOSE
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--out-dir', default=ROOT, help='write data/ (and the mapping report) under this directory (default: repo root)')
    ap.add_argument('--from-db', nargs='?', const=os.path.join(ROOT, 'tools', 'pairings.db'), default=None, metavar='DB',
                    help='read the ahn2011 source from tools/pairings.db (built by build_db.py) instead of the TSV files')
    ap.add_argument('-v', '--verbose', action='store_true')
    args = ap.parse_args(argv)
    VERBOSE = args.verbose
    A = load_from_db(args.from_db) if args.from_db else load_ahn(verify=True)
    print('flavordata: %d ingredients, %d compounds; all %d official shared-compound pairs verified%s' % (len(A['IC']), len(A['comp']), A['n_s2'],
          ' (when %s was built)' % os.path.basename(args.from_db) if args.from_db else ''))
    nb = build_notebook(A, args.out_dir, 'Ahn et al. 2011 ingredient–compound table + data/recipes.json (tools/build_pairings.py)')
    print('notebook mode: %d ingredients, %d with aroma data, %d without' % (len(nb['ids']), len(nb['mapped']), len(nb['unmapped'])))
    build_full(A, nb, args.out_dir)


if __name__ == '__main__':
    main()
