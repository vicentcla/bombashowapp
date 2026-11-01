# Mejoras: partituras, Modo Bolo, fluidez y copias de seguridad

## 1. Cambiar de partitura deslizando (sin flechas)
- Se quitan las flechas anterior/siguiente del visor (normal y pantalla completa).
- **Bloqueo de dirección**: al empezar a arrastrar, la app decide si el gesto es vertical (bajar el PDF) u horizontal (cambiar de partitura) y bloquea la otra dirección hasta soltar el dedo. Nunca las dos a la vez.
- **Arrastrar y mantener, estilo GoodNotes**: al arrastrar hacia un lado aparece un aviso en el borde («Siguiente: Título» / «Anterior: Título») con una barra que se va llenando. Solo cambia si arrastras suficiente y mantienes un instante (~0,5 s). Si sueltas antes, vuelve a su sitio. Así un roce al bajar la página nunca cambia de canción.
- Con zoom puesto, arrastrar mueve la página ampliada; el cambio solo funciona a zoom normal.
- Precarga silenciosa de la partitura siguiente para que el cambio sea instantáneo.

## 2. Modo Bolo (no invasivo)
- En Inicio solo un botón pequeño «Modo Bolo» (o una línea discreta si hay un bolo en curso). Inicio sigue igual.
- Al entrar: pantalla propia con
  - Selector del setlist del día (solo vigentes).
  - Orden de pases y canciones con duración.
  - Acceso directo a las partituras de ese setlist por instrumento.
  - **Bolsa de hoy**: tocar una canción la marca como tocada (otro toque la desmarca), también canciones de calle sueltas.
  - Botón final «Guardar todo a los contadores» (solo admin, como ahora) que suma un toque por canción marcada y vacía la bolsa.
- La bolsa se guarda en el móvil, así no se pierde si se cierra la app.

## 3. Fluidez (punto 7)
Qué significa: que todo responda más rápido y se vea más suave.
- Carpetas grandes: la lista se muestra al instante y se recuerda entre visitas.
- Animación de deslizamiento suave al cambiar de partitura (la nueva entra desde el lado).
- Pantallas que cargan con esqueletos en vez de quedarse en blanco.

## 4. Copia de seguridad y restauración (solo superadmin)
- En Gestión, nueva pestaña «Copias» visible en móvil y ordenador.
- **Descargar copia**: un archivo con repertorio, calle, letras, setlists, periodos y contadores.
- **Contraseña maestra**: el superadmin la crea la primera vez; se guarda cifrada y nadie puede leerla.
- **Cargar copia**: eliges el archivo, ves un resumen (cuántas canciones, setlists...), y para confirmar escribes la contraseña maestra. Avisa claramente que se sustituirá todo lo actual. Antes de reemplazar, la app descarga automáticamente una copia de lo que hay por seguridad.
- Descargar también pide la contraseña maestra.
- No toca usuarios, roles ni avisos.

## Detalles técnicos
- NativeScore: máquina de gestos con axis lock (umbral ~12px), umbral horizontal 35% ancho + hold 500ms; prop `onSwipe(dir)` desde ScoreViewer; precarga del siguiente `getDriveFile` en React Query.
- Modo Bolo: ruta nueva `/_authenticated/bolo-modo` (o reutilizar bolo.tsx existente tras revisarlo); bolsa en localStorage por usuario; guardado usa `useAddPlay` en lote.
- Copias: tabla `private.master_secret` con hash bcrypt (pgcrypto); RPCs SECURITY DEFINER `set_master_password`, `export_backup(pass)`, `restore_backup(pass, data jsonb)` que verifican superadmin + contraseña y hacen el reemplazo en una sola transacción. Validación de formato con zod en cliente y comprobación de versión del archivo.
- Tests vitest: bloqueo de dirección/umbral del gesto, validación del archivo de copia.
- Ninguna clave nueva en Cloudflare.
