#!/usr/bin/env python3
"""Parse the existing Quaderno scheda + tutorial HTML into data/recipes.json.
Never invents content: every string comes from the source HTML.

Usage (from anywhere):  python tools/build_recipes.py [SITE_DIR] [OUT_JSON]
Defaults: SITE_DIR = repository root, OUT_JSON = <root>/data/recipes.json.
Requires: beautifulsoup4 (see tools/requirements.txt)."""
import json, re, sys, os
try:
    from bs4 import BeautifulSoup
except ImportError:  # pragma: no cover
    sys.exit('build_recipes.py needs beautifulsoup4:  python -m pip install -r tools/requirements.txt')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = sys.argv[1] if len(sys.argv) > 1 else ROOT
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(SITE, 'data', 'recipes.json')

SECTIONS = [
  {'id': 'italia-squisita', 'num': 'I', 'name': 'Italia Squisita',
   'slugs': ['peperonata-romana', 'spaghetti-imago']},
  {'id': 'ratana', 'num': 'II', 'name': 'Ratanà',
   'slugs': ['padellata-verdure', 'spaghetti-cipollotto', 'gnocchi-sorrentina', 'risotto-zucchine', 'carpaccio-peperoni', 'pappa-pomodoro']},
  {'id': 'masterchef', 'num': 'III', 'name': 'MasterChef Magazine',
   'slugs': ['tartare-trota', 'medaglie-salsiccia', 'fish-and-chips-locatelli', 'medaglioni-cervo', 'colazione-barbieri', 'pernice-ripiena', 'cucina-vegana-locatelli', 'risotto-caprino-lumache']},
]

def soup(fn):
    with open(os.path.join(SITE, fn), encoding='utf-8') as f:
        return BeautifulSoup(f.read(), 'html.parser')

def clean(s):
    return re.sub(r'\s+', ' ', (s or '')).strip()

def txt(el):
    return clean(el.get_text(' ')) if el is not None else ''

def fix_punct(s):
    # get_text(' ') inserts spaces around inline tags; tidy spaces before punctuation
    return re.sub(r'\s+([,.;:!?)»])', r'\1', s)

def bi(parent, sel):
    """IT/EN pair from sibling elements marked data-lang-it / data-lang-en."""
    it = parent.select_one(sel + '[data-lang-it]') if parent else None
    en = parent.select_one(sel + '[data-lang-en]') if parent else None
    if it is None and en is None:
        return None
    return {'it': fix_punct(txt(it)), 'en': fix_punct(txt(en))}

def bi_inner(el):
    """IT/EN pair from spans inside a single element (e.g. <li><span data-lang-it>..)."""
    it = el.find(attrs={'data-lang-it': True}); en = el.find(attrs={'data-lang-en': True})
    if it is None and en is None:
        t = fix_punct(txt(el)); return {'it': t, 'en': t}
    return {'it': fix_punct(txt(it)), 'en': fix_punct(txt(en))}

def pairs_from_lis(ul):
    """Tutorial style: <li data-lang-it>..</li><li data-lang-en>..</li> in order."""
    out, cur = [], None
    for li in ul.find_all('li', recursive=False):
        if li.has_attr('data-lang-it'):
            cur = {'it': fix_punct(txt(li)), 'en': ''}; out.append(cur)
        elif li.has_attr('data-lang-en'):
            if cur is not None and not cur['en']:
                cur['en'] = fix_punct(txt(li))
            else:
                out.append({'it': '', 'en': fix_punct(txt(li))})
        else:
            out.append(bi_inner(li))
    return out

def img_info(img):
    if img is None: return None
    return {'src': img.get('src'), 'alt': clean(img.get('alt')),
            'w': int(img.get('width') or 0) or None, 'h': int(img.get('height') or 0) or None}

