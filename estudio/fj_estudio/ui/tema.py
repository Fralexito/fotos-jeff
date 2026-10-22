"""Colores y estilo (oscuro tipo estudio, como la maqueta aprobada)."""

C = dict(
    fondo="#141619", panel="#1b1e22", panel2="#181a1e", elev="#22262b", borde="#2b2f35", borde2="#353a41",
    texto="#e9eaec", suave="#c7cbd1", tenue="#9aa0a8", acento="#e8c46a", acento_txt="#141619",
    verde="#3fbf74", verde_bg="#1f3a2c", verde_txt="#7fd8a4",
    ambar="#e3a93b", ambar_bg="#3b3322", ambar_txt="#f1cf86",
    rojo="#f26b3a", rojo_bg="#3a2420", rojo_txt="#f7a07f",
    ia="#5cc3d4", ia_bg="#17313a", ia_txt="#a7e3ee",
)

SEMAFORO = {"verde": C["verde"], "amarillo": C["ambar"], "rojo": C["rojo"]}
ESTADO_COLOR = {"nueva": C["tenue"], "editando": C["ia"], "lista": C["verde"], "revisar": C["ambar"],
                "problema": C["rojo"], "aprobada": C["verde"], "rechazada": C["rojo"]}
ESTADO_TEXTO = {"nueva": "Sin editar", "editando": "Editando…", "lista": "Lista", "revisar": "Revisar",
                "problema": "Con problema", "aprobada": "Aprobada", "rechazada": "Rechazada"}

