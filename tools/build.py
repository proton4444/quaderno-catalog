#!/usr/bin/env python3
"""Rebuild everything and verify it.   python tools/build.py

  1. data/recipes.json      <- scheda + tutorial HTML pages   (tools/build_recipes.py, needs beautifulsoup4)
  2. tools/pairings.db      <- Ahn et al. 2011 + Wikidata snapshot + FoodOn (tools/fetch_sources.py, tools/build_db.py)
     tools/pairings_review.csv  rows that need a human decision
  3. data/pairings*.json    <- pairings.db + recipes (tools/build_pairings.py --from-db, stdlib)
     data/ing-index.json, data/compounds.json, data/ing/*.json  (full "all ingredients" mode)
  4. static checks          (tools/check_site.py)
If the FoodOn file cannot be downloaded (offline), step 2 is skipped and the committed tools/pairings.db is used.

Options
  --check          build into a temporary folder and compare with the committed files (changes nothing;
                   exit 1 if anything is out of date) - handy before a push
  --skip-recipes   keep the committed data/recipes.json (e.g. beautifulsoup4 not installed)
  --no-db          skip pairings.db; build the site data straight from tools/flavordata/*.tsv (same output)
  -v               verbose pairing report
Works from any working directory on Windows, macOS and Linux (Python 3.10+)."""
import argparse, filecmp, glob, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PY = sys.executable


def run(args):
    print('\n$ python ' + ' '.join(os.path.relpath(a, ROOT) if os.path.isabs(a) else a for a in args), flush=True)
    r = subprocess.run([PY] + args, cwd=ROOT)
    if r.returncode:
        sys.exit('build step failed: %s' % ' '.join(args))


def have_bs4():
    try:
        import bs4  # noqa: F401
        return True
    except ImportError:
        return False


def outputs(base, with_db=False):
    files = ['data/recipes.json', 'data/ing-index.json', 'data/compounds.json', 'tools/flavordata/mapping_report.json']
    if with_db:
        files += ['tools/pairings.db', 'tools/pairings_review.csv']
    files += ['data/' + n for n in ('pairings-v4.json', 'pairings-v2.json', 'pairings.json')]
    files += [os.path.relpath(p, base).replace(os.sep, '/') for p in glob.glob(os.path.join(base, 'data', 'ing', '*.json'))]
    return set(files)


def main():
    if sys.version_info < (3, 10):
        sys.exit('Python 3.10+ required (found %s)' % sys.version.split()[0])
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--skip-recipes', action='store_true')
    ap.add_argument('--no-db', action='store_true')
    ap.add_argument('-v', '--verbose', action='store_true')
    a = ap.parse_args()
    recipes = not a.skip_recipes
    if recipes and not have_bs4():
        print('NOTE: beautifulsoup4 not installed -> keeping committed data/recipes.json '
              '(install with: python -m pip install -r tools/requirements.txt)')
        recipes = False
    extra = ['-v'] if a.verbose else []
    DB = os.path.join(HERE, 'pairings.db')
    sources_ok = False
    if not a.no_db:
        print('\n$ python tools/fetch_sources.py', flush=True)
        sources_ok = subprocess.run([PY, os.path.join(HERE, 'fetch_sources.py')], cwd=ROOT).returncode == 0
        if not sources_ok:
            print('NOTE: sources unavailable -> using the committed tools/pairings.db' if os.path.exists(DB) else
                  'NOTE: sources unavailable and no tools/pairings.db -> building from the TSV files')
    use_db = not a.no_db and (sources_ok or os.path.exists(DB))
    if not a.check:
        if recipes:
            run([os.path.join(HERE, 'build_recipes.py')])
        if sources_ok:
            run([os.path.join(HERE, 'build_db.py')])
        run([os.path.join(HERE, 'build_pairings.py')] + (['--from-db', DB] if use_db else []) + extra)
        run([os.path.join(HERE, 'check_site.py')])
        print('\nOK - rebuilt. Preview:  python -m http.server 8000   then open http://localhost:8000/')
        return
    tmp = tempfile.mkdtemp(prefix='qc-check-')
    try:
        if recipes:
            run([os.path.join(HERE, 'build_recipes.py'), ROOT, os.path.join(tmp, 'data', 'recipes.json')])
        else:
            os.makedirs(os.path.join(tmp, 'data'), exist_ok=True)
            shutil.copy2(os.path.join(ROOT, 'data', 'recipes.json'), os.path.join(tmp, 'data', 'recipes.json'))
        db = DB
        if sources_ok:
            os.makedirs(os.path.join(tmp, 'tools'), exist_ok=True)
            db = os.path.join(tmp, 'tools', 'pairings.db')
            run([os.path.join(HERE, 'build_db.py'), '-o', db, '--review', os.path.join(tmp, 'tools', 'pairings_review.csv')])
        run([os.path.join(HERE, 'build_pairings.py'), '--out-dir', tmp] + (['--from-db', db] if use_db else []) + extra)
        want, have = outputs(tmp, sources_ok), outputs(ROOT, sources_ok)
        diff = sorted(f for f in want | have if f not in want or f not in have or
                      not filecmp.cmp(os.path.join(tmp, f), os.path.join(ROOT, f), shallow=False))
        run([os.path.join(HERE, 'check_site.py')])
        if diff:
            print('\nOUT OF DATE (%d files) - run  python tools/build.py  and commit:' % len(diff))
            for f in diff[:30]:
                print('  ', f)
            sys.exit(1)
        print('\nOK - committed data is up to date with the sources.')
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