def parse_tutorial(fn):
    s = soup(fn)
    hero = s.select_one('section.hero')
    t = {'page': fn}
    t['title'] = bi(hero, 'h1')
    t['kicker'] = bi(hero, 'p.kicker')
    t['lede'] = bi(hero, 'p.lede')
    t['techNote'] = bi(hero, 'p.note')
    chips_it = [fix_punct(txt(c)) for c in hero.select('.meta .chip[data-lang-it]')]
    chips_en = [fix_punct(txt(c)) for c in hero.select('.meta .chip[data-lang-en]')]
    t['meta'] = [{'it': a, 'en': b} for a, b in zip(chips_it, chips_en)]
    groups = []
    for g in s.select('aside.ingredients .group'):
        ul = g.find('ul')
        groups.append({'title': bi(g, '.group-title'), 'items': pairs_from_lis(ul) if ul else []})
    t['ingredients'] = groups
    steps = []
    for art in s.select('section.steps article.step'):
        st = bi(art, 'p.step-text') or {'it': '', 'en': ''}
        st['n'] = txt(art.select_one('.step-num'))
        st['img'] = img_info(art.find('img'))
        steps.append(st)
    t['steps'] = steps
    src = None
    for a in s.select('footer a[href^="http"]'):
        src = a.get('href'); break
    t['footerSource'] = src
    ft = s.select_one('footer')
    t['credits'] = bi(ft, 'p') if ft else None
    return t

def parse_method_block(container):
    """Returns list of {title, intro, steps[]} from ol.steps inside section.method or directly."""
    blocks = []
    methods = container.select('section.method')
    if methods:
        for m in methods:
            h4 = m.find('h4')
            blocks.append({'title': bi_inner(h4) if h4 else None,
                           'intro': bi(m, 'p.gintro'),
                           'steps': [bi_inner(li.select_one('.t') or li) for li in m.select('ol.steps > li')]})
    else:
        for ol in container.select('ol.steps'):
            blocks.append({'title': None, 'intro': None,
                           'steps': [bi_inner(li.select_one('.t') or li) for li in ol.find_all('li', recursive=False)]})
    return blocks

def parse_ing_groups(aside):
    groups = []
    gs = aside.select('.group')
    if gs:
        for g in gs:
            h4 = g.find('h4')
            groups.append({'title': bi_inner(h4) if h4 else None,
                           'intro': bi(g, 'p.gintro'), 'note': bi(g, 'p.gnote'),
                           'items': [bi_inner(li) for li in g.select('ul.ings > li')]})
    else:
        for ul in aside.select('ul.ings'):
            groups.append({'title': None, 'intro': None, 'note': None,
                           'items': [bi_inner(li) for li in ul.find_all('li', recursive=False)]})
    return groups

def parse_notes(aside):
    if aside is None: return []
    return [bi_inner(li) for li in aside.select('ul > li')]

def parse_standard_scheda(slug):
    fn = slug + '.html'; s = soup(fn)
    hero = s.select_one('section.hero-page')
    r = {'scheda': fn}
    r['kicker'] = fix_punct(txt(hero.select_one('p.kicker')))  # mixed; keep both variants below
    k = hero.select_one('p.kicker')
    r['kickerBi'] = {'it': fix_punct(clean(''.join(x if isinstance(x, str) else ('' if x.has_attr('data-lang-en') else x.get_text(' ')) for x in k.contents))),
                     'en': fix_punct(clean(''.join(x if isinstance(x, str) else ('' if x.has_attr('data-lang-it') else x.get_text(' ')) for x in k.contents)))}
    r['title'] = bi(hero, 'h1')
    r['description'] = bi(hero, 'p.lede')
    r['subtitle'] = None
    r['intro'] = None
    r['servingNote'] = bi(hero, 'p.serving')
    a_it = hero.select_one('a.source[data-lang-it]'); a_en = hero.select_one('a.source[data-lang-en]')
    r['source'] = {'url': a_it.get('href') if a_it else (a_en.get('href') if a_en else None),
                   'label': {'it': txt(a_it).replace('↗', '').strip(), 'en': txt(a_en).replace('↗', '').strip()}} if (a_it or a_en) else None
    r['cover'] = img_info(hero.select_one('figure.cover img'))
    grid = s.select_one('div.grid')
    r['ingredients'] = parse_ing_groups(grid.find('aside'))
    r['method'] = parse_method_block(grid)
    r['notes'] = parse_notes(s.select_one('aside.after'))
    ft = s.select_one('footer')
    r['credits'] = bi(ft, 'p')
    tut = s.select_one('a.tut-link')
    r['tutorialPage'] = tut.get('href') if tut else None
    return r

