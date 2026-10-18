# Copy de redes: formato de WhatsApp al pegar y escritura directa siempre activa

## 1. Entender el formato de WhatsApp al pegar
Al pegar un texto en el editor de copy, se convierten sus marcas al estilo correspondiente y se quitan los símbolos:
- `*hola*` → **negrita** (𝐡𝐨𝐥𝐚)
- `_hola_` → *cursiva*
- `*_hola_*` o `_*hola*_` → negrita cursiva
- ```` ```hola``` ```` → monoespaciada
- `~hola~` → se deja tal cual (no existe tachado en estas tipografías)

Solo se convierte cuando la marca abre y cierra en la misma línea y rodea texto (por ejemplo, `5 * 3` o un `*` suelto no cambian). Las palabras sin marcas toman la tipografía y el estilo que tengas elegidos, igual que si las escribieras.

## 2. Quitar «Escribir directo»
- El botón desaparece y la escritura directa queda siempre activada: todo lo que escribas sale con la tipografía y el estilo marcados.
- Para cambiar una parte ya escrita, la seleccionas y eliges la tipografía o el estilo (o pulsas «Aplicar» o la goma de borrar formato), como ahora.
- Con la tipografía «Normal» y el estilo «Normal», se escribe texto sin formato.
- Se actualiza el texto de ayuda del editor.

## Detalles técnicos
- En `src/routes/_authenticated/social.tsx`: eliminar el estado `liveMode` y su botón; `handleContentChange` usa siempre `composeUnicodeStyle(fontFamily, fontStyle)`.
- Nuevo `onPaste` en el textarea: `preventDefault`, leer `text/plain`, convertir el texto con una función pura `whatsappToUnicode(text, base)` en `src/lib/format.ts` (expresiones regulares para ```` ``` ````, `*_ _*`, `*`, `_`, que no crucen saltos de línea), insertar el resultado en la selección, actualizar `prevContentRef` y colocar el cursor al final.
- Prueba en vitest para `whatsappToUnicode`: `*hola*` sale en negrita, `_hola_` en cursiva, `5 * 3` sin cambios.