QSS = f"""
* {{ font-family: "Segoe UI", "Figtree", sans-serif; font-size: 13px; color: {C['texto']}; }}
QMainWindow, QWidget#raiz {{ background: {C['fondo']}; }}
QWidget#barra {{ background: {C['panel']}; border-bottom: 1px solid {C['borde']}; }}
QWidget#lateral {{ background: {C['panel2']}; border-right: 1px solid {C['borde']}; }}
QWidget#derecha {{ background: {C['panel2']}; border-left: 1px solid {C['borde']}; }}
QStatusBar {{ background: {C['panel']}; color: {C['tenue']}; border-top: 1px solid {C['borde']}; }}
QLabel#marca {{ font-weight: 700; letter-spacing: 1px; }}
QLabel#logo {{ background: {C['acento']}; color: {C['acento_txt']}; border-radius: 7px; font-weight: 700; }}
QLabel#titulo {{ font-size: 18px; font-weight: 700; }}
QLabel#seccion {{ color: {C['tenue']}; font-size: 11px; font-weight: 600; letter-spacing: 1px; }}
QLabel#tenue {{ color: {C['tenue']}; }}
QPushButton {{ background: {C['elev']}; border: 1px solid {C['borde2']}; border-radius: 7px; padding: 7px 12px; min-height: 18px; }}
QPushButton:hover {{ border-color: {C['tenue']}; }}
QPushButton:disabled {{ color: {C['tenue']}; background: {C['panel']}; }}
QPushButton#primario {{ background: {C['acento']}; color: {C['acento_txt']}; border: 0; font-weight: 700; }}
QPushButton#primario:hover {{ background: #f0d283; }}
QPushButton#primario:disabled, QPushButton#ia:disabled, QPushButton#aprobar:disabled, QPushButton#rechazar:disabled {{
    background: {C['elev']}; color: {C['tenue']}; border: 1px solid {C['borde2']}; }}
QPushButton#aprobar {{ background: {C['verde']}; color: #0f1f16; border: 0; font-weight: 700; padding: 11px; }}
QPushButton#rechazar {{ background: {C['rojo_bg']}; color: {C['rojo_txt']}; border: 1px solid #4a3027; font-weight: 700; padding: 11px; }}
QPushButton#ia {{ background: {C['ia']}; color: #0e2128; border: 0; font-weight: 700; }}
QPushButton#modulo {{ background: transparent; border: 0; color: {C['tenue']}; padding: 7px 14px; }}
QPushButton#modulo:checked {{ background: #2c3138; color: white; font-weight: 600; }}
QPushButton#chip {{ border-radius: 12px; padding: 4px 10px; color: {C['suave']}; }}
QPushButton#chip:checked {{ background: {C['ia_bg']}; color: {C['ia_txt']}; border-color: {C['ia_bg']}; font-weight: 600; }}
QPushButton#medida {{ border-radius: 12px; padding: 4px 10px; }}
QPushButton#medida:checked {{ background: #2c3138; border-color: {C['acento']}; font-weight: 600; }}
QLineEdit, QTextEdit, QPlainTextEdit, QSpinBox, QDoubleSpinBox, QComboBox {{
    background: {C['elev']}; border: 1px solid {C['borde2']}; border-radius: 7px; padding: 6px 8px;
    selection-background-color: {C['acento']}; selection-color: {C['acento_txt']}; }}
QLineEdit:focus, QTextEdit:focus, QPlainTextEdit:focus, QComboBox:focus {{ border-color: {C['acento']}; }}
QComboBox QAbstractItemView {{ background: {C['panel']}; border: 1px solid {C['borde2']}; }}
QTreeWidget, QListView, QTableWidget, QTableView {{ background: transparent; border: 0; outline: 0; }}
QTreeWidget::item {{ padding: 5px 4px; border-radius: 6px; }}
QTreeWidget::branch:selected {{ background: transparent; }}
QTreeWidget::item:selected, QTableWidget::item:selected, QTableView::item:selected {{ background: #2c3138; color: white; }}
QListView::item:selected {{ background: transparent; }}
QHeaderView {{ background: transparent; border: 0; }}
QTableCornerButton::section {{ background: transparent; border: 0; }}
QHeaderView::section {{ background-color: {C['fondo']}; color: {C['tenue']}; border: 0; border-bottom: 1px solid {C['borde']};
    padding: 6px; font-size: 11px; font-weight: 600; }}
QTableWidget, QTableView {{ gridline-color: {C['borde']}; }}
QScrollBar:vertical {{ background: transparent; width: 10px; }}
QScrollBar::handle:vertical {{ background: {C['borde2']}; border-radius: 5px; min-height: 30px; }}
QScrollBar:horizontal {{ background: transparent; height: 10px; }}
QScrollBar::handle:horizontal {{ background: {C['borde2']}; border-radius: 5px; min-width: 30px; }}
QScrollBar::add-line, QScrollBar::sub-line {{ width: 0; height: 0; }}
QProgressBar {{ background: #2c3138; border: 0; border-radius: 3px; height: 6px; text-align: center; }}
QProgressBar::chunk {{ background: {C['acento']}; border-radius: 3px; }}
QSlider::groove:horizontal {{ height: 4px; background: #2c3138; border-radius: 2px; }}
QSlider::handle:horizontal {{ background: {C['acento']}; width: 14px; margin: -6px 0; border-radius: 7px; }}
QCheckBox::indicator {{ width: 16px; height: 16px; }}
QTabWidget::pane {{ border: 0; }}
QTabBar::tab {{ background: transparent; color: {C['tenue']}; padding: 9px 14px; border-bottom: 2px solid transparent; }}
QTabBar::tab:selected {{ color: white; border-bottom: 2px solid {C['acento']}; }}
QMenu {{ background: {C['panel']}; border: 1px solid {C['borde2']}; }}
QMenu::item {{ padding: 6px 18px; }}
QMenu::item:selected {{ background: #2c3138; }}
QToolTip {{ background: {C['panel']}; color: {C['texto']}; border: 1px solid {C['borde2']}; }}
QDialog {{ background: {C['panel']}; }}
QFrame#tarjeta {{ background: {C['panel']}; border: 1px solid {C['borde']}; border-radius: 12px; }}
QFrame#aviso_ia {{ background: {C['ia_bg']}; border-radius: 10px; }}
QFrame#aviso_ia QLabel {{ color: {C['ia_txt']}; }}
"""


# ------------------------------------------------------------------ diseño simple (v0.2)
# Claro y cálido para colegios y salones; oscuro solo en la galería (las fotos se ven mejor).
FUENTE = "Plus Jakarta Sans"