def parse_is_article(slug):
    s = soup('peperonata.html')
    art = s.select_one('article#' + slug)
    r = {'scheda': 'peperonata.html#' + slug}
    r['kickerBi'] = bi_inner(art.select_one('p.kicker'))
    r['kickerBi'] = {'it': 'Italia Squisita · Andrea Antonini · ' + r['kickerBi']['it'],
                     'en': 'Italia Squisita · Andrea Antonini · ' + r['kickerBi']['en']}
    h2 = txt(art.find('h2'))
    r['title'] = {'it': h2, 'en': None}
    r['subtitle'] = bi(art, 'p.eng')
    r['intro'] = bi(art, 'p.intro')
    r['description'] = None
    r['servingNote'] = bi(art, 'p.serving')
    r['cover'] = img_info(art.select_one('figure.cover img'))
    grid = art.select_one('div.grid')
    r['ingredients'] = parse_ing_groups(grid.find('aside'))
    r['method'] = parse_method_block(grid)
    r['notes'] = parse_notes(art.select_one('aside.after'))
    ft = s.select_one('footer')
    fa = ft.select_one('a[href^="http"]')
    r['source'] = {'url': fa.get('href'), 'label': {'it': 'Fonte · ' + txt(fa), 'en': 'Source · ' + txt(ft.select('p')[1].find('a'))}} if fa else None
    ps = ft.select('p')
    r['credits'] = {'it': fix_punct(txt(ps[0])), 'en': fix_punct(txt(ps[1]))}
    ban = art.select_one('a.fooby-banner')
    r['tutorialPage'] = ban.get('href') if ban else None
    return r

def index_blurbs():
    s = soup('index.html'); out = {}
    for card in s.select('.card'):
        a = card.select_one('a.cta.secondary')
        if not a: continue
        href = a.get('href'); slug = href.split('#')[1] if '#' in href else href.replace('.html', '')
        out[slug] = {'title': bi(card, 'h3') or bi(card, '.card-body h3'),
                     'blurb': bi(card, 'p'), 'src': fix_punct(txt(card.select_one('.src')))}
    return out

# --- categories: only when evident from the title (IT or EN), per spec -----
CAT_RULES = [
    ('pasta',     r'\b(spaghetti|rigatoni|gnocchi|pasta)\b'),
    ('risotto',   r'\brisotto\b'),
    ('carne',     r'\b(salsiccia|sausage|cervo|venison|pernice|partridge)\b'),
    ('pesce',     r'\b(trota|trout|fish)\b'),
    ('verdure',   r'(padellata di verdure|sautéed vegetables|\bpeperon\w*|\bpomodoro\b)'),
    ('vegano',    r'\b(vegan[oa]?|vegan)\b'),
    ('colazione', r'\b(colazione|breakfast)\b'),
]
CAT_LABELS = {'pasta': {'it': 'Pasta', 'en': 'Pasta'}, 'risotto': {'it': 'Risotto', 'en': 'Risotto'},
              'carne': {'it': 'Carne', 'en': 'Meat'}, 'pesce': {'it': 'Pesce', 'en': 'Fish'},
              'verdure': {'it': 'Verdure', 'en': 'Vegetables'}, 'vegano': {'it': 'Vegano', 'en': 'Vegan'},
              'colazione': {'it': 'Colazione', 'en': 'Breakfast'}}

NUM_RE = re.compile(r'^\s*(circa\s+|about\s+)?[\d½¼¾]', re.I)

