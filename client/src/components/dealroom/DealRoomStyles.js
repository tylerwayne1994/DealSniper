/**
 * Deal Room design system CSS (shared between the live route and the
 * self-contained HTML export, so both render identically). One accent
 * color variable controls the whole palette — change --dr-accent to
 * re-brand per deal or per sponsor.
 */
export const DEAL_ROOM_ACCENT_DEFAULT = '#0f5132'; // deep green/ink

// Curated, safe font pairings for the sponsor's theme editor — never
// free-text (avoids loading arbitrary/unavailable fonts), each a
// self-contained web-safe stack so the static HTML export renders
// identically with zero external font requests.
export const DEAL_ROOM_FONT_OPTIONS = {
  classic: {
    label: 'Classic Serif',
    heading: 'Georgia, "Times New Roman", serif',
    body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  },
  modern: {
    label: 'Modern Sans',
    heading: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  },
  editorial: {
    label: 'Editorial',
    heading: '"Times New Roman", Times, serif',
    body: 'Georgia, "Times New Roman", serif',
  },
};
export const DEAL_ROOM_FONT_DEFAULT = 'classic';

/**
 * @param {string|{accent?: string, font?: string}} themeOrAccent Either a
 *   plain accent color string (legacy callers) or a theme object with an
 *   `accent` color and a `font` key from DEAL_ROOM_FONT_OPTIONS.
 */
export function buildDealRoomCss(themeOrAccent = DEAL_ROOM_ACCENT_DEFAULT) {
  const isObj = themeOrAccent && typeof themeOrAccent === 'object';
  const accent = (isObj ? themeOrAccent.accent : themeOrAccent) || DEAL_ROOM_ACCENT_DEFAULT;
  const fontKey = (isObj && themeOrAccent.font && DEAL_ROOM_FONT_OPTIONS[themeOrAccent.font]) ? themeOrAccent.font : DEAL_ROOM_FONT_DEFAULT;
  const fonts = DEAL_ROOM_FONT_OPTIONS[fontKey];

  return `
.deal-room {
  --dr-accent: ${accent};
  --dr-bg: #FAFAF7;
  --dr-ink: #111111;
  --dr-muted: #6b7280;
  --dr-border: #e5e7eb;
  background: var(--dr-bg);
  color: var(--dr-ink);
  font-family: ${fonts.body};
  line-height: 1.55;
}
.deal-room * { box-sizing: border-box; }
.dr-serif { font-family: ${fonts.heading}; }

.dr-nav {
  position: sticky; top: 0; z-index: 50;
  background: rgba(255,255,255,0.92); backdrop-filter: blur(6px);
  border-bottom: 1px solid var(--dr-border);
  display: flex; align-items: center; gap: 18px;
  padding: 10px 24px; overflow-x: auto; white-space: nowrap;
}
.dr-nav a {
  color: var(--dr-muted); text-decoration: none; font-size: 13px; font-weight: 600;
  letter-spacing: 0.02em; padding: 4px 0; border-bottom: 2px solid transparent;
}
.dr-nav a:hover, .dr-nav a.active { color: var(--dr-ink); border-bottom-color: var(--dr-accent); }
.dr-progress {
  position: sticky; top: 0; z-index: 51; height: 2px; background: var(--dr-accent);
  width: 0%; transition: width 0.1s linear;
}

.dr-section { max-width: 960px; margin: 0 auto; padding: 56px 24px; border-bottom: 1px solid var(--dr-border); }
.dr-section:last-of-type { border-bottom: none; }
.dr-eyebrow { color: var(--dr-accent); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 8px; }
.dr-h2 { font-size: 30px; font-weight: 700; margin: 0 0 24px; position: relative; padding-bottom: 16px; }
.dr-h2::after { content: ''; position: absolute; left: 0; bottom: 0; width: 46px; height: 3px; background: var(--dr-accent); border-radius: 2px; }
.dr-lead { font-size: 17px; color: var(--dr-ink); max-width: 68ch; }
.dr-lead + .dr-lead { margin-top: 14px; }

.dr-hero { position: relative; height: 420px; overflow: hidden; }
.dr-hero img { width: 100%; height: 100%; object-fit: cover; display: block; }
.dr-hero-empty {
  width: 100%; height: 100%;
  background: linear-gradient(135deg, #1f2937 0%, #111111 100%);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; color: rgba(255,255,255,0.45);
}
.dr-hero-empty span { font-size: 13px; font-weight: 600; }
.dr-hero-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.15) 55%, transparent 100%);
}
.dr-hero-content { position: absolute; left: 24px; right: 24px; bottom: 28px; color: #fff; max-width: 960px; margin: 0 auto; }
.dr-hero-title { font-size: 34px; font-weight: 700; margin: 0 0 4px; }
.dr-hero-sub { font-size: 15px; opacity: 0.9; }

.dr-photo-strip {
  display: flex; gap: 8px; padding: 12px 24px; background: #fff;
  border-bottom: 1px solid var(--dr-border); overflow-x: auto;
}
.dr-photo-thumb { position: relative; flex-shrink: 0; width: 72px; height: 72px; border-radius: 8px; overflow: hidden; }
.dr-photo-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

.dr-stat-bar {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 1px; background: var(--dr-border); border: 1px solid var(--dr-border); margin-top: -1px;
}
.dr-stat { background: #fff; padding: 16px 14px 14px; border-top: 3px solid var(--dr-accent); }
.dr-stat-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--dr-muted); margin-bottom: 4px; }
.dr-stat-value { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }

.dr-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
.dr-card {
  background: #fff; border: 1px solid var(--dr-border); border-radius: 12px; padding: 24px 26px;
  box-shadow: 0 1px 3px rgba(17,17,17,0.05), 0 8px 20px rgba(17,17,17,0.04);
  position: relative; overflow: hidden;
}
.dr-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--dr-accent); }
.dr-card h3 { margin: 0 0 14px; font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.dr-card h3 svg { color: var(--dr-accent); flex-shrink: 0; }

table.dr-table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
table.dr-table th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--dr-muted); padding: 6px 8px; border-bottom: 1px solid var(--dr-border); }
table.dr-table td { padding: 8px 8px; font-size: 14px; border-bottom: 1px solid var(--dr-border); }
table.dr-table td.dr-num, table.dr-table th.dr-num { text-align: right; }
table.dr-table tr.dr-bold td { font-weight: 700; border-top: 1px solid var(--dr-ink); }
table.dr-table tr:last-child td { border-bottom: none; }

.dr-bullets { padding-left: 18px; margin: 8px 0; }
.dr-bullets li { margin-bottom: 6px; font-size: 14px; }

.dr-risk-table td, .dr-risk-table th { vertical-align: top; }

.dr-footer { background: #111111; color: #d1d5db; padding: 40px 24px; }
.dr-footer .dr-section { border-bottom: none; max-width: 960px; padding: 0; }
.dr-footer a { color: #fff; }
.dr-disclaimer { font-size: 11px; color: #9ca3af; margin-top: 18px; }

@media (max-width: 720px) {
  .dr-two-col { grid-template-columns: 1fr; }
  .dr-hero { height: 280px; }
  .dr-hero-title { font-size: 24px; }
  .dr-section { padding: 36px 16px; }
}

@media print {
  .dr-nav, .dr-progress, [data-export-exclude] { display: none !important; }
  .dr-section { border-bottom: 1px solid #ccc; padding: 24px 0; }
  .deal-room { background: #fff; }
}
`;
}
