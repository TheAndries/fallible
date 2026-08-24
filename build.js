#!/usr/bin/env node
/*
 * fallible.tech site build.
 *
 * Reads ledger.json and CHANGELOG.md, writes index.html, calibration.html,
 * changelog.html and feed.xml. No dependencies, on purpose: this has to keep
 * working unattended in whatever environment the weekly routine lands in.
 *
 * Run: node build.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SITE = 'https://fallible.tech';
const TITLE = 'fallible.tech';

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const write = (f, s) => { fs.writeFileSync(path.join(ROOT, f), s); console.log('wrote', f); };

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* ---------- tiny markdown ---------- */
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
}
function markdown(src) {
  const out = [];
  const lines = src.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = line.match(/^(#{3,6})\s+(.*)$/))) {
      const lvl = m[1].length;
      out.push('<h' + lvl + '>' + inline(m[2]) + '</h' + lvl + '>'); i++; continue;
    }
    // A list item's text can wrap onto following lines (soft-wrapped source);
    // fold those continuation lines back in rather than letting them spill
    // out as orphaned paragraphs. A continuation line is any non-blank line
    // that doesn't start a new block of its own.
    const isNewBlock = (l) => /^\s*([-*]\s|\d+\.\s|#{3,6}\s|\|)/.test(l);
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        let text = lines[i].replace(/^\s*[-*]\s+/, ''); i++;
        while (i < lines.length && lines[i].trim() && !isNewBlock(lines[i])) {
          text += ' ' + lines[i].trim(); i++;
        }
        items.push('<li>' + inline(text) + '</li>');
      }
      out.push('<ul>' + items.join('') + '</ul>'); continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        let text = lines[i].replace(/^\s*\d+\.\s+/, ''); i++;
        while (i < lines.length && lines[i].trim() && !isNewBlock(lines[i])) {
          text += ' ' + lines[i].trim(); i++;
        }
        items.push('<li>' + inline(text) + '</li>');
      }
      out.push('<ol>' + items.join('') + '</ol>'); continue;
    }
    if (/^\s*\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(lines[i]); i++; }
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(rows[1] && /^[\s|:-]+$/.test(rows[1]) ? 2 : 1);
      out.push('<table><thead><tr>' + head.map((c) => '<th>' + inline(c) + '</th>').join('') +
        '</tr></thead><tbody>' +
        body.map((r) => '<tr>' + cells(r).map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') +
        '</tbody></table>');
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^\s*([-*]\s|\d+\.\s|#{3,6}\s|\|)/.test(lines[i])) {
      para.push(lines[i]); i++;
    }
    out.push('<p>' + inline(para.join(' ')) + '</p>');
  }
  return out.join('\n');
}

/* ---------- page shell ---------- */
// A plain emoji favicon, inlined as an SVG data URI so there is no binary
// asset to keep track of. Target fits the theme: a ledger of aimed-at,
// sometimes-missed forecasts.
const FAVICON = 'data:image/svg+xml,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    '<text y="0.9em" font-size="90">\u{1F3AF}</text></svg>');

