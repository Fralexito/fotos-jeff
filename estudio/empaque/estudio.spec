# PyInstaller: FOTOS JEFFERSON Estudio (carpeta, sin consola). Se arma en GitHub Actions (Windows).
#   pyinstaller --noconfirm estudio/empaque/estudio.spec
import os

from PyInstaller.utils.hooks import collect_all, collect_submodules

AQUI = os.path.abspath(SPECPATH)
ESTUDIO = os.path.dirname(AQUI)
REPO = os.path.dirname(ESTUDIO)

datas = [(os.path.join(REPO, "pipeline", "pipeline_fotos.py"), "pipeline"),
         (os.path.join(ESTUDIO, "motor_servidor.py"), "."),
         (os.path.join(AQUI, "icono.png"), "empaque"),
         (os.path.join(REPO, "estudio", "fj_estudio", "ui", "fuentes"), "fj_estudio/ui/fuentes")]
binaries = []
hidden = ["pipeline_fotos", "PIL.ImageCms", "openpyxl", "onnxruntime", "scipy._cyutility"]
hidden += collect_submodules("keyring.backends") + collect_submodules("fj_estudio")
for paquete in ("mediapipe", "pymatting", "numba", "llvmlite", "onnxruntime", "scipy"):
    d, b, h = collect_all(paquete)
    datas += d
    binaries += b
    hidden += h

a = Analysis([os.path.join(ESTUDIO, "main.py")],
             pathex=[ESTUDIO, os.path.join(REPO, "pipeline")],
             binaries=binaries, datas=datas, hiddenimports=hidden,
             excludes=["torch", "torchvision", "transformers", "timm", "kornia", "tkinter",
                       "IPython", "pytest", "PySide6.QtWebEngineCore", "PySide6.Qt3DCore", "PySide6.QtQuick3D"],
             noarchive=False)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name="FOTOS JEFFERSON Estudio",
          icon=os.path.join(AQUI, "icono.ico"), console=False, upx=False)
coll = COLLECT(exe, a.binaries, a.datas, name="FOTOS JEFFERSON Estudio", upx=False)
