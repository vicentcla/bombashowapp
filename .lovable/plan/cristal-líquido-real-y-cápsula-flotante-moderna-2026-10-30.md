# Cristal líquido real y cápsula flotante moderna

## Objetivo
Que el efecto de cristal se vea de verdad en iPhone (claro y oscuro) y que la barra inferior sea una cápsula flotante al estilo de las apps actuales. Sin cambiar funciones ni datos.

## 1. Cristal líquido visible
- En modo oscuro el cristal hoy es casi opaco (fondo sólido): pasarlo a negro translúcido con desenfoque fuerte, para que se note el contenido pasando por debajo y siga ahorrando batería (el fondo de página sigue negro puro).
- En modo claro: más transparencia, más desenfoque y saturación, borde superior brillante y un reflejo suave en diagonal (capa de luz) que da el aspecto "líquido".
- Asegurar compatibilidad con Safari de iPhone (el desenfoque se aplica bien también tras publicar en Cloudflare).
- Aplicarlo a: cabecera, cápsula inferior, menús emergentes, popover de afinador/metrónomo y hojas inferiores. Las tarjetas de contenido siguen sólidas para leer bien.

## 2. Cápsula flotante moderna
- Cápsula separada de los bordes y del fondo, más compacta, esquinas totalmente redondas, sombra suave flotante.
- Pestaña activa marcada con una píldora de cristal interna que se desliza con animación al cambiar de pestaña; icono activo en color de acento y algo más grande.
- Botón «Más» integrado como último elemento, mismo estilo.
- Respeta la zona inferior del iPhone; el contenido tiene margen inferior para no quedar tapado.
- Al tocar: ligera reducción de tamaño (sensación táctil).

## 3. Barra lateral
Solo existe en ordenador/tablet grande; en el móvil no aparece (es intencionado). Se le aplica el mismo cristal para que sea coherente.

## 4. Verificación
- Entrar con la cuenta de Vicent en el entorno de pruebas, capturas en tamaño iPhone en modo claro y oscuro de Inicio, Calle, Setlists, Centro y Gestión.
- Comprobar que el cristal deja ver el contenido detrás al desplazar, que la píldora activa se mueve y que nada queda tapado por la cápsula.
- Revisar errores de compilación, consola y lint; pasar los tests existentes.

## Detalles técnicos
- `src/styles.css`: rehacer tokens `--glass-*` (oscuro: `oklch(0.12 0 0 / 0.55)`), utilidades `glass`, `glass-strong`, nueva `liquid` con pseudo-elemento de reflejo (`&::before` gradiente) y `backdrop-filter: blur(28px) saturate(200%)` sin prefijos manuales.
- `src/components/AppShell.tsx`: dock con indicador absoluto animado (transform según índice activo), `active:scale-95`, padding inferior del main ajustado.
- Comprobar que ningún ancestro con `overflow`/`transform` rompe el `backdrop-filter`.
