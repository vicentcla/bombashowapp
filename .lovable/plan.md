# Háptica, generador de setlists y visor de partituras

## 1. Respuesta háptica centralizada
- Una sola función `haptic('light' | 'medium' | 'success' | 'selection')` que no hace nada si el móvil no vibra.
- Contadores: pulso corto al sumar (+1), doble pulso suave al restar (−1).
- Arrastrar y soltar: vibración al levantar y al soltar (sustituye la actual `buzz()`).
- Acciones clave: guardar setlist, enviar propuesta, aprobar/rechazar propuesta.

## 2. Generador de setlists por tiempo
- Botón «Generar» dentro de un setlist (o de un pase): eliges los minutos objetivo (p. ej. 45, 60, 90 o libre).
- **Margen de hasta 5 minutos**: el resultado es válido si queda entre objetivo − 5 y objetivo + 5 min; se prefiere el más cercano, sin buscar exactitud.
- **Combinaciones anteriores**: se analizan los setlists ya hechos (incluidos archivados) para puntuar parejas de canciones que suelen ir seguidas y mantener esas transiciones juntas y en el mismo orden.
- Algo de aleatoriedad para que «Regenerar» dé propuestas distintas.
- Vista previa con lista, duración total y diferencia con el objetivo; se puede regenerar, quitar o cambiar un tema concreto y luego «Aplicar».
- Los no-admin aplican en modo propuesta (como ahora); los admin directamente.
- No se incluye: priorizar por historial de toques ni filtros por etiquetas/estilo.

## 3. Visor de partituras integrado (modo atril)
- Abrir PDFs dentro de la app desde Partituras, con navegación rápida entre archivos de la carpeta de tu instrumento.
- Pantalla completa ocultando la barra de la app.
- Mantener la pantalla encendida mientras el visor está abierto.
- Zoom táctil fluido y lectura en horizontal.

## Detalles técnicos
- `haptic` en `src/lib/haptics.ts`; usarlo en `Counters.tsx`, `SortableList.tsx` y acciones de `setlists.tsx`/`AdminManagement.tsx`.
- Generador en `src/lib/setlistGenerator.ts` (puro, testeable): matriz de transiciones a partir de `setlist_items` ordenados por `position` de todos los setlists; búsqueda voraz con semillas aleatorias + puntuación (distancia al objetivo dentro de ±300 s, peso de transiciones conocidas, penalizar repetidos). Diálogo `SetlistGeneratorDialog.tsx`. Al aplicar se respeta el formato JSON de `notes` (`item_pass_map`, `proposals`).
- Tests de vitest: el total siempre queda dentro de ±5 min cuando es posible; no repite canciones.
- Visor: listar PDFs de la carpeta de Drive y mostrarlos con `pdfjs-dist` cargado solo en cliente; Fullscreen API + Wake Lock API con fallback. Requiere que las carpetas sean públicas («cualquiera con el enlace») o una clave de API de Google Drive; si hace falta, se pedirá en la implementación.
