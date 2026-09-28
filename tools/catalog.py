"""Catalog definitions shared by the build scripts (single place to edit).

C          canonical notebook ingredients: (id, Italian name, English name, type, regex on normalised IT text)
TYPES      the 9 ingredient types (id, IT, EN, colour)
STAPLES    shown faintly
EXCLUDE    per-recipe exclusions where a keyword means something else
MAP        catalog id -> Ahn et al. 2011 ingredient entity (quality 'exact' | 'close', note)
UNMAPPED_WHY  reason for every catalog ingredient deliberately left without aroma data

Adding a new canonical ingredient: add a row to C (regex!), then either MAP it to an entity that exists in
tools/flavordata/ingr_info.tsv (same food only - never guess) or add it to UNMAPPED_WHY. The build fails
loudly if an ingredient found in the recipes is in neither.
"""
import re

TYPES = [
 ('verdure', 'Verdure & ortaggi', 'Vegetables', '#5f7f3a'),
 ('erbe', 'Erbe & aromi', 'Herbs & aromatics', '#2f7d6b'),
 ('mare', 'Pesce & mare', 'Fish & seafood', '#2c5f8a'),
 ('carne', 'Carne', 'Meat', '#8e2f2a'),
 ('latticini', 'Latticini & uova', 'Dairy & eggs', '#c79a3a'),
 ('cereali', 'Cereali, pasta, pane, riso', 'Grains, pasta, bread, rice', '#a8743f'),
 ('frutta', 'Frutta', 'Fruit', '#c0567a'),
 ('condimenti', 'Spezie & condimenti', 'Spices & condiments', '#704a2c'),
 ('altro', 'Altro', 'Other', '#6d6480'),
]
# id, it, en, type, IT regex (matched on normalised IT item text), staple?
C = [
 ('peperoni','Peperoni','Peppers','verdure',r'\bpeperon[ei]\b'),
 ('pomodoro','Pomodoro','Tomato','verdure',r'\bpomodor|\bdatterini\b|\bpassata\b'),
 ('cipolla','Cipolla','Onion','verdure',r'\bcipoll[ae]\b'),
 ('cipollotto','Cipollotto','Spring onion','verdure',r'\bcipollott'),
 ('scalogno','Scalogno','Shallot','verdure',r'\bscalogn'),
 ('aglio','Aglio','Garlic','verdure',r"\baglio\b(?! nero)"),
 ('aglio-nero','Aglio nero','Black garlic','verdure',r'\baglio nero\b'),
 ('melanzana','Melanzana','Aubergine','verdure',r'\bmelanzan'),
 ('zucchine','Zucchine','Courgettes','verdure',r'\bzucchin'),
 ('fiori-zucca','Fiori di zucca','Squash blossoms','verdure',r'\bfiori di zucca\b|zucchine/fiori'),
 ('carciofi','Carciofi','Artichokes','verdure',r'\bcarciof'),
 ('patate','Patate','Potatoes','verdure',r'\bpatat[ae]\b(?! americane)'),
 ('patate-dolci','Patate dolci','Sweet potatoes','verdure',r'\bpatate americane dolci\b'),
 ('piselli','Piselli','Peas','verdure',r'\bpisell'),
 ('funghi','Funghi','Mushrooms','verdure',r'\bfungh'),
 ('spinaci','Spinaci','Spinach','verdure',r'\bspinac'),
 ('cavolo-rosso','Cavolo rosso','Red cabbage','verdure',r'\bcavolo rosso\b'),
 ('indivia','Indivia belga','Belgian endive','verdure',r'\bindivia\b'),
 ('sedano-rapa','Sedano rapa','Celeriac','verdure',r'\bsedano\b'),
 ('olive','Olive','Olives','verdure',r'\bolive\b'),
 ('basilico','Basilico','Basil','erbe',r'\bbasilico\b'),
 ('origano','Origano','Oregano','erbe',r'\borigano\b'),
 ('rosmarino','Rosmarino','Rosemary','erbe',r'\brosmarino\b'),
 ('alloro','Alloro','Bay','erbe',r'\balloro\b'),
 ('maggiorana','Maggiorana','Marjoram','erbe',r'\bmaggiorana\b'),
 ('menta','Menta','Mint','erbe',r'\bmenta\b'),
 ('erba-cipollina','Erba cipollina','Chives','erbe',r'\berba cipollina\b'),
 ('santoreggia','Santoreggia','Savory','erbe',r'\bsantoreggia\b'),
 ('acetosella','Acetosella','Sorrel','erbe',r'\bacetosella\b'),
 ('lemongrass','Lemongrass','Lemongrass','erbe',r'\blemongrass\b'),
 ('trota','Trota','Trout','mare',r'\btrota\b'),
 ('pesce','Pesce','Fish','mare',r'^pesce\b'),
 ('salmone','Salmone','Salmon','mare',r'\bsalmone\b'),
 ('caviale','Caviale','Caviar','mare',r'\bcaviale\b'),
 ('capesante','Capesante','Scallops','mare',r'\bcapesant'),
 ('salsiccia','Salsiccia','Sausage','carne',r'\bsalsiccia\b'),
 ('guanciale','Guanciale','Guanciale','carne',r'\bguanciale\b'),
 ('lardo','Lardo','Lard','carne',r'\blardo\b'),
 ('bacon','Bacon','Bacon','carne',r'\bbacon\b'),
 ('cervo','Cervo','Venison','carne',r'\bcervo\b'),
 ('pernice','Pernice','Partridge','carne',r'\bpernice\b'),
 ('pollo','Fondo di pollo','Chicken stock','carne',r'\bpollo\b'),
 ('burro','Burro','Butter','latticini',r'\bburro\b'),
 ('ricotta','Ricotta','Ricotta','latticini',r'\bricotta\b(?! (vegana|di soia))'),
 ('mozzarella','Mozzarella di bufala','Buffalo mozzarella','latticini',r'\bmozzarella\b'),
 ('formaggio','Formaggio grattugiato','Grated cheese','latticini',r'\bformaggio grattugiato\b'),
 ('taleggio','Taleggio','Taleggio','latticini',r'\btaleggio\b'),
 ('caprino','Caprino','Goat cheese','latticini',r'\bcaprino\b'),
 ('panna','Panna','Cream','latticini',r'\bpanna\b|\bcrema di latte\b'),
 ('latte','Latte','Milk','latticini',r'\blatte\b(?! di soia)'),
 ('uova','Uova','Eggs','latticini',r'\buova\b'),
 ('spaghetti','Spaghetti','Spaghetti','cereali',r'\bspaghetti\b'),
 ('rigatoni','Rigatoni di kamut','Kamut rigatoni','cereali',r'\brigatoni\b'),
 ('gnocchi','Gnocchi','Gnocchi','cereali',r'\bgnocchi\b'),
 ('riso','Riso','Rice','cereali',r'\briso\b'),
 ('pane','Pane','Bread','cereali',r'\bpane\b'),
 ('brioche','Brioche','Brioche','cereali',r'\bbrioche\b'),
 ('polenta','Polenta','Polenta','cereali',r'\bpolenta\b'),
 ('farina','Farina','Flour','cereali',r'\bfarina\b'),
 ('avena','Fiocchi d\'avena','Oat flakes','cereali',r'\bavena\b'),
 ('limone','Limone','Lemon','frutta',r'\blimone\b'),
 ('lime','Lime','Lime','frutta',r'\blime\b'),
 ('mele','Mele','Apples','frutta',r'\bmele\b'),
 ('mango','Mango','Mango','frutta',r'\bmango\b'),
 ('albicocche','Albicocche','Apricots','frutta',r'\balbicocch'),
 ('lamponi','Lamponi','Raspberries','frutta',r'\blamponi\b'),
 ('frutti-bosco','Frutti di bosco','Berries','frutta',r'\bfrutti di bosco\b'),
 ('noci','Noci','Walnuts','frutta',r'\bnoci\b'),
 ('pistacchi','Pistacchi','Pistachios','frutta',r'\bpistacch'),
 ('olio','Olio d\'oliva','Olive oil','condimenti',r'\bolio\b(?! di semi)'),
 ('olio-semi','Olio di semi','Seed oil','condimenti',r'\bolio di semi\b'),
 ('sale','Sale','Salt','condimenti',r'\bsale\b'),
 ('pepe','Pepe','Pepper','condimenti',r'\bpepe\b'),
 ('aceto','Aceto','Vinegar','condimenti',r'\baceto\b'),
 ('peperoncino','Peperoncino','Chilli','condimenti',r'\bpeperoncino\b'),
 ('zenzero','Zenzero','Ginger','condimenti',r'\bzenzero\b'),
 ('paprika','Paprika','Paprika','condimenti',r'\bpaprika\b'),
 ('pimenton','Pimentón de la Vera','Pimentón de la Vera','condimenti',r'\bpimenton\b'),
 ('senape','Semi di senape','Mustard seeds','condimenti',r'\bsenape\b'),
 ('mostarda','Mostarda','Mostarda','condimenti',r'\bmostarda\b'),
 ('rafano','Rafano','Horseradish','condimenti',r'\brafano\b'),
 ('zucchero','Zucchero','Sugar','condimenti',r'\bzucchero\b'),
 ('miele','Miele','Honey','condimenti',r'\bmiele\b'),
 ('cacao','Cacao','Cocoa','condimenti',r'\bcacao\b'),
 ('pesto','Pesto','Pesto','condimenti',r'\bpesto\b'),
 ('brodo','Brodo','Stock','condimenti',r'\bbrodo\b'),
 ('vino-bianco','Vino bianco','White wine','altro',r'\bvino bianco\b'),
 ('birra','Birra','Beer','altro',r'\bbirra\b'),
 ('amarone','Amarone','Amarone','altro',r'\bamarone\b'),
 ('lumache','Lumache','Snails','altro',r'\blumache\b'),
 ('rane','Rane','Frogs','altro',r'\brane\b'),
 ('latte-soia','Latte di soia','Soy milk','altro',r'\blatte di soia\b'),
 ('ricotta-vegana','Ricotta vegana (di soia)','Vegan soy ricotta','altro',r'\bricotta vegana\b'),
 ('elisir','Elisir di rose e sambuco','Rose & elderflower elixir','altro',r'\belisir\b'),
 ('pectina','Pectina','Pectin','altro',r'\bpectina\b'),
]
STAPLES = {'sale','pepe','olio'}   # shown faintly, ranked last
# per-recipe exclusions where a keyword means something else in that text
EXCLUDE = {
 # in "Spaghetti pepe, limone e senape" 'pepe' = the roasted-pepper water/cream (peperoni), not black pepper
 'spaghetti-imago': {'pepe'},
 # vinegar is only used to sterilise egg shells, not eaten
 'colazione-barbieri': {'aceto'},
}

