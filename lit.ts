// @ts-nocheck
// Stand-in for chrome://resources/lit/v3_0/lit.rollup.js, backed by the `lit` package.
import { LitElement, css, html, nothing, render } from 'lit';
import { AsyncDirective } from 'lit/async-directive.js';
import { PartType, directive } from 'lit/directive.js';

function toDashCase(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

class CrLitElement extends LitElement {
  $;
  willUpdatePending_ = false;
  static notifyProps_ = null;

  constructor() {
    super();
    const self = this;
    this.$ = new Proxy({}, {
      get(cache, id) {
        if (!self.hasUpdated && !self.isConnected) {
          const d = self.tagName + (self.id ? `#${self.id}` : '');
          throw new Error(`CrLitElement ${d} accessed '$.${id}' before connected at least once.`);
        }
        if (!self.hasUpdated) {
          if (self.willUpdatePending_) {
            const d = self.tagName + (self.id ? `#${self.id}` : '');
            throw new Error(`CrLitElement ${d} accessed '$.${id}' within willUpdate().`);
          }
          self.performUpdate();
        }
        if (id in cache) return cache[id];
        const element = self.shadowRoot.querySelector(`#${id}`);
        if (element === null) {
          throw new Error(`CrLitElement ${self.tagName}: Failed to find child with id ${id}`);
        }
        cache[id] = element;
        return element;
      },
    });
  }

  ensureInitialRender() {
    if (!this.hasUpdated) this.performUpdate();
  }

  connectedCallback() {
    super.connectedCallback();
    this.ensureInitialRender();
  }

  willUpdate(changed) {
    this.willUpdatePending_ = true;
  }

  updated(changedProperties) {
    this.willUpdatePending_ = false;
    const notifyProps = this.constructor.notifyProps_;
    if (notifyProps !== null) {
      for (const key of changedProperties.keys()) {
        if (notifyProps.has(key)) {
          if (changedProperties.get(key) === undefined && this[key] === undefined) continue;
          this.dispatchEvent(new CustomEvent(`${toDashCase(key.toString())}-changed`, {
            detail: { value: this[key] },
          }));
        }
      }
    }
  }

  focus(options) {
    this.ensureInitialRender();
    super.focus(options);
  }

  fire(eventName, detail) {
    this.dispatchEvent(new CustomEvent(eventName, { bubbles: true, composed: true, detail }));
  }

  static patchPropertiesObject() {
    if (!this.hasOwnProperty('properties')) return;
    const properties = this.properties;
    for (const [key, value] of Object.entries(properties)) {
      if (value.attribute == null) value.attribute = toDashCase(key);
    }
    Object.defineProperty(this, 'properties', { value: properties });
  }

  static populateNotifyProps() {
    if (!this.hasOwnProperty('properties')) return;
    for (const [key, value] of Object.entries(this.properties)) {
      if (value.notify) {
        if (this.notifyProps_ === null) this.notifyProps_ = new Set();
        this.notifyProps_.add(key);
      }
    }
  }

  static finalize() {
    this.patchPropertiesObject();
    this.populateNotifyProps();
    super.finalize();
  }
}

export {
  AsyncDirective,
  CrLitElement,
  LitElement,
  PartType,
  css,
  directive,
  html,
  nothing,
  render,
};
