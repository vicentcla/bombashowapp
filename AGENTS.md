<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Instrucciones del proyecto — App La Bomba Show

## Qué es esto

Aplicación privada (web) para la xaranga **La Bomba Show**: letras, repertorio y
setlists, y contadores de canciones tocadas, todo detrás de login y con datos
compartidos en la nube. Toda la UI y la documentación están en **español**; los
nombres de tablas/columnas en la BD también.

## Stack y comandos

- **Stack**: TanStack Start (React 19 + TypeScript + Vite) · Tailwind CSS 4 ·
  Supabase (Postgres + Auth) · React Query · `@dnd-kit` (drag & drop) ·
  `sonner` (toasts) · `lucide-react` (iconos). Paquete de UI: shadcn (en
  `src/components/ui/`). Gestor de paquetes: **bun** (`bun.lock`).
- **Comandos**:
  - Instalar: `bun install`
  - Desarrollo: `bun run dev`
  - Build: `bun run build`
  - Lint: `bun run lint` (ESLint + Prettier)
  - No hay framework de tests configurado.
- `components.json` y `vite.config.ts` definen los alias `@/*`.

## Arquitectura

- Rutas en `src/routes/`. Todo el contenido está bajo el layout autenticado
  `src/routes/_authenticated/` (una sola ruta pública: `src/routes/auth.tsx`).
- `src/lib/queries.ts`: tipos + hooks React Query sobre Supabase
  (`useArrangements`, `useStreetSongs`, `useLyrics`, `useSetlists`,
  `useSetlistItems`, `usePlayEvents`, `usePeriods`, `useAddPlay`,
  `useResetCounters`, `useReorder`, `useRoleRequests`, `useTabOrder`,
  `usePendingCount`).
- `src/lib/nav.ts`: definición compartida de pestañas (`ALL_NAV`,
  `DESKTOP_NAV`, `DEFAULT_ORDER`, `orderNav`). La barra inferior móvil muestra
  las 4 primeras del orden personalizado del usuario (`profiles.tab_order`) +
  un botón fijo **«Más»** que abre `/centro`. En móvil la barra solo muestra
  iconos (sin títulos).
- `src/lib/format.ts`: formato de duraciones, saneado de HTML de letras
  (`sanitizeLyricsHtml`), `htmlToPlainText`, `normalize` (quita acentos) y
  `formatTimeComparison` (estados pending/exact/exceeded).
- `src/hooks/useAuth.ts`: `useAuth()` y `useIsAdmin()`.
- `src/components/`: componentes propios (`Counters`, `LyricDialog`,
  `RichTextEditor`, `SortableList`, `TagInput`, `ImportExcelDialog`,
  `ImportCalleDialog`, `InstrumentIcons`, `AppShell`) y UI genérica en `ui/`.
- `src/integrations/supabase/`: clientes de Supabase (cliente y servidor).

## Modelo de datos (Supabase)

Tablas (migraciones en `supabase/migrations/`): `profiles`, `user_roles`,
`arrangements`, `street_songs`, `lyrics`, `setlists`, `setlist_items`,
`reset_periods`, `play_events`, `role_requests`.

- `scope` en `lyrics`/`reset_periods`/`play_events`: `'calle' | 'arreglo'`.
- `arrangements` y `street_songs` tienen `sort_order` (orden manual), `tags`
  (array de texto) y `title`/`duration_seconds`.
- `lyrics` guarda `content` (HTML saneado), `plain_text` (para buscar), y
  enlaza a `arrangement_id` o `street_song_id`.
- `setlist_items` = canciones de un setlist (con `position`).
- `play_events` = cada toque (+1) con `period_id`; el −1 borra el último evento.
- `reset_periods` = periodos de fiestas; el "reiniciar contadores" cierra el
  periodo abierto (le pone `ended_at`) y abre uno nuevo.
- `profiles.tab_order` (`text[]`) = orden personalizado de pestañas de la barra
  inferior por usuario (migración `20260812120000_add_profiles_tab_order.sql`).
  No está en los tipos generados de Supabase: al leerlo/escribirlo se usa un
  cast tipado.
