
# Premium Homepage Rebuild — Netflix / Apple TV+ Level

Scope is intentionally narrow: only the Home route (`/`) and a new admin **Homepage Builder**. Nothing else is touched.

## 1. Route change (only routing edit)

- Currently `/` renders `MoviesPage` per project memory. Change ONLY the `/` route in `src/App.tsx` to render the new `<HomePage />`. Keep `/movies` and every other route exactly as-is.
- Update the memory rule about "default root route is Movies Page" after the change.

## 2. New page — `src/pages/HomePage.tsx`

Independent page composed of modular sections. Reads a `home_layout` config from DB and renders sections in order, respecting per-section enabled/settings. Never imports MoviesPage.

Sections (each in `src/components/home/`):
- `HeroCinema` — fullscreen backdrop slider, autoplay muted trailer (YouTube embed muted, or `<video>` if mp4), overlay + gradient + glass, meta (title, desc, genres, year, runtime, rating, quality), 3 CTAs (Watch Now → `/watch/:type/:id`, Watch Trailer → `TrailerModal`, Add to Watchlist → `watch_later`). Framer Motion transitions, RTL-aware direction, configurable interval/speed/height/blur/overlay.
- `ContinueWatching` — from `watch_history` for logged-in users, with progress bar + remaining time.
- `TrendingRow` — driven by the trending engine (see §4).
- `NewReleases`, `PopularThisWeek`, `MostViewedToday`, `RecentlyAdded` — auto queries.
- `EditorPicks` — manual list, drag/drop ordered in admin.
- `AiRecommendations` — reuses existing `ai-recommendations` edge function.
- `CategoryRow` — one instance per configured genre (Action, Comedy, …), each with its own settings.
- `FeaturedCollections` — banners + carousels from a new `collections` table.
- `LiveStats` — animated counters (movies/series/anime/users/views/vip/favorites/comments/reviews), realtime.
- `VipRow` — VIP-only picks.
- `PremiumFooterExtras` — trending tags, popular searches, genres, collections, latest news, social/apps/help links. Renders ABOVE the existing global Footer (Footer itself is untouched).

Shared building block: `PremiumCarousel` — snap + drag + wheel + keyboard, infinite loop optional, momentum, hover scale/glow/shadow, skeletons, lazy images via existing `OptimizedImage`.

Ads: `<AdvertisementRenderer>` slots above/below every section, plus a new `between_cards` mode in the carousel every N cards, using new placements: `home_hero`, `home_section_top_<key>`, `home_section_bottom_<key>`, `home_between_cards_<key>`, `home_sticky`, `home_popup`.

## 3. Database (single migration)

New tables (all with GRANTs, RLS, updated_at triggers):

- `home_sections` — `key` (unique), `type` (hero|trending|continue|new|popular_week|most_viewed_today|editor_picks|recently_added|ai_recs|category|collections|live_stats|vip|footer_extras|custom), `title_i18n jsonb`, `description_i18n jsonb`, `enabled bool`, `sort_order int`, `settings jsonb` (item count, animation, transition, speed, direction, autoplay, loop, gap, card_style, background, overlay, padding, margin, desktop/tablet/mobile overrides, ad slots config, category filter, weighted trending config, etc.), `created_by`.
  - Public SELECT of enabled sections; write restricted to admins via `has_role`.
- `home_section_items` — manual curation for Editor Picks, VIP Row, Hero manual list: `section_id`, `content_type`, `content_id`, `sort_order`, `active`.
- `home_collections` — `slug`, `title_i18n`, `description_i18n`, `banner_url`, `logo_url`, `theme_color`, `sort_order`, `active`.
- `home_collection_items` — `collection_id`, `content_type`, `content_id`, `sort_order`.
- `home_footer_links` — `group_key` (tags|searches|genres|collections|news|social|apps|help|legal), `label_i18n`, `href`, `icon`, `sort_order`, `active`.

RLS: public read where `active`/`enabled = true`; full write only for `admin`/`super_admin` via existing `has_role`. Realtime enabled for all five tables so edits appear instantly.

