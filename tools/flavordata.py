"""Load + verify the Ahn et al. (2011) flavour-network data in tools/flavordata/.

Files (see flavordata/SOURCES.md for URLs, checksums, licence):
  ingr_info.tsv   id <TAB> ingredient name <TAB> category        (1,530 ingredients)
  comp_info.tsv   id <TAB> compound name <TAB> CAS number         (1,107 compounds)
  ingr_comp.tsv   ingredient id <TAB> compound id                  (36,781 links)
  41598_2011_BFsrep00196_MOESM2_ESM.zip  official Supplementary Data 2 (srep00196-s2.csv:
                  every ingredient pair with its number of shared compounds)
load() recomputes every shared-compound count from the TSV table and requires a 100% match with the
official supplementary file, so a corrupted / edited table can never silently produce pairings.
"""
import collections, io, os, zipfile

FD = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'flavordata')
S2_ZIP = '41598_2011_BFsrep00196_MOESM2_ESM.zip'


def _rows(name):
    with open(os.path.join(FD, name), encoding='utf-8') as f:
        for line in f:
            if line.startswith('#') or not line.strip():
                continue
            yield line.rstrip('\r\n').split('\t')


def load(verify=True):
    ing, cat = {}, {}
    for i, n, c in _rows('ingr_info.tsv'):
        ing[int(i)] = n; cat[n] = c
    comp = {}
    for p in _rows('comp_info.tsv'):
        comp[int(p[0])] = p[1]
    IC = collections.defaultdict(set)
    for a, b in _rows('ingr_comp.tsv'):
        IC[ing[int(a)]].add(int(b))
    n_s2 = 0
    if verify:
        bad = 0
        with zipfile.ZipFile(os.path.join(FD, S2_ZIP)) as z:
            with z.open('srep00196-s2.csv') as raw:
                for line in io.TextIOWrapper(raw, encoding='utf-8'):
                    if line.startswith('#') or not line.strip():
                        continue
                    a, b, w = line.strip().split(',')
                    n_s2 += 1
                    if len(IC.get(a, set()) & IC.get(b, set())) != int(w):
                        bad += 1
        if bad or n_s2 == 0:
            raise SystemExit('flavordata: ingredient-compound table disagrees with official s2 (%d of %d pairs)' % (bad, n_s2))
    deg = collections.Counter(c for s in IC.values() for c in s)  # compound -> #ingredients containing it
    return {'ing': ing, 'cat': cat, 'comp': comp, 'IC': dict(IC), 'deg': deg, 'n_s2': n_s2}


def cname(s):
    return s.replace('_', ' ').replace(',  ', ', ').strip()


def distinctive(shared, comp, deg, k):
    """k example compounds: rarest across the dataset first, readable (short) names preferred."""
    return sorted(shared, key=lambda c: (len(comp[c]) > 26, deg[c], comp[c]))[:k]