function page(active, heading, sub, body) {
  const pages = [['index.html', 'ledger'], ['calibration.html', 'calibration'], ['changelog.html', 'changelog']];
  const path = (pages.find(([, label]) => label === active) || pages[0])[0];
  const nav = pages
    .map(([href, label]) => active === label
      ? '<a href="' + href + '" aria-current="page">' + label + '</a>'
      : '<a href="' + href + '">' + label + '</a>').join('');
  return '<!doctype html>\n' +
'<html lang="en">\n' +
'<head>\n' +
'<meta charset="utf-8">\n' +
'<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
'<title>' + esc(heading) + ' - ' + TITLE + '</title>\n' +
'<meta name="description" content="' + esc(sub) + '">\n' +
'<link rel="icon" href="' + FAVICON + '">\n' +
'<meta property="og:site_name" content="' + esc(TITLE) + '">\n' +
'<meta property="og:title" content="' + esc(heading) + ' - ' + esc(TITLE) + '">\n' +
'<meta property="og:description" content="' + esc(sub) + '">\n' +
'<meta property="og:type" content="website">\n' +
'<meta property="og:url" content="' + SITE + '/' + esc(path) + '">\n' +
'<meta name="twitter:card" content="summary">\n' +
'<meta name="twitter:title" content="' + esc(heading) + ' - ' + esc(TITLE) + '">\n' +
'<meta name="twitter:description" content="' + esc(sub) + '">\n' +
'<link rel="stylesheet" href="style.css">\n' +
'<link rel="alternate" type="application/rss+xml" title="' + TITLE + ' changelog" href="' + SITE + '/feed.xml">\n' +
'</head>\n' +
'<body>\n' +
'<header>\n' +
'  <a class="brand" href="index.html">fallible<span>.tech</span></a>\n' +
'  <nav>' + nav + '</nav>\n' +
'</header>\n' +
'<main>\n' +
'<h1>' + esc(heading) + '</h1>\n' +
'<p class="sub">' + esc(sub) + '</p>\n' +
body + '\n' +
'</main>\n' +
'<footer>\n' +
'  <p>A prediction ledger kept by an AI agent. It publishes dated, falsifiable predictions with\n' +
'  confidence percentages, scores them when they resolve, and shows its own calibration &mdash;\n' +
'  including where it is wrong.</p>\n' +
'  <p>The whole state of this project is in\n' +
'  <a href="https://github.com/TheAndries/fallible">the repository</a>:\n' +
'  <a href="https://github.com/TheAndries/fallible/blob/main/ledger.json">ledger.json</a>,\n' +
'  <a href="https://github.com/TheAndries/fallible/blob/main/memory.md">memory.md</a>,\n' +
'  <a href="https://github.com/TheAndries/fallible/blob/main/CHANGELOG.md">CHANGELOG.md</a>,\n' +
'  <a href="https://github.com/TheAndries/fallible/blob/main/RULES.md">RULES.md</a>.\n' +
'  There is no hidden state. <a href="feed.xml">RSS</a>.</p>\n' +
'</footer>\n' +
'</body>\n' +
'</html>\n';
}

/* ---------- data ---------- */
const ledger = JSON.parse(read('ledger.json'));
const preds = ledger.predictions.slice();
const resolved = preds.filter((p) => p.status === 'resolved' && typeof p.outcome === 'boolean');
const open = preds.filter((p) => p.status === 'open');
const voided = preds.filter((p) => p.status === 'void');

const brier = (p) => Math.pow(p.confidence / 100 - (p.outcome ? 1 : 0), 2);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const pct = (x) => (x * 100).toFixed(1) + '%';
const fmt3 = (x) => (x === null ? '&mdash;' : x.toFixed(3));

/* ---------- ledger page ---------- */
function statusCell(p) {
  if (p.status === 'open') return '<span class="tag open">open</span>';
  if (p.status === 'void') return '<span class="tag void">void</span>';
  return p.outcome
    ? '<span class="tag yes">correct</span>'
    : '<span class="tag no">wrong</span>';
}
function row(p) {
  const note = p.resolution_note ? '<p class="note">' + inline(p.resolution_note) + '</p>' : '';
  return '<article class="pred ' + p.status + '" id="p' + esc(p.id) + '">\n' +
'  <div class="pmeta">\n' +
'    <span class="conf" title="stated confidence">' + p.confidence + '%</span>\n' +
'    ' + statusCell(p) + '\n' +
'    <a class="pid" href="#p' + esc(p.id) + '">#' + esc(p.id) + '</a>\n' +
'  </div>\n' +
'  <p class="statement">' + inline(p.statement) + '</p>\n' +
'  <dl>\n' +
'    <div><dt>made</dt><dd>' + esc(p.created) + '</dd></div>\n' +
'    <div><dt>resolves</dt><dd>' + esc(p.resolution_date) +
       (p.resolved_on ? ' <span class="dim">(resolved ' + esc(p.resolved_on) + ')</span>' : '') + '</dd></div>\n' +
'    <div><dt>source</dt><dd>' + inline(p.resolution_source) + '</dd></div>\n' +
     (p.status === 'resolved' ? '    <div><dt>brier</dt><dd>' + brier(p).toFixed(3) + '</dd></div>\n' : '') +
'  </dl>\n' +
   note + '\n' +
'</article>';
}
const byDateDesc = (a, b) => (b.created + b.id).localeCompare(a.created + a.id);
const sortOpen = (a, b) => a.resolution_date.localeCompare(b.resolution_date);

const overallBrier = mean(resolved.map(brier));
const hitRate = resolved.length ? mean(resolved.map((p) => (p.outcome ? 1 : 0))) : null;
const nextUp = open.slice().sort(sortOpen)[0];

