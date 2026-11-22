#!/usr/bin/env node
// Builds a single self-contained dino.html from Chromium's neterror page.
//
// Usage:  node build-dino.mjs        (or: bun build-dino.mjs)
// Needs:  git, node >= 18, and bun (preferred) or npm/npx (esbuild fallback).
// Output: ./dino.html
 
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
 
// ---------------------------------------------------------------- helpers
const OUT = resolve(process.cwd(), "dino.html");
const ROOT = resolve(process.cwd(), "chromium");
const RES = join(ROOT, "components/neterror/resources");
const SEC = join(ROOT, "components/security_interstitials/core/common/resources");
 
const run = (cmd, args, cwd = process.cwd()) =>
  execFileSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
 
const has = (cmd) =>
  spawnSync(cmd, ["--version"], { stdio: "ignore", shell: process.platform === "win32" }).status === 0;
 
const read = (p) => readFileSync(p, "utf8");
const edit = (p, fn) => writeFileSync(p, fn(read(p)));
 
// Replace using a function so `$` in the replacement is never special.
const sub = (text, search, replacement) =>
  text.replace(search, typeof replacement === "function" ? replacement : () => replacement);
 
const deleteLines = (text, re) => text.split("\n").filter((l) => !re.test(l)).join("\n");
 
// Like sed '/start/,/end/d' (end is only checked from the line after start).
function deleteRanges(text, startRe, endRe) {
  const out = [];
  let inside = false;
  for (const line of text.split("\n")) {
    if (inside) {
      if (endRe.test(line)) inside = false;
      continue;
    }
    if (startRe.test(line)) {
      inside = true;
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}
 
// Source of a module kept verbatim inside a block comment, so no escaping is needed.
const embedded = (fn) => {
  const s = fn.toString();
  return s.slice(s.indexOf("/*") + 2, s.lastIndexOf("*/")).trim() + "\n";
};
 
// ------------------------------------------- stand-ins for chrome://resources
function assertTs() {/*
export function assert(value,message="null"){if(value){return}throw new Error("Assertion failed"+(message?`: ${message}`:""))}export function assertInstanceof(value,type,message="null"){if(value instanceof type){return}throw new Error(message||`Value ${value} is not of type ${type.name||typeof type}`)}export function assertNotReached(message="Unreachable code hit"){assert(false,message)}export function assertNotReachedCase(_param,message="null"){assertNotReached(message)}
*/}
 
function loadTimeDataTs() {/*
import{assert}from"./assert.js";class LoadTimeData{data_=null;set data(value){assert(!this.data_,"Re-setting data.");this.data_=value}valueExists(id){assert(this.data_,"No data. Did you remember to include strings.js?");return id in this.data_}getValue(id){assert(this.data_,"No data. Did you remember to include strings.js?");const value=this.data_[id];assert(typeof value!=="undefined","Could not find value for "+id);return value}getString(id){const value=this.getValue(id);assert(typeof value==="string",`[${value}] (${id}) is not a string`);return value}getStringF(id,...args){const value=this.getString(id);if(!value){return""}return this.substituteString(value,...args)}substituteString(label,...args){return label.replace(/\$(.|$|\n)/g,(function(m){assert(m.match(/\$[$1-9]/),"Unescaped $ found in localized string.");if(m==="$$"){return"$"}const substitute=args[Number(m[1])-1];if(substitute===undefined||substitute===null){return""}return substitute.toString()}))}getSubstitutedStringPieces(label,...args){const pieces=(label.match(/(\$[1-9])|(([^$]|\$([^1-9]|$))+)/g)||[]).map((function(p){if(!p.match(/^\$[1-9]$/)){assert((p.match(/\$/g)||[]).length%2===0,"Unescaped $ found in localized string.");return{value:p.replace(/\$\$/g,"$"),arg:null}}const substitute=args[Number(p[1])-1];if(substitute===undefined||substitute===null){return{value:"",arg:p}}return{value:substitute.toString(),arg:p}}));return pieces}getBoolean(id){const value=this.getValue(id);assert(typeof value==="boolean",`[${value}] (${id}) is not a boolean`);return value}getInteger(id){const value=this.getValue(id);assert(typeof value==="number",`[${value}] (${id}) is not a number`);assert(value===Math.floor(value),"Number isn't integer: "+value);return value}overrideValues(replacements){assert(typeof replacements==="object","Replacements must be a dictionary object.");assert(this.data_,"Data must exist before being overridden");for(const key in replacements){this.data_[key]=replacements[key]}}resetForTesting(newData=null){this.data_=newData}isInitialized(){return this.data_!==null}}export const loadTimeData=new LoadTimeData;
*/}
 
function utilTs() {/*
import{assert}from"./assert.js";export function $(id){const el=document.querySelector(`#${id}`);if(el){assert(el instanceof HTMLElement);return el}return null}export function getRequiredElement(id){const el=document.querySelector(`#${id}`);assert(el);assert(el instanceof HTMLElement);return el}export function getDeepActiveElement(){let a=document.activeElement;while(a&&a.shadowRoot&&a.shadowRoot.activeElement){a=a.shadowRoot.activeElement}return a}export function isRTL(){return document.documentElement.dir==="rtl"}export function appendParam(url,key,value){const param=encodeURIComponent(key)+"="+encodeURIComponent(value);if(url.indexOf("?")===-1){return url+"?"+param}return url+"&"+param}export function ensureTransitionEndEvent(el,timeOut){if(timeOut===undefined){const style=getComputedStyle(el);timeOut=parseFloat(style.transitionDuration)*1e3;timeOut+=50}let fired=false;el.addEventListener("transitionend",(function f(){el.removeEventListener("transitionend",f);fired=true}));window.setTimeout((function(){if(!fired){el.dispatchEvent(new CustomEvent("transitionend",{bubbles:true,composed:true}))}}),timeOut)}export function htmlEscape(original){return original.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}export function quoteString(str){return str.replace(/([\\\.\+\*\?\[\^\]\$\(\)\{\}\=\!\<\>\|\:])/g,"\\$1")}export function listenOnce(target,eventNames,callback){const eventNamesArray=Array.isArray(eventNames)?eventNames:eventNames.split(/ +/);const removeAllAndCallCallback=function(event){eventNamesArray.forEach((function(eventName){target.removeEventListener(eventName,removeAllAndCallCallback,false)}));return callback(event)};eventNamesArray.forEach((function(eventName){target.addEventListener(eventName,removeAllAndCallCallback,false)}))}export function hasKeyModifiers(e){return!!(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)}export function isUndoKeyboardEvent(event){if(event.key!=="z"){return false}const excludedModifiers=[event.altKey,event.shiftKey,event.metaKey];let targetModifier=event.ctrlKey;return targetModifier&&!excludedModifiers.some((modifier=>modifier))}export function debounceEnd(fn,time=50){let timerId;return()=>{clearTimeout(timerId);timerId=setTimeout(fn,time)}}
*/}
 
// Instead of pasting the minified lit rollup, pull `lit` from npm and re-export
// it under the names Chromium's lit.rollup.js provides, plus CrLitElement.
function litRollupTs() {/*
import { LitElement, css, html, nothing, render } from "lit";
import { AsyncDirective } from "lit/async-directive.js";
import { directive, PartType } from "lit/directive.js";
 
function toDashCase(name){return name.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase()}class CrLitElement extends LitElement{$;willUpdatePending_=false;static notifyProps_=null;constructor(){super();const self=this;this.$=new Proxy({},{get(cache,id){if(!self.hasUpdated&&!self.isConnected){const description=self.tagName+(self.id?`#${self.id}`:"");throw new Error(`CrLitElement ${description} accessed '$.${id}' before connected at least once.`)}if(!self.hasUpdated){if(self.willUpdatePending_){const description=self.tagName+(self.id?`#${self.id}`:"");throw new Error(`CrLitElement ${description} accessed '$.${id}' within willUpdate().`)}self.performUpdate()}if(id in cache){return cache[id]}const element=self.shadowRoot.querySelector(`#${id}`);if(element===null){throw new Error(`CrLitElement ${self.tagName}: Failed to find child with id ${id}`)}cache[id]=element;return element}})}ensureInitialRender(){if(!this.hasUpdated){this.performUpdate()}}connectedCallback(){super.connectedCallback();this.ensureInitialRender()}willUpdate(_changedProperties){this.willUpdatePending_=true}updated(changedProperties){this.willUpdatePending_=false;const notifyProps=this.constructor.notifyProps_;if(notifyProps!==null){const indexableThis=this;for(const key of changedProperties.keys()){if(notifyProps.has(key)){if(changedProperties.get(key)===undefined&&indexableThis[key]===undefined){continue}this.dispatchEvent(new CustomEvent(`${toDashCase(key.toString())}-changed`,{detail:{value:indexableThis[key]}}))}}}}focus(options){this.ensureInitialRender();super.focus(options)}fire(eventName,detail){this.dispatchEvent(new CustomEvent(eventName,{bubbles:true,composed:true,detail:detail}))}static patchPropertiesObject(){if(!this.hasOwnProperty("properties")){return}const properties=this.properties;for(const[key,value]of Object.entries(properties)){if(value.attribute==null){value.attribute=toDashCase(key)}}Object.defineProperty(this,"properties",{value:properties})}static populateNotifyProps(){if(!this.hasOwnProperty("properties")){return}for(const[key,value]of Object.entries(this.properties)){if(value.notify){if(this.notifyProps_===null){this.notifyProps_=new Set}this.notifyProps_.add(key)}}}static finalize(){this.patchPropertiesObject();this.populateNotifyProps();super.finalize()}}
 
export { AsyncDirective, CrLitElement, LitElement, PartType, css, directive, html, nothing, render };
*/}
 
// ------------------------------------------------------------ HTML inliner
const MIME = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
  ".ttf": "font/ttf", ".otf": "font/otf", ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg", ".wav": "audio/wav", ".mp4": "video/mp4",
  ".webm": "video/webm", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".html": "text/html",
};
 
const dataUri = (p) =>
  `data:${MIME[extname(p).toLowerCase()] ?? "application/octet-stream"};base64,${readFileSync(p).toString("base64")}`;
 
const isExternal = (u) => /^(https?:|data:|\/\/|javascript:|#)/i.test(u);
 
function parseAttrs(tag) {
  const attrs = {};
  const body = tag.replace(/^<\s*[^\s>\/]+/, "").replace(/\/?>$/, "");
  for (const m of body.matchAll(/([^\s=\/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return attrs;
}
 
function inlineCss(css, baseDir) {
  css = css.replace(/@import\s+(?:url\()?\s*['"]?([^'")]+)['"]?\s*\)?\s*;?/g, (m, raw) => {
    raw = raw.trim();
    if (isExternal(raw)) return m;
    const p = resolve(baseDir, raw);
    return existsSync(p) ? `@import url('${dataUri(p)}');` : m;
  });
  return css.replace(/url\(([\s\S]*?)\)/g, (m, raw) => {
    raw = raw.trim().replace(/^['"]|['"]$/g, "");
    if (isExternal(raw)) return m;
    const p = resolve(baseDir, raw);
    return existsSync(p) ? `url(${dataUri(p)})` : m;
  });
}
 
function inlineHtml(html, baseDir) {
  const local = (u) => {
    if (!u || isExternal(u)) return null;
    const p = resolve(baseDir, u);
    return existsSync(p) ? p : null;
  };
 
  const inlineScriptSrc = (seg) => {
    const open = seg.match(/^<script\b[^>]*>/i)[0];
    const attrs = parseAttrs(open);
    const p = local(attrs.src);
    if (!p) return seg;
    const type = attrs.type ? ` type="${attrs.type}"` : "";
    return `<script${type}>${read(p)}</script>`;
  };
 
  const inlineTags = (seg) =>
    seg
      .replace(/<link\b[^>]*>/gi, (tag) => {
        const a = parseAttrs(tag);
        const p = (a.rel ?? "").toLowerCase() === "stylesheet" ? local(a.href) : null;
        return p ? `<style>${inlineCss(read(p), baseDir)}</style>` : tag;
      })
      .replace(/<(?:img|audio|video|source)\b[^>]*>/gi, (tag) => {
        const p = local(parseAttrs(tag).src);
        if (!p) return tag;
        return tag.replace(/\bsrc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, () => `src="${dataUri(p)}"`);
      });
 
  // Script bodies are left alone; only <script src> tags and markup outside are rewritten.
  html = html
    .split(/(<script\b[\s\S]*?<\/script>)/gi)
    .map((seg) => (/^<script\b/i.test(seg) ? inlineScriptSrc(seg) : inlineTags(seg)))
    .join("");
 
  html = html.replace(/\/\*\*[\s\S]*?\* @license[\s\S]*?\*\/\s*/g, "");
  html = html.replace(/<\/script>\s*<\/script>/g, "</script>");
  return html;
}
 
// ------------------------------------------------------------------- build
console.log("==> Fetching Chromium sources (sparse)");
rmSync(ROOT, { recursive: true, force: true });
run("git", [
  "clone", "--depth", "1", "--filter=blob:none", "--sparse", "--no-checkout",
  "https://github.com/chromium/chromium.git", ROOT,
]);
run("git", ["sparse-checkout", "set", "components/neterror/resources"], ROOT);
for (const dir of [
  "components/security_interstitials/core/common/resources",
  "components/security_interstitials/core/browser/resources",
  "components/resources",
]) {
  run("git", ["sparse-checkout", "add", dir], ROOT);
}
run("git", ["checkout"], ROOT);
 
console.log("==> Writing chrome://resources replacements");
const shimDir = join(RES, "chrome-resources");
mkdirSync(shimDir, { recursive: true });
writeFileSync(join(shimDir, "assert.ts"), embedded(assertTs));
writeFileSync(join(shimDir, "load_time_data.ts"), embedded(loadTimeDataTs));
writeFileSync(join(shimDir, "util.ts"), embedded(utilTs));
writeFileSync(join(shimDir, "lit.rollup.ts"), embedded(litRollupTs));
 
console.log("==> Installing lit");
const useBun = has("bun");
if (!useBun && !has("npm")) throw new Error("Need bun or npm installed.");
writeFileSync(join(ROOT, "package.json"), JSON.stringify({ name: "dino-build", private: true }));
if (useBun) run("bun", ["add", "lit@^3"], ROOT);
else run("npm", ["install", "--no-audit", "--no-fund", "lit@^3"], ROOT);
 
console.log("==> Patching sources");
const importMap = [
  [/chrome:\/\/resources\/js\/assert\.js/g, "assert.js"],
  [/chrome:\/\/resources\/js\/load_time_data\.js/g, "load_time_data.js"],
  [/chrome:\/\/resources\/js\/util\.js/g, "util.js"],
  [/chrome:\/\/resources\/lit\/v3_0\/lit\.rollup\.js/g, "lit.rollup.js"],
];
const rewriteImports = (file, prefix) =>
  edit(file, (t) => importMap.reduce((acc, [re, name]) => sub(acc, re, `${prefix}/chrome-resources/${name}`), t));
 
for (const f of readdirSync(join(RES, "dino_game")).filter((f) => f.endsWith(".ts"))) {
  rewriteImports(join(RES, "dino_game", f), "..");
}
for (const f of readdirSync(RES).filter((f) => f.endsWith(".ts"))) {
  rewriteImports(join(RES, f), ".");
}
 
const offlineTs = join(RES, "dino_game/offline.ts");
edit(offlineTs, (t) => {
  t = sub(
    t,
    "private isDisabled: boolean = loadTimeData.valueExists('disabledEasterEgg');",
    "private isDisabled: boolean = false;",
  );
  return sub(
    t,
    /^[ \t]*this\.loadSounds\(\);$/m,
    `            try {
              this.loadSounds();
            } catch (error) {
              console.warn("Sound initialization failed:", error);
            }`,
  );
});
 
edit(join(RES, "neterror.ts"), (t) =>
  sub(
    t,
    '          <div class="error-code">${data.errorCode}</div>',
    '          ${data.errorCode ? html`<div class="error-code">${data.errorCode}</div>` : ""}',
  ),
);
 
edit(join(RES, "neterror.css"), (t) => {
  t = t.replace(/\n?$/, "\n") + "\nbody {\n  font-family: Arial, sans-serif;\n  font-size: 75%;\n}\n";
  t = deleteRanges(t, /<if\s+expr="\s*is_ios\s*"[^>]*>/, /<\/if>/);
  return deleteLines(t, /[</]if.*>/);
});
 
console.log(`==> Bundling with ${useBun ? "bun" : "esbuild"}`);
if (useBun) {
  run("bun", ["build", "neterror.ts", "--target=browser", "--format=esm", "--outfile=bundled.js"], RES);
} else {
  run("npx", [
    "--yes", "esbuild", "neterror.ts", "--bundle", "--format=esm",
    "--platform=browser", "--outfile=bundled.js",
  ], RES);
}
const bundled = read(join(RES, "bundled.js"));
 
console.log("==> Assembling neterror.html");
const coreCss = read(join(SEC, "interstitial_core.css"));
const commonCss = read(join(SEC, "interstitial_common.css"));
 
const loadTimeDataScript = `  <script>
    window.loadTimeDataRaw = {
      errorCode: "",
      heading: {msg: "No internet"},
      iconClass: "icon-offline",
      isOfflineError: true,
      dinoGameA11yAriaLabel: "Dinosaur game",
      dinoGameInstructionsTouch: "Tap to play",
      dinoGameInstructionsKeyboard: "Press space to play",
      dinoGameInstructionsHybrid: "Press space to play",
      dinoGameA11yAriaLabelTouch: "Dinosaur game",
      dinoGameA11yAriaLabelKeyboard: "Dinosaur game",
      dinoGameA11yAriaLabelHybrid: "Dinosaur game",
      disabledEasterEgg: "Game disabled",
      altGameType: "0"
    };
  </script>`;
 
const htmlPath = join(RES, "neterror.html");
edit(htmlPath, (t) => {
  t = sub(t, /<html dir="\$i18n\{textdirection\}" lang="\$i18n\{language\}">/, '<html dir="ltr" lang="en">');
  t = sub(t, /  <title>.*<\/title>/, "  <title>There is no internet</title>");
  t = deleteLines(t, /interstitial_core\.css/);
  t = deleteLines(t, /interstitial_common\.css/);
  t = deleteRanges(t, /<if expr="not optimize_webui">/, /<\/if>/);
  t = deleteRanges(t, /<if expr="optimize_webui">/, /<\/if>/);
  t = sub(t, /<body class="neterror".*>/, '<body class="neterror">');
 
  // Inline the interstitial CSS right after the <style> line(s).
  t = t
    .split("\n")
    .flatMap((l) => (/<style>/.test(l) ? [l, coreCss, commonCss] : [l]))
    .join("\n");
 
  // Bundle first, then the load-time data (same order as the original script).
  t = sub(t, /<\/head>/, () => `  <script>\n${bundled}\n  </script>\n</head>`);
  t = sub(t, /<\/head>/, () => `${loadTimeDataScript}\n</head>`);
 
  t = t.replaceAll('loadTimeData.valueExists("disabledEasterEgg");', "false;");
 
  // sed '/^\/\*\*$/,+4d': drop each "/**" line plus the 4 lines after it.
  const lines = t.split("\n");
  const kept = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === "/**") i += 4;
    else kept.push(lines[i]);
  }
  return kept.join("\n");
});
 
console.log("==> Inlining assets");
const finalHtml = inlineHtml(read(htmlPath), dirname(htmlPath));
writeFileSync(OUT, finalHtml);
console.log(`Done: ${OUT} (${(finalHtml.length / 1024).toFixed(0)} KB)`);
 
