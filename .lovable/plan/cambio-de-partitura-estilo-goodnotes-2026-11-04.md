# Cambio de partitura estilo GoodNotes

Sí se puede hacer. Se cambia el gesto de "mantener el dedo un tiempo" por "arrastrar hasta un punto y soltar", como en GoodNotes.

## Cómo funcionará
1. Empiezas a arrastrar (hacia el lado, o hacia arriba al final de la última página): la partitura se mueve con resistencia, cada vez más dura.
2. El círculo con «Siguiente» / «Anterior» se va llenando **según lo que arrastras**, no por tiempo. Hace falta arrastrar bastante más que ahora (aprox. el 40% de la pantalla de lado, 30% hacia arriba).
3. Cuando el círculo se completa: vibración corta (en Android) y el texto cambia a **«Suelta para siguiente»** / **«Suelta para anterior»**.
4. Si sueltas en ese momento, cambia de partitura. Si vuelves atrás antes de soltar, se cancela y no pasa nada.
5. Se mantiene: bloqueo de dirección (solo vertical u horizontal), funciona con zoom cuando estás en el borde, y la precarga.

## Detalles técnicos
- `NativeScore.tsx`: eliminar `HOLD_MS`, temporizador e intervalo de vibración. Calcular `progress = min(1, |d| / umbral)` en `move`; umbral horizontal `clientWidth*0.4`, vertical `clientHeight*0.3`. Resistencia: translate = `d * 0.4 * (1 - progress*0.4)`.
- Estado `pull` pasa a `{ dir, progress, ready }`; el anillo usa `strokeDashoffset = 283*(1-progress)` sin animación CSS.
- `haptic("success")` una vez al pasar a `ready`; en `end`, si `ready` → `onSwipe(dir)`, si no → `resetSwipe()`.
- Quitar la regla `score-ring` de `styles.css` si queda sin uso.
