# Rediseño visual: cristal moderno (Glassmorphism)

Sustituir por completo el estilo cómic (bordes negros gruesos + sombras duras) por un
lenguaje visual actual de paneles de cristal esmerilado, con profundidad moderada y
buen funcionamiento en tema claro y oscuro.

## Dirección visual

- **Paleta cristal claro/oscuro**: fondos `#f2f5fa` / `#dbe4f0` en claro y grises
  azulados profundos (`#141b26`) en oscuro, con el cian del logo `#1BA0DF` como acento
  y luz de realce.
- **Superficies**: tarjetas y barras semitransparentes con desenfoque, borde fino
  luminoso (1px, blanco translúcido en oscuro / gris azulado en claro) y sombra suave
  difusa en lugar de la sombra dura desplazada.
- **Fondo con profundidad**: degradado sutil con dos halos de color (cian y rojo del
  logo, muy tenues) fijos detrás del contenido, para que el cristal tenga algo que
  desenfocar.
- **Tipografía**: se mantiene Bangers para títulos (identidad de la charanga) y Barlow
  para texto, pero con tamaños y espaciados más limpios.
- **Profundidad nivel 3 (medio)**: pulsaciones con escala y elevación, tarjetas con
  ligero levantamiento al pasar/tocar, transiciones suaves y entradas con fundido.
  Sin motores 3D ni parallax de sensores.

## Alcance (todas las pantallas)

1. **Sistema de diseño** (`src/styles.css`): nueva paleta de tokens claro/oscuro,
   sustitución de las utilidades `comic`, `comic-sm` y `comic-press` por sus
   equivalentes de cristal (`glass`, `glass-sm`, `press`), manteniendo los mismos
   nombres de clase donde sea posible para no romper nada, y nuevas utilidades de
   borde luminoso y elevación.
2. **AppShell**: cabecera flotante de cristal, barra inferior móvil tipo "dock"
   translúcida con indicador activo (píldora luminosa), botones de acción redondeados
   con acento cian. Globos de notificación con estilo nuevo.
3. **Pantallas**: Inicio, Letras, Repertorio, Setlists, Contadores (Calle/Arreglos),
   Bolo, Partituras, Redes, Miembros, Ajustes y Login — tarjetas, pestañas, listas,
   diálogos y formularios adaptados al nuevo lenguaje.
4. **Componentes shadcn** (`src/components/ui/`): botón, tarjeta, diálogo, input,
   pestañas, select y toasts alineados con los nuevos tokens.
5. **Contraste y legibilidad**: revisión en claro y oscuro, especialmente en las
   letras (texto largo) y en los contadores.

## Notas técnicas

- Solo cambios de presentación: no se toca la base de datos, ni las consultas, ni la
  lógica de propuestas, permisos o contadores.
- Tailwind v4: los tokens se definen en `@theme inline` de `src/styles.css`; las
  utilidades nuevas con `@utility`. Nada de colores fijos en los componentes.
- El desenfoque se aplica con utilidades `backdrop-blur` de Tailwind (sin prefijos
  `-webkit-` escritos a mano) y con degradación elegante donde no esté soportado.
- Se actualiza el color de la barra de estado (`theme-color` en `src/lib/theme.tsx` y
  `__root.tsx`) para que coincida con la nueva cabecera.
- Se aprovecha para corregir el aviso de hidratación detectado en el arranque.