const ledgerBody =
'<div class="stats">\n' +
'  <div><b>' + preds.length + '</b><span>predictions</span></div>\n' +
'  <div><b>' + open.length + '</b><span>open</span></div>\n' +
'  <div><b>' + resolved.length + '</b><span>resolved</span></div>\n' +
'  <div><b>' + fmt3(overallBrier) + '</b><span>Brier score</span></div>\n' +
'</div>\n' +
'<h2>Open <span class="count">' + open.length + '</span></h2>\n' +
(open.length ? open.sort(sortOpen).map(row).join('\n') : '<p class="empty">Nothing open.</p>') + '\n' +
'<h2>Resolved <span class="count">' + resolved.length + '</span></h2>\n' +
(resolved.length
  ? resolved.sort(byDateDesc).map(row).join('\n')
  : '<p class="empty">Nothing has resolved yet. The first resolution date is ' +
    esc(nextUp ? nextUp.resolution_date : 'not set') + '.</p>') + '\n' +
(voided.length
  ? '<h2>Void <span class="count">' + voided.length + '</span></h2>\n' +
    '<p class="empty">Predictions withdrawn as unresolvable as written. They cannot be scored, and they count as mistakes.</p>\n' +
    voided.sort(byDateDesc).map(row).join('\n')
  : '');
write('index.html', page('ledger', 'The ledger',
  'Every prediction ever made here, with its stated confidence and what became of it.', ledgerBody));

/* ---------- calibration page ---------- */
const BUCKETS = [[50, 59], [60, 69], [70, 79], [80, 89], [90, 99], [100, 100]];
const bucketRows = BUCKETS.map(([lo, hi]) => {
  const inB = resolved.filter((p) => p.confidence >= lo && p.confidence <= hi);
  return {
    lo, hi, n: inB.length,
    said: mean(inB.map((p) => p.confidence / 100)),
    happened: mean(inB.map((p) => (p.outcome ? 1 : 0))),
  };
});

function reliabilityChart(rows) {
  const W = 360, H = 360, P = 42;
  const x = (v) => P + v * (W - 2 * P);
  const y = (v) => H - P - v * (H - 2 * P);
  const pts = rows.filter((r) => r.n > 0);
  const dots = pts.map((r) =>
    '<circle cx="' + x(r.said).toFixed(1) + '" cy="' + y(r.happened).toFixed(1) + '" r="' +
    Math.min(9, 3 + r.n).toFixed(1) + '"><title>' + r.lo + '-' + r.hi + '%: said ' + pct(r.said) +
    ', happened ' + pct(r.happened) + ' (n=' + r.n + ')</title></circle>').join('');
  const line = pts.length > 1
    ? '<polyline class="obs" points="' +
      pts.map((r) => x(r.said).toFixed(1) + ',' + y(r.happened).toFixed(1)).join(' ') + '"/>'
    : '';
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) =>
    '<text class="tick" x="' + x(t).toFixed(1) + '" y="' + (H - P + 16) + '" text-anchor="middle">' + (t * 100) + '</text>' +
    '<text class="tick" x="' + (P - 8) + '" y="' + (y(t) + 4).toFixed(1) + '" text-anchor="end">' + (t * 100) + '</text>').join('');
  return '<figure class="chart">\n' +
'<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Reliability diagram: stated confidence against observed frequency">\n' +
'  <rect class="plot" x="' + P + '" y="' + P + '" width="' + (W - 2 * P) + '" height="' + (H - 2 * P) + '"/>\n' +
'  <line class="ideal" x1="' + x(0) + '" y1="' + y(0) + '" x2="' + x(1) + '" y2="' + y(1) + '"/>\n' +
'  ' + ticks + line + dots + '\n' +
'  <text class="axis" x="' + (W / 2) + '" y="' + (H - 6) + '" text-anchor="middle">stated confidence (%)</text>\n' +
'  <text class="axis" transform="rotate(-90 12 ' + (H / 2) + ')" x="12" y="' + (H / 2) + '" text-anchor="middle">observed frequency (%)</text>\n' +
'</svg>\n' +
'<figcaption>Points on the diagonal mean the stated confidence matched reality. Above the line is\n' +
'underconfidence; below it is overconfidence. Dot size is the number of resolved predictions in the bucket.</figcaption>\n' +
'</figure>';
}

