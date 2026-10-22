# Recetas de IA · FOTOS JEFFERSON

El programa las trae listas como botones. Hoy también puedes copiarlas y pegarlas en ChatGPT.

**Cómo se arma cada pedido:**
1. Una o varias **recetas** (puedes combinar).
2. Las **reglas fijas** (siempre van, protegen a la persona).
3. La **salida** (fondo, encuadre, resolución).

Lo que va entre {llaves} lo llena el programa solo (color de fondo, medida, colores de toga, etc.).

---

## Reglas fijas (van SIEMPRE al final)

> REGLAS FIJAS, NO NEGOCIABLES: Debe seguir siendo exactamente la misma persona. No cambies la forma de la cara ni de la cabeza, los ojos, la nariz, la boca, los labios, las cejas, las orejas, la mandíbula ni el mentón. No cambies el color ni la textura de la piel. Conserva las pecas, los lunares, las cicatrices y las marcas de nacimiento. No cambies el peinado, el largo ni el color del cabello. No cambies la complexión, el peso, el ancho de hombros, el cuello ni la estatura. No embellezcas, no adelgaces, no maquilles, no aclares ni oscurezcas la piel. No cambies la edad aparente. No agregues ni quites nada que no se pida aquí.

## Salida (va SIEMPRE al final)

> SALIDA: Retrato vertical de busto, cabeza centrada, con un espacio libre arriba de la cabeza (o del birrete) de más o menos un décimo del alto. Fondo liso {fondo} (RGB {fondo_rgb}), sin degradado, sin sombra y sin brillo alrededor. Corte limpio, sobre todo en el cabello: pelo natural, sin halo y sin bordes duros. Iluminación de estudio suave y pareja. Devuelve la imagen en la máxima resolución posible.

---

## 1. Recorte y fondo (la que ya funcionó)

> Recorta a la persona y ponla sobre un fondo liso {fondo}. Deja la ropa, la borla y los accesorios tal como están en el original.

## 2. Enderezar cabeza

> La cabeza está inclinada hacia un lado. Endereza solo la inclinación de la cabeza para que quede vertical y mirando de frente, con un giro natural del cuello. No cambies la expresión ni la dirección de la mirada.

## 3. Corregir postura

> Corrige la postura: espalda recta, hombros relajados y a la misma altura, pecho de frente a la cámara y cuello natural. Mueve solo la posición del cuerpo, nunca su forma ni su tamaño.

## 4. Abrir ojos cerrados

> La persona tiene los ojos cerrados o medio cerrados. Ábrelos de forma natural, mirando a la cámara, con la misma forma de párpado, tamaño de ojo y color de iris que tiene esta persona. {si hay otra toma: "Usa la segunda imagen, que es la misma persona con los ojos abiertos, como referencia exacta de cómo son sus ojos."}

## 5. Limpiar errores de la toma

> Quita lo que no debe salir en un retrato de estudio: carteles, manos o brazos de otras personas, objetos, pelusas, hilos sueltos, etiquetas de la ropa, brillo de sudor en la frente y reflejos en los lentes. Rellena esas zonas de forma natural, siguiendo la ropa o el fondo. No toques la cara más allá de eso.

## 6. Retoque suave de piel

> Retoque suave de estudio: atenúa solo los granos o irritaciones pasajeras y las ojeras muy marcadas. La textura de la piel debe seguir viéndose real, sin efecto plástico ni piel lisa artificial.

## 7. Vestimenta de promoción (para quien no la tenía)

Elige la variante y el programa pone los colores de la campaña.

**7a. Graduación con toga y birrete**
> Viste a la persona con una toga de graduación color {color_toga}, de tela mate con caída natural y pocas arrugas, cerrada al frente. Agrega una estola o banda {color_estola} sobre los hombros {si hay texto: "con el texto '{texto_estola}' bordado en dorado"}. Pon un birrete del mismo color, recto sobre la cabeza y apoyado de forma natural sobre el cabello, con una borla {color_borla} colgando al lado {lado_borla}. La ropa debe ajustarse a los hombros, el cuello y la postura reales de la persona. El cuello de la toga sigue la línea real del cuello, sin cubrir la barbilla. No cambies el cuerpo para que encaje la ropa: adapta la ropa al cuerpo.

**7b. Promoción con terno**
> Viste a la persona con un terno escolar formal: saco {color_saco}, camisa blanca de cuello bien planchado y corbata {color_corbata} con nudo simple. La ropa se ajusta a los hombros y al cuello reales, con caída natural y sin arrugas fuertes.

**7c. Inicial**
> Viste al niño o niña con una toga infantil color {color_toga} y un birrete pequeño del mismo color con borla {color_borla}, a su medida y con aspecto tierno y natural. Adapta la ropa a su cuerpo real.

## 8. Mejorar colores

> Corrige el color como en una foto profesional de estudio: balance de blancos neutro, piel natural sin tono naranja, verde ni magenta, contraste suave y negros limpios. La toga debe verse {color_toga} intenso y uniforme, sin virar a morado ni a gris. El dorado debe verse dorado, no amarillo. No subas la saturación de la piel.

## 9. Más nitidez para imprimir (HD)

> Mejora la nitidez y el detalle real para impresión: cabello con hebras definidas, ojos nítidos y textura de tela clara. No inventes textura de piel ni detalles nuevos, sin efecto pintado ni plástico, y sin ruido ni bordes marcados.

⚠️ Las IAs de imagen devuelven fotos pequeñas, de unos 1 000 a 1 500 píxeles. Por eso el paso final a {medida} y 300 DPI lo hace el programa en tu PC, con un ampliador que no inventa caras. Así sale nítido en 20x30.

## 10. Completar lo que quedó cortado

> La foto está cortada {arriba de la cabeza / en los hombros}. Completa la parte que falta para que entre el busto completo con espacio arriba, siguiendo el mismo cabello, ropa y fondo, sin cambiar nada de lo que ya existe.

---

## Combinar recetas

El programa las une en este orden, en un solo pedido:

**Limpiar (5) → Enderezar (2, 3) → Ojos (4) → Vestimenta (7) → Recorte y fondo (1) → Color (8) → Piel (6) → Nitidez (9)**

Ejemplo, "alumno sin toga, cabeza ladeada y con cartel":
> [Receta 5] + [Receta 2] + [Receta 7a] + [Receta 1] + [Receta 8] + REGLAS FIJAS + SALIDA

**Combos guardados** (un solo botón):
- **Graduación completa:** 5 + 7a + 1 + 8 + 9
- **Arreglar toma mala:** 5 + 2 + 3 + 4
- **Solo mejorar:** 8 + 6 + 9

## Cómo se protege el resultado

Después de cada pedido, el programa revisa estas tres cosas antes de aceptar la foto:
1. **¿Es la misma persona?** Compara la cara con el original. Si no coincide, descarta el resultado y avisa.
2. **¿Cambió el cuerpo?** Mide el ancho de hombros y el tamaño de la cabeza. Si cambian más de lo normal, la marca en amarillo.
3. **El original nunca se borra.** Siempre puedes volver atrás.
