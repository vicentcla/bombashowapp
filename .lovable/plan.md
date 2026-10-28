# Rediseño visual "Liquid Glass" de La Bomba Show

Objetivo: una actualización notable y profesional, al nivel de apps actuales (iOS 26 / Liquid Glass), sin cambiar funciones ni datos.

## 1. Colores y temas
- **Claro**: fondo casi blanco con tinte frío muy suave, superficies de cristal translúcido (blur alto, borde fino luminoso, brillo superior sutil), un único color de acento vivo (azul eléctrico del logo) y grises neutros.
- **Oscuro (ahorro de batería)**: fondo negro puro (OLED), tarjetas casi negras, cristal oscuro solo en barra inferior, cabecera y menús emergentes. Menos zonas iluminadas, texto en gris claro en lugar de blanco puro para lo secundario.
- Revisar contraste en ambos temas; sustituir el estilo "cómic" pesado por bordes finos, sombras suaves y esquinas redondeadas grandes (manteniendo el logo y el carácter del grupo en detalles).

## 2. Estructura general (todas las páginas)
- **Cabecera compacta**: logo + afinador a la izquierda, título de la página centrado/grande al hacer scroll (estilo iOS "large title" que se encoge), acciones a la derecha.
- **Barra inferior flotante tipo cápsula de cristal**: 4 pestañas + «Más», iconos más finos, indicador de pestaña activa con pastilla de acento, globo de notificaciones limpio. Respeta zona segura del iPhone.
- Espaciado y tipografía unificados: escala de tamaños fija, márgenes consistentes, listas agrupadas tipo "Ajustes de iOS" (filas con icono, título, detalle y flecha).
- Escritorio: barra lateral de cristal en lugar de pestañas superiores.

## 3. Centro de control («Más»)
- Rejilla de accesos rápidos tipo Centro de Control de iOS: mosaicos grandes (Afinador, Partituras, Setlists, Social…) y mosaicos pequeños (tema claro/oscuro, enviar problema).
- Debajo, lista agrupada del resto de secciones.
- Bloque «Gestión» solo para admin, separado y con globos de pendientes.

## 4. Panel de administración
- Resumen arriba: tarjetas con números (pendientes de aprobar, peticiones de rol, propuestas de setlist, problemas reportados).
- Secciones en pestañas segmentadas: Usuarios · Propuestas · Problemas · Carpetas Drive.
- Usuarios en tres grupos (Pendientes/Rechazados, Administradores, Miembros) con filas limpias y acciones en menú, no botones amontonados.

## 5. Perfil
Nuevo orden: **1. Información de la cuenta** (foto, nombre, instrumento, email, contraseña) → **2. Instalar la app** → **3. Ayuda**. Cada bloque como grupo de cristal con título pequeño.

## 6. Resto de pantallas
Aplicar el nuevo estilo a Inicio, Letras, Repertorio, Setlists, Contadores, Partituras y Social: tarjetas, buscadores tipo cápsula, diálogos como hojas inferiores en móvil, botones primarios uniformes.

## Detalles técnicos
- Tokens nuevos en `src/styles.css` (`--background` negro puro en `.dark`, `--glass-*`, `--shadow-*`, radios); utilidades `glass`, `glass-strong`, `group-list`; las clases `comic*` se redefinen al nuevo estilo para no tocar cada componente.
- `AppShell.tsx`: cabecera + dock flotante + barra lateral de escritorio; `meta theme-color` según tema.
- `centro.tsx`: rejilla de control + lista agrupada; `AdminManagement`/`ProblemReportsAdmin` bajo pestañas con resumen.
- `ProfileSettings.tsx`: reordenar secciones (cuenta, instalar, ayuda).
- Sin cambios en base de datos, permisos ni Cloudflare. Verificación con capturas en móvil (claro y oscuro) y escritorio.
