#!/usr/bin/env python3
"""Re-download the Ahn et al. 2011 data into tools/flavordata/ and verify SHA-256 checksums.
Only needed if the committed files are missing or you want to re-check them:  python tools/fetch_flavordata.py
(stdlib only; the committed copies are identical to these downloads)."""
import hashlib, os, sys, urllib.request

FD = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'flavordata')
FILES = {
    # official Scientific Reports supplementary file (Supplementary Data 2)
    '41598_2011_BFsrep00196_MOESM2_ESM.zip': ('https://media.springernature.com/original/springer-static/esm/art%3A10.1038%2Fsrep00196/MediaObjects/41598_2011_BFsrep00196_MOESM2_ESM.zip',
                                              '89e560416588b60c7a257186e152ecc9a3207437f375b771bf0a8e8e233e3ce2'),
    # ingredient-compound table (mirror of the authors' data; verified against the official file by tools/flavordata.py)
    'ingr_info.tsv': ('https://raw.githubusercontent.com/lingcheng99/Flavor-Network/master/data/ingr_info.tsv',
                      '5ff493a5cc680a7d5b1dde013f5de69e36f481affaabe4b24bc2acc9ede5f518'),
    'comp_info.tsv': ('https://raw.githubusercontent.com/lingcheng99/Flavor-Network/master/data/comp_info.tsv',
                      '17ae9e5034ae0bd8dcb9845af32ddefb88909d0af5bf68d96a7cf399fc1e35cc'),
    'ingr_comp.tsv': ('https://raw.githubusercontent.com/lingcheng99/Flavor-Network/master/data/ingr_comp.tsv',
                      '54ac1a13c20534ec91981e9f10d90703f78dd4c95a8eae017aea3a1b91085f24'),
}


def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 16), b''):
            h.update(chunk)
    return h.hexdigest()


def main():
    os.makedirs(FD, exist_ok=True)
    force = '--force' in sys.argv
    ok = True
    for name, (url, want) in FILES.items():
        path = os.path.join(FD, name)
        if force or not os.path.exists(path):
            print('downloading', name)
            req = urllib.request.Request(url, headers={'User-Agent': 'quaderno-catalog-tools'})
            with urllib.request.urlopen(req, timeout=60) as r, open(path + '.part', 'wb') as f:
                f.write(r.read())
            os.replace(path + '.part', path)
        got = sha(path)
        print('%-40s %s' % (name, 'OK' if got == want else 'CHECKSUM MISMATCH ' + got))
        ok &= got == want
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