CL = dict(
    fondo="#FBF8F2", tarjeta="#FFFFFF", borde="#EDE5D6", borde2="#E3D8C4", tinta="#1C1A17", suave="#6B6457",
    tenue="#8A7F6C", oro="#C9962B", oro_claro="#E8C46A", oro_txt="#7A5410", oro_bg="#FBEFD2",
    verde="#3FA36B", verde_bg="#E3F3EA", verde_txt="#1F6B43", gris_bg="#F1ECE3", pista="#EFE7D8",
    rojo="#D9583F", rojo_bg="#FBE3DD", rojo_txt="#8E2E1C",
)
OSC = dict(fondo="#121212", panel="#1A1A1A", elev="#232323", elev2="#2C2C2C", borde="#2E2E2E", texto="#F2EEE6",
           suave="#CFC9BD", tenue="#9A958B", oro="#E8C46A")

# Colores de las tarjetas de colegio (fondo, tinta): se reparten en orden.
PALETAS_COLEGIO = [("#FCEFD2", "#9A6A0E"), ("#DDEBFA", "#1F5FA8"), ("#DDF2E6", "#23784A"), ("#F6E0EA", "#A33A68"),
                   ("#EAE4FA", "#5B43B0"), ("#FDE5D6", "#A2481C")]

PUNTO_ESTADO = {"lista": "#3FA36B", "aprobada": "#3FA36B", "revisar": "#E8C46A", "problema": "#E5674E",
                "nueva": "#6B6B6B", "editando": "#5CC3D4", "sin_foto": "#3A3A3A", "rechazada": "#E5674E"}
TEXTO_ESTADO = {"lista": "Lista para aprobar", "aprobada": "Aprobada", "revisar": "Mírala antes de aprobar",
                "problema": "Tiene un problema", "nueva": "Sin editar", "editando": "Editando…",
                "sin_foto": "Sin foto", "rechazada": "Rechazada"}


def cargar_fuentes():
    """Plus Jakarta Sans viene con el programa (licencia OFL en ui/fuentes)."""
    import os
    import sys

    from PySide6.QtGui import QFontDatabase
    aqui = os.path.join(getattr(sys, "_MEIPASS", os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
                        "fj_estudio", "ui", "fuentes") if getattr(sys, "frozen", False) else \
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "fuentes")
    for f in ("PlusJakartaSans.ttf",):
        ruta = os.path.join(aqui, f)
        if os.path.exists(ruta):
            QFontDatabase.addApplicationFont(ruta)


