#!/usr/bin/env python3
"""Pone en la web el número de lecciones y de palabras. Uso: python3 tools/cifras_web.py 35 1438
Cambia «N lecciones/lessons» y «1.xxx / 1,xxx» (palabras y frases) en index.html, support.html y terms.html."""
import re,sys,os
L=int(sys.argv[1]); P=int(sys.argv[2])
es=f"{P:,}".replace(',','.'); en=f"{P:,}"
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for f in ('index.html','support.html','terms.html','en.html','terms-of-use.html'):
    p=os.path.join(root,f)
    if not os.path.exists(p): continue
    s=o=open(p,encoding='utf-8').read()
    s=re.sub(r'\b[23]\d (lecciones|lessons)\b',lambda m:f'{L} {m.group(1)}',s)
    s=re.sub(r'(<b>)[23]\d(</b><span data-t="n3">)',lambda m:f'{m.group(1)}{L}{m.group(2)}',s)   # la cifra grande
    s=re.sub(r'(de la 1 a la |1 to )[23]\d\b',lambda m:f'{m.group(1)}{L}',s)
    s=re.sub(r'\b1\.[2-9]\d\d\b(?=\s*(palabras|frases|</b>|\'))',es,s)
    s=re.sub(r'\b1,[2-9]\d\d\b(?=\s*(words|sentences|</b>|\'))',en,s)
    if s!=o: open(p,'w',encoding='utf-8').write(s); print('cambiado',f)
# la fuente unica de las cifras: la lee test/web20_test.mjs (nada de numeros escritos a mano en la prueba)
import json
json.dump({'lecciones': L, 'palabras': P}, open(os.path.join(root, 'cifras.json'), 'w'))
print('cifras.json', L, P)
