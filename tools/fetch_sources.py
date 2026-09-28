#!/usr/bin/env python3
"""Download + verify the external sources used by tools/build_db.py (pairings.db).

  python tools/fetch_sources.py                    verify everything; download missing pinned files
  python tools/fetch_sources.py --refresh-wikidata re-run the Wikidata SPARQL queries and rewrite the lock
                                                   (results change as Wikidata is edited - review the diff)

Sources (details, licences: tools/sources/SOURCES.md):
  FoodOn   foodon-synonyms.tsv from a pinned release tag, SHA-256 fixed below (CC BY 4.0). Not committed (10 MB):
           downloaded to tools/sources/foodon/ and verified.
  Wikidata SPARQL results (CC0): committed snapshot in tools/sources/wikidata/, SHA-256 in sources.lock.json,
           so the database is reproducible offline and a changed/corrupted snapshot is detected.
stdlib only.
"""
import argparse, datetime, hashlib, json, os, re, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'sources')
LOCK = os.path.join(SRC, 'sources.lock.json')
UA = 'quaderno-catalog-tools/1.0 (https://github.com/proton4444/quaderno-catalog)'
FOODON_TAG = 'v2025-07-31'
FOODON = {'foodon/foodon-synonyms.tsv': (
    'https://raw.githubusercontent.com/FoodOntology/foodon/%s/foodon-synonyms.tsv' % FOODON_TAG,
    '1900fb2c80d834287cfdd0b52a98957b18269e86c197617711bc3a5d8541deb2')}
WD_ENDPOINT = 'https://query.wikidata.org/sparql'
# food / drink class closures: an item counts as food if it is an instance or subclass of one of these
WD_ROOTS = {'Q2095': 'food', 'Q40050': 'drink'}
BATCH = 40


def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 16), b''):
            h.update(chunk)
    return h.hexdigest()


def get(url, data=None, tries=3):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers={'User-Agent': UA, 'Accept': 'application/sparql-results+json'})
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except Exception as e:  # network hiccup / 429: back off and retry
            if k == tries - 1:
                raise
            print('  retry (%s)' % e); time.sleep(5 * (k + 1))


def sparql(q, tries=3):
    for k in range(tries):
        raw = get(WD_ENDPOINT, urllib.parse.urlencode({'query': q}).encode())
        time.sleep(1.0)   # be polite to the public endpoint
        try:
            return json.loads(raw)['results']['bindings']
        except ValueError:  # the endpoint cut the response short (server-side timeout mid-stream)
            if k == tries - 1:
                raise
            print('  retry (truncated response)'); time.sleep(10)


def sparql_split(q, part):
    """Run a candidate query; on repeated timeouts split the VALUES list in halves."""
    try:
        return sparql(q)
    except Exception:
        if len(part) < 2:
            print('  giving up on', part); raise
        h = len(part) // 2; out = []
        for sub in (part[:h], part[h:]):
            vals = ' '.join(lit(s, l) for l, s in sub)
            out += sparql_split(re.sub(r'VALUES \?name \{ .*? \}\n', 'VALUES ?name { %s }\n' % vals.replace('\\', '\\\\'), q, count=1, flags=re.S), sub)
        return out


def v(b, k):
    x = b.get(k)
    return x['value'] if x else ''


def qid(uri):
    return uri.rsplit('/', 1)[-1]


def query_names():
    """(lang, string) pairs to look up: every Ahn et al. ingredient name + catalog EN/IT names."""
    sys.path.insert(0, HERE)
    from catalog import C
    from flavordata import load, cname
    A = load(verify=False)
    names = set()
    for n in A['ing'].values():
        s = cname(n); names.add(('en', s)); names.add(('en', s[:1].upper() + s[1:]))   # taxa are capitalised
    for c in C:
        names.add(('en', c[2])); names.add(('en', c[2].lower())); names.add(('it', c[1])); names.add(('it', c[1].lower()))
    return sorted(names)


def lit(s, lang):
    return '"%s"@%s' % (s.replace('\\', '\\\\').replace('"', '\\"'), lang)


