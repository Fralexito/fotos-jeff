"""
Motor de edición de Fotos Jeff: corre en la PC del estudio y procesa las fotos que el panel sube.

El panel guarda la foto en el bucket "originales" y crea la fila en `fotos` con estado 'subida'.
Este motor la toma (tomar_fotos, sin chocar con otra PC), la edita con pipeline_fotos.procesar,
sube el resultado al bucket "procesadas" y deja en la fila el semáforo, las alertas y la vista
previa. Verde -> 'procesada'; amarillo o rojo -> 'excepcion' para que una persona la revise.

Uso (Windows, en la carpeta del motor):  python motor.py
Config en motor.env (no se sube a GitHub):
    SUPABASE_URL=https://xxxx.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=...        # solo en esta PC, nunca en la web
    MODELO_ONNX=isnet.onnx               # opcional: PCs sin tarjeta gráfica
    MODELO_CARA=face_landmarker.task     # se descarga solo si falta
"""
from __future__ import annotations

import json
import os
import socket
import sys
import tempfile
import time
import traceback
import urllib.request
from datetime import datetime, timezone

import requests
from PIL import Image

import pipeline_fotos as pf

AQUI = os.path.dirname(os.path.abspath(__file__))
URL_CARA = ("https://storage.googleapis.com/mediapipe-models/face_landmarker/"
            "face_landmarker/float16/1/face_landmarker.task")
ESPERA_S = 5          # sin trabajo: cada cuánto vuelve a mirar la cola
LADO_VISTA = 1200     # alto de la vista previa para el panel


def leer_config() -> dict:
    cfg = dict(os.environ)
    ruta = os.path.join(AQUI, "motor.env")
    if os.path.exists(ruta):
        for linea in open(ruta, encoding="utf-8"):
            linea = linea.strip()
            if linea and not linea.startswith("#") and "=" in linea:
                k, v = linea.split("=", 1)
                cfg.setdefault(k.strip(), v.strip())
    for k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"):
        if not cfg.get(k):
            sys.exit(f"Falta {k} en motor.env")
    return cfg


class Supabase:
    def __init__(self, url: str, clave: str):
        self.url = url.rstrip("/")
        self.s = requests.Session()
        self.s.headers.update({"apikey": clave, "Authorization": f"Bearer {clave}"})

    def rpc(self, nombre: str, **args):
        r = self.s.post(f"{self.url}/rest/v1/rpc/{nombre}", json=args, timeout=30)
        r.raise_for_status()
        return r.json()

    def actualizar_foto(self, foto_id: str, campos: dict):
        r = self.s.patch(f"{self.url}/rest/v1/fotos", params={"id": f"eq.{foto_id}"}, json=campos,
                         headers={"Prefer": "return=minimal"}, timeout=30)
        r.raise_for_status()

    def bajar(self, bucket: str, ruta: str, destino: str):
        with self.s.get(f"{self.url}/storage/v1/object/{bucket}/{ruta}", stream=True, timeout=120) as r:
            r.raise_for_status()
            with open(destino, "wb") as f:
                for trozo in r.iter_content(1 << 20):
                    f.write(trozo)

    def subir(self, bucket: str, ruta: str, archivo: str):
        with open(archivo, "rb") as f:
            r = self.s.post(f"{self.url}/storage/v1/object/{bucket}/{ruta}", data=f, timeout=300,
                            headers={"Content-Type": "image/jpeg", "x-upsert": "true"})
        r.raise_for_status()


def vista_previa(origen: str, destino: str):
    im = Image.open(origen)
    im.thumbnail((LADO_VISTA, LADO_VISTA))
    im.save(destino, quality=85)


