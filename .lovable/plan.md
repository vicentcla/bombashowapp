## Objetivo

App privada para La Bomba Show (xaranga) con 4 áreas: Letras, Repertorio/Setlists, Contadores de Calle y Contadores de Arreglos, todo detrás de login y con datos compartidos en la nube.

## Marca e identidad

- Se usan los tres archivos subidos: el **logo original** (bomba + explosión) como marca principal e icono de la app, el **banner** ("LA BOMBA SHOW XARANGA") como cabecera del login y de la pantalla de inicio, y el **logo del X aniversario** como sello destacado en la pantalla de inicio.
- Los tres se suben al CDN de assets (no engordan el repositorio) y el favicon se genera a partir del logo original.
- Paleta tomada directamente del logo: azul cian vivo, rojo, amarillo y negro de contorno grueso, sobre fondo claro u oscuro. Estética cómic/pop: bordes marcados, tipografía de titulares con carácter, botones grandes tipo "explosión".

## Modo oscuro / claro

- Tres modos seleccionables: **Automático (sigue el teléfono)**, **Claro** y **Oscuro**. Por defecto Automático, usando la preferencia del sistema (`prefers-color-scheme`).
- El selector vive en la barra superior y en Ajustes; la elección se recuerda en el dispositivo.
- Ambos temas se definen con los mismos tokens semánticos, con contraste comprobado para leer letras en la calle de noche.

## Nota sobre GitHub y Cloudflare Pages

El código se puede sincronizar con GitHub desde Lovable (menú + → GitHub) y desplegar desde ahí. Pero los datos compartidos (letras, setlists, contadores) necesitan base de datos y login reales: eso lo aporta **Lovable Cloud**, que activaré en el proyecto. Cloudflare Pages sirve solo archivos estáticos, así que la base de datos seguiría en Lovable Cloud. Recomendación: publicar desde Lovable y usar GitHub como copia/versionado.

## Acceso y roles

- Login con email + contraseña (y Google como opción rápida).
- Sin sesión no se ve nada: todo detrás de la puerta de autenticación; solo `/auth` es pública.
- Tabla de roles separada (`admin` / `miembro`):
  - **Admin**: crear, editar y borrar todo; resetear contadores.
  - **Miembro**: solo lectura (letras, setlists, estadísticas).
- El primer usuario registrado queda como admin; después los admins ascienden a otros desde la pantalla de Miembros.

## 1. Letras

- Página `/letras` con dos pestañas: **Calle** y **Arreglos (en parado)**.
- Buscador instantáneo por título y por contenido, con resaltado del término.
- Botón "Añadir letra" (solo admin) con editor enriquecido: **negrita**, *cursiva*, subrayado y separadores para varias letras en un mismo texto. El HTML se sanea antes de guardar y mostrar.
- Editar y borrar letras existentes (solo admin).
- Las letras de Arreglos se vinculan a los arreglos del punto 2.

## 2. Repertorio y Setlists

- Página `/repertorio` con dos partes:
  - **Catálogo de arreglos**: crear/editar/borrar con título, duración (minutos + segundos) y tags. Es la fuente única que alimenta Letras y Contadores de Arreglos.
  - **Setlists**: crear un setlist por concierto (nombre y fecha), añadir arreglos del catálogo, reordenar y quitar. Se muestra la duración de cada uno y el **tiempo total acumulado** en vivo.
- Desde un arreglo se accede directo a su letra (o a crearla).

## 3. Contadores de canciones de calle

- Página `/calle` con una tarjeta por canción, botón +1 y −1 para corregir.
- Cada pulsación guarda fecha y hora.
- Añadir canción nueva con su título.
- Botón "Reiniciar todo a 0" (solo admin, con confirmación): abre un nuevo periodo de fiestas sin borrar el histórico.
- Botón "Estadísticas": tabla con el total por canción en tres vistas — **Mes**, **Año** y **Periodo de reseteo** (con selector), ordenable.

## 4. Contadores de arreglos

- Igual que el punto 3, pero sobre el catálogo de arreglos del punto 2 (sincronizado, sin duplicar títulos).
- Cada tarjeta muestra duración y acceso a su letra.
- Filtro por **tags** y buscador.
- Mismo reseteo global y mismas estadísticas, independientes de las de calle.

## Detalles técnicos

- Lovable Cloud (Postgres + Auth) con RLS en todas las tablas: lectura para autenticados, escritura solo para admin mediante función `has_role` de seguridad definida.
- Tablas: `profiles`, `user_roles`, `arrangements`, `lyrics`, `setlists`, `setlist_items`, `street_songs`, `play_events`, `reset_periods`.
- Estadísticas por agregación sobre `play_events` según mes, año o periodo de reseteo.
- Rutas protegidas bajo el layout autenticado; `/auth` como única ruta pública.
- Tema gestionado con clase `dark` en la raíz + `matchMedia` para el modo automático, sin parpadeo al cargar.
- Navegación inferior fija en móvil con las 4 secciones.

## Orden de trabajo

1. Assets de marca, favicon, paleta del logo y sistema de temas (auto/claro/oscuro).
2. Lovable Cloud, auth y roles + pantalla de login con el banner.
3. Esquema de base de datos completo con RLS.
4. Repertorio y setlists.
5. Letras con editor enriquecido y buscador.
6. Contadores de calle + estadísticas.
7. Contadores de arreglos con tags + estadísticas.
8. Pantalla de miembros y ajustes.
