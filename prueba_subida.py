"""Prueba temporal de punta a punta: sube 2 fotos a 'originales', crea filas en fotos y espera al motor."""
import os
import sys
import time
import uuid

import requests

AQUI = os.path.dirname(os.path.abspath(__file__))
BASE = r"D:\Users\Alexander\Pictures\FOTOS PROMO PAPA JEFF 2024\NSL 2024"
FOTOS = [
    ("gabriela", os.path.join(BASE, r"NSL 5to B\GABRIELA\IMG_1798.JPG")),
    ("sayri", os.path.join(BASE, r"NSL 5to A\SAYRI\IMG_2101.JPG")),
]

cfg = {}
for linea in open(os.path.join(AQUI, "pipeline", "motor.env"), encoding="utf-8"):
    linea = linea.strip()
    if linea and not linea.startswith("#") and "=" in linea:
        k, v = linea.split("=", 1)
        cfg[k.strip()] = v.strip()
URL = cfg["SUPABASE_URL"].rstrip("/")
CLAVE = cfg["SUPABASE_SERVICE_ROLE_KEY"]

s = requests.Session()
s.headers["apikey"] = CLAVE
if CLAVE.startswith("eyJ"):
    s.headers["Authorization"] = f"Bearer {CLAVE}"

r = s.get(f"{URL}/rest/v1/campanas", params={"select": "id,nombre", "nombre": "ilike.*Graduación 2026*"}, timeout=30)
r.raise_for_status()
camps = r.json()
print("Campañas:", camps)
if not camps:
    sys.exit("No hay campaña con 'Graduación 2026'")
camp = camps[0]["id"]

ids = {}
for nombre, ruta_local in FOTOS:
    ruta = f"{camp}/prueba-{nombre}-{uuid.uuid4()}.jpg"
    with open(ruta_local, "rb") as f:
        r = s.post(f"{URL}/storage/v1/object/originales/{ruta}", data=f,
                   headers={"Content-Type": "image/jpeg"}, timeout=300)
    print(f"Subida {nombre}: HTTP {r.status_code}")
    r.raise_for_status()
    r = s.post(f"{URL}/rest/v1/fotos", json={"campana_id": camp, "ruta_original": ruta, "producto": "20x30"},
               headers={"Prefer": "return=representation"}, timeout=30)
    print(f"Insert {nombre}: HTTP {r.status_code}")
    r.raise_for_status()
    ids[r.json()[0]["id"]] = nombre

t0 = time.time()
pendientes = dict(ids)
while pendientes and time.time() - t0 < 360:
    time.sleep(15)
    r = s.get(f"{URL}/rest/v1/fotos", params={"select": "id,estado,qa,motivo_excepcion",
                                              "id": f"in.({','.join(pendientes)})"}, timeout=30)
    r.raise_for_status()
    for fila in r.json():
        seg = time.time() - t0
        print(f"  [{seg:.0f}s] {pendientes[fila['id']]}: {fila['estado']}", flush=True)
        if fila["estado"] in ("procesada", "excepcion"):
            sem = (fila.get("qa") or {}).get("semaforo")
            print(f"RESULTADO {pendientes[fila['id']]}: estado={fila['estado']} semaforo={sem} "
                  f"motivo={fila['motivo_excepcion']} segundos={seg:.0f} id={fila['id']}")
            del pendientes[fila["id"]]
for fid, nombre in pendientes.items():
    print(f"RESULTADO {nombre}: no terminó en 6 minutos (id={fid})")
