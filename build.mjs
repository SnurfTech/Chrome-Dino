#!/usr/bin/env node
// Builds a single self-contained dino.html from Chromium's neterror page.
//
//   node build.mjs [--out dist/dino.html] [--minify] [--fresh] [--ref 140.0.7339.80]
//   bun  build.mjs [...]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
 
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(ROOT, '.cache');
const CLONE = path.join(CACHE, 'chromium');
const WORK = path.join(CACHE, 'work');
 
const { values: opts } = parseArgs({
  options: {
    out: { type: 'string', default: 'dist/dino.html' },
    fresh: { type: 'boolean', default: false },
    minify: { type: 'boolean', default: false },
    ref: { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
  },
});
 
if (opts.help) {
  console.log('Usage: build.mjs [--out <file>] [--minify] [--fresh] [--ref <chromium-tag>]');
  process.exit(0);
}
 
const log = (...a) => console.log('•', ...a);
const warn = (...a) => console.warn('! WARNING:', ...a);
 
// ---------------------------------------------------------------- 1. fetch
 
const SPARSE_PATHS = [
  'components/neterror/resources',
  'components/security_interstitials/core/common/resources',
  'components/security_interstitials/core/browser/resources',
  'components/resources',
  'ui/webui/resources/js',
  'third_party/lit/v3_0',
];
 
function git(args, cwd) {
  execFileSync('git', args, { cwd, stdio: 'inherit' });
}
 
const REF_FILE = path.join(CACHE, 'chromium.ref');
 
function fetchChromium() {
  const wantRef = opts.ref ?? '';
  const haveRef = fs.existsSync(REF_FILE) ? fs.readFileSync(REF_FILE, 'utf8').trim() : '';
  if (opts.fresh || (fs.existsSync(CLONE) && haveRef !== wantRef)) {
    fs.rmSync(CLONE, { recursive: true, force: true });
  }
  if (!fs.existsSync(path.join(CLONE, '.git'))) {
    log(`Cloning Chromium ${wantRef || '(default branch)'} (sparse, blobless)…`);
    fs.mkdirSync(CACHE, { recursive: true });
    git(
      [
        'clone', '--depth', '1', '--filter=blob:none',
        '--sparse', '--no-checkout',
        ...(wantRef ? ['--branch', wantRef] : []),
        'https://github.com/chromium/chromium.git', CLONE,
      ],
      ROOT,
    );
    fs.writeFileSync(REF_FILE, wantRef);
    git(['sparse-checkout', 'set', ...SPARSE_PATHS], CLONE);
    git(['checkout'], CLONE);
  } else if (!SPARSE_PATHS.every((p) => fs.existsSync(path.join(CLONE, p)))) {
    log('Extending sparse checkout with newly required paths…');
    git(['sparse-checkout', 'set', ...SPARSE_PATHS], CLONE);
    git(['checkout'], CLONE);
  } else {
    log('Using cached Chromium checkout (pass --fresh to re-clone)');
  }
}
 
// ---------------------------------------------------------------- 2. patch
 
function patch(file, steps) {
  let src = fs.readFileSync(file, 'utf8');
  for (const [label, re, repl] of steps) {
    if (!re.test(src)) {
      warn(`${path.basename(file)}: patch "${label}" did not match (upstream changed?)`);
      continue;
    }
    src = src.replace(re, repl);
  }
  fs.writeFileSync(file, src);
}
 
function prepareWorkdir() {
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.cpSync(path.join(CLONE, 'components/neterror/resources'), WORK, { recursive: true });
 
  patch(path.join(WORK, 'dino_game/offline.ts'), [
    [
      'enable easter egg',
      /private isDisabled: boolean = loadTimeData\.valueExists\(['"]disabledEasterEgg['"]\);/,
      () => 'private isDisabled: boolean = false;',
    ],
    [
      'guard loadSounds',
      /^([ \t]*)this\.loadSounds\(\);[ \t]*$/m,
      (_, i) =>
        [
          `${i}try {`,
          `${i}  this.loadSounds();`,
          `${i}} catch (error) {`,
          `${i}  console.warn("Sound initialization failed:", error);`,
          `${i}}`,
        ].join('\n'),
    ],
  ]);
 
  patch(path.join(WORK, 'neterror.ts'), [
    [
      'hide empty error code',
      /^([ \t]*)<div class="error-code">\$\{data\.errorCode\}<\/div>/m,
      (_, i) => `${i}\${data.errorCode ? html\`<div class="error-code">\${data.errorCode}</div>\` : ""}`,
    ],
  ]);
 
  const cssFile = path.join(WORK, 'neterror.css');
  let css = fs.readFileSync(cssFile, 'utf8');
  css = css.replace(/<if\s+expr="\s*is_ios\s*"[^>]*>[\s\S]*?<\/if>/g, '');
  css = css.replace(/^.*<\/?if\b.*>.*\n?/gm, '');
  css += '\nbody {\n  font-family: Arial, sans-serif;\n  font-size: 75%;\n}\n';
  fs.writeFileSync(cssFile, css);
}
 
// ---------------------------------------------------------------- 3. bundle
 
// chrome://resources/<x> lives in ui/webui/resources/<x> in the Chromium tree.
// The Lit bundle (chrome://resources/lit/v3_0/lit.rollup.js, which already
// includes CrLitElement) is the checked-in file third_party/lit/v3_0/lit.rollup.js.
function resolveChrome(spec) {
  const rel = spec.replace(/^chrome:\/\/resources\//, '');
  const base = rel.startsWith('lit/v3_0/')
    ? path.join(CLONE, 'third_party/lit/v3_0', rel.slice('lit/v3_0/'.length))
    : path.join(CLONE, 'ui/webui/resources', rel);
  const candidates = [base.replace(/\.js$/, '.ts'), base];
  const hit = candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
  if (!hit) {
    throw new Error(`Cannot resolve "${spec}". Tried:\n  ${candidates.join('\n  ')}`);
  }
  return hit;
}
 
const chromePlugin = {
  name: 'chrome-resources',
  setup(build) {
    build.onResolve({ filter: /^chrome:\/\/resources\// }, (args) => ({
      path: resolveChrome(args.path),
    }));
  },
};
 
async function bundle(entry) {
  if (typeof Bun !== 'undefined') {
    log('Bundling with Bun…');
    const result = await Bun.build({
      entrypoints: [entry],
      target: 'browser',
      format: 'esm',
      minify: opts.minify,
      plugins: [chromePlugin],
    });
    if (!result.success) {
      for (const l of result.logs) console.error(l);
      throw new Error('Bun.build failed');
    }
    return result.outputs[0].text();
  }
 
  log('Bundling with esbuild…');
  const esbuild = await import('esbuild');
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    minify: opts.minify,
    write: false,
    logLevel: 'warning',
    plugins: [chromePlugin],
  });
  return result.outputFiles[0].text;
}
 
// ---------------------------------------------------------------- 4. HTML
 
const LICENSE_RE = /\/\*\*(?:(?!\*\/)[\s\S])*?@license(?:(?!\*\/)[\s\S])*?\*\/\s*/g;
 
const LOAD_TIME_DATA = {
  errorCode: '',
  heading: { msg: 'No internet' },
  iconClass: 'icon-offline',
  isOfflineError: true,
  dinoGameA11yAriaLabel: 'Dinosaur game',
  dinoGameInstructionsTouch: 'Tap to play',
  dinoGameInstructionsKeyboard: 'Press space to play',
  dinoGameInstructionsHybrid: 'Press space to play',
  dinoGameA11yAriaLabelTouch: 'Dinosaur game',
  dinoGameA11yAriaLabelKeyboard: 'Dinosaur game',
  dinoGameA11yAriaLabelHybrid: 'Dinosaur game',
  disabledEasterEgg: 'Game disabled',
  altGameType: '0',
};
 
const safeScript = (js) => js.replace(/<\/script/gi, '<\\/script');
 
function buildHtml(bundledJs) {
  const read = (p) => fs.readFileSync(p, 'utf8');
  const interstitial = path.join(CLONE, 'components/security_interstitials/core/common/resources');
 
  let html = read(path.join(WORK, 'neterror.html'));
 
  html = html
    .replace('<html dir="$i18n{textdirection}" lang="$i18n{language}">', () => '<html dir="ltr" lang="en">')
    .replace(/<title>.*?<\/title>/, '<title>There is no internet</title>')
    .replace(/^.*interstitial_(?:core|common)\.css.*\n?/gm, '')
    .replace(/<if expr="(?:not )?optimize_webui">[\s\S]*?<\/if>/g, '')
    .replace(/<body class="neterror"[^>]*>/, '<body class="neterror">');
 
  const stripIf = (css) => css.replace(/^.*<\/?if\b.*>.*\n?/gm, '');
  const interstitialCss =
    stripIf(read(path.join(interstitial, 'interstitial_core.css'))) + '\n' +
    stripIf(read(path.join(interstitial, 'interstitial_common.css'))) + '\n';
 
  if (html.includes('<style>')) {
    html = html.replace('<style>', () => '<style>\n' + interstitialCss);
  } else if (/<head[^>]*>/.test(html)) {
    // No <style> tag upstream: add one at the top of <head> so that the
    // (later-inlined) neterror.css can still override these rules.
    html = html.replace(/<head[^>]*>/, (m) => `${m}\n  <style>\n${interstitialCss}  </style>`);
  } else {
    warn('neterror.html: no <head> found; interstitial CSS not injected');
  }
 
  const js = bundledJs.replace(/loadTimeData\.valueExists\("disabledEasterEgg"\);/g, 'false;');
  const injected =
    `  <script>window.loadTimeDataRaw = ${JSON.stringify(LOAD_TIME_DATA)};</script>\n` +
    `  <script>\n${safeScript(js)}\n  </script>\n`;
  html = html.replace('</head>', () => injected + '</head>');
 
  return html.replace(LICENSE_RE, '');
}
 
// ---------------------------------------------------------------- 5. inline assets
 
const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.wav': 'audio/wav', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.css': 'text/css', '.js': 'text/javascript',
};
 