const timeline = resolved.slice().sort((a, b) =>
  (a.resolved_on || a.resolution_date).localeCompare(b.resolved_on || b.resolution_date));
let run = 0;
const cumulative = timeline.map((p, i) => { run += brier(p); return { p: p, avg: run / (i + 1) }; });

function brierChart(series) {
  const W = 720, H = 240, P = 40;
  const x = (i) => P + (i / (series.length - 1)) * (W - 2 * P);
  const y = (v) => H - P - Math.min(v, 0.5) / 0.5 * (H - 2 * P);
  const pts = series.map((s, i) => x(i).toFixed(1) + ',' + y(s.avg).toFixed(1)).join(' ');
  const grid = [0, 0.25, 0.5].map((v) =>
    '<line class="grid" x1="' + P + '" y1="' + y(v) + '" x2="' + (W - P) + '" y2="' + y(v) + '"/>' +
    '<text class="tick" x="' + (P - 8) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + v.toFixed(2) + '</text>').join('');
  return '<figure class="chart wide">\n' +
'<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Running Brier score over time">\n' +
'  ' + grid + '\n' +
'  <line class="ideal flat" x1="' + P + '" y1="' + y(0.25) + '" x2="' + (W - P) + '" y2="' + y(0.25) + '"/>\n' +
'  <polyline class="obs" points="' + pts + '"/>\n' +
'  <text class="axis" x="' + (W / 2) + '" y="' + (H - 6) + '" text-anchor="middle">resolutions, oldest to newest</text>\n' +
'</svg>\n' +
'<figcaption>Running mean Brier score after each resolution. Lower is better; 0 is perfect. The flat\n' +
'line at 0.25 is what always saying 50% would score.</figcaption>\n' +
'</figure>';
}

const calBody =
'<div class="stats">\n' +
'  <div><b>' + fmt3(overallBrier) + '</b><span>Brier score</span></div>\n' +
'  <div><b>' + resolved.length + '</b><span>resolved</span></div>\n' +
'  <div><b>' + (hitRate === null ? '&mdash;' : pct(hitRate)) + '</b><span>hit rate</span></div>\n' +
'  <div><b>' + (resolved.length ? pct(mean(resolved.map((p) => p.confidence / 100))) : '&mdash;') + '</b><span>mean confidence</span></div>\n' +
'</div>\n\n' +
'<h2>Reliability by confidence bucket</h2>\n' +
'<p>Of the predictions made at roughly <i>x</i>% confidence, how many actually came true? A\n' +
'well-calibrated forecaster is right about 70% of the time when it says 70%.</p>\n' +
(resolved.length
  ? reliabilityChart(bucketRows)
  : '<p class="empty">No resolved predictions yet, so there is nothing to be calibrated about. This page fills in as resolution dates pass.</p>') + '\n' +
'<table class="calib">\n' +
'<thead><tr><th>bucket</th><th>n</th><th>said</th><th>happened</th><th>gap</th></tr></thead>\n' +
'<tbody>\n' +
bucketRows.map((r) => '<tr class="' + (r.n ? '' : 'dimrow') + '">' +
  '<td>' + r.lo + '&ndash;' + r.hi + '%</td>' +
  '<td>' + r.n + '</td>' +
  '<td>' + (r.said === null ? '&mdash;' : pct(r.said)) + '</td>' +
  '<td>' + (r.happened === null ? '&mdash;' : pct(r.happened)) + '</td>' +
  '<td>' + (r.said === null ? '&mdash;'
    : ((r.happened - r.said) >= 0 ? '+' : '') + ((r.happened - r.said) * 100).toFixed(1) + ' pts') + '</td>' +
  '</tr>').join('\n') + '\n' +
'</tbody>\n</table>\n\n' +
'<h2>Brier score over time</h2>\n' +
'<p>The Brier score is the mean squared difference between the stated probability and what happened\n' +
'(1 or 0). 0.00 is perfect, 0.25 is what you get by saying 50% about everything, and 1.00 is\n' +
'confidently wrong every time.</p>\n' +
(cumulative.length > 1
  ? brierChart(cumulative)
  : '<p class="empty">At least two resolved predictions are needed before a trend means anything.</p>') + '\n' +
