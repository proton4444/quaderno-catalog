#!/usr/bin/env python3
"""Static checks for the site (stdlib only):  python tools/check_site.py
- every local href/src in the HTML pages points to an existing file
- every data/*.json parses; data/ing-index.json and data/ing/*.json agree; partner ids resolve
- the data files js/pairings.js loads exist
Exit code 1 on any problem."""
import glob, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = re.compile(r'''(?:href|src)\s*=\s*["']([^"'#]+?)(?:[?#][^"']*)?["']''', re.I)


def rel(p):
    return os.path.relpath(p, ROOT).replace(os.sep, '/')


def check(root=ROOT):
    problems = []
    pages = sorted(glob.glob(os.path.join(root, '*.html')))
    for page in pages:
        with open(page, encoding='utf-8') as f:
            html = f.read()
        for url in REF.findall(html):
            u = url.strip()
            if not u or re.match(r'^(?:[a-z]+:|//|data:|mailto:|tel:|javascript:)', u, re.I) or '{' in u or '+' in u:
                continue
            if not os.path.exists(os.path.join(root, u.lstrip('/'))):
                problems.append('%s: missing %s' % (rel(page), u))
    data = {}
    for p in sorted(glob.glob(os.path.join(root, 'data', '*.json'))):
        try:
            with open(p, encoding='utf-8') as f:
                data[os.path.basename(p)] = json.load(f)
        except ValueError as e:
            problems.append('%s: invalid JSON (%s)' % (rel(p), e))
    js = os.path.join(root, 'js', 'pairings.js')
    if os.path.exists(js):
        with open(js, encoding='utf-8') as f:
            src = f.read()
        for u in sorted(set(re.findall(r"'(data/[a-z0-9\-]+\.json)'", src))):
            if not os.path.exists(os.path.join(root, u)):
                problems.append('js/pairings.js loads missing %s' % u)
    idx = data.get('ing-index.json')
    n_files = 0
    if idx:
        ids = {r[0] for r in idx['items']}
        withfile = {r[0] for r in idx['items'] if r[5] != 2}
        files = {os.path.basename(p)[:-5] for p in glob.glob(os.path.join(root, 'data', 'ing', '*.json'))}
        n_files = len(files)
        for i in sorted(withfile - files):
            problems.append('data/ing/%s.json missing (listed in ing-index.json)' % i)
        for i in sorted(files - withfile):
            problems.append('data/ing/%s.json not listed in ing-index.json' % i)
        ncomp = len(data.get('compounds.json') or [])
        for i in sorted(files & withfile):
            p = os.path.join(root, 'data', 'ing', i + '.json')
            try:
                with open(p, encoding='utf-8') as f:
                    d = json.load(f)
            except ValueError as e:
                problems.append('data/ing/%s.json: invalid JSON (%s)' % (i, e)); continue
            for m in d.get('m', []):
                if m[0] not in ids:
                    problems.append('data/ing/%s.json: unknown partner %s' % (i, m[0]))
                if any(k >= ncomp for k in m[3]):
                    problems.append('data/ing/%s.json: compound index out of range' % i)
    nb = data.get('pairings-v4.json')
    if nb:
        ings = {g['id'] for g in nb['ingredients']}
        for h in nb.get('hubs', []):
            if h not in ings:
                problems.append('pairings-v4.json: hub %s unknown' % h)
        if idx:
            for g in nb['ingredients']:
                if g['id'] not in {r[0] for r in idx['items']}:
                    problems.append('ing-index.json: notebook ingredient %s missing' % g['id'])
    return problems, len(pages), n_files


def main():
    problems, pages, files = check()
    for p in problems:
        print('  PROBLEM', p)
    print('check_site: %d pages, %d ingredient files, %d problems' % (pages, files, len(problems)))
    sys.exit(1 if problems else 0)


if __name__ == '__main__':
    main()
