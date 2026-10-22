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