const isRemote = (u) => /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(u);
 
function localFile(ref, baseDir) {
  if (!ref || isRemote(ref)) return null;
  const p = path.resolve(baseDir, ref.split(/[?#]/)[0]);
  return fs.existsSync(p) && fs.statSync(p).isFile() ? p : null;
}
 
function dataUri(file) {
  const mime = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}
 
function inlineCss(css, baseDir) {
  return css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/g, (m, _q, ref) => {
    const f = localFile(ref.trim(), baseDir);
    return f ? `url(${dataUri(f)})` : m;
  });
}
 
const getAttr = (tag, name) =>
  tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'))?.slice(1).find((v) => v !== undefined);
 
function inlineAssets(html, baseDir) {
  // <link rel="stylesheet" href="local.css">
  html = html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (getAttr(tag, 'rel')?.toLowerCase() !== 'stylesheet') return tag;
    const f = localFile(getAttr(tag, 'href'), baseDir);
    if (!f) return tag;
    return `<style>${inlineCss(fs.readFileSync(f, 'utf8'), path.dirname(f))}</style>`;
  });
 
  // <script src="local.js"></script>
  html = html.replace(/<script\b[^>]*\bsrc\s*=[^>]*>\s*<\/script>/gi, (tag) => {
    const f = localFile(getAttr(tag, 'src'), baseDir);
    return f ? `<script>${safeScript(fs.readFileSync(f, 'utf8'))}</script>` : tag;
  });
 
  // <img|audio|video|source src="local">
  html = html.replace(/<(?:img|audio|video|source)\b[^>]*>/gi, (tag) => {
    const src = getAttr(tag, 'src');
    const f = localFile(src, baseDir);
    return f ? tag.replace(src, () => dataUri(f)) : tag;
  });
 
  // inline <style> blocks with url(...)
  html = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (m, css) =>
    m.replace(css, () => inlineCss(css, baseDir)),
  );
 
  return html;
}
 
// ---------------------------------------------------------------- main
 
async function main() {
  fetchChromium();
  prepareWorkdir();
 
  const js = await bundle(path.join(WORK, 'neterror.ts'));
  const html = inlineAssets(buildHtml(js), WORK);
 
  const out = path.resolve(ROOT, opts.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  log(`Wrote ${path.relative(process.cwd(), out)} (${(html.length / 1024).toFixed(0)} KiB)`);
}
 
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
 
