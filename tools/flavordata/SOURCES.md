# Flavour-compound data (Ahn et al. 2011)

Source: Y.-Y. Ahn, S. E. Ahnert, J. P. Bagrow, A.-L. Barabási, *Flavor network and the principles of food pairing*,
Scientific Reports 1:196 (2011), https://doi.org/10.1038/srep00196

Licence: the article and its supplementary data are published under **Creative Commons Attribution-NonCommercial-ShareAlike 3.0**
(CC BY-NC-SA 3.0, https://creativecommons.org/licenses/by-nc-sa/3.0/). Derived files in this repo (`data/pairings*.json`,
`data/ing/*.json`, `data/ing-index.json`, `data/compounds.json`) are therefore also CC BY-NC-SA 3.0: credit the paper, no commercial use,
share alike. The site pages credit the source.

| file | origin | SHA-256 |
|---|---|---|
| `41598_2011_BFsrep00196_MOESM2_ESM.zip` | official Supplementary Data 2 (Springer Nature), contains `srep00196-s2.csv` (ingredient pairs + shared-compound counts) | `89e560416588b60c7a257186e152ecc9a3207437f375b771bf0a8e8e233e3ce2` |
| `ingr_info.tsv` | mirror of the authors' ingredient table (github.com/lingcheng99/Flavor-Network) | `5ff493a5cc680a7d5b1dde013f5de69e36f481affaabe4b24bc2acc9ede5f518` |
| `comp_info.tsv` | mirror, compound table | `17ae9e5034ae0bd8dcb9845af32ddefb88909d0af5bf68d96a7cf399fc1e35cc` |
| `ingr_comp.tsv` | mirror, ingredient→compound links | `54ac1a13c20534ec91981e9f10d90703f78dd4c95a8eae017aea3a1b91085f24` |

URLs are in `tools/fetch_flavordata.py` (`python tools/fetch_flavordata.py [--force]` re-downloads and checks the hashes).

Mirror verification: the three TSVs come from a third-party mirror, so `tools/flavordata.py` (`load(verify=True)`, run by every build)
recomputes the shared-compound count of all 221,777 ingredient pairs from the TSVs and checks each one against the official
`srep00196-s2.csv` inside the zip. The build stops if any pair differs.