Seed default rows for every section type in the same migration so the homepage renders immediately after deploy.

## 4. Trending engine

Client-side scorer in `src/lib/homeTrending.ts`:
- Pulls candidate rows from `movies`/`anime`/`series` (respect existing visibility filters).
- Joins with aggregate metrics already available (`content_views`, `likes`, `comments`, `user_ratings.get_average_rating`, `watch_history`, `watch_later`).
- Applies admin-configured weights from `home_sections.settings` (views %, rating %, likes %, comments %, watch %, favorites %, weekly/monthly/yearly window, optional country, manual overrides).
- Time-window filters via `created_at`/`published_at`.
- Falls back gracefully when a metric table is empty.

`MostViewedToday` and `PopularThisWeek` are thin wrappers around this scorer with fixed windows.

## 5. Admin — Homepage Builder

New route `src/pages/admin/AdminHomepageBuilder.tsx` + sidebar link (`AdminSidebar` already dynamically renders from DB — we add the entry via `page_settings`/sidebar config, not by editing Navbar).

Tabs:
1. **Sections** — drag/drop reorder (`@dnd-kit` already common), inline enable toggle, rename, per-section settings drawer with all listed knobs (animation, transitions, autoplay, loop, gap, card style, backgrounds, overlays, padding/margin, desktop/tablet/mobile breakpoints, ad placement toggles, item count, manual vs auto, trending weights).
2. **Hero** — manual movie picker OR auto rule, slide count, transition type/duration, autoplay, loop, trailer autoplay/mute, overlay opacity, blur, height per breakpoint.
3. **Editor Picks / VIP Row / Hero Manual** — searchable content picker writing to `home_section_items` with drag reorder.
4. **Collections** — CRUD for `home_collections` + item picker for `home_collection_items` with banner/logo upload to existing `content` bucket.
5. **Footer Extras** — CRUD for `home_footer_links` grouped by `group_key`.
6. **Preview** — renders `<HomePage />` in an iframe at device presets (reusing pattern from `AdPreviewDialog`), light/dark toggle, "as guest / logged / VIP" simulation.
7. **Publish** — writes `enabled=true` + bumps `updated_at`; realtime pushes to all visitors.

All writes go through Supabase; nothing lives in localStorage.

## 6. Performance & SEO

- Route-level `React.lazy` for `HomePage` and each heavy section.
- Skeletons per section; `OptimizedImage` with WebP/AVIF where CDN provides it; `loading="lazy"` + `decoding="async"`.
- Prefetch next hero slide's backdrop.
- Framer Motion uses `transform`/`opacity` only (GPU).
- `SEOHead` with localized title/description, JSON-LD `WebSite` + `ItemList` for the visible rails.
- Respect `prefers-reduced-motion`.

## 7. Guardrails

- No edits to: `Navbar.tsx`, `MoviesPage.tsx`, `AnimePage.tsx`, `SeriesPage.tsx`, `ContactUsPage.tsx`/Support Center, Footer, existing routes other than `/`.
- No redirect from `/` to `/movies`. Home is fully standalone.
- All new UI uses semantic tokens from `index.css` (no hardcoded colors).
- RTL/Arabic and 10-language support via existing `LanguageContext` + `content_translations`.

## Technical notes

- Realtime: subscribe once per table via existing debounced pattern in `useAdvertisements` to avoid render storms.
- Continue Watching writes already exist in the video player (`watch_history`); we only read here.
- Ads: extend `AdvertisementRenderer` placements list; no engine changes needed.
- Types regen after migration; then implement all frontend code.

## Deliverables checklist

- [ ] Migration: 5 tables + GRANTs + RLS + triggers + seed + realtime
- [ ] `src/pages/HomePage.tsx` + `src/components/home/*` (Hero, PremiumCarousel, all rows, LiveStats, PremiumFooterExtras)
- [ ] `src/hooks/useHomeLayout.ts`, `src/lib/homeTrending.ts`
- [ ] `src/pages/admin/AdminHomepageBuilder.tsx` + subcomponents
- [ ] Single-line route swap in `src/App.tsx`
- [ ] Memory update for new default `/` behavior