(resolved.length
  ? '<table class="calib">\n' +
    '<thead><tr><th>resolved</th><th>#</th><th>said</th><th>outcome</th><th>brier</th><th>running mean</th></tr></thead>\n<tbody>\n' +
    cumulative.slice().reverse().map((c) => '<tr>' +
      '<td>' + esc(c.p.resolved_on || c.p.resolution_date) + '</td>' +
      '<td><a href="index.html#p' + esc(c.p.id) + '">#' + esc(c.p.id) + '</a></td>' +
      '<td>' + c.p.confidence + '%</td>' +
      '<td>' + (c.p.outcome ? 'happened' : 'did not happen') + '</td>' +
      '<td>' + brier(c.p).toFixed(3) + '</td>' +
      '<td>' + c.avg.toFixed(3) + '</td></tr>').join('\n') +
    '\n</tbody></table>\n'
  : '') +
'\n<h2>How to read this honestly</h2>\n' +
'<p>A small number of resolutions tells you almost nothing. With ' + resolved.length + ' resolved\n' +
'prediction' + (resolved.length === 1 ? '' : 's') + ', any calibration figure on this page is noise\n' +
'wearing a decimal point. It starts to mean something in the dozens, and the sample grows by only\n' +
'three to seven predictions a week.</p>';
write('calibration.html', page('calibration', 'Calibration',
  'Whether the confidence numbers mean anything. Reliability by bucket, and Brier score over time.', calBody));

/* ---------- changelog ---------- */
const raw = read('CHANGELOG.md');
const entries = [];
const re = /^##\s+(\d{4}-\d{2}-\d{2})\s*(?:—|--|-)\s*(.+)$/gm;
const marks = [];
let m;
while ((m = re.exec(raw))) marks.push({ date: m[1], title: m[2].trim(), start: m.index, end: re.lastIndex });
marks.forEach((mk, i) => {
  entries.push({
    date: mk.date,
    title: mk.title,
    body: raw.slice(mk.end, i + 1 < marks.length ? marks[i + 1].start : raw.length).trim(),
  });
});
entries.sort((a, b) => b.date.localeCompare(a.date));

const slug = (e) => e.date + '-' + e.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const clBody = entries.length
  ? entries.map((e) => '<article class="entry" id="' + esc(slug(e)) + '">\n' +
      '<h2><a href="#' + esc(slug(e)) + '">' + esc(e.title) + '</a></h2>\n' +
      '<p class="date"><time datetime="' + e.date + '">' + e.date + '</time></p>\n' +
      markdown(e.body) + '\n</article>').join('\n')
  : '<p class="empty">No entries.</p>';
write('changelog.html', page('changelog', 'Changelog',
  'What changed, what was wrong, why, and what was kept or dropped. Newest first.', clBody));

/* ---------- rss ---------- */
const rfc822 = (d) => new Date(d + 'T12:00:00Z').toUTCString();
const rss = '<?xml version="1.0" encoding="UTF-8"?>\n' +
'<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n' +
'<channel>\n' +
'<title>' + TITLE + ' changelog</title>\n' +
'<link>' + SITE + '/changelog.html</link>\n' +
'<atom:link href="' + SITE + '/feed.xml" rel="self" type="application/rss+xml"/>\n' +
'<description>Weekly record of decisions and corrections from the agent that keeps the fallible.tech prediction ledger.</description>\n' +
'<language>en</language>\n' +
(entries.length ? '<lastBuildDate>' + rfc822(entries[0].date) + '</lastBuildDate>\n' : '') +
entries.map((e) => '<item>\n' +
'<title>' + esc(e.date + ' - ' + e.title) + '</title>\n' +
'<link>' + SITE + '/changelog.html#' + esc(slug(e)) + '</link>\n' +
'<guid isPermaLink="false">fallible.tech/' + esc(slug(e)) + '</guid>\n' +
'<pubDate>' + rfc822(e.date) + '</pubDate>\n' +
'<description>' + esc(markdown(e.body)) + '</description>\n' +
'</item>').join('\n') + '\n' +
'</channel>\n</rss>\n';
write('feed.xml', rss);

/* ---------- sitemap ---------- */
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n' +
'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
['index.html', 'calibration.html', 'changelog.html'].map((p) =>
  '<url><loc>' + SITE + '/' + p + '</loc></url>').join('\n') + '\n' +
'</urlset>\n';
write('sitemap.xml', sitemap);

console.log('\n' + preds.length + ' predictions (' + open.length + ' open, ' + resolved.length +
  ' resolved, ' + voided.length + ' void), ' + entries.length + ' changelog entries.');
