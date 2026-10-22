"""
Recetas de IA: pedidos ya probados que se combinan en uno solo.

Regla de la casa (FADG, 2026-10-22): 0 % de cambios en rasgos faciales, corporales o
fenotípicos. La IA solo mejora la calidad, corrige detalles pequeños de la piel, endereza
y viste; nunca cambia cómo es la persona. Por eso las REGLAS FIJAS van en TODOS los pedidos
(también en los que escribe la persona a mano) y no se pueden quitar.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

REGLAS_FIJAS = (
    "REGLAS FIJAS, NO NEGOCIABLES: Debe seguir siendo exactamente la misma persona. No cambies la forma de la "
    "cara ni de la cabeza, los ojos, los párpados, la nariz, la boca, los labios, las cejas, las orejas, la "
    "mandíbula ni el mentón. No cambies el color ni el tono de la piel. Conserva las pecas, los lunares, las "
    "cicatrices y las marcas de nacimiento. No cambies el peinado, el largo ni el color del cabello. No cambies "
    "la complexión, el peso, el ancho de hombros, el cuello ni la estatura. No embellezcas, no adelgaces, no "
    "maquilles, no aclares ni oscurezcas la piel, no cambies la edad aparente ni la expresión. No agregues ni "
    "quites nada que no se pida aquí."
)

SALIDA = (
    "SALIDA: Retrato vertical de busto, cabeza centrada, con un espacio libre arriba de la cabeza (o del "
    "birrete) de más o menos un décimo del alto. Fondo liso {fondo} (RGB {fondo_rgb}), sin degradado, sin "
    "sombra y sin brillo alrededor. Corte limpio, sobre todo en el cabello: pelo natural, sin halo y sin bordes "
    "duros. Iluminación de estudio suave y pareja. Devuelve la imagen en la máxima resolución posible."
)


@dataclass(frozen=True)
class Receta:
    id: str
    titulo: str
    grupo: str
    orden: int          # en qué turno se aplica al combinar
    texto: str
    toca_cara: bool = False  # si es True, la verificación de rasgos es aún más estricta
    requiere_referencia: bool = False  # necesita otra toma de la MISMA persona (nada se inventa)


RECETAS: list[Receta] = [
    Receta("limpiar", "Limpiar toma", "Arreglar", 10,
           "Quita lo que no debe salir en un retrato de estudio: carteles, manos o brazos de otras personas, objetos, "
           "pelusas, hilos sueltos, etiquetas de la ropa, brillo de sudor en la frente y reflejos en los lentes. "
           "Rellena esas zonas de forma natural siguiendo la ropa o el fondo. No toques la cara más allá de eso."),
    Receta("enderezar", "Enderezar cabeza", "Arreglar", 20,
           "La cabeza está inclinada hacia un lado. Gira la cabeza entera, como un bloque rígido, solo lo necesario "
           "para que quede vertical, con un giro natural del cuello. La cara no se deforma: solo cambia su ángulo.",
           toca_cara=True),
    Receta("ojos", "Abrir ojos (con otra toma)", "Arreglar", 25,
           "En la primera imagen la persona tiene los ojos cerrados o entrecerrados. La segunda imagen es la MISMA "
           "persona, en otra toma de la misma sesión, con los ojos abiertos. Abre los ojos de la primera imagen "
           "copiando exactamente cómo son en la segunda: misma forma y pliegue de párpado, mismo tamaño de ojo, mismo "
           "color y tamaño de iris, mismas pestañas y cejas, mirando a la cámara. Cambia solo los párpados y lo que "
           "se ve del ojo; el resto de la cara queda idéntico a la primera imagen. Si no puedes hacerlo idéntico a la "
           "segunda imagen, deja los ojos como están.",
           toca_cara=True, requiere_referencia=True),
    Receta("postura", "Corregir postura", "Arreglar", 21,
           "Corrige la postura: espalda recta, hombros relajados y a la misma altura, pecho de frente a la cámara y "
           "cuello natural. Mueve solo la posición del cuerpo, nunca su forma ni su tamaño."),
    Receta("toga", "Poner toga y birrete", "Vestir", 30,
           "Viste a la persona con una toga de graduación color {color_toga}, de tela mate con caída natural y pocas "
           "arrugas, cerrada al frente. Agrega una estola {color_estola} sobre los hombros. Pon un birrete del mismo "
           "color que la toga, recto sobre la cabeza y apoyado de forma natural sobre el cabello, con una borla "
           "{color_borla} colgando al lado derecho. La ropa se ajusta a los hombros, el cuello y la postura reales; "
           "el cuello de la toga sigue la línea real del cuello sin cubrir la barbilla. Adapta la ropa al cuerpo, "
           "nunca el cuerpo a la ropa."),
    Receta("terno", "Poner terno", "Vestir", 31,
           "Viste a la persona con un terno escolar formal: saco {color_saco}, camisa blanca de cuello bien "
           "planchado y corbata {color_corbata} con nudo simple. La ropa se ajusta a los hombros y al cuello reales, "
           "con caída natural y sin arrugas fuertes. Adapta la ropa al cuerpo, nunca el cuerpo a la ropa."),
    Receta("toga_inicial", "Toga de inicial", "Vestir", 32,
           "Viste al niño o niña con una toga infantil color {color_toga} y un birrete pequeño del mismo color con "
           "borla {color_borla}, a su medida y con aspecto natural. Adapta la ropa a su cuerpo real."),
    Receta("planchar", "Planchar toga", "Vestir", 33,
           "Quita las arrugas de la toga y de la estola dejando la caída natural de la tela. No cambies el color, "
           "el corte ni el tamaño de la ropa."),
    Receta("fondo", "Recorte y fondo", "Fondo", 40,
           "Recorta a la persona y ponla sobre un fondo liso {fondo}. Deja la ropa, la borla y los accesorios tal "
           "como están."),
    Receta("color", "Mejorar color", "Calidad", 50,
           "Corrige el color como en una foto profesional de estudio: balance de blancos neutro, piel natural sin "
           "tono naranja, verde ni magenta, contraste suave y negros limpios. La ropa debe verse con su color real, "
           "intenso y parejo, sin virar a morado ni a gris; el dorado debe verse dorado. No subas la saturación de "
           "la piel ni cambies su tono."),
    Receta("piel", "Retoque suave de piel", "Calidad", 60,
           "Retoque suave de estudio: atenúa solo granos, irritaciones pasajeras, brillo de grasa y ojeras muy "
           "marcadas. Conserva pecas, lunares, cicatrices y la textura real de la piel, sin efecto plástico.",
           toca_cara=True),
    Receta("nitidez", "Más nitidez (HD)", "Calidad", 70,
           "Mejora la nitidez y el detalle real: cabello con hebras definidas, ojos nítidos y textura de tela clara. "
           "No inventes textura de piel ni detalles nuevos, sin efecto pintado ni plástico, sin ruido."),
    Receta("completar", "Completar lo cortado", "Arreglar", 15,
           "La foto está cortada arriba de la cabeza o en los hombros. Completa la parte que falta para que entre el "
           "busto completo con espacio arriba, siguiendo el mismo cabello, ropa y fondo, sin cambiar nada de lo que "
           "ya existe."),
]

POR_ID = {r.id: r for r in RECETAS}

COMBOS = {
    "Graduación completa": ["limpiar", "toga", "planchar", "fondo", "color", "nitidez"],
    "Arreglar toma mala": ["limpiar", "completar", "enderezar", "postura"],
    "Solo mejorar": ["color", "piel", "nitidez"],
    "Promoción con terno": ["limpiar", "terno", "fondo", "color", "nitidez"],
}

VARIABLES_POR_DEFECTO = {
    "fondo": "celeste", "fondo_rgb": "107, 201, 237", "color_toga": "azul marino", "color_estola": "dorada",
    "color_borla": "dorada", "color_saco": "azul marino", "color_corbata": "azul marino",
}

_PROHIBIDO_LIBRE = re.compile(
    r"\b(m[aá]s (delgad|flac|guap|bonit|joven|alt|blanc)|adelgaz|aclar(a|ar) la piel|blanquea|cambia(r)? (la|su) "
    r"(cara|nariz|boca|ojos|forma)|ojos (azules|verdes|claros)|nariz (fina|peque)|labios (gruesos|finos)|"
    r"embellec|rejuvenec|envejec|maquill)", re.I)


def componer(ids: list[str], texto_libre: str = "", variables: dict | None = None) -> str:
    """Une las recetas en su orden, agrega el pedido libre y SIEMPRE las reglas fijas y la salida."""
    if not ids and not texto_libre.strip():
        raise ValueError("Elige al menos una receta o escribe qué quieres cambiar.")
    desconocidas = [i for i in ids if i not in POR_ID]
    if desconocidas:
        raise ValueError(f"Receta desconocida: {', '.join(desconocidas)}")
    if texto_libre and _PROHIBIDO_LIBRE.search(_sin_tildes(texto_libre)):
        raise ValueError("Ese pedido cambiaría cómo es la persona. El programa no lo permite: solo se mejora "
                         "la calidad, se corrigen detalles de la piel, se endereza y se viste.")
    v = {**VARIABLES_POR_DEFECTO, **(variables or {})}
    partes = [f"{n}. {POR_ID[i].texto}" for n, i in enumerate(sorted(dict.fromkeys(ids),
                                                                    key=lambda i: POR_ID[i].orden), 1)]
    if texto_libre.strip():
        partes.append(f"{len(partes) + 1}. {' '.join(texto_libre.split())}")
    cuerpo = "Haz estos cambios en este orden, todos en una sola imagen:\n" + "\n".join(partes)
    return _llenar(f"{cuerpo}\n\n{REGLAS_FIJAS}\n\n{SALIDA}", v)


def _sin_tildes(t: str) -> str:
    import unicodedata
    return unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode()


def _llenar(texto: str, v: dict) -> str:
    return re.sub(r"\{(\w+)\}", lambda m: str(v.get(m.group(1), m.group(0))), texto)


def requiere_referencia(ids: list[str]) -> bool:
    return any(POR_ID[i].requiere_referencia for i in ids if i in POR_ID)


def toca_cara(ids: list[str]) -> bool:
    return any(POR_ID[i].toca_cara for i in ids if i in POR_ID)