QSS_CLARO = f"""
* {{ font-family: "{FUENTE}", "Segoe UI", sans-serif; font-size: 15px; color: {CL['tinta']}; }}
QMainWindow, QWidget#raiz {{ background: {CL['fondo']}; }}
QScrollArea {{ background: transparent; border: 0; }}
QScrollArea > QWidget > QWidget {{ background: transparent; }}
QLabel {{ background: transparent; }}
QLabel#h1 {{ font-size: 40px; font-weight: 800; }}
QLabel#h2 {{ font-size: 22px; font-weight: 800; }}
QLabel#marca {{ font-size: 15px; font-weight: 800; letter-spacing: 1px; }}
QLabel#suave {{ color: {CL['suave']}; }}
QLabel#tenue {{ color: {CL['tenue']}; font-weight: 600; }}
QLabel#etiqueta {{ color: {CL['oro']}; font-size: 13px; font-weight: 800; letter-spacing: 2px; }}
QPushButton {{ background: {CL['tarjeta']}; border: 1px solid {CL['borde2']}; border-radius: 16px; padding: 12px 20px;
    font-weight: 700; }}
QPushButton:hover {{ border-color: {CL['oro']}; }}
QPushButton:disabled {{ color: #B3AB9C; border-color: {CL['borde']}; }}
QPushButton#oscuro {{ background: {CL['tinta']}; color: #FFFFFF; border: 0; border-radius: 24px; padding: 14px 24px; }}
QPushButton#oscuro:hover {{ background: #33302A; }}
QPushButton#pildora {{ border-radius: 22px; padding: 10px 18px; }}
QPushButton#redondo {{ border-radius: 22px; padding: 0; min-width: 44px; max-width: 44px; min-height: 44px; max-height: 44px; }}
QPushButton#fantasma {{ background: transparent; border: 0; color: {CL['suave']}; padding: 10px 14px; }}
QPushButton#fantasma:hover {{ color: {CL['tinta']}; }}
QLineEdit {{ background: {CL['tarjeta']}; border: 1px solid #DCD3C3; border-radius: 12px; padding: 8px 12px;
    selection-background-color: {CL['oro_claro']}; }}
QLineEdit#buscar {{ border-radius: 26px; padding: 14px 20px 14px 12px; font-size: 16px; }}
QLineEdit:focus {{ border: 2px solid {CL['oro']}; }}
QScrollBar:vertical {{ background: transparent; width: 10px; margin: 4px; }}
QScrollBar::handle:vertical {{ background: #D9CFBE; border-radius: 5px; min-height: 40px; }}
QScrollBar::add-line, QScrollBar::sub-line {{ width: 0; height: 0; }}
QScrollBar:horizontal {{ height: 0; }}
QToolTip {{ background: {CL['tinta']}; color: #FFFFFF; border: 0; padding: 6px 10px; border-radius: 8px; }}
QMessageBox, QDialog {{ background: {CL['fondo']}; }}
QMessageBox QLabel {{ font-size: 15px; }}
QMessageBox QPushButton, QDialog QPushButton {{ min-width: 90px; }}
QComboBox, QSpinBox, QDoubleSpinBox {{ background: {CL['tarjeta']}; border: 1px solid #DCD3C3; border-radius: 12px; padding: 8px 12px; }}
QCheckBox {{ spacing: 10px; }}
QMenu {{ background: {CL['tarjeta']}; border: 1px solid {CL['borde']}; border-radius: 12px; padding: 6px; }}
QMenu::item {{ padding: 10px 18px; border-radius: 8px; }}
QMenu::item:selected {{ background: {CL['gris_bg']}; color: {CL['tinta']}; }}
"""

QSS_GALERIA = f"""
QWidget#galeria, QWidget#galeria QWidget {{ color: {OSC['texto']}; }}
QWidget#galeria {{ background: {OSC['fondo']}; }}
QWidget#galeria QLabel#h1 {{ color: {OSC['texto']}; font-size: 36px; font-weight: 800; }}
QWidget#galeria QLabel#tenue {{ color: {OSC['tenue']}; }}
QWidget#galeria QLabel#suave {{ color: {OSC['suave']}; }}
QWidget#galeria QPushButton {{ background: {OSC['elev2']}; color: {OSC['texto']}; border: 0; border-radius: 16px;
    padding: 12px 20px; font-weight: 700; }}
QWidget#galeria QPushButton:hover {{ background: #383838; }}
QWidget#galeria QPushButton:disabled {{ color: #6E6A62; background: {OSC['elev']}; }}
QWidget#galeria QPushButton#filtro {{ background: transparent; color: {OSC['suave']}; border-radius: 18px; padding: 9px 18px; }}
QWidget#galeria QPushButton#filtro:checked {{ background: {OSC['texto']}; color: {OSC['fondo']}; }}
QWidget#galeria QPushButton#borde {{ background: transparent; border: 1px solid #3A3A3A; }}
QWidget#galeria QPushButton#borde:hover {{ border-color: {OSC['oro']}; }}
QWidget#galeria QFrame#filtros {{ background: {OSC['panel']}; border-radius: 24px; }}
QWidget#galeria QFrame#lateral {{ background: {OSC['panel']}; border-left: 1px solid {OSC['borde']}; }}
QWidget#galeria QFrame#flotante {{ background: {OSC['elev']}; border: 1px solid #3A3A3A; border-radius: 34px; }}
QWidget#galeria QFrame#flotante QPushButton {{ border-radius: 24px; padding: 13px 22px; }}
QWidget#galeria QListView {{ background: transparent; border: 0; outline: 0; }}
QWidget#galeria QScrollBar::handle:vertical {{ background: #3A3A3A; }}
"""
