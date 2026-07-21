#!/usr/bin/env node
/*
 * This & That — build step
 * Injects the reviews from /content/reviews into the original design template,
 * then writes the finished homepage + SEO files into /public.
 * Runs automatically on Netlify every time content changes. No dependencies.
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SITE_URL = (process.env.URL || "https://thisandthat.today").replace(/\/+$/, "");

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attr = (s = "") => esc(s).replace(/"/g, "&quot;");

// ---- read the review records ----
const dir = path.join(ROOT, "content", "reviews");
let reviews = [];
if (fs.existsSync(dir)) {
  reviews = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))
    .sort((a, b) => (String(a.date) < String(b.date) ? 1 : -1)); // newest first
}

// ---- render one card, matching the original markup exactly ----
function card(r) {
  const tmdbType = r.category === "Movie" ? "movie" : "tv";
  const query = r.tmdbQuery || r.title;
  const yearAttr = r.tmdbYear ? ` data-tmdb-year="${attr(r.tmdbYear)}"` : "";
  const posterAttr = r.poster ? ` data-poster="${attr(r.poster)}"` : "";
  const hasScore = r.score && String(r.score).trim() !== "";
  const foot = hasScore
    ? `<div class="score"><span class="num">${esc(r.score)}</span><span class="out">/10</span></div>
            <span class="verdict">${esc(r.verdict)}</span>`
    : `<span class="status">${esc(r.status)}</span>
            <span class="verdict">${esc(r.verdict)}</span>`;
  return `<article class="review" data-tmdb-type="${tmdbType}" data-tmdb-query="${attr(query)}"${yearAttr}${posterAttr}>
        <div class="review-poster"><span class="mono">T<span class="amp">&amp;</span>T</span><img alt="${attr(r.title)} poster" loading="lazy" /></div>
        <div class="review-body">
          <div class="review-cat"><b>${esc(r.category)}</b> · ${esc(r.catLabel)}</div>
          <h3 class="review-title">${esc(r.title)}</h3>
          <p class="review-take">"${esc(r.take)}"</p>
          <div class="review-foot">
            ${foot}
          </div>
        </div>
      </article>`;
}

// ---- inject into the template ----
let html = fs.readFileSync(path.join(ROOT, "template.html"), "utf8");
const cardsHtml = reviews.length
  ? reviews.map(card).join("\n\n      ")
  : `<p style="grid-column:1/-1;padding:2rem;color:var(--ink-mute)">No reviews yet. Log in at /admin to publish your first one.</p>`;
html = html.replace("<!--REVIEWS-->", cardsHtml);
html = html.replace(/__SITE_URL__/g, SITE_URL);

// ---- write outputs (never touch public/admin or public/uploads) ----
const OUT = path.join(ROOT, "public");
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "index.html"), html);

// sitemap
fs.writeFileSync(
  path.join(OUT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}/</loc><lastmod>${reviews[0]?.date || new Date().toISOString().slice(0, 10)}</lastmod></url>
</urlset>`
);

// rss
const items = reviews
  .map(
    (r) => `    <item>
      <title>${esc(r.title)} — ${esc(r.verdict)}</title>
      <link>${SITE_URL}/#reviews</link>
      <guid isPermaLink="false">${esc(r.title)}-${esc(r.date)}</guid>
      <pubDate>${new Date(String(r.date) + "T00:00:00").toUTCString()}</pubDate>
      <description>${esc(r.take)}</description>
    </item>`
  )
  .join("\n");
fs.writeFileSync(
  path.join(OUT, "rss.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
    <title>This &amp; That</title>
    <link>${SITE_URL}/</link>
    <description>Reality. Reviews. Stories.</description>
${items}
</channel></rss>`
);

// robots
fs.writeFileSync(
  path.join(OUT, "robots.txt"),
  `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`
);

console.log(`Built homepage with ${reviews.length} reviews for ${SITE_URL}`);
reviews.forEach((r) => console.log(` - ${r.title}`));
