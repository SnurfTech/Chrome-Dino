import { assert } from './assert.js';

export function $(id: string): HTMLElement | null {
  const el = document.querySelector(`#${id}`);
  if (el) {
    assert(el instanceof HTMLElement);
    return el;
  }
  return null;
}

export function getRequiredElement(id: string): HTMLElement {
  const el = document.querySelector(`#${id}`);
  assert(el);
  assert(el instanceof HTMLElement);
  return el;
}

export function getDeepActiveElement(): Element | null {
  let a = document.activeElement;
  while (a && a.shadowRoot && a.shadowRoot.activeElement) {
    a = a.shadowRoot.activeElement;
  }
  return a;
}

export function isRTL(): boolean {
  return document.documentElement.dir === 'rtl';
}

export function appendParam(url: string, key: string, value: string): string {
  const param = encodeURIComponent(key) + '=' + encodeURIComponent(value);
  return url + (url.indexOf('?') === -1 ? '?' : '&') + param;
}

export function ensureTransitionEndEvent(el: HTMLElement, timeOut?: number): void {
  if (timeOut === undefined) {
    const style = getComputedStyle(el);
    timeOut = parseFloat(style.transitionDuration) * 1e3 + 50;
  }
  let fired = false;
  el.addEventListener('transitionend', function f() {
    el.removeEventListener('transitionend', f);
    fired = true;
  });
  window.setTimeout(() => {
    if (!fired) {
      el.dispatchEvent(new CustomEvent('transitionend', { bubbles: true, composed: true }));
    }
  }, timeOut);
}

export function htmlEscape(original: string): string {
  return original
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function quoteString(str: string): string {
  return str.replace(/([\\\.\+\*\?\[\^\]\$\(\)\{\}\=\!\<\>\|\:])/g, '\\$1');
}

export function listenOnce(
  target: EventTarget,
  eventNames: string | string[],
  callback: (e: Event) => any,
): void {
  const names = Array.isArray(eventNames) ? eventNames : eventNames.split(/ +/);
  const handler = (event: Event) => {
    names.forEach((n) => target.removeEventListener(n, handler, false));
    return callback(event);
  };
  names.forEach((n) => target.addEventListener(n, handler, false));
}

export function hasKeyModifiers(e: KeyboardEvent): boolean {
  return !!(e.altKey || e.ctrlKey || e.metaKey || e.shiftKey);
}

export function isUndoKeyboardEvent(event: KeyboardEvent): boolean {
  if (event.key !== 'z') return false;
  const excluded = [event.altKey, event.shiftKey, event.metaKey];
  return event.ctrlKey && !excluded.some((m) => m);
}

export function debounceEnd(fn: () => void, time = 50): () => void {
  let timerId: ReturnType<typeof setTimeout>;
  return () => {
    clearTimeout(timerId);
    timerId = setTimeout(fn, time);
  };
}
