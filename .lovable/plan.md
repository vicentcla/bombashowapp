# Ocultar la pestaña del título en pantalla completa

## Qué cambia
- Al entrar en pantalla completa (y al cambiar a otra partitura) la pestaña con el número y el título aparece **2,5 segundos** y luego se desvanece sola.
- Si tocas la pantalla mientras se ve, desaparece al momento.
- El botón de salir de pantalla completa también se oculta junto con la pestaña, para que solo quede la partitura.
- Para volver a verlos: un toque rápido en la pantalla los muestra de nuevo otros 2,5 segundos (así siempre puedes salir de pantalla completa).
- Arrastrar, hacer zoom o cambiar de partitura con el gesto no cuenta como toque y no los muestra.

Funciona igual en iPhone, Android y ordenador.

## Detalles técnicos
- `src/components/ScoreViewer.tsx`: estado `chromeVisible` con temporizador (2500 ms) que se reinicia al activar `full` y al cambiar `index`.
- Detección de toque corto (pointerdown/pointerup con movimiento < 10 px y < 300 ms) sobre el contenedor: si visible → ocultar; si oculto → mostrar y reiniciar temporizador.
- Pestaña y botón con transición de opacidad; `pointer-events-none` cuando están ocultos.