def refresh_wikidata(force=False):
    os.makedirs(os.path.join(SRC, 'wikidata'), exist_ok=True)
    names = query_names()
    rows = []
    print('wikidata: %d name strings' % len(names), flush=True)
    cpath = os.path.join(SRC, 'wikidata', 'candidates.tsv')
    if os.path.exists(cpath) and not force:   # resume: keep the candidates fetched by an interrupted run
        with open(cpath, encoding='utf-8') as f:
            next(f); rows = [l.rstrip('\n').split('\t') for l in f]
        print('  reusing', len(rows), 'candidate rows (use --force to re-query)')
    for k in range(0, len(names), BATCH) if not rows else []:
        vals = ' '.join(lit(s, l) for l, s in names[k:k + BATCH])
        q = '''SELECT ?name ?item ?en ?it ?foodon ?taxon ?sl
  (GROUP_CONCAT(DISTINCT ?c; separator=" ") AS ?cls) WHERE {
  VALUES ?name { %s }
  ?item rdfs:label|skos:altLabel ?name .
  ?item wikibase:sitelinks ?sl .
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en)="en") }
  OPTIONAL { ?item rdfs:label ?it FILTER(LANG(?it)="it") }
  OPTIONAL { ?item wdt:P6767 ?foodon }
  OPTIONAL { ?item wdt:P225 ?taxon }
  OPTIONAL { ?item wdt:P31|wdt:P279 ?c }
} GROUP BY ?name ?item ?en ?it ?foodon ?taxon ?sl''' % vals
        for b in sparql_split(q, names[k:k + BATCH]):
            nm = b['name']
            how = 'label' if nm['value'] == v(b, 'en' if nm['xml:lang'] == 'en' else 'it') else 'alias'
            rows.append([nm['xml:lang'], nm['value'], qid(v(b, 'item')), how, v(b, 'en'), v(b, 'it'), v(b, 'foodon'),
                         v(b, 'taxon'), v(b, 'sl'), ' '.join(sorted(qid(c) for c in v(b, 'cls').split() if c))])
        if (k // BATCH) % 10 == 0: print('  %d/%d' % (min(k + BATCH, len(names)), len(names)), flush=True)
    rows = sorted(set(tuple(r) for r in rows))
    print('wikidata: %d candidate rows' % len(rows), flush=True)
    hdr = ['lang', 'name', 'qid', 'match', 'label_en', 'label_it', 'foodon', 'taxon', 'sitelinks', 'classes']
    with open(os.path.join(SRC, 'wikidata', 'candidates.tsv'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\t'.join(hdr) + '\n')
        for r in rows:
            f.write('\t'.join(x.replace('\t', ' ').replace('\n', ' ') for x in r) + '\n')
    # class closures
    closure = []
    for root, lab in WD_ROOTS.items():
        for b in sparql('SELECT DISTINCT ?c WHERE { ?c wdt:P279* wd:%s }' % root, tries=5):
            closure.append((qid(b['c']['value']), root))
        print('wikidata: %s closure done' % lab, flush=True)
    closure = sorted(set(closure))
    with open(os.path.join(SRC, 'wikidata', 'food_classes.tsv'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('qid\troot\n')
        for c, r in closure:
            f.write('%s\t%s\n' % (c, r))
    # English/Italian aliases (synonyms) of the eligible candidates only: food/drink items and taxa
    food = {c for c, _ in closure}
    elig = sorted({r[2] for r in rows if r[7] or r[2] in food or any(c in food for c in r[9].split())})
    al = []
    for k in range(0, len(elig), 150):
        vals = ' '.join('wd:' + c for c in elig[k:k + 150])
        for b in sparql('SELECT ?item ?a WHERE { VALUES ?item { %s } ?item skos:altLabel ?a FILTER(LANG(?a)="en" || LANG(?a)="it") }' % vals):
            al.append((qid(b['item']['value']), b['a']['xml:lang'], b['a']['value'].replace('\t', ' ')))
    with open(os.path.join(SRC, 'wikidata', 'aliases.tsv'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('qid\tlang\talias\n')
        for r in sorted(set(al)):
            f.write('\t'.join(r) + '\n')
    print('wikidata: %d aliases for %d eligible items' % (len(al), len(elig)))
    # labels of the food classes that candidates point at (used as a readable category)
    food = {c for c, _ in closure}
    used = sorted({c for r in rows for c in r[9].split() if c in food})
    labels = []
    for k in range(0, len(used), 200):
        vals = ' '.join('wd:' + c for c in used[k:k + 200])
        for b in sparql('SELECT ?c ?en ?it WHERE { VALUES ?c { %s } OPTIONAL { ?c rdfs:label ?en FILTER(LANG(?en)="en") } OPTIONAL { ?c rdfs:label ?it FILTER(LANG(?it)="it") } }' % vals):
            labels.append((qid(b['c']['value']), v(b, 'en'), v(b, 'it')))
    with open(os.path.join(SRC, 'wikidata', 'class_labels.tsv'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('qid\tlabel_en\tlabel_it\n')
        for r in sorted(set(labels)):
            f.write('\t'.join(r) + '\n')
    print('wikidata: %d candidate rows, %d food/drink classes, %d class labels' % (len(rows), len(closure), len(labels)))
    lock = read_lock()
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    for fn in ('candidates.tsv', 'food_classes.tsv', 'aliases.tsv', 'class_labels.tsv'):
        lock['wikidata/' + fn] = {'sha256': sha(os.path.join(SRC, 'wikidata', fn)), 'retrieved': stamp, 'url': WD_ENDPOINT}
    write_lock(lock)


def read_lock():
    if os.path.exists(LOCK):
        with open(LOCK, encoding='utf-8') as f:
            return json.load(f)
    return {}


def write_lock(lock):
    with open(LOCK, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(lock, f, indent=1, sort_keys=True); f.write('\n')


def ensure(verbose=True):
    """Download missing pinned files, verify every file against its checksum. Returns True if all OK."""
    ok = True
    for rel, (url, want) in FOODON.items():
        path = os.path.join(SRC, rel)
        if not os.path.exists(path):
            os.makedirs(os.path.dirname(path), exist_ok=True)
            print('downloading', url)
            with open(path + '.part', 'wb') as f:
                f.write(get(url))
            os.replace(path + '.part', path)
        got = sha(path)
        if got != want:
            print('CHECKSUM MISMATCH', rel, got); ok = False
        elif verbose:
            print('ok  ', rel)
    lock = read_lock()
    for rel, meta in sorted(lock.items()):
        path = os.path.join(SRC, rel)
        if not os.path.exists(path):
            print('MISSING', rel, '(run with --refresh-wikidata)'); ok = False
        elif sha(path) != meta['sha256']:
            print('CHECKSUM MISMATCH', rel); ok = False
        elif verbose:
            print('ok  ', rel, '(retrieved %s)' % meta['retrieved'])
    if not lock:
        print('no Wikidata snapshot yet: run with --refresh-wikidata'); ok = False
    return ok


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--refresh-wikidata', action='store_true')
    ap.add_argument('--force', action='store_true', help='with --refresh-wikidata: re-query candidates even if present')
    a = ap.parse_args()
    if a.refresh_wikidata:
        refresh_wikidata(a.force)
    sys.exit(0 if ensure() else 1)


if __name__ == '__main__':
    main()
