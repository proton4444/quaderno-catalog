#!/usr/bin/env python3
"""Rebuild everything and verify it.   python tools/build.py

  1. data/recipes.json      <- scheda + tutorial HTML pages   (tools/build_recipes.py, needs beautifulsoup4)
  2. data/pairings*.json    <- Ahn et al. 2011 data + recipes (tools/build_pairings.py, stdlib)
     data/ing-index.json, data/compounds.json, data/ing/*.json  (full "all ingredients" mode)
  3. static checks          (tools/check_site.py)

Options
  --check          build into a temporary folder and compare with the committed files (changes nothing;
                   exit 1 if anything is out of date) - handy before a push
  --skip-recipes   keep the committed data/recipes.json (e.g. beautifulsoup4 not installed)
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


def outputs(base):
    files = ['data/recipes.json', 'data/ing-index.json', 'data/compounds.json', 'tools/flavordata/mapping_report.json']
    files += ['data/' + n for n in ('pairings-v4.json', 'pairings-v2.json', 'pairings.json')]
    files += [os.path.relpath(p, base).replace(os.sep, '/') for p in glob.glob(os.path.join(base, 'data', 'ing', '*.json'))]
    return set(files)


def main():
    if sys.version_info < (3, 10):
        sys.exit('Python 3.10+ required (found %s)' % sys.version.split()[0])
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--skip-recipes', action='store_true')
    ap.add_argument('-v', '--verbose', action='store_true')
    a = ap.parse_args()
    recipes = not a.skip_recipes
    if recipes and not have_bs4():
        print('NOTE: beautifulsoup4 not installed -> keeping committed data/recipes.json '
              '(install with: python -m pip install -r tools/requirements.txt)')
        recipes = False
    extra = ['-v'] if a.verbose else []
    if not a.check:
        if recipes:
            run([os.path.join(HERE, 'build_recipes.py')])
        run([os.path.join(HERE, 'build_pairings.py')] + extra)
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
        run([os.path.join(HERE, 'build_pairings.py'), '--out-dir', tmp] + extra)
        want, have = outputs(tmp), outputs(ROOT)
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
