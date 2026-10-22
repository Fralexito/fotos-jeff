"""
Motor con tarjeta gráfica para el programa instalado (.exe).

El .exe no lleva torch (pesa varios GB); usa el Python del motor ya instalado en la PC
(C:\\dev\\fotos-jeff-motor\\pipeline\\.venv) y le habla por este pequeño servidor, que carga
BiRefNet una sola vez y edita foto tras foto.

    python motor_servidor.py <carpeta con pipeline_fotos.py>

Entrada (una línea JSON por foto): {"in", "out", "producto", "fondo": [r,g,b 0-1], "dpi", "modelo_onnx", "modelo_cara"}
Salida: una línea "@@FJ@@" + JSON con el resultado o {"error": "..."}. Todo lo demás que se imprima
va a stderr, para no mezclarse con las respuestas.
"""
import json
import sys
import traceback

MARCA = "@@FJ@@"


def main():
    sys.path.insert(0, sys.argv[1])
    salida = sys.stdout
    sys.stdout = sys.stderr
    import pipeline_fotos as pf

    salida.write(MARCA + json.dumps({"listo": True}) + "\n")
    salida.flush()
    for linea in sys.stdin:
        if not linea.strip():
            continue
        try:
            p = json.loads(linea)
            r = pf.procesar(p["in"], p["out"], p["producto"], fondo_rgb=tuple(p["fondo"]), dpi=p["dpi"],
                            modelo_onnx=p.get("modelo_onnx"), modelo_cara=p.get("modelo_cara"))
        except Exception as e:
            traceback.print_exc()
            r = {"error": f"{e.__class__.__name__}: {e}"}
        salida.write(MARCA + json.dumps(r, ensure_ascii=False, default=str) + "\n")
        salida.flush()


if __name__ == "__main__":
    main()
