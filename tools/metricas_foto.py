#!/usr/bin/env python3
"""Una foto del contador del embudo, y nada más.

POR QUÉ VIVE AQUÍ Y NO EN EL REPOSITORIO DEL CURSO. Dos motivos, los dos medidos:
launchd NO PUEDE LEER dentro de iCloud Drive —lo intenté el 15-sep-2026 y devolvió
«Operation not permitted», que es la protección de macOS—, y aunque pudiera, un
proceso que escribe en iCloud dos veces al día es exactamente lo que genera copias
de conflicto (ver CLAUDE.md del curso). Aquí es un directorio normal, en git.

POR QUÉ ESTO NO ES UN AGENTE. La pregunta que hay que poder contestar es «cuántos
clics hoy», y el contador de la web NO guarda fecha: solo lleva un acumulado. La
única forma de sacar un «hoy» sin tocar el servicio es tener fotos con hora y
restar. Y para eso hace falta que las fotos NO FALTEN.

Un agente que se despierta, razona y apunta puede fallar por diez motivos que no
tienen nada que ver con el dato —una sesión cerrada, un token caducado, un cambio
de modelo—, y cada fallo es un hueco que ya no se recupera. Esto son veinte líneas
que o escriben una fila o no escriben nada, y se pueden arreglar leyéndolas. La
parte lista —mirar la tabla y decir qué ha cambiado— va aparte y puede fallar sin
consecuencias, porque el dato ya está guardado.

Y HAY UNA PROPIEDAD QUE LO SALVA TODO: el contador es ACUMULADO, no por periodo.
Si el portátil está apagado y se pierden dos tomas, no se pierde ni un clic — solo
resolución. La diferencia entre dos fotos cualesquiera sigue siendo exacta.

    python3 tools/metricas_foto.py          → añade una fila
    python3 tools/metricas_foto.py --ver    → enseña lo guardado y las diferencias
"""
import csv, json, os, sys, urllib.request
from datetime import datetime

URL = 'https://nihongo-sensei-metricas.nihongosenseiapp.deno.net/m'
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV = os.path.join(RAIZ, 'metricas', 'historico.csv')
COLS = ['cuando', 'canal', 'visitas', 'ios', 'android', 'clics']


def lee():
    with urllib.request.urlopen(URL, timeout=30) as r:
        return json.loads(r.read().decode('utf-8'))


def guarda(d):
    ahora = datetime.now().astimezone().isoformat(timespec='seconds')
    filas = list(d.get('canales', [])) + [d['total']]
    nuevo = not os.path.exists(CSV)
    with open(CSV, 'a', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        if nuevo:
            w.writerow(COLS)
        for c in filas:
            # El canal va tal cual: si mañana aparece uno nuevo, entra solo.
            w.writerow([ahora, c['canal'], c['visitas'], c['ios'], c['android'], c['clics']])
    return ahora, len(filas)


def ver():
    if not os.path.exists(CSV):
        print('todavía no hay ninguna foto')
        return
    with open(CSV, encoding='utf-8') as f:
        filas = [r for r in csv.DictReader(f) if r['canal'] == 'TOTAL']
    if not filas:
        print('no hay filas de TOTAL')
        return
    print('%-25s %8s %6s %8s %7s' % ('cuando', 'visitas', 'ios', 'android', 'clics'))
    ant = None
    for r in filas:
        linea = '%-25s %8s %6s %8s %7s' % (r['cuando'], r['visitas'], r['ios'], r['android'], r['clics'])
        if ant:
            dc = int(r['clics']) - int(ant['clics'])
            dv = int(r['visitas']) - int(ant['visitas'])
            linea += '   (+%d visitas, +%d clics)' % (dv, dc)
        print(linea)
        ant = r
    if len(filas) < 2:
        print('\nCon una sola foto no hay diferencia que enseñar. La siguiente ya dirá algo.')


if __name__ == '__main__':
    if '--ver' in sys.argv:
        ver()
        raise SystemExit(0)
    try:
        d = lee()
    except Exception as e:
        # Se dice y se sale con error, para que launchd lo deje en su registro. Una
        # foto que falla en silencio es un hueco que nadie sabe que existe.
        print('no se pudo leer el contador: %s' % e, file=sys.stderr)
        raise SystemExit(1)
    cuando, n = guarda(d)
    print('foto guardada %s · %d filas · total %d clics' % (cuando, n, d['total']['clics']))

# ── CÓMO SE PROGRAMA ────────────────────────────────────────────────────────
#   cp tools/com.nihongosensei.metricas.plist ~/Library/LaunchAgents/
#   launchctl load ~/Library/LaunchAgents/com.nihongosensei.metricas.plist
#   launchctl start com.nihongosensei.metricas     # y se COMPRUEBA que escribió
#
# Dispara a las 00:04, 09:07 y 21:07. Las horas no son en punto a proposito: a las
# 09:00 en punto compite con todo lo que el sistema programa a esa hora.
#
# LA DE LAS 00:04 ES LA QUE HACE QUE «HOY» SIGNIFIQUE ALGO. Con solo dos fotos al dia
# no habia ningun corte en el cambio de fecha: la herramienta daba diferencias exactas
# ENTRE FOTOS —que ya es mucho mejor que estimar— pero «los clics de hoy» seguia sin
# poder contestarse, porque habia que restar dos ventanas que se comian parte del dia
# anterior. Lo pidio Paul el 16-sep-2026 preguntando «cuantos clics de hoy» a las
# 00:16, cuando «hoy» tenia dieciseis minutos y la respuesta honesta fue «no se puede».
# El registro queda en /tmp/ns_metricas.log y los errores en /tmp/ns_metricas.err.