- RLS actual: **todos los autenticados** pueden escribir en `arrangements`,
  `street_songs`, `lyrics`, `setlists` y `setlist_items`. `play_events`,
  `reset_periods` y `user_roles` siguen siendo **solo admin** (helper
  `private.has_role`). Los no-admin no deben poder escribir contadores: su
  flujo de cambios en setlists va por **propuestas** (ver abajo).

## Funcionalidad por página

- `/inicio`: portada con marca (logo, banner, sello X aniversario).
- `/letras`: pestañas **Calle** y **Arreglos**, buscador instantáneo con
  resaltado, editor enriquecido (negrita/cursiva/subrayado) y diálogo de letra.
- `/repertorio`: catálogo de arreglos (crear/editar/borrar, duración mm:ss,
  tags, reordenar) + pestaña de canciones de calle. Incluye importadores
  (`ImportExcelDialog`, `ImportCalleDialog`) desde texto pegado.
- `/setlists`: setlists por concierto con **pases** y **descansos**,
  duración objetivo, comparativa de tiempos, barra de progreso, drag & drop
  cross-pase, archivar/restaurar, copiar estructura, "Deshacer", y **modo
  propuesta** para no-admins (ver "Propuestas").
- `/calle` y `/arreglos`: contadores (tarjetas +1/−1) y estadísticas en vistas
  Mes / Año / Periodo de reseteo.
- `/miembros`: redirige a `/centro`.
- `/centro`: **Centro de control**. Secciones internas **Páginas** (todas las
  pestañas en cuadrícula + "Editar orden" con drag & drop), **Perfil** y
  **Gestión** (solo admin). La sección Perfil y el panel de gestión viven aquí
  (antes en `/ajustes`, que ahora redirige a `/centro`). El panel de gestión
  usa sub-pestañas **Usuarios nuevos**, **Peticiones de Admin** y
  **Modificación Setlist** (revisión de propuestas).

## Formato de `setlists.notes`

La columna `notes` de `setlists` es un **JSON serializado** (ver
`serializeSetlistNotes`/`parseSetlistNotes` en `setlists.tsx`). Contiene:
`target_minutes`, `passes` (`{id,name,target_minutes}`), `breaks`
(`{id,minutes,title}`), `section_order` (IDs de pases y descansos
entremezclados), `item_pass_map` (item_id → pass_id), `archived`, `notes_text`
y `proposals`. Si se edita `setlists` siempre hay que preservar este formato.

## Propuestas (flujo no-admin)

- Los no-admin editan sobre una **copia virtual** en el cliente (modo
  propuesta, `isProposalMode`) y al enviar guardan un `SetlistProposal` en
  `notes.proposals` (con `kind: 'single_song'` o `'bulk_edit'` con
  `bulk_items`). Nada se escribe en `setlist_items` hasta aprobarse.
- Los admin revisan en `/centro` (sección Gestión → "Modificación Setlist"): al
  aprobar, se insertan los items y se actualiza `item_pass_map`; al rechazar,
  solo se marca `status`.
- Tipos compartidos exportados desde `setlists.tsx` (`SetlistProposal`,
  `SetlistNotesConfig`, `parseSetlistNotes`, `serializeSetlistNotes`).

## Convenciones

- Texto visible en español. Diseño "cómic" con clases `comic`, `comic-sm`,
  `comic-press` (definidas en `src/styles.css`) sobre tokens de Tailwind
  (`primary`, `destructive`, `ink`, `card`, `muted-*`...).
- Tema claro/oscuro/automático con la clase `dark` en la raíz (ver
  `src/lib/theme.tsx`). Comprobar contraste en ambos temas.
- Usar los componentes de `src/components/ui/` (shadcn) antes de inventar
  nuevos primitivos. Toasts con `sonner`.
- Las letras se guardan como HTML saneado por `sanitizeLyricsHtml`; al
  mostrarlas se usa `dangerouslySetInnerHTML` solo con contenido ya saneado.
- Drag & drop con `@dnd-kit` (sensors Pointer+Touch con delay en móvil).
- No añadir comentarios salvo que se pidan; seguir el estilo de archivos vecinos.
- Antes de terminar: `bun run lint`. El proyecto usa `exactOptionalPropertyTypes`:
  no pasar `undefined` a props opcionales (p. ej. `initialTab`); omitir la prop.