def main():
    blurbs = index_blurbs()
    recipes, report = [], []
    order = 0
    for sec in SECTIONS:
        for slug in sec['slugs']:
            order += 1
            r = parse_is_article(slug) if sec['id'] == 'italia-squisita' else parse_standard_scheda(slug)
            tut = parse_tutorial(r['tutorialPage']) if r.get('tutorialPage') else None
            if tut:
                if not r['title'].get('en'): r['title']['en'] = tut['title']['en']
                if not r['cover'] and tut['steps'] and tut['steps'][-1]['img']:
                    r['cover'] = tut['steps'][-1]['img']
            b = blurbs.get(slug, {})
            if b.get('title'):
                r['shortTitle'] = b['title']
            if not r.get('description') and b.get('blurb'):
                r['description'] = b['blurb']
            titles = ' '.join(filter(None, [r['title'].get('it'), r['title'].get('en'),
                                            (r.get('subtitle') or {}).get('it'), (r.get('subtitle') or {}).get('en'),
                                            (tut or {}).get('title', {}).get('it') if tut else None,
                                            (tut or {}).get('title', {}).get('en') if tut else None]))
            cats = [c for c, rx in CAT_RULES if re.search(rx, titles, re.I)]
            items = [i for g in r['ingredients'] for i in g['items']]
            steps = [st for m in r['method'] for st in m['steps']]
            servings = None
            if tut:
                for m in tut['meta']:
                    mm = re.search(r'(\d+)\s*(porzioni|servings)', m['it'] + ' ' + m['en'])
                    if mm: servings = int(mm.group(1))
            numeric_share = (sum(1 for i in items if NUM_RE.match(i['it'])) / len(items)) if items else 0
            rec = {
                'slug': slug, 'order': order,
                'section': {'id': sec['id'], 'num': sec['num'], 'name': sec['name']},
                'title': r['title'], 'shortTitle': r.get('shortTitle'), 'subtitle': r.get('subtitle'),
                'kicker': r.get('kickerBi'), 'description': r.get('description'), 'intro': r.get('intro'),
                'servingNote': r.get('servingNote'), 'cover': r['cover'], 'source': r.get('source'),
                'credits': r.get('credits'), 'ingredients': r['ingredients'], 'method': r['method'],
                'notes': r['notes'], 'meta': tut['meta'] if tut else [],
                'techNote': tut['techNote'] if tut else None,
                'servings': servings,
                # scaling only if a numeric serving count exists AND most ingredients carry numeric quantities
                'scalable': bool(servings and numeric_share >= 0.6),
                'categories': cats,
                'tutorial': ({'page': tut['page'], 'title': tut['title'], 'lede': tut['lede'],
                              'steps': [{'n': st['n'], 'it': st['it'], 'en': st['en'], 'img': st['img']} for st in tut['steps']]}
                             if tut else None),
                'schedaPage': r['scheda'],
            }
            recipes.append(rec)
            problems = []
            if not items: problems.append('no ingredients')
            if not steps: problems.append('no method steps')
            for i in items + steps:
                if not i['it'] or not i['en']: problems.append('missing IT/EN text'); break
            if not rec['title']['it'] or not rec['title']['en']: problems.append('missing title')
            if not rec['cover']: problems.append('no cover')
            if not rec['source'] or not rec['source']['url']: problems.append('no source link')
            if tut:
                if not tut['steps']: problems.append('tutorial has no steps')
                for st in tut['steps']:
                    if not st['img'] or not os.path.exists(os.path.join(SITE, st['img']['src'])): problems.append('tutorial image missing: %s' % (st['img'] or {}).get('src')); 
                    if not st['it'] or not st['en']: problems.append('tutorial step missing text')
            else:
                problems.append('no tutorial')
            if rec['cover'] and not os.path.exists(os.path.join(SITE, rec['cover']['src'])): problems.append('cover file missing')
            report.append((slug, len(items), len(steps), len(tut['steps']) if tut else 0, len(r['notes']), cats, servings, rec['scalable'], problems))
    data = {'version': 1, 'generatedFrom': 'scheda + tutorial HTML (build_recipes.py)',
            'sections': [{k: v for k, v in s.items() if k != 'slugs'} for s in SECTIONS],
            'categories': [{'id': c, 'label': CAT_LABELS[c]} for c, _ in CAT_RULES if any(c in r['categories'] for r in recipes)],
            'recipes': recipes}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print('%-26s %4s %4s %4s %4s  %-22s %s %s %s' % ('slug', 'ings', 'meth', 'tut', 'note', 'categories', 'serv', 'scal', 'problems'))
    for row in report:
        print('%-26s %4d %4d %4d %4d  %-22s %4s %4s %s' % (row[0], row[1], row[2], row[3], row[4], ','.join(row[5]), row[6], row[7], '; '.join(row[8]) or 'OK'))
    print('recipes:', len(recipes), '->', OUT, os.path.getsize(OUT), 'bytes')

main()