def procesar_foto(sb: Supabase, foto: dict, cfg: dict):
    fid, camp = foto["id"], foto["campana_id"]
    fondo = tuple(int(v) / 255 for v in foto["fondo_rgb"].split(","))
    medidas = [m.strip() for m in foto["producto"].split(",") if m.strip()] or ["15x21"]
    with tempfile.TemporaryDirectory() as tmp:
        ext = os.path.splitext(foto["ruta_original"])[1] or ".jpg"
        original = os.path.join(tmp, "original" + ext)
        sb.bajar("originales", foto["ruta_original"], original)
        salidas, qas = {}, {}
        for med in medidas:
            local = os.path.join(tmp, f"{med}.jpg")
            qas[med] = pf.procesar(original, local, med, fondo_rgb=fondo,
                                   modelo_onnx=cfg.get("MODELO_ONNX") or None,
                                   modelo_cara=cfg["MODELO_CARA"])
            ruta = f"{camp}/{fid}_{med}.jpg"
            sb.subir("procesadas", ruta, local)
            salidas[med] = ruta
        principal = medidas[0]
        vista = os.path.join(tmp, "vista.jpg")
        vista_previa(os.path.join(tmp, f"{principal}.jpg"), vista)
        ruta_vista = f"{camp}/vistas/{fid}.jpg"
        sb.subir("procesadas", ruta_vista, vista)

    # la foto vale lo que su peor medida
    orden = {"verde": 0, "amarillo": 1, "rojo": 2}
    semaforo = max((q["semaforo"] for q in qas.values()), key=orden.get)
    alertas = sorted({a for q in qas.values() for a in q["alertas"]})
    qa = dict(qas[principal], semaforo=semaforo, alertas=alertas, salidas=salidas,
              por_medida={m: dict(semaforo=q["semaforo"], alertas=q["alertas"]) for m, q in qas.items()})
    sb.actualizar_foto(fid, dict(
        estado="procesada" if semaforo == "verde" else "excepcion",
        motivo_excepcion="; ".join(alertas) or None,
        ruta_procesada=salidas[principal], ruta_vista=ruta_vista,
        qa=json.loads(json.dumps(qa, default=str)),
        procesada_en=datetime.now(timezone.utc).isoformat()))
    return semaforo, alertas


def main():
    cfg = leer_config()
    cfg.setdefault("MODELO_CARA", os.path.join(AQUI, "face_landmarker.task"))
    if not os.path.isabs(cfg["MODELO_CARA"]):
        cfg["MODELO_CARA"] = os.path.join(AQUI, cfg["MODELO_CARA"])
    if cfg.get("MODELO_ONNX") and not os.path.isabs(cfg["MODELO_ONNX"]):
        cfg["MODELO_ONNX"] = os.path.join(AQUI, cfg["MODELO_ONNX"])
    if not os.path.exists(cfg["MODELO_CARA"]):
        print("Descargando el detector de rostros...")
        urllib.request.urlretrieve(URL_CARA, cfg["MODELO_CARA"])
    sb = Supabase(cfg["SUPABASE_URL"], cfg["SUPABASE_SERVICE_ROLE_KEY"])
    pc = cfg.get("NOMBRE_PC") or socket.gethostname()
    modo = "rápido (ISNet, sin tarjeta gráfica)" if cfg.get("MODELO_ONNX") else "alta calidad (BiRefNet)"
    print(f"Motor de Fotos Jeff listo en {pc}, modo {modo}. Esperando fotos... (Ctrl+C para salir)")
    while True:
        try:
            fotos = sb.rpc("tomar_fotos", p_motor=pc, p_max=1)
        except requests.RequestException as e:
            print(f"Sin conexión con el servidor ({e}); reintento en 30 s")
            time.sleep(30)
            continue
        if not fotos:
            time.sleep(ESPERA_S)
            continue
        for foto in fotos:
            t0 = time.time()
            try:
                sem, alertas = procesar_foto(sb, foto, cfg)
                print(f"{foto['ruta_original']}: {sem} {alertas} ({time.time() - t0:.0f} s)")
            except Exception as e:  # una foto rota no detiene el motor
                traceback.print_exc()
                try:
                    sb.actualizar_foto(foto["id"], dict(estado="excepcion", motivo_excepcion=f"error del motor: {e}"[:500]))
                except requests.RequestException:
                    pass  # si no hay red, tomar_fotos la devuelve a la cola en 20 min


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("Motor detenido.")
