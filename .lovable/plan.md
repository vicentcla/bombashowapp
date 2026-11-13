# Minutaje más fácil y partituras que no se reconocen

## 1. Minutaje sin mover el cursor

Todos los campos de tiempo pasan a funcionar como el teclado de un microondas. Escribes solo números, que siempre entran por la derecha, y el formato se pone solo:
- `6` → 0:06 · `63` → 0:63→ se corrige a 1:03 al salir · `630` → 6:30 · `1245` → 12:45
- Borrar quita el último número. El cursor siempre se queda al final aunque toques en medio, así no se descoloca en el iPhone.
- Al abrir una canción que ya tiene duración, el campo aparece relleno y puedes borrar o seguir escribiendo.

Dónde se aplica:
- Duración de canción en Repertorio (arreglos y calle) y al crear o editar canción desde Setlists.
- Duración objetivo del setlist (crear y editar), minutos de cada pase, minutos de cada descanso y duración del generador de setlists. Aquí se escribe como horas y minutos: `130` → 1:30 h, `45` → 0:45.

## 2. Partituras que no aparecen en los setlists vigentes

He comparado las canciones de los setlists vigentes (sin enlace manual) con los PDF de las 8 carpetas:

**Fallan en todos los instrumentos (el nombre del PDF es distinto):**
- 80'S DANCE → PDF «80s Dance-…»
- 80'S POP → PDF «80s POP - …»
- BOMBA ROCK → PDF «Bombarock - …» (todo junto)
- Mix Popu 2 → PDF «Mix Popular 2 - …»
- MINIATURAS + UMBRELLA → son dos PDF separados: «Miniaturas - …» (en formato imagen .BMP, que el visor no abre) y «Umbrella - …»
- SHAKIMIX → no hay ningún PDF con ese nombre en ninguna carpeta

**Solo en Percusión (falta el PDF o el nombre no coincide):** CARIBE MIX, FITOTERAPIA, REMEMBER 3D, SARANBOMBA, TELEVISHOW.

**Sousa:** SARANBOMBA encuentra dos (Percu y Tuba); la app pide elegir. Se arreglará eligiendo el de Tuba.

Arreglos que haré en la app:
- Que `80'S` y `80s` cuenten como lo mismo (ignorar apóstrofos).
- Que «BOMBA ROCK» reconozca «Bombarock» (ignorar espacios al comparar).
- Si hay dos candidatos y uno es de otro instrumento (p. ej. «Percu» en la carpeta de Sousa), escoger el del instrumento de la carpeta.
- Mix Popu 2: se enlazará con «Mix Popular 2» en cada carpeta (el enlace queda guardado).

Lo que te toca a ti en Drive (la app no puede hacerlo):
- SHAKIMIX: subir los PDF o decirme con qué nombre están.
- MINIATURAS: convertir los .BMP a PDF. Para MINIATURAS + UMBRELLA te propongo que se muestren las dos partituras seguidas.
- Percusión: subir CARIBE MIX, FITOTERAPIA, REMEMBER 3D, SARANBOMBA y TELEVISHOW, o decirme cómo se llaman.

## Detalles técnicos
- Componente compartido `DurationInput` (modo `mm:ss` y `h:mm`) que guarda solo dígitos, fuerza el cursor al final (`setSelectionRange` en focus/click/input) y normaliza segundos ≥60 al salir. Reutiliza `formatDurationInput`/`durationInputToSeconds` de `format.ts`.
- `scoreMatch.ts`: `clean()` elimina apóstrofos antes de reemplazar símbolos; comparación extra sin espacios; desempate por palabras de instrumento de la carpeta; alias para «popu»→«popular»; soporte de títulos con «+» repartidos en varios PDF.
- Prueba unitaria para el formato `630 → 390 s` y para los nuevos emparejamientos.