def norm(s):
    s = s.lower().replace('’', "'").replace('à','a').replace('ó','o').replace('ò','o').replace('è','e').replace('é','e')
    s = re.sub(r'\([^)]*\)', ' ', s)        # drop parentheticals (alternatives / notes)
    s = s.split(' — ')[0]                     # drop "— quantità non detta" etc.
    return ' ' + re.sub(r'\s+', ' ', s).strip()

# catalog id -> (Ahn et al. ingredient name, quality, note). quality: 'exact' = same food;
# 'close' = nearest same-food entity in the dataset (different form/cultivar/usage). Anything
# without a same-food entity is left unmapped (no compound pairings) rather than guessed.
MAP = {
 'peperoni': ('bell_pepper', 'exact', ''),
 'pomodoro': ('tomato', 'exact', ''),
 'cipolla': ('onion', 'exact', ''),
 'cipollotto': ('scallion', 'exact', 'spring onion = scallion'),
 'scalogno': ('shallot', 'exact', ''),
 'aglio': ('garlic', 'exact', ''),
 'zucchine': ('zucchini', 'exact', 'only 1 compound in dataset'),
 'carciofi': ('artichoke', 'exact', ''),
 'patate': ('potato', 'exact', ''),
 'patate-dolci': ('sweet_potato', 'exact', ''),
 'piselli': ('pea', 'exact', ''),
 'funghi': ('mushroom', 'exact', ''),
 'cavolo-rosso': ('cabbage', 'close', 'red cabbage -> cabbage'),
 'indivia': ('endive', 'exact', 'Belgian endive'),
 'sedano-rapa': ('celery_root', 'exact', 'celeriac; only 1 compound in dataset'),
 'olive': ('olive', 'exact', ''),
 'basilico': ('basil', 'exact', ''),
 'origano': ('oregano', 'exact', 'only 2 compounds in dataset'),
 'rosmarino': ('rosemary', 'exact', ''),
 'alloro': ('laurel', 'exact', 'bay leaf = Laurus nobilis (dataset entity "laurel")'),
 'maggiorana': ('marjoram', 'exact', ''),
 'menta': ('mint', 'exact', ''),
 'erba-cipollina': ('chive', 'exact', ''),
 'santoreggia': ('savory', 'exact', 'only 1 compound in dataset'),
 'lemongrass': ('lemongrass', 'exact', ''),
 'pesce': ('fish', 'exact', 'generic fish'),
 'salmone': ('salmon', 'exact', ''),
 'caviale': ('caviar', 'exact', ''),
 'capesante': ('scallop', 'exact', ''),
 'salsiccia': ('pork_sausage', 'exact', ''),
 'guanciale': ('cured_pork', 'close', 'guanciale = cured pork cheek -> cured pork'),
 'bacon': ('bacon', 'exact', ''),
 'pollo': ('chicken_broth', 'exact', 'chicken stock; only 1 compound in dataset'),
 'burro': ('butter', 'exact', ''),
 'mozzarella': ('mozzarella_cheese', 'exact', ''),
 'formaggio': ('cheese', 'exact', 'generic grated cheese -> generic cheese'),
 'caprino': ('goat_cheese', 'exact', ''),
 'panna': ('cream', 'exact', ''),
 'latte': ('milk', 'exact', ''),
 'uova': ('egg', 'exact', ''),
 'riso': ('rice', 'exact', ''),
 'pane': ('bread', 'exact', ''),
 'polenta': ('corn_grit', 'close', 'polenta (cornmeal) -> corn grit'),
 'farina': ('wheat', 'close', 'wheat flour -> wheat'),
 'avena': ('oat', 'exact', 'oat flakes -> oat'),
 'limone': ('lemon', 'exact', ''),
 'lime': ('lime', 'exact', ''),
 'mele': ('apple', 'exact', ''),
 'mango': ('mango', 'exact', ''),
 'albicocche': ('apricot', 'exact', ''),
 'lamponi': ('raspberry', 'exact', ''),
 'frutti-bosco': ('berry', 'exact', 'mixed berries -> berry'),
 'noci': ('walnut', 'exact', ''),
 'pistacchi': ('pistachio', 'exact', ''),
 'olio': ('olive_oil', 'exact', 'only 3 compounds in dataset'),
 'olio-semi': ('seed_oil', 'exact', 'only 3 compounds in dataset'),
 'pepe': ('black_pepper', 'exact', ''),
 'aceto': ('vinegar', 'exact', ''),
 'peperoncino': ('cayenne', 'close', 'dried hot chilli -> cayenne'),
 'zenzero': ('ginger', 'exact', ''),
 'senape': ('mustard', 'close', 'mustard seeds -> mustard'),
 'rafano': ('horseradish', 'exact', 'only 2 compounds in dataset'),
 'miele': ('honey', 'exact', ''),
 'cacao': ('cocoa', 'exact', ''),
 'vino-bianco': ('white_wine', 'exact', ''),
 'birra': ('beer', 'exact', ''),
 'amarone': ('red_wine', 'close', 'Amarone (a red wine) -> red wine'),
}
# reasons for the ones deliberately left out
UNMAPPED_WHY = {
 'aglio-nero': 'no entity (fermented black garlic differs from garlic)',
 'melanzana': 'no aubergine/eggplant in dataset',
 'fiori-zucca': 'no squash blossom in dataset',
 'spinaci': 'only dried spinach in dataset',
 'acetosella': 'no sorrel in dataset',
 'trota': 'no trout in dataset',
 'lardo': 'dataset has rendered lard, not cured lardo',
 'cervo': 'no venison in dataset',
 'pernice': 'no partridge in dataset',
 'ricotta': 'no ricotta in dataset',
 'taleggio': 'no taleggio in dataset',
 'spaghetti': 'no pasta in dataset', 'rigatoni': 'no pasta in dataset', 'gnocchi': 'composite (no entity)',
 'brioche': 'composite (no entity)',
 'sale': 'salt has no aroma compounds in dataset',
 'paprika': 'no paprika in dataset', 'pimenton': 'no smoked paprika in dataset',
 'mostarda': 'composite', 'zucchero': 'no sugar in dataset', 'pesto': 'composite', 'brodo': 'unspecified stock',
 'lumache': 'no snails in dataset', 'rane': 'no frogs in dataset',
 'latte-soia': 'no soy milk in dataset', 'ricotta-vegana': 'composite', 'elisir': 'composite', 'pectina': 'no aroma entity',
}


# ---------- stable ingredient ids (site URLs, per-ingredient files, pairings.db master table) ----------
# A notebook ingredient keeps its catalog id; any other Ahn et al. entity gets its name with '_' -> '-',
# plus '-ds' if that would collide with a catalog id. Ids are never renamed once published.
def ingredient_id(ahn_name):
    for cid, (a, q, _) in MAP.items():
        if a == ahn_name:
            return cid
    i = ahn_name.replace('_', '-')
    if i in {c[0] for c in C}:
        i += '-ds'   # e.g. dataset 'cacao' vs catalog 'cacao' (= dataset 'cocoa')
    return i
