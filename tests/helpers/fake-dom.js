// Minimal fake DOM for exercising the portal view under node:test.
//
// The project deliberately ships no DOM library (environment.test.js pins the
// only devDependency to Vite), so this helper implements just the surface the
// portal module touches: element creation, class/dataset/attribute storage,
// tree traversal, focus, and bubbling event dispatch.

function classListOf(element) {
  return new Set(element.className.split(/\s+/).filter(Boolean));
}

function matches(element, selector) {
  if (selector.startsWith('.')) {
    return classListOf(element).has(selector.slice(1));
  }
  return element.tagName === selector.toUpperCase();
}

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.attributes = {};
    this.className = '';
    this._text = '';
    this._listeners = new Map();
  }

  get classList() {
    const element = this;
    return {
      add(name) {
        const set = classListOf(element);
        set.add(name);
        element.className = [...set].join(' ');
      },
      remove(name) {
        const set = classListOf(element);
        set.delete(name);
        element.className = [...set].join(' ');
      },
      contains(name) {
        return classListOf(element).has(name);
      },
    };
  }

  get textContent() {
    if (this.children.length === 0) return this._text;
    return this.children.map((child) => child.textContent).join('');
  }

  set textContent(value) {
    this._text = String(value);
    this.children = [];
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  append(...nodes) {
    nodes.forEach((node) => this.appendChild(node));
  }

  remove() {
    if (!this.parentNode) return;
    const index = this.parentNode.children.indexOf(this);
    if (index >= 0) this.parentNode.children.splice(index, 1);
    this.parentNode = null;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'class') this.className = String(value);
  }

  getAttribute(name) {
    return name in this.attributes ? this.attributes[name] : null;
  }

  focus() {
    this.ownerDocument.activeElement = this;
    this.dispatchEvent({ type: 'focusin', bubbles: true, target: this });
  }

  addEventListener(type, listener) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this._listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event) {
    if (!event.target) event.target = this;
    if (typeof event.preventDefault !== 'function') {
      event.preventDefault = () => {
        event.defaultPrevented = true;
      };
    }
    const listeners = this._listeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) listener(event);
    }
    if (event.bubbles && this.parentNode) {
      this.parentNode.dispatchEvent(event);
    }
  }

  descendants() {
    return this.children.flatMap((child) => [
      child,
      ...child.descendants(),
    ]);
  }

  querySelectorAll(selector) {
    return this.descendants().filter((node) => matches(node, selector));
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (matches(node, selector)) return node;
      node = node.parentNode;
    }
    return null;
  }

  contains(node) {
    let current = node;
    while (current) {
      if (current === this) return true;
      current = current.parentNode;
    }
    return false;
  }
}

export function createFakeDocument() {
  const document = {
    activeElement: null,
    createElement(tagName) {
      return new FakeElement(tagName, document);
    },
  };
  return document;
}

export { FakeElement };
