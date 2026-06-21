// ../state/src/symbols.mjs
var DEP = {
  ITERATE: Symbol.for("@simplyedit/simplyflow.iterate"),
  XRAY: Symbol.for("@simplyedit/simplyflow.xRay"),
  SIGNAL: Symbol.for("@simplyedit/simplyflow.Signal"),
  TEMPLATE: Symbol.for("@simplyedit/simplyflow.bindTemplate"),
  VALUE: Symbol.for("@simplyedit/simplyflow.bindValue"),
  LENGTH: "length",
  SIZE: "size"
};

// ../state/src/index.mjs
var MAP_READS_KEY = /* @__PURE__ */ new Set(["get", "has"]);
var MAP_READS_ITERATION = /* @__PURE__ */ new Set(["keys", "values", "entries", "forEach", Symbol.iterator]);
var MAP_WRITES = /* @__PURE__ */ new Set(["set", "delete", "clear"]);
var SET_WRITES = /* @__PURE__ */ new Set(["add", "delete", "clear"]);
var SET_ITERATION_PROPERTIES = {
  entries: {},
  forEach: {},
  has: {},
  keys: {},
  values: {},
  [Symbol.iterator]: {}
};
function isObjectLike(value) {
  return value !== null && (typeof value === "object" || typeof value === "function");
}
function isSignal(value) {
  return Boolean(isObjectLike(value) && value[DEP.SIGNAL]);
}
function raw(value) {
  return isSignal(value) ? value[DEP.XRAY] : value;
}
function getSignal(value) {
  return isSignal(value) ? value : signals.get(value);
}
function targetSignal(target) {
  return signals.get(target);
}
function readTarget(target, property) {
  return target?.[property];
}
function bindMethod(target, receiver, value) {
  if (target instanceof HTMLElement || target instanceof Number || target instanceof String || target instanceof Boolean) {
    return value.bind(target);
  }
  return value.bind(receiver);
}
function collectRemovedArrayValues(target, nextLength) {
  const values = /* @__PURE__ */ new Map();
  if (!Array.isArray(target) || nextLength >= target.length) {
    return values;
  }
  for (let index = nextLength; index < target.length; index++) {
    if (Object.hasOwn(target, index)) {
      values.set(index, target[index]);
    }
  }
  return values;
}
function addArrayLengthChanges(context, target, oldLength, removedValues = /* @__PURE__ */ new Map()) {
  if (!Array.isArray(target) || oldLength === target.length) {
    return;
  }
  context.set(DEP.LENGTH, { was: oldLength, now: target.length });
  context.set(DEP.ITERATE, {});
  for (const [index, oldValue] of removedValues) {
    context.set(String(index), { delete: true, was: oldValue, now: void 0 });
  }
}
function notifyContext(receiver, context) {
  if (context.size) {
    notifySet(receiver, context);
  }
}
function wrapArrayMethod(target, property, receiver, value) {
  return (...args) => {
    const oldLength = target.length;
    const result = value.apply(receiver, args);
    if (oldLength !== target.length) {
      notifySet(receiver, makeContext(DEP.LENGTH, { was: oldLength, now: target.length }));
    }
    return result;
  };
}
function addMapWriteChanges(context, target, property, args, oldSize) {
  if (property === "set") {
    const [key, nextValue] = args;
    const hadKey = target.has(key);
    const oldValue = target.get(key);
    return () => {
      if (!hadKey || !Object.is(oldValue, nextValue)) {
        context.set(key, { was: oldValue, now: nextValue });
        context.set(DEP.ITERATE, {});
      }
      if (!hadKey) {
        context.set(DEP.SIZE, { was: oldSize, now: target.size });
      }
    };
  }
  if (property === "delete") {
    const [key] = args;
    const hadKey = target.has(key);
    const oldValue = target.get(key);
    return () => {
      if (hadKey) {
        context.set(key, { delete: true, was: oldValue, now: void 0 });
        context.set(DEP.SIZE, { was: oldSize, now: target.size });
        context.set(DEP.ITERATE, {});
      }
    };
  }
  if (property === "clear") {
    const oldEntries = oldSize ? Array.from(target.entries()) : [];
    return () => {
      if (oldEntries.length) {
        for (const [key, oldValue] of oldEntries) {
          context.set(key, { delete: true, was: oldValue, now: void 0 });
        }
        context.set(DEP.SIZE, { was: oldSize, now: target.size });
        context.set(DEP.ITERATE, {});
      }
    };
  }
  return () => {
  };
}
function wrapMapMethod(target, property, receiver, value) {
  return (...args) => {
    if (MAP_READS_KEY.has(property)) {
      notifyGet(receiver, args[0]);
    }
    if (MAP_READS_ITERATION.has(property)) {
      notifyGet(receiver, DEP.ITERATE);
    }
    const oldSize = target.size;
    const context = /* @__PURE__ */ new Map();
    const addChanges = MAP_WRITES.has(property) ? addMapWriteChanges(context, target, property, args, oldSize) : () => {
    };
    const result = value.apply(target, args);
    addChanges();
    notifyContext(receiver, context);
    return result;
  };
}
function addSetWriteChanges(context, target, property, args, oldSize) {
  const [value] = args;
  const hadValue = property === "add" || property === "delete" ? target.has(value) : false;
  return () => {
    const changed = property === "clear" ? oldSize > 0 : target.size !== oldSize || property === "delete" && hadValue;
    if (!changed) {
      return;
    }
    context.set(DEP.SIZE, { was: oldSize, now: target.size });
    for (const prop of Reflect.ownKeys(SET_ITERATION_PROPERTIES)) {
      context.set(prop, {});
    }
  };
}
function wrapSetMethod(target, property, receiver, value) {
  return (...args) => {
    const oldSize = target.size;
    const context = /* @__PURE__ */ new Map();
    const addChanges = SET_WRITES.has(property) ? addSetWriteChanges(context, target, property, args, oldSize) : () => {
    };
    const result = value.apply(target, args);
    addChanges();
    notifyContext(receiver, context);
    return result;
  };
}
function propertyValueChanged(descriptor, oldDescriptor, oldValue, newDescriptor, newValue) {
  return Object.hasOwn(descriptor, "value") && !Object.is(oldValue, newValue) || Object.hasOwn(descriptor, "get") && oldDescriptor?.get !== newDescriptor?.get || Object.hasOwn(descriptor, "set") && oldDescriptor?.set !== newDescriptor?.set;
}
var signalHandler = {
  get(target, property, receiver) {
    const value = readTarget(target, property);
    notifyGet(receiver, property);
    if (typeof value === "function") {
      if (Array.isArray(target)) {
        return wrapArrayMethod(target, property, receiver, value);
      }
      if (target instanceof Map) {
        return wrapMapMethod(target, property, receiver, value);
      }
      if (target instanceof Set) {
        return wrapSetMethod(target, property, receiver, value);
      }
      return bindMethod(target, receiver, value);
    }
    return isObjectLike(value) ? signal(value) : value;
  },
  set(target, property, value, receiver) {
    const hadOwn = Object.hasOwn(target, property);
    const oldLength = Array.isArray(target) ? target.length : void 0;
    const removedValues = property === DEP.LENGTH ? collectRemovedArrayValues(target, Number(value)) : /* @__PURE__ */ new Map();
    const oldValue = target[property];
    target[property] = value;
    const hasOwn = Object.hasOwn(target, property);
    const newValue = target[property];
    const context = /* @__PURE__ */ new Map();
    if (!Object.is(oldValue, newValue) || !hadOwn && hasOwn) {
      context.set(property, { was: oldValue, now: newValue });
    }
    if (!hadOwn && hasOwn) {
      context.set(DEP.ITERATE, {});
    }
    addArrayLengthChanges(context, target, oldLength, removedValues);
    notifyContext(receiver, context);
    return true;
  },
  has(target, property) {
    const receiver = targetSignal(target);
    if (receiver) {
      notifyGet(receiver, property);
    }
    return Reflect.has(target, property);
  },
  deleteProperty(target, property) {
    const hadOwn = Object.hasOwn(target, property);
    if (!hadOwn) {
      return true;
    }
    const oldValue = target[property];
    const oldLength = Array.isArray(target) ? target.length : void 0;
    const result = Reflect.deleteProperty(target, property);
    if (!result) {
      return result;
    }
    const receiver = targetSignal(target);
    const context = makeContext(property, { delete: true, was: oldValue, now: void 0 });
    context.set(DEP.ITERATE, { delete: true, property });
    addArrayLengthChanges(context, target, oldLength);
    notifySet(receiver, context);
    return result;
  },
  defineProperty(target, property, descriptor) {
    const hadOwn = Object.hasOwn(target, property);
    const oldDescriptor = Object.getOwnPropertyDescriptor(target, property);
    const oldValue = target[property];
    const oldLength = Array.isArray(target) ? target.length : void 0;
    const removedValues = property === DEP.LENGTH && Object.hasOwn(descriptor, "value") ? collectRemovedArrayValues(target, Number(descriptor.value)) : /* @__PURE__ */ new Map();
    const result = Reflect.defineProperty(target, property, descriptor);
    if (!result) {
      return result;
    }
    const hasOwn = Object.hasOwn(target, property);
    const newDescriptor = Object.getOwnPropertyDescriptor(target, property);
    const newValue = target[property];
    const context = /* @__PURE__ */ new Map();
    if (!hadOwn && hasOwn) {
      context.set(property, { was: oldValue, now: newValue });
      context.set(DEP.ITERATE, {});
    } else if (hadOwn && hasOwn) {
      if (propertyValueChanged(descriptor, oldDescriptor, oldValue, newDescriptor, newValue)) {
        context.set(property, { was: oldValue, now: newValue });
      }
      if (oldDescriptor?.enumerable !== newDescriptor?.enumerable) {
        context.set(DEP.ITERATE, {});
      }
    }
    addArrayLengthChanges(context, target, oldLength, removedValues);
    notifyContext(targetSignal(target), context);
    return result;
  },
  ownKeys(target) {
    const receiver = targetSignal(target);
    notifyGet(receiver, DEP.ITERATE);
    return Reflect.ownKeys(target);
  }
};
var signals = /* @__PURE__ */ new WeakMap();
function assertSignalTarget(value, name) {
  if (!isObjectLike(value)) {
    throw new TypeError(
      `simplyflow/state: ${name}() expects an object, array, Map, Set, class instance, function, or DOM node; received ${typeof value}`
    );
  }
}
function assertProxyHandler(handler, name) {
  if (!handler || typeof handler !== "object") {
    throw new TypeError(`simplyflow/state: ${name}() expects a Proxy handler object`);
  }
}
function signalProxyHandler(handler) {
  return {
    ...handler,
    get(target, property, receiver) {
      if (property === DEP.XRAY) {
        return target;
      }
      if (property === DEP.SIGNAL) {
        return true;
      }
      if (handler.get) {
        return handler.get(target, property, receiver);
      }
      return readTarget(target, property);
    }
  };
}
function registerSignal(target, proxy) {
  const rawTarget = raw(target);
  assertSignalTarget(rawTarget, "registerSignal");
  if (!isSignal(proxy)) {
    throw new TypeError("simplyflow/state: registerSignal() expects a signal proxy");
  }
  const existing = signals.get(rawTarget);
  if (existing && existing !== proxy) {
    throw new Error("simplyflow/state: registerSignal() target already has a different signal");
  }
  signals.set(rawTarget, proxy);
  return proxy;
}
function createSignal(target, handler = {}, init) {
  assertSignalTarget(target, "createSignal");
  assertProxyHandler(handler, "createSignal");
  if (init !== void 0 && typeof init !== "function") {
    throw new TypeError("simplyflow/state: createSignal() expects init to be a function");
  }
  if (isSignal(target)) {
    return target;
  }
  const existing = getSignal(target);
  if (existing) {
    return existing;
  }
  const proxy = new Proxy(target, signalProxyHandler(handler));
  registerSignal(target, proxy);
  init?.(target, proxy);
  return proxy;
}
function signal(value = {}) {
  if (!isObjectLike(value)) {
    throw new TypeError(
      `simplyflow/state: signal() expects an object, array, Map, Set, class instance, or function; received ${typeof value}`
    );
  }
  return createSignal(value, signalHandler);
}
var tracers = [];
var tracing = false;
function callTracers(kind, ...params) {
  for (const tracer of tracers) {
    tracer[kind]?.(...params);
  }
}
var batchedListeners = /* @__PURE__ */ new Set();
var batchDepth = 0;
function notifySet(self, context = /* @__PURE__ */ new Map()) {
  if (!isSignal(self)) {
    throw new TypeError("simplyflow/state: notifySet() expects a signal as first argument");
  }
  if (!(context instanceof Map)) {
    throw new TypeError("simplyflow/state: notifySet() expects context to be a Map; use makeContext()");
  }
  const listeners = /* @__PURE__ */ new Set();
  context.forEach((change, property) => {
    for (const listener of listenersFor(self, property)) {
      addContextChange(listener, property, change);
      listeners.add(listener);
    }
  });
  if (!listeners.size) {
    return;
  }
  if (batchDepth) {
    for (const listener of listeners) {
      batchedListeners.add(listener);
    }
    return;
  }
  runListeners(listeners, self, context);
}
function makeContext(property, change) {
  const context = /* @__PURE__ */ new Map();
  if (property instanceof Map) {
    property.forEach((change2, prop) => context.set(prop, change2));
    return context;
  }
  if (property !== null && typeof property === "object") {
    for (const prop of Reflect.ownKeys(property)) {
      context.set(prop, property[prop]);
    }
  } else {
    context.set(property, change);
  }
  return context;
}
function addContextChange(listener, property, change) {
  if (!listener.context) {
    listener.context = /* @__PURE__ */ new Map();
  }
  listener.context.set(property, change);
  listener.needsUpdate = true;
}
function clearContext(listener) {
  delete listener.context;
  delete listener.needsUpdate;
}
function notifyGet(self, property) {
  const currentCompute = computeStack[computeStack.length - 1];
  if (!currentCompute || currentCompute.skipDependency?.(self, property)) {
    return;
  }
  if (tracing && tracers.length) {
    callTracers("get", self, property);
  }
  setListeners(self, property, currentCompute);
}
var listenersMap = /* @__PURE__ */ new WeakMap();
var computeMap = /* @__PURE__ */ new WeakMap();
var emptyListeners = /* @__PURE__ */ new Set();
function listenersFor(self, property) {
  return listenersMap.get(self)?.get(property) || emptyListeners;
}
function setListeners(self, property, compute) {
  if (!listenersMap.has(self)) {
    listenersMap.set(self, /* @__PURE__ */ new Map());
  }
  const listeners = listenersMap.get(self);
  if (!listeners.has(property)) {
    listeners.set(property, /* @__PURE__ */ new Set());
  }
  listeners.get(property).add(compute);
  if (!computeMap.has(compute)) {
    computeMap.set(compute, /* @__PURE__ */ new Map());
  }
  const dependencies = computeMap.get(compute);
  if (!dependencies.has(property)) {
    dependencies.set(property, /* @__PURE__ */ new Set());
  }
  dependencies.get(property).add(self);
}
function clearListeners(compute) {
  const dependencies = computeMap.get(compute);
  if (!dependencies) {
    return;
  }
  dependencies.forEach((signals2, property) => {
    signals2.forEach((signal3) => {
      const listeners = listenersMap.get(signal3);
      listeners?.get(property)?.delete(compute);
    });
  });
  computeMap.delete(compute);
}
var computeStack = [];
var effectStack = [];
var signalStack = [];
var effectMap = /* @__PURE__ */ new WeakMap();
function assertFunction(fn, name) {
  if (typeof fn !== "function") {
    throw new TypeError(`simplyflow/state: ${name}() expects a function`);
  }
}
function assertNotRecursive(fn) {
  if (effectStack.includes(fn)) {
    throw new Error("Recursive update() call", { cause: fn });
  }
}
function effectSignal(fn) {
  let connectedSignal = signals.get(fn);
  if (!connectedSignal) {
    connectedSignal = signal({ current: null });
    signals.set(fn, connectedSignal);
  }
  return connectedSignal;
}
function setEffectResult(connectedSignal, result) {
  if (result instanceof Promise) {
    result.then((value) => {
      connectedSignal.current = value;
    });
  } else {
    connectedSignal.current = result;
  }
}
function runTracked(compute, connectedSignal, fn, effectType, args = [compute, computeStack, signalStack]) {
  if (signalStack.includes(connectedSignal)) {
    throw new Error("Cyclical dependency in update() call", { cause: fn });
  }
  clearListeners(compute);
  compute.effectFunction = fn;
  compute.effectType = effectType;
  computeStack.push(compute);
  signalStack.push(connectedSignal);
  let result;
  try {
    result = fn(...args);
  } finally {
    computeStack.pop();
    signalStack.pop();
    setEffectResult(connectedSignal, result);
  }
}
function runListeners(listeners, signal3, context) {
  const currentEffect = computeStack[computeStack.length - 1];
  for (const listener of listeners) {
    if (listener !== currentEffect && listener?.needsUpdate) {
      if (listener.scheduleClock) {
        listener.scheduleClock();
      } else {
        if (signal3 && tracing && tracers.length) {
          callTracers("set", signal3, context, listener);
        }
        listener();
      }
    }
    clearContext(listener);
  }
}
function destroy(connectedSignal) {
  if (!isSignal(connectedSignal)) {
    throw new TypeError("simplyflow/state: destroy() expects an effect signal");
  }
  const compute = effectMap.get(connectedSignal);
  if (!compute) {
    return;
  }
  compute.destroy?.();
  clearListeners(compute);
  if (compute.fn) {
    signals.delete(compute.fn);
    const index = effectStack.findIndex((fn) => fn === compute.fn);
    if (index !== -1) {
      effectStack.splice(index, 1);
    }
  }
  effectMap.delete(connectedSignal);
}
function batch(fn) {
  assertFunction(fn, "batch");
  batchDepth++;
  let result;
  try {
    result = fn();
  } finally {
    const finish = () => {
      batchDepth--;
      if (!batchDepth) {
        runBatchedListeners();
      }
    };
    if (result instanceof Promise) {
      result.then(finish, finish);
    } else {
      finish();
    }
  }
  return result;
}
function runBatchedListeners() {
  const listeners = batchedListeners;
  batchedListeners = /* @__PURE__ */ new Set();
  const clocked = /* @__PURE__ */ new Set();
  const ready = /* @__PURE__ */ new Set();
  for (const listener of listeners) {
    if (listener.scheduleClock) {
      clocked.add(listener);
    } else {
      ready.add(listener);
    }
  }
  runListeners(clocked);
  runListeners(ready);
}
function throttledEffect(fn, throttleTime) {
  assertFunction(fn, "throttledEffect");
  if (!Number.isFinite(throttleTime) || throttleTime < 0) {
    throw new TypeError("simplyflow/state: throttledEffect() expects throttleTime to be a non-negative number");
  }
  assertNotRecursive(fn);
  effectStack.push(fn);
  const connectedSignal = effectSignal(fn);
  let throttledUntil = 0;
  let hasChange = true;
  let timeout = null;
  const compute = function computeEffect() {
    const now = Date.now();
    if (throttledUntil > now) {
      hasChange = true;
      schedule();
      return;
    }
    runTracked(compute, connectedSignal, fn, throttledEffect);
    hasChange = false;
    throttledUntil = Date.now() + throttleTime;
  };
  function schedule() {
    if (timeout) {
      return;
    }
    const delay = Math.max(0, throttledUntil - Date.now());
    timeout = globalThis.setTimeout(() => {
      timeout = null;
      if (hasChange) {
        compute();
      }
    }, delay);
  }
  compute.fn = fn;
  compute.destroy = () => {
    if (timeout) {
      globalThis.clearTimeout(timeout);
      timeout = null;
    }
    hasChange = false;
  };
  effectMap.set(connectedSignal, compute);
  compute();
  return connectedSignal;
}
function untracked(fn) {
  assertFunction(fn, "untracked");
  const index = computeStack.length - 1;
  const current = computeStack[index];
  computeStack[index] = false;
  try {
    return fn();
  } finally {
    computeStack[index] = current;
  }
}

// ../bind/src/render.mjs
function writesFromDom(binding, context) {
  return binding.options.twoway || context.edit;
}
function field(context) {
  if (context.templates?.length) {
    fieldByTemplates.call(this, context);
  } else if (Object.hasOwnProperty.call(this.options.renderers, context.element.tagName)) {
    const renderer = this.options.renderers[context.element.tagName];
    if (renderer) {
      renderer.call(this, context);
    }
  } else if (this.options.renderers["*"]) {
    this.options.renderers["*"].call(this, context);
  }
  return context;
}
function list(context) {
  if (!Array.isArray(context.value)) {
    context.value = [context.value];
  }
  const length = context.value.length;
  if (!context.templates?.length) {
    console.error("No templates found in", context.element);
  } else {
    arrayByTemplates.call(this, context);
  }
  return context;
}
function map(context) {
  if (typeof context.value != "object" || !context.value) {
    console.error("Value is not an object.", context.element, context.path, context.value);
  } else if (!context.templates?.length) {
    console.error("No templates found in", context.element);
  } else {
    objectByTemplates.call(this, context);
  }
  return context;
}
function isInt(s) {
  if (parseInt(s) == s) {
    return true;
  }
}
function setValueByPath(root, path2, value, options = {}) {
  batch(() => {
    let parts = path2.split(".");
    let curr = root;
    let part;
    part = parts.shift();
    let prev = null;
    let prevPart = null;
    let prevCurr = curr;
    while (part && curr) {
      prevCurr = curr;
      part = decodeURIComponent(part);
      if (part == "0" && !Array.isArray(curr)) {
      } else if (part == ":key") {
        throw new Error("setting key not yet supported");
        curr = prevPart;
      } else if (part == ":value") {
      } else if (Array.isArray(curr) && !isInt(part) && typeof curr[part] == "undefined") {
        prev = curr[0];
        curr = curr[0][part];
      } else {
        prev = curr;
        curr = curr[part];
      }
      prevPart = part;
      part = parts.shift();
      if (part && !curr) {
        const intKey = parseInt(part);
        if (intKey >= 0 && part === "" + intKey) {
          prevCurr[prevPart] = [];
        } else {
          prevCurr[prevPart] = {};
        }
        curr = prevCurr[prevPart];
      }
    }
    if (prev && prevPart && options.replace) {
      prev[prevPart] = value;
    } else if (prev && prevPart && prev[prevPart] !== value) {
      if (Array.isArray(value)) {
        prev[prevPart] = value;
      } else if (value && typeof value == "object") {
        curr = prev[prevPart];
        if (!curr) {
          prev[prevPart] = {};
          curr = prev[prevPart];
        }
        for (const prop in value) {
          if (curr[prop] !== value[prop]) {
            curr[prop] = value[prop];
          }
        }
      } else {
        prev[prevPart] = value;
      }
    }
  });
}
function arrayByTemplates(context) {
  const attribute = this.options.attribute;
  const attributes2 = [attribute + "-field", attribute + "-edit", attribute + "-list", attribute + "-map", attribute + "-value-path"];
  const attrQuery = "[" + attributes2.join("],[") + "]";
  const keyAttribute = attribute + "-key";
  const items = Array.from(context.element.querySelectorAll(":scope > [" + keyAttribute + "]"));
  const usedItems = /* @__PURE__ */ new Set();
  let cursor = 0;
  context.list = context.value;
  for (let index = 0; index < context.value.length; index++) {
    context.index = index;
    const value = context.list[index];
    let item = nextUnusedItem(items, usedItems, cursor);
    if (!item) {
      context.element.appendChild(this.applyTemplate(context));
      continue;
    }
    const newTemplate = this.findTemplate(context.templates, value);
    const currentValueMatches = item[DEP.VALUE] === value;
    let reusableItem = currentValueMatches ? item : findReusableItem(items, usedItems, value, newTemplate, cursor + 1);
    if (reusableItem) {
      if (newTemplate != reusableItem[DEP.TEMPLATE]) {
        context.element.replaceChild(this.applyTemplate(context), reusableItem);
      } else {
        if (reusableItem !== item) {
          context.element.insertBefore(reusableItem, item);
        }
        updateItemKey(reusableItem, index, context.path, keyAttribute, attributes2, attrQuery);
        reusableItem[DEP.VALUE] = value;
      }
      usedItems.add(reusableItem);
      if (reusableItem === item) {
        cursor++;
      }
      continue;
    }
    context.element.insertBefore(this.applyTemplate(context), item);
  }
  for (let item of items) {
    if (!usedItems.has(item)) {
      item.remove();
    }
  }
  if (this.options.twoway) {
    trackDomList.call(this, context.element);
  }
}
function nextUnusedItem(items, usedItems, start) {
  while (start < items.length) {
    const item = items[start];
    if (!usedItems.has(item)) {
      return item;
    }
    start++;
  }
}
function findReusableItem(items, usedItems, value, template, start) {
  for (let i = start; i < items.length; i++) {
    const item = items[i];
    if (!usedItems.has(item) && item[DEP.VALUE] === value && item[DEP.TEMPLATE] === template) {
      return item;
    }
  }
}
function updateItemKey(item, key, path2, keyAttribute, attributes2, attrQuery) {
  const oldKey = item.getAttribute(keyAttribute);
  const newKey = "" + key;
  if (oldKey === newKey) {
    return;
  }
  item.setAttribute(keyAttribute, newKey);
  const oldPrefix = path2 + "." + oldKey;
  const newPrefix = path2 + "." + newKey;
  const bindings = Array.from(item.querySelectorAll(attrQuery));
  if (item.matches(attrQuery)) {
    bindings.unshift(item);
  }
  for (let binding of bindings) {
    for (let attr of attributes2) {
      const bindPath = binding.getAttribute(attr);
      if (!bindPath || bindPath.substr(0, 5) === ":root") {
        continue;
      }
      if (bindPath === oldPrefix) {
        binding.setAttribute(attr, newPrefix);
      } else if (bindPath.startsWith(oldPrefix + ".")) {
        binding.setAttribute(attr, newPrefix + bindPath.substr(oldPrefix.length));
      }
    }
  }
}
function objectByTemplates(context) {
  const attribute = this.options.attribute;
  const attributes2 = [attribute + "-field", attribute + "-edit", attribute + "-list", attribute + "-map", attribute + "-value-path"];
  const attrQuery = "[" + attributes2.join("],[") + "]";
  const keyAttribute = attribute + "-key";
  const items = Array.from(context.element.querySelectorAll(":scope > [" + keyAttribute + "]"));
  const usedItems = /* @__PURE__ */ new Set();
  let cursor = 0;
  context.list = context.value;
  for (let key in context.list) {
    context.index = key;
    const value = context.list[key];
    let item = nextUnusedItem(items, usedItems, cursor);
    if (!item) {
      context.element.appendChild(this.applyTemplate(context));
      continue;
    }
    const newTemplate = this.findTemplate(context.templates, value);
    let reusableItem;
    if (item.getAttribute(keyAttribute) === key) {
      reusableItem = item;
    } else {
      reusableItem = findItemByKey(items, usedItems, key, keyAttribute) || findReusableItem(items, usedItems, value, newTemplate, cursor);
    }
    if (reusableItem) {
      if (newTemplate != reusableItem[DEP.TEMPLATE]) {
        context.element.replaceChild(this.applyTemplate(context), reusableItem);
      } else {
        if (reusableItem !== item) {
          context.element.insertBefore(reusableItem, item);
        }
        updateItemKey(reusableItem, key, context.path, keyAttribute, attributes2, attrQuery);
        reusableItem[DEP.VALUE] = value;
      }
      usedItems.add(reusableItem);
      if (reusableItem === item) {
        cursor++;
      }
      continue;
    }
    context.element.insertBefore(this.applyTemplate(context), item);
  }
  for (let item of items) {
    if (!usedItems.has(item)) {
      item.remove();
    }
  }
}
function findItemByKey(items, usedItems, key, keyAttribute) {
  const stringKey = "" + key;
  for (let item of items) {
    if (!usedItems.has(item) && item.getAttribute(keyAttribute) === stringKey) {
      return item;
    }
  }
}
function fieldByTemplates(context) {
  const rendered = context.element.querySelector(":scope > :not(template)");
  const template = this.findTemplate(context.templates, context.value);
  context.parent = getParentPath(context.element);
  if (rendered) {
    if (template) {
      if (rendered?.[DEP.TEMPLATE] != template) {
        const clone = this.applyTemplate(context);
        context.element.replaceChild(clone, rendered);
      }
    } else {
      context.element.removeChild(rendered);
    }
  } else if (template) {
    const clone = this.applyTemplate(context);
    context.element.appendChild(clone);
  }
}
function getParentPath(el, attribute) {
  const parentEl = el.parentElement?.closest(`[${attribute}-list],[${attribute}-map]`);
  if (!parentEl) {
    return "";
  }
  if (parentEl.hasAttribute(`${attribute}-list`)) {
    return parentEl.getAttribute(`${attribute}-list`) + ".";
  }
  return parentEl.getAttribute(`${attribute}-map`) + ".";
}
function input(context) {
  const el = context.element;
  let value = context.value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    setProperties(el, value, "title", "id", "className", "value", "checked");
    value = value.value;
  }
  if (typeof value == "undefined") {
    value = "";
  }
  if (el.type == "checkbox") {
    el.checked = checkboxIsChecked(el, value);
  } else if (el.type == "radio") {
    el.checked = matchValue(el.value, value);
  } else if (!matchValue(el.value, value)) {
    el.value = "" + value;
  }
  if (writesFromDom(this, context)) {
    if (el.type == "checkbox") {
      trackDomField.call(this, context.element, ["checked"], true, "checked", checkboxEditValue, context);
    } else if (el.type == "radio") {
      trackDomField.call(this, context.element, ["checked"], true, "checked", radioEditValue, context);
    } else {
      trackDomField.call(this, context.element, ["value"], true, "value", void 0, context);
    }
  }
}
function checkboxIsChecked(el, value) {
  if (Array.isArray(value)) {
    return value.some((selected) => matchValue(el.value, selected));
  }
  if (typeof value === "boolean") {
    return value;
  }
  return matchValue(el.value, value);
}
function checkboxEditValue(el, currentValue) {
  if (Array.isArray(currentValue)) {
    const value = el.value;
    const values = currentValue.filter((item) => !matchValue(item, value));
    if (el.checked) {
      values.push(value);
    }
    return values;
  }
  if (typeof currentValue === "boolean") {
    return el.checked;
  }
  if (el.checked && matchValue(el.value, currentValue)) {
    return currentValue;
  }
  return el.checked;
}
function radioEditValue(el, currentValue) {
  if (!el.checked) {
    return void 0;
  }
  return el.value;
}
function button(context) {
  element.call(this, context, "value");
}
function select(context) {
  const el = context.element;
  let value = context.value;
  if (value === null) {
    value = "";
  }
  if (Array.isArray(value)) {
    for (let option of el.options) {
      option.selected = value.some((selected) => matchValue(option.value, selected));
      if (option.selected) {
        option.setAttribute("selected", true);
      } else {
        option.removeAttribute("selected");
      }
    }
  } else if (typeof value != "object") {
    let option = Array.from(el.options).find((o) => matchValue(o.value, value));
    if (option) {
      option.selected = true;
      option.setAttribute("selected", true);
    }
  } else {
    if (value.options) {
      setSelectOptions(el, value.options);
    }
    if (typeof value.selected !== "undefined") {
      select.call(this, Object.assign({}, context, { value: value.selected }));
    }
    setProperties(el, value, "name", "id", "selectedIndex", "className");
  }
  if (writesFromDom(this, context)) {
    if (el.multiple) {
      trackDomField.call(this, context.element, ["value"], true, "value", selectMultipleEditValue, context);
    } else {
      trackDomField.call(this, context.element, ["value"], true, "value", void 0, context);
    }
  }
}
function selectMultipleEditValue(el) {
  const value = el.value;
  return Array.from(el.options).filter((option) => option.selected).map((option) => option.value);
}
function addOption(select2, option) {
  if (!option) {
    return;
  }
  if (typeof option !== "object") {
    select2.options.add(new Option("" + option));
  } else if (option.text) {
    select2.options.add(new Option(option.text, option.value, option.defaultSelected, option.selected));
  } else if (typeof option.value != "undefined") {
    select2.options.add(new Option("" + option.value, option.value, option.defaultSelected, option.selected));
  }
}
function setSelectOptions(select2, options) {
  select2.innerHTML = "";
  if (Array.isArray(options)) {
    for (const option of options) {
      addOption(select2, option);
    }
  } else if (options && typeof options == "object") {
    for (const option in options) {
      addOption(select2, { text: options[option], value: option });
    }
  }
}
function anchor(context) {
  element.call(this, context, "target", "href", "name", "newwindow", "nofollow");
  if (writesFromDom(this, context)) {
    batch(() => {
      updateProperties.call(this, context, ["target", "href", "name", "newwindow", "nofollow"]);
    });
  }
}
function image(context) {
  setProperties(context.element, context.value, "title", "alt", "src", "id");
  if (writesFromDom(this, context)) {
    batch(() => {
      updateProperties.call(this, context, ["title", "alt", "src", "id"]);
    });
  }
}
function iframe(context) {
  setProperties(context.element, context.value, "title", "src", "id");
  if (writesFromDom(this, context)) {
    batch(() => {
      updateProperties.call(this, context, ["title", "src", "id"]);
    });
  }
}
function meta(context) {
  setProperties(context.element, context.value, "content", "id");
  if (writesFromDom(this, context)) {
    batch(() => {
      updateProperties.call(this, context, ["content", "id"]);
    });
  }
}
function element(context, ...extraprops) {
  const el = context.element;
  let value = context.value;
  let valueIsString = false;
  if (typeof value != "undefined" && value !== null) {
    let strValue = "" + value;
    if (typeof value != "object" || strValue.substring(0, 8) != "[object ") {
      value = { innerHTML: value };
      valueIsString = true;
    }
  }
  const props = ["innerHTML", "title", "id", "className"].concat(extraprops);
  setProperties(el, value, ...props);
  if (writesFromDom(this, context)) {
    trackDomField.call(this, context.element, props, valueIsString, "innerHTML", void 0, context);
  }
}
function setProperties(el, data, ...properties) {
  if (!data || typeof data !== "object") {
    return;
  }
  for (const property of properties) {
    if (typeof data[property] === "undefined") {
      continue;
    }
    if (matchValue(el[property], data[property])) {
      continue;
    }
    if (data[property] === null) {
      el[property] = "";
    } else {
      el[property] = "" + data[property];
    }
  }
}
function updateProperties(context, properties) {
  trackDomField.call(this, context.element, properties, false, "innerHTML", void 0, context);
}
function getProperties(el, ...properties) {
  const result = {};
  for (const property of properties) {
    switch (property) {
      default:
        result[property] = el[property];
        break;
    }
  }
  return result;
}
function matchValue(a, b) {
  if (a == ":empty" && !b) {
    return true;
  }
  if (b == ":empty" && !a) {
    return true;
  }
  if ("" + a == "" + b) {
    return true;
  }
  return false;
}

// ../bind/src/dom.mjs
var domSignals = /* @__PURE__ */ new WeakMap();
var observers = /* @__PURE__ */ new WeakMap();
var domSignalHandler = {
  get: (target, property, receiver) => {
    const value = target?.[property];
    notifyGet(receiver, property);
    if (typeof value === "function") {
      return value.bind(target);
    }
    if (value && typeof value == "object") {
      return signal(value);
    }
    return value;
  },
  set: (target, property, value, receiver) => {
    const current = target[property];
    target[property] = value;
    const now = target[property];
    if (!Object.is(current, now)) {
      notifySet(receiver, makeContext(property, { was: current, now }));
    }
    return true;
  },
  has: (target, property) => {
    const receiver = getSignal(target);
    if (receiver) {
      notifyGet(receiver, property);
    }
    return Reflect.has(target, property);
  },
  ownKeys: (target) => {
    const receiver = getSignal(target);
    if (receiver) {
      notifyGet(receiver, DEP.ITERATE);
    }
    return Reflect.ownKeys(target);
  }
};
function signal2(el, options) {
  if (isSignal(el)) {
    return el;
  }
  const existing = getSignal(el);
  if (existing) {
    return existing;
  }
  return createSignal(el, domSignalHandler, (target, proxy) => {
    domListen(target, proxy, options);
  });
}
function domListen(el, signal3, options) {
  const defaultOptions = {
    characterData: true,
    subtree: true,
    attributes: true,
    attributesOldValue: true,
    childList: true
  };
  if (!options) {
    options = defaultOptions;
  }
  let oldContentHTML = el.innerHTML;
  let oldContentText = el.innerText;
  if (!observers.has(el)) {
    const observer = new MutationObserver((mutationList, observer2) => {
      const changes = {};
      for (const mutation of mutationList) {
        if (mutation.type === "attributes") {
          changes[mutation.attributeName] = mutation.attributeOldValue;
        } else if (mutation.type === "subtree" || mutation.type === "characterData") {
          if (el.innerHTML != oldContentHTML) {
            changes.innerHTML = oldContentHTML;
            oldContentHTML = el.innerHTML;
          }
          if (el.innerText != oldContentText) {
            changes.innerText = oldContentText;
            oldContentText = el.innerText;
          }
        } else if (mutation.type === "childList") {
          changes.children = {
            //FIXME: overwrites changes in this list path if list is rendered multiple times
            was: Array.from(el.children)
            //FIXME; fill in 'now'
          };
          changes.length = -1;
          if (el.innerHTML != oldContentHTML) {
            changes.innerHTML = oldContentHTML;
            oldContentHTML = el.innerHTML;
          }
          if (el.innerText != oldContentText) {
            changes.innerText = oldContentText;
            oldContentText = el.innerText;
          }
        } else {
          console.log("nothing to do for", el, mutation.type);
        }
      }
      for (const prop in changes) {
        notifySet(signal3, makeContext(prop, { was: changes[prop], now: el[prop] }));
      }
    });
    observer.observe(el, options);
    observers.set(el, observer);
    if (el.matches("input, textarea, select")) {
      let prevValue = el.value;
      let prevChecked = el.checked;
      const notifyFormValue = () => {
        notifySet(signal3, makeContext("value", { was: prevValue, now: el.value }));
        prevValue = el.value;
        if ("checked" in el) {
          notifySet(signal3, makeContext("checked", { was: prevChecked, now: el.checked }));
          prevChecked = el.checked;
        }
      };
      el.addEventListener("change", notifyFormValue);
      if (el.matches("input, textarea")) {
        el.addEventListener("input", notifyFormValue);
      }
    }
  }
}
function trackDomList(element2) {
  const path2 = this.getBindingPath(element2);
  if (!path2) {
    throw new Error("Could not find binding path for element", { cause: element2 });
  }
  const s = signal2(element2, {
    childList: true
  });
  throttledEffect(() => {
    const children = Array.from(s.children);
    untracked(() => {
      batch(() => {
        let key = 0;
        const currentList = getValueByPath(this.options.root, path2);
        const source = currentList.slice();
        for (const item of children) {
          if (item.tagName === "TEMPLATE") {
            continue;
          }
          if (item.dataset.flowKey) {
            if (item.dataset.flowKey != key) {
              setValueByPath(
                this.options.root,
                path2 + "." + key,
                source[item.dataset.flowKey]
              );
            }
            key++;
          }
        }
        if (currentList.length > key) {
          currentList.length = key;
        }
      });
    });
  }, 50);
  return s;
}
function trackDomField(element2, props, valueIsString, stringProperty = "innerHTML", getUpdateValue, context) {
  if (domSignals.has(element2)) {
    return;
  }
  const path2 = this.getBindingPath(element2);
  if (!path2) {
    throw new Error("Could not find binding path for element", { cause: element2 });
  }
  const s = signal2(element2);
  domSignals.set(element2, s);
  batch(() => {
    throttledEffect(() => {
      let updateValue;
      if (getUpdateValue) {
        for (const prop of props) {
          s[prop];
        }
      } else {
        updateValue = s[stringProperty];
        if (!valueIsString) {
          updateValue = getProperties(s, ...props);
        }
      }
      untracked(() => {
        const currentValue = getValueByPath(this.options.root, path2);
        if (getUpdateValue) {
          updateValue = getUpdateValue.call(this, s, currentValue);
        }
        if (typeof updateValue === "undefined") {
          return;
        }
        updateValue = this.extractValue?.(context, updateValue, currentValue) ?? updateValue;
        if (typeof updateValue === "undefined") {
          return;
        }
        if (valueIsString && !Object.is(currentValue, updateValue) && String(currentValue) === updateValue) {
          return;
        }
        setValueByPath(this.options.root, path2, updateValue, { replace: context?.replaceValue });
      });
    }, 50);
  });
  return s;
}

// ../bind/src/transformers.mjs
var escape_html = {
  render(context, next) {
    if (typeof context.value !== "string") {
      return next(context);
    }
    if (usesValueProperty(context.element)) {
      context.value = { value: context.value };
    } else {
      context.value = { innerHTML: escapeHTML(context.value) };
    }
    return next(context);
  },
  extract(context, next) {
    if (typeof context.value === "string") {
      context.value = unescapeHTML(context.value);
    } else if (context.value && typeof context.value === "object") {
      if (typeof context.value.innerHTML === "string") {
        context.value = unescapeHTML(context.value.innerHTML);
      } else if (typeof context.value.value === "string") {
        context.value = context.value.value;
      }
    }
    return next(context);
  }
};
function usesValueProperty(element2) {
  return element2?.tagName === "INPUT" || element2?.tagName === "TEXTAREA";
}
function escapeHTML(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function unescapeHTML(value) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}
function fixed_content(context, next) {
  if (typeof context.value == "string") {
    context.value = {};
  } else {
    delete context.value?.innerHTML;
  }
  next(context);
}
var attributes = {
  render(context) {
    const names = getAttributeNames.call(this, context);
    setAttributes(context.element, context.value, names);
    if (context.edit) {
      trackDomField.call(
        this,
        context.element,
        names,
        false,
        "innerHTML",
        () => readAttributes(context.element, names),
        context
      );
    }
    return context;
  },
  extract(context, next) {
    const names = getAttributeNames.call(this, context);
    context.value = readAttributes(context.element, names);
    context.replaceValue = true;
    return next ? next(context) : context;
  }
};
function getAttributeNames(context) {
  const attribute = this.options.attribute + "-attributes";
  const configured = context.element.getAttribute(attribute);
  if (configured) {
    return configured.split(/[\s,]+/).filter(Boolean);
  }
  if (context.value && typeof context.value === "object" && !Array.isArray(context.value)) {
    return Object.keys(context.value);
  }
  if (context.currentValue && typeof context.currentValue === "object" && !Array.isArray(context.currentValue)) {
    return Object.keys(context.currentValue);
  }
  return [];
}
function setAttributes(element2, data, names) {
  if (!names.length || !data || typeof data !== "object" || Array.isArray(data)) {
    return;
  }
  for (const name of names) {
    const value = data[name];
    if (typeof value === "undefined" || value === null) {
      element2.removeAttribute(name);
    } else if (element2.getAttribute(name) !== "" + value) {
      element2.setAttribute(name, "" + value);
    }
  }
}
function readAttributes(element2, names) {
  const data = {};
  for (const name of names) {
    if (element2.hasAttribute(name)) {
      data[name] = element2.getAttribute(name);
    }
  }
  return data;
}

// ../bind/src/index.mjs
var SimplyBind = class {
  /**
   * @param Object options - a set of options for this instance, options may include:
   *  - root (signal) (required) - the root data object that contains al signals that can be bound
   *  - container (HTMLElement) - the dom element to use as the root for all bindings
   *  - attribute (string) - the prefix for the field, edit, list and map attributes, e.g. 'data-bind'
   *  - transformers (object name:function) - a map of transformer names and functions
   *  - render (object with field, list and map properties); edit uses field renderers
   */
  constructor(options) {
    this.bindings = /* @__PURE__ */ new Map();
    const defaultTransformers = {
      escape_html,
      fixed_content,
      attributes
    };
    const defaultOptions = {
      container: document.body,
      attribute: "data-flow",
      transformers: defaultTransformers,
      render: {
        field: [field],
        list: [list],
        map: [map]
      },
      renderers: {
        "INPUT": input,
        "TEXTAREA": input,
        "BUTTON": button,
        "SELECT": select,
        "A": anchor,
        "IMG": image,
        "IFRAME": iframe,
        "META": meta,
        "TEMPLATE": null,
        "*": element
      },
      twoway: false
    };
    if (!options?.root) {
      throw new Error("bind needs at least options.root set");
    }
    this.options = Object.assign({}, defaultOptions, options);
    if (options.transformers) {
      this.options.transformers = Object.assign({}, defaultTransformers, options?.transformers);
    } else {
      this.options.transformers = defaultTransformers;
    }
    const attribute = this.options.attribute;
    const bindAttributes = [attribute + "-field", attribute + "-edit", attribute + "-list", attribute + "-map"];
    const getBindingAttribute = (el) => {
      const foundAttribute = bindAttributes.find((attr) => el.hasAttribute(attr));
      if (!foundAttribute) {
        console.error("No matching attribute found", el, bindAttributes);
      }
      return foundAttribute;
    };
    const renderElement = (el) => {
      this.bindings.set(el, throttledEffect(() => {
        if (!el.isConnected) {
          untrack(el, this.getBindingPath(el));
          const binding = this.bindings.get(el);
          if (binding) {
            destroy(binding);
            this.bindings.delete(el);
          }
          return;
        }
        let context = {
          templates: el.querySelectorAll(":scope > template"),
          attribute: getBindingAttribute(el)
        };
        context.edit = context.attribute === this.options.attribute + "-edit";
        context.path = this.getBindingPath(el);
        context.value = getValueByPath(this.options.root, context.path);
        context.element = el;
        track(el, context);
        runTransformers(context);
      }, 50));
    };
    const runTransformers = (context) => {
      let transformers;
      switch (context.attribute) {
        case this.options.attribute + "-field":
        case this.options.attribute + "-edit":
          transformers = Array.from(this.options.render.field);
          break;
        case this.options.attribute + "-list":
          transformers = Array.from(this.options.render.list);
          break;
        case this.options.attribute + "-map":
          transformers = Array.from(this.options.render.map);
          break;
        default:
          throw new Error("no valid context attribute specified", context);
          break;
      }
      transformers.push(...this.getNamedTransformers(context.element).map((transformer) => getTransformerPhase(transformer, "render")).filter(Boolean));
      runTransformerStack.call(this, transformers, context);
    };
    const applyBindings = (bindings2) => {
      for (let bindingEl of bindings2) {
        if (!this.bindings.get(bindingEl)) {
          renderElement(bindingEl);
        }
      }
    };
    const updateBindings = (changes) => {
      const selector = `[${attribute}-field],[${attribute}-edit],[${attribute}-list],[${attribute}-map]`;
      for (const change of changes) {
        if (change.type == "childList" && change.addedNodes) {
          for (let node of change.addedNodes) {
            if (node instanceof HTMLElement) {
              let bindings2 = Array.from(node.querySelectorAll(selector));
              if (node.matches(selector)) {
                bindings2.unshift(node);
              }
              if (bindings2.length) {
                applyBindings(bindings2);
              }
            }
          }
        }
      }
    };
    this.observer = new MutationObserver((changes) => {
      updateBindings(changes);
    });
    this.observer.observe(this.options.container, {
      subtree: true,
      childList: true
    });
    const bindings = this.options.container.querySelectorAll(
      ":is([" + this.options.attribute + "-field],[" + this.options.attribute + "-edit],[" + this.options.attribute + "-list],[" + this.options.attribute + "-map]):not(template)"
    );
    try {
      if (bindings.length) {
        applyBindings(bindings);
      }
    } catch (error) {
      this.destroy();
      throw error;
    }
  }
  /**
   * Finds the first matching template and creates a new DocumentFragment
   * with the correct data bind attributes in it (prepends the current path)
   * @param Context context
   * @return DocumentFragment
   */
  applyTemplate(context) {
    const path2 = context.path;
    const parent = context.parent;
    const templates = context.templates;
    const list2 = context.list;
    const index = context.index;
    const value = list2 ? list2[index] : context.value;
    let template = this.findTemplate(templates, value);
    if (!template) {
      let result = new DocumentFragment();
      result.innerHTML = "<!-- no matching template -->";
      return result;
    }
    let clone = template.content.cloneNode(true);
    if (!clone.children?.length) {
      return clone;
    }
    if (clone.children.length > 1) {
      throw new Error("template must contain a single root node", { cause: template });
    }
    const attribute = this.options.attribute;
    const attributes2 = [attribute + "-field", attribute + "-edit", attribute + "-list", attribute + "-map"];
    const bindings = clone.querySelectorAll(`[${attribute}-field],[${attribute}-edit],[${attribute}-list],[${attribute}-map]`);
    for (let binding of bindings) {
      if (binding.tagName == "TEMPLATE") {
        continue;
      }
      const attr = attributes2.find((attr2) => binding.hasAttribute(attr2));
      let bind2 = binding.getAttribute(attr);
      bind2 = this.applyLinks(template.links, bind2);
      if (bind2.substring(0, ":root.".length) == ":root.") {
        binding.setAttribute(attr, bind2.substring(":root.".length));
      } else if (bind2 == ":value" && index != null) {
        binding.setAttribute(attr, path2 + "." + index);
      } else if (index != null) {
        binding.setAttribute(attr, path2 + "." + index + "." + bind2);
      } else {
        binding.setAttribute(attr, parent + bind2);
      }
    }
    this.applyTemplateCommandValues(clone, template.links, path2, index);
    if (typeof index !== "undefined") {
      clone.children[0].setAttribute(attribute + "-key", index);
    }
    clone.children[0][DEP.TEMPLATE] = template;
    clone.children[0][DEP.VALUE] = value;
    return clone;
  }
  applyTemplateCommandValues(fragment, links, path2, index) {
    const valueAttribute = this.options.attribute + "-value";
    const valuePathAttribute = this.options.attribute + "-value-path";
    const valueSelector = "[" + valueAttribute + "]";
    const elements = Array.from(fragment.querySelectorAll(valueSelector));
    for (const element2 of elements) {
      let value = element2.getAttribute(valueAttribute);
      value = this.applyLinks(links, value);
      const resolved = templateCommandValue(value, path2, index);
      if (!resolved) {
        continue;
      }
      if (Object.hasOwn(resolved, "path")) {
        element2.setAttribute(valuePathAttribute, resolved.path);
      } else {
        element2.setAttribute(valueAttribute, resolved.value);
        element2.removeAttribute(valuePathAttribute);
      }
    }
  }
  parseLinks(links) {
    let result = {};
    links = links.split(";").map((link) => link.trim());
    for (let link of links) {
      link = link.split("=");
      result[link[0].trim()] = link[1].trim();
    }
    return result;
  }
  applyLinks(links, value) {
    for (let link in links) {
      if (value.startsWith(link + ".")) {
        return links[link] + value.substr(link.length);
      } else if (value == link) {
        return links[link];
      }
    }
    return value;
  }
  /**
   * Returns the path referenced in either the field, list or map attribute
   * @param HTMLElement el
   * @return string The path referenced, or void
   */
  getBindingPath(el) {
    const attributes2 = [
      this.options.attribute + "-field",
      this.options.attribute + "-edit",
      this.options.attribute + "-list",
      this.options.attribute + "-map"
    ];
    for (let attr of attributes2) {
      if (el.hasAttribute(attr)) {
        return el.getAttribute(attr);
      }
    }
  }
  getNamedTransformers(el) {
    const transformAttribute = this.options.attribute + "-transform";
    if (!el.hasAttribute(transformAttribute)) {
      return [];
    }
    return el.getAttribute(transformAttribute).split(" ").filter(Boolean).map((name) => {
      const transformer = this.options.transformers[name];
      if (!transformer) {
        console.warn("No transformer with name " + name + " configured", { cause: el });
        return null;
      }
      return transformer;
    }).filter(Boolean);
  }
  extractValue(context, value, currentValue) {
    if (!context?.element) {
      return value;
    }
    const transformers = this.getNamedTransformers(context.element).map((transformer) => getTransformerPhase(transformer, "extract")).filter(Boolean).reverse();
    if (!transformers.length) {
      return value;
    }
    delete context.replaceValue;
    const extractContext = Object.assign({}, context, {
      value,
      currentValue,
      originalValue: currentValue
    });
    runTransformerStack.call(this, transformers, extractContext);
    context.replaceValue = extractContext.replaceValue;
    return extractContext.value;
  }
  /**
   * Finds the first template from an array of templates that
   * matches the given value. 
   */
  findTemplate(templates, value) {
    const templateMatches = (t) => {
      let path2 = this.getBindingPath(t);
      let currentItem;
      if (path2) {
        if (path2.substr(0, 6) == ":root.") {
          currentItem = getValueByPath(this.options.root, path2.substring(6));
        } else {
          currentItem = getValueByPath(value, path2);
        }
      } else {
        currentItem = value;
      }
      const strItem = "" + currentItem;
      let matches = t.getAttribute(this.options.attribute + "-match");
      if (matches) {
        if (matches === ":empty" && !currentItem) {
          return t;
        } else if (matches === ":notempty" && currentItem) {
          return t;
        }
        if (strItem == matches) {
          return t;
        }
      }
      if (!matches) {
        return t;
      }
    };
    let template = Array.from(templates).find(templateMatches);
    let links = null;
    if (template?.hasAttribute(this.options.attribute + "-link")) {
      links = this.parseLinks(template.getAttribute(this.options.attribute + "-link"));
    }
    let rel = template?.getAttribute("rel");
    if (rel) {
      let replacement = document.querySelector("template#" + rel);
      if (!replacement) {
        throw new Error("Could not find template with id " + rel);
      }
      template = replacement;
    }
    if (template) {
      template.links = links;
    }
    return template;
  }
  destroy() {
    this.bindings.forEach((binding, element2) => {
      untrack(element2, this.getBindingPath(element2));
      destroy(binding);
    });
    this.bindings = /* @__PURE__ */ new Map();
    this.observer.disconnect();
  }
};
function bind(options) {
  return new SimplyBind(options);
}
function getTransformerPhase(transformer, phase) {
  if (typeof transformer === "function") {
    return phase === "render" ? transformer : null;
  }
  if (transformer && typeof transformer[phase] === "function") {
    return transformer[phase];
  }
  return null;
}
function runTransformerStack(transformers, context) {
  let next = (context2) => context2;
  for (let transformer of transformers) {
    next = /* @__PURE__ */ ((next2, transformer2) => {
      return (context2) => {
        return transformer2.call(this, context2, next2);
      };
    })(next, transformer);
  }
  return next?.(context);
}
var tracking = /* @__PURE__ */ new Map();
function track(el, context) {
  untrack(el);
  if (!tracking.has(context.path)) {
    tracking.set(context.path, [context]);
  } else {
    tracking.get(context.path).push(context);
  }
}
function untrack(el, path2) {
  if (path2) {
    let list2 = tracking.get(path2);
    if (list2) {
      list2 = list2.filter((context) => context.element !== el);
      tracking.set(path2, list2);
    }
    return;
  }
  tracking.forEach((list2, trackedPath) => {
    list2 = list2.filter((context) => context.element !== el);
    tracking.set(trackedPath, list2);
  });
}
function templateCommandValue(value, path2, index) {
  if (!value || value[0] !== ":") {
    return null;
  }
  if (value === ":key") {
    return { value: "" + index };
  }
  if (value === ":value") {
    return { path: templateItemPath(path2, index) };
  }
  if (value.startsWith(":value.")) {
    return { path: joinPath(templateItemPath(path2, index), value.substring(":value".length)) };
  }
  if (value.startsWith(":root.")) {
    return { path: value.substring(":root.".length) };
  }
  return null;
}
function templateItemPath(path2, index) {
  if (typeof index === "undefined") {
    return path2;
  }
  return joinPath(path2, "." + index);
}
function joinPath(path2, suffix) {
  if (!path2) {
    return suffix.replace(/^\./, "");
  }
  return path2 + suffix;
}
function getValueByPath(root, path2) {
  let parts = path2.split(".");
  let curr = root;
  let part;
  part = parts.shift();
  let prevPart = null;
  while (part && curr) {
    part = decodeURIComponent(part);
    if (part == "0" && !Array.isArray(curr)) {
    } else if (part == ":key") {
      curr = prevPart;
    } else if (part == ":value") {
    } else if (Array.isArray(curr) && typeof curr[part] == "undefined" && curr[0]) {
      curr = curr[0][part];
    } else {
      curr = curr[part];
    }
    prevPart = part;
    part = parts.shift();
  }
  return curr;
}

// ../app/src/suggest.mjs
function closest(name, options, { maxDistance = 2, minLength = 4 } = {}) {
  if (name.length < minLength) {
    return;
  }
  let result;
  let resultDistance = Infinity;
  for (const option of options) {
    const distance = editDistance(name, option, maxDistance);
    if (distance < resultDistance) {
      result = option;
      resultDistance = distance;
    }
  }
  return resultDistance <= maxDistance ? result : void 0;
}
function editDistance(a, b, maxDistance = 2) {
  const tooFar = maxDistance + 1;
  if (Math.abs(a.length - b.length) > maxDistance) {
    return tooFar;
  }
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array(b.length + 1);
  for (let ai = 1; ai <= a.length; ai++) {
    current[0] = ai;
    for (let bi = 1; bi <= b.length; bi++) {
      const cost = a[ai - 1] === b[bi - 1] ? 0 : 1;
      current[bi] = Math.min(
        previous[bi] + 1,
        current[bi - 1] + 1,
        previous[bi - 1] + cost
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[b.length];
}

// ../app/src/route.mjs
function routes(options) {
  return new SimplyRoute(options);
}
var SimplyRoute = class {
  constructor(options = {}) {
    this.options = options;
    this.baseURL = options.baseURL || "/";
    this.app = options.app || {};
    this.addMissingSlash = !!options.addMissingSlash;
    this.matchExact = !!options.matchExact;
    this.hijackLinks = !!options.hijackLinks;
    this.clear();
    if (options.routes) {
      this.load(options.routes);
    }
  }
  load(routes2) {
    parseRoutes(routes2, this.routeInfo, this.matchExact);
  }
  clear() {
    this.routeInfo = [];
    this.listeners = {
      match: {},
      call: {},
      goto: {},
      finish: {}
    };
  }
  match(path2, options) {
    let args = {
      path: path2,
      options
    };
    args = this.runListeners("match", args);
    path2 = args.path ? args.path : path2;
    let searchParams;
    if (!path2) {
      const currentPath = document.location.pathname + document.location.hash;
      if (this.has(currentPath)) {
        path2 = currentPath;
      } else {
        path2 = document.location.pathname;
      }
      searchParams = new URLSearchParams(document.location.search);
    } else {
      searchParams = searchParamsForPath(path2);
    }
    path2 = getPath(routePath(path2), this.baseURL);
    for (let route of this.routeInfo) {
      let params = route.pattern.match(path2);
      if (this.addMissingSlash && !params) {
        if (path2 && path2[path2.length - 1] != "/") {
          const pathWithSlash = path2 + "/";
          params = route.pattern.match(pathWithSlash);
          if (params) {
            path2 = pathWithSlash;
            history.replaceState({}, "", getURL(path2, this.baseURL));
          }
        }
      }
      if (params) {
        Object.assign(params, options);
        args.route = route;
        args.params = params;
        args = this.runListeners("call", args);
        params = args.params ? args.params : params;
        args.searchParams = searchParams;
        args.result = callRouteAction(this.app, route, params, searchParams);
        this.runListeners("finish", args);
        return args.result;
      }
    }
    return false;
  }
  runListeners(action, params) {
    if (!this.listeners[action] || !Object.keys(this.listeners[action])) {
      return;
    }
    Object.keys(this.listeners[action]).forEach((route) => {
      const pattern = compileRoutePattern(route);
      if (pattern.match(routePath(params.path))) {
        var result;
        for (let callback of this.listeners[action][route]) {
          result = callback.call(this.app, params);
          if (result) {
            params = result;
          }
        }
      }
    });
    return params;
  }
  handleEvents() {
    this.removeEvents();
    const popstateHandler = () => {
      this.match();
    };
    const clickHandler = (evt) => {
      if (evt.ctrlKey) {
        return;
      }
      if (evt.which != 1) {
        return;
      }
      var link = evt.target;
      while (link && link.tagName != "A") {
        link = link.parentElement;
      }
      if (link && link.pathname && link.hostname == globalThis.location.hostname && !link.link && !link.dataset.simplyCommand) {
        let check = [
          { match: link.hash, goto: link.hash },
          { match: link.pathname + link.hash, goto: link.pathname + link.search + link.hash },
          { match: link.pathname, goto: link.pathname + link.search }
        ];
        let target;
        do {
          target = check.shift();
          target.match = getPath(target.match, this.baseURL);
        } while (check.length && !this.has(target.match));
        if (this.has(target.match)) {
          let params = this.runListeners("goto", { path: target.goto });
          if (params.path) {
            const followLink = this.goto(params.path);
            if (!followLink || this.options.hijackLinks && followLink !== false) {
              evt.preventDefault();
              return false;
            }
          }
        }
      }
    };
    globalThis.addEventListener("popstate", popstateHandler);
    this.app.container.addEventListener("click", clickHandler);
    this.eventHandlers = {
      container: this.app.container,
      popstateHandler,
      clickHandler
    };
  }
  removeEvents() {
    if (!this.eventHandlers) {
      return;
    }
    globalThis.removeEventListener("popstate", this.eventHandlers.popstateHandler);
    this.eventHandlers.container.removeEventListener("click", this.eventHandlers.clickHandler);
    this.eventHandlers = void 0;
  }
  destroy() {
    this.removeEvents();
  }
  goto(path2) {
    history.pushState({}, "", getURL(path2, this.baseURL));
    return this.match(path2);
  }
  has(path2) {
    path2 = getPath(routePath(path2), this.baseURL);
    for (let route of this.routeInfo) {
      if (route.pattern.match(path2)) {
        return true;
      }
    }
    return false;
  }
  addListener(action, route, callback) {
    if (["goto", "match", "call", "finish"].indexOf(action) == -1) {
      throw new TypeError(`simplyflow/route: unknown listener type "${action}"`);
    }
    if (!this.listeners[action][route]) {
      this.listeners[action][route] = [];
    }
    this.listeners[action][route].push(callback);
  }
  removeListener(action, route, callback) {
    if (["goto", "match", "call", "finish"].indexOf(action) == -1) {
      throw new TypeError(`simplyflow/route: unknown listener type "${action}"`);
    }
    if (!this.listeners[action][route]) {
      return;
    }
    this.listeners[action][route] = this.listeners[action][route].filter((listener) => {
      return listener != callback;
    });
  }
  init(options) {
    if (options.baseURL) {
      this.baseURL = options.baseURL;
    }
  }
};
function callRouteAction(app2, route, params, searchParams) {
  if (typeof route.action === "function") {
    return route.action.call(app2, params, searchParams);
  }
  if (typeof route.action === "string") {
    const action = app2.actions?.[route.action];
    if (typeof action === "function") {
      return action.call(app2, routeActionParams(route, params, searchParams));
    }
    throw unknownRouteActionError(route, app2.actions);
  }
  throw new TypeError(`simplyflow/route: route "${route.path}" must use a function or action name`);
}
var warnedRouteQueryConflicts = /* @__PURE__ */ new Set();
function routeActionParams(route, params, searchParams) {
  const query = queryParams(searchParams);
  for (const key of Object.keys(query)) {
    if (Object.hasOwn(params, key)) {
      warnRouteQueryConflict(route, key);
    }
  }
  return Object.assign(query, params);
}
function queryParams(searchParams) {
  const params = {};
  for (const [key, value] of searchParams.entries()) {
    if (!Object.hasOwn(params, key)) {
      params[key] = value;
    } else if (Array.isArray(params[key])) {
      params[key].push(value);
    } else {
      params[key] = [params[key], value];
    }
  }
  return params;
}
function warnRouteQueryConflict(route, key) {
  const warningKey = `${route.path}\0${key}`;
  if (warnedRouteQueryConflicts.has(warningKey)) {
    return;
  }
  warnedRouteQueryConflicts.add(warningKey);
  console.warn(`simplyflow/route: query parameter "${key}" was ignored because route "${route.path}" already provides a route parameter with that name.`);
}
function unknownRouteActionError(route, actions2) {
  const suggestion = closest(route.action, Object.keys(actions2 || {}));
  const hint = suggestion ? ` Did you mean "${suggestion}"?` : "";
  return new TypeError(`simplyflow/route: route "${route.path}" uses unknown action "${route.action}".${hint}`);
}
function searchParamsForPath(path2) {
  const index = typeof path2 === "string" ? path2.indexOf("?") : -1;
  if (index === -1) {
    return new URLSearchParams();
  }
  const hashIndex = path2.indexOf("#", index);
  const search = hashIndex === -1 ? path2.substring(index) : path2.substring(index, hashIndex);
  return new URLSearchParams(search);
}
function routePath(path2) {
  const index = typeof path2 === "string" ? path2.indexOf("?") : -1;
  if (index === -1) {
    return path2;
  }
  const hashIndex = path2.indexOf("#", index);
  if (hashIndex === -1) {
    return path2.substring(0, index);
  }
  return path2.substring(0, index) + path2.substring(hashIndex);
}
function getPath(path2, baseURL = "/") {
  if (path2.substring(0, baseURL.length) == baseURL || baseURL[baseURL.length - 1] == "/" && path2.length == baseURL.length - 1 && path2 == baseURL.substring(0, path2.length)) {
    path2 = path2.substring(baseURL.length);
  }
  if (path2[0] != "/") {
    path2 = "/" + path2;
  }
  return path2;
}
function getURL(path2, baseURL) {
  path2 = getPath(path2, baseURL);
  if (baseURL[baseURL.length - 1] === "/" && path2[0] === "/") {
    path2 = path2.substring(1);
  }
  if (path2[0] == "#") {
    return path2;
  }
  return baseURL + path2;
}
function compileRoutePattern(path2, exact = false) {
  const params = [];
  const regexp = routeRegexp(path2, exact, params);
  return {
    path: path2,
    params,
    regexp,
    match(value) {
      const matches = regexp.exec(value);
      if (!matches) {
        return null;
      }
      const result = {};
      params.forEach((name, i) => {
        result[name] = matches[i + 1];
      });
      return result;
    }
  };
}
function routeRegexp(route, exact = false, params = []) {
  if (route.includes(":*")) {
    throw new TypeError(`simplyflow/route: route "${route}" uses the old wildcard syntax ":*". Use a named wildcard like ":path*" instead.`);
  }
  const prefix = route[0] === "#" ? "" : "^";
  const suffix = exact ? "$" : "";
  return new RegExp(prefix + routeRegexpSource(route, params) + suffix);
}
function routeRegexpSource(route, params) {
  let source = "";
  let index = 0;
  while (index < route.length) {
    if (route[index] === ":") {
      const match = /^:([A-Za-z_][A-Za-z0-9_]*)(\*)?/.exec(route.substring(index));
      if (!match) {
        throw new TypeError(`simplyflow/route: invalid route parameter in "${route}"`);
      }
      params.push(match[1]);
      source += match[2] ? "(.*)" : "([^/]+)";
      index += match[0].length;
      continue;
    }
    if (route[index] === "*") {
      source += ".*";
      index++;
      continue;
    }
    source += escapeRegexp(route[index]);
    index++;
  }
  return source;
}
function escapeRegexp(value) {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}
function parseRoutes(routes2, routeInfo, exact = false) {
  const paths = Object.keys(routes2);
  for (let path2 of paths) {
    routeInfo.push({
      path: path2,
      pattern: compileRoutePattern(path2, exact),
      action: routes2[path2]
    });
  }
  return routeInfo;
}

// ../app/src/path.mjs
var path = {
  get(dataset, pointer) {
    if (typeof pointer !== "string") {
      return pointer;
    }
    if (!pointer) {
      return dataset;
    }
    return pointer.split(".").reduce(function(acc, name) {
      if (acc == null) {
        return null;
      }
      if (!Reflect.has(Object(acc), name)) {
        return null;
      }
      return acc[name];
    }, dataset);
  },
  set: function(dataset, pointer, value) {
    const parent = path.get(dataset, path.parent(pointer));
    if (parent == null) {
      throw new TypeError(`simplyflow/path: cannot set "${pointer}" because its parent path does not exist`);
    }
    parent[path.pop(pointer)] = value;
  },
  pop: function(pointer) {
    return pointer.split(".").pop();
  },
  push: function(pointer, name) {
    return (pointer ? pointer + "." : "") + name;
  },
  parent: function(pointer) {
    const names = pointer.split(".");
    names.pop();
    return names.join(".");
  },
  parents: function(dataset, pointer) {
    let result = [];
    while (pointer) {
      pointer = path.parent(pointer);
      result.unshift(pointer);
    }
    return result;
  }
};
var path_default = path;

// ../app/src/command.mjs
var commandState = /* @__PURE__ */ new WeakMap();
var COMMAND_OPTIONS = [
  "commands",
  "handlers",
  "app",
  "container"
];
var SimplyCommands = class {
  constructor(options = {}) {
    if (!options.app) {
      options.app = {};
    }
    if (!options.app.container) {
      options.app.container = document.body;
    }
    this.app = options.app;
    this.$handlers = options.handlers || defaultHandlers;
    if (options.commands) {
      Object.assign(this, options.commands);
    }
    const commandHandler = (evt) => {
      const command = getCommand(evt, this.$handlers, this.app);
      if (!command) {
        return;
      }
      if (!this[command.name]) {
        warnUnknownCommand(this, command.name, command.source);
        return;
      }
      const shouldContinue = this[command.name].call(options.app, command.source, command.value, evt);
      if (shouldContinue !== true) {
        evt.preventDefault();
        evt.stopPropagation();
        return false;
      }
    };
    const container = options.app.container;
    container.addEventListener("click", commandHandler);
    container.addEventListener("submit", commandHandler);
    container.addEventListener("change", commandHandler);
    container.addEventListener("input", commandHandler);
    commandState.set(this, { container, commandHandler });
  }
  call(command, el, value, event) {
    if (!this[command]) {
      warnUnknownCommand(this, command, el);
      return;
    }
    return this[command].call(this.app, el, value, event);
  }
  appendHandler(handler) {
    this.$handlers.push(handler);
  }
  prependHandler(handler) {
    this.$handlers.unshift(handler);
  }
};
function commands(options = {}) {
  return new SimplyCommands(options);
}
function destroyCommands(commandApi) {
  const state = commandState.get(commandApi);
  if (!state) {
    return;
  }
  state.container.removeEventListener("click", state.commandHandler);
  state.container.removeEventListener("submit", state.commandHandler);
  state.container.removeEventListener("change", state.commandHandler);
  state.container.removeEventListener("input", state.commandHandler);
  commandState.delete(commandApi);
}
function getCommand(evt, handlers, app2) {
  var el = evt.target.closest("[data-simply-command]");
  if (el) {
    for (let handler of handlers) {
      if (el.matches(handler.match)) {
        if (handler.check(el, evt)) {
          return {
            name: el.dataset.simplyCommand,
            source: el,
            value: handler.get(el, app2)
          };
        }
        return null;
      }
    }
  }
  return null;
}
function getConfiguredCommandValue(el, app2) {
  const pathAttribute = "simplyValuePath";
  if (Object.hasOwn(el.dataset, pathAttribute)) {
    return {
      found: true,
      value: path_default.get(app2?.data, el.dataset[pathAttribute])
    };
  }
  if (Object.hasOwn(el.dataset, "simplyValue")) {
    return { found: true, value: el.dataset.simplyValue };
  }
  return { found: false, value: void 0 };
}
var defaultHandlers = [
  {
    match: "input,select,textarea",
    get: function(el, app2) {
      const configuredValue = getConfiguredCommandValue(el, app2);
      if (configuredValue.found) {
        return configuredValue.value;
      }
      if (el.tagName === "SELECT" && el.multiple) {
        let values = [];
        for (let option of el.options) {
          if (option.selected) {
            values.push(option.value);
          }
        }
        return values;
      }
      return el.value;
    },
    check: function(el, evt) {
      return evt.type == "change" || el.dataset.simplyImmediate && evt.type == "input";
    }
  },
  {
    match: "a,button",
    get: function(el, app2) {
      const configuredValue = getConfiguredCommandValue(el, app2);
      if (configuredValue.found) {
        return configuredValue.value;
      }
      return el.href || el.value;
    },
    check: function(el, evt) {
      return evt.type == "click" && evt.ctrlKey == false && evt.button == 0;
    }
  },
  {
    match: "form",
    get: function(el) {
      let data = {};
      for (let input2 of Array.from(el.elements)) {
        if (input2.tagName == "INPUT" && (input2.type == "checkbox" || input2.type == "radio")) {
          if (!input2.checked) {
            return;
          }
        }
        if (data[input2.name] && !Array.isArray(data[input2.name])) {
          data[input2.name] = [data[input2.name]];
        }
        if (Array.isArray(data[input2.name])) {
          data[input2.name].push(input2.value);
        } else {
          data[input2.name] = input2.value;
        }
      }
      return data;
    },
    check: function(el, evt) {
      return evt.type == "submit";
    }
  },
  {
    match: "*",
    get: function(el, app2) {
      return getConfiguredCommandValue(el, app2).value;
    },
    check: function(el, evt) {
      return evt.type == "click" && evt.ctrlKey == false && evt.button == 0;
    }
  }
];
var unknownCommandWarnings = /* @__PURE__ */ new WeakMap();
function warnUnknownCommand(commands2, command, source) {
  let warned = unknownCommandWarnings.get(commands2);
  if (!warned) {
    warned = /* @__PURE__ */ new Set();
    unknownCommandWarnings.set(commands2, warned);
  }
  if (warned.has(command)) {
    return;
  }
  warned.add(command);
  const suggestion = closest(command, commandNames(commands2));
  const suffix = suggestion ? `. Did you mean "${suggestion}"?` : "";
  if (source) {
    console.warn(`simplyflow/command: unknown command "${command}"${suffix}`, { cause: source });
  } else {
    console.warn(`simplyflow/command: unknown command "${command}"${suffix}`);
  }
}
function commandNames(commands2) {
  return Object.keys(commands2).filter((command) => {
    return !command.startsWith("$") && !COMMAND_OPTIONS.includes(command) && typeof commands2[command] === "function";
  });
}

// ../app/src/action.mjs
var warnedUnknownActions = /* @__PURE__ */ new WeakMap();
function actions(options) {
  if (options.app) {
    const functionHandler = {
      apply(target, thisArg, argumentsList) {
        try {
          const result = target(...argumentsList);
          if (result instanceof Promise) {
            return result.catch((err) => {
              return options.app.onError.call(this, err, target);
            });
          }
          return result;
        } catch (err) {
          return options.app.onError.call(this, err, target);
        }
      }
    };
    const actionHandler = {
      get(target, property) {
        if (!Object.hasOwn(target, property)) {
          warnUnknownAction(target, property);
          return void 0;
        }
        if (options.app.onError) {
          return new Proxy(target[property].bind(options.app), functionHandler);
        } else {
          return target[property].bind(options.app);
        }
      }
    };
    return new Proxy(options.actions, actionHandler);
  } else {
    return options;
  }
}
function warnUnknownAction(actions2, property) {
  if (typeof property !== "string") {
    return;
  }
  let warned = warnedUnknownActions.get(actions2);
  if (!warned) {
    warned = /* @__PURE__ */ new Set();
    warnedUnknownActions.set(actions2, warned);
  }
  if (warned.has(property)) {
    return;
  }
  warned.add(property);
  const suggestion = closest(property, Object.keys(actions2));
  const suffix = suggestion ? `. Did you mean "${suggestion}"?` : "";
  console.warn(`simplyflow/action: unknown action "${property}"${suffix}`);
}

// ../app/src/shortcut.mjs
var shortcutState = /* @__PURE__ */ new WeakMap();
var accesskeyState = /* @__PURE__ */ new WeakMap();
var KEY = Object.freeze({
  Compose: 229,
  Control: 17,
  Meta: 224,
  Alt: 18,
  Shift: 16
});
var SimplyShortcuts = class {
  constructor(options = {}) {
    if (!options.app) {
      options.app = {};
    }
    if (!options.app.container) {
      options.app.container = document.body;
    }
    Object.assign(this, options.shortcuts);
    const keyHandler = (e) => {
      let shortcutScopes = [];
      let shortcutElement = e.target.closest("[data-simply-shortcuts]");
      while (shortcutElement) {
        shortcutScopes.push(shortcutElement.dataset.simplyShortcuts);
        shortcutElement = shortcutElement.parentNode.closest("[data-simply-shortcuts]");
      }
      if (shortcutScopes[shortcutScopes.length - 1] != "default") {
        shortcutScopes.push("default");
      }
      let shortcutScope;
      let separators = ["+", "-"];
      for (let separator of separators) {
        const keyString = getKeyString(e, separator);
        for (let i in shortcutScopes) {
          shortcutScope = shortcutScopes[i];
          if (this[shortcutScope] && typeof this[shortcutScope][keyString] == "function") {
            let _continue = this[shortcutScope][keyString].call(options.app, e);
            if (!_continue) {
              e.preventDefault();
              return;
            }
          }
          if (typeof this[shortcutScope + "." + keyString] == "function") {
            let _continue = this[shortcutScope + "." + keyString].call(options.app, e);
            if (!_continue) {
              e.preventDefault();
              return;
            }
          }
          if (typeof this[keyString] == "function") {
            let _continue = this[keyString].call(options.app, e);
            if (!_continue) {
              e.preventDefault();
              return;
            }
          }
        }
      }
    };
    const container = options.app.container;
    container.addEventListener("keydown", keyHandler);
    shortcutState.set(this, { container, keyHandler });
  }
};
function getKeyString(e, separator = "+") {
  if (e.isComposing || e.keyCode === KEY.Compose) {
    return;
  }
  if (e.defaultPrevented) {
    return;
  }
  if (!e.target) {
    return;
  }
  let keyCombination = [];
  if (e.ctrlKey && e.keyCode != KEY.Control) {
    keyCombination.push("Control");
  }
  if (e.metaKey && e.keyCode != KEY.Meta) {
    keyCombination.push("Meta");
  }
  if (e.altKey && e.keyCode != KEY.Alt) {
    keyCombination.push("Alt");
  }
  if (e.shiftKey && e.keyCode != KEY.Shift) {
    keyCombination.push("Shift");
  }
  keyCombination.push(e.key.toLowerCase());
  return keyCombination.join(separator);
}
function shortcuts(options = {}) {
  return new SimplyShortcuts(options);
}
function destroyShortcuts(shortcutApi) {
  const state = shortcutState.get(shortcutApi);
  if (!state) {
    return;
  }
  state.container.removeEventListener("keydown", state.keyHandler);
  shortcutState.delete(shortcutApi);
}
function accesskeys(options = {}) {
  const container = options.container || options.app?.container || document.body;
  const keyHandler = (e) => {
    const separators = ["+", "-"];
    for (const separator of separators) {
      const keyString = getKeyString(e, separator);
      const selector = "[data-simply-accesskey='" + keyString + "']";
      const targets = container.querySelectorAll(selector);
      if (targets.length) {
        targets.forEach(function(target) {
          target.click();
        });
      }
    }
  };
  container.addEventListener("keydown", keyHandler);
  const controller = {};
  accesskeyState.set(controller, { container, keyHandler });
  return controller;
}
function destroyAccesskeys(accesskeyApi) {
  const state = accesskeyState.get(accesskeyApi);
  if (!state) {
    return;
  }
  state.container.removeEventListener("keydown", state.keyHandler);
  accesskeyState.delete(accesskeyApi);
}

// ../app/src/behavior.mjs
var BEHAVIOR_SELECTOR = "[data-simply-behavior]";
var SimplyBehaviors = class {
  constructor(options = {}) {
    this.app = options.app;
    this.container = options.container || document.body;
    this.behaviors = options.behaviors || {};
    this.active = /* @__PURE__ */ new Set();
    this.cleanups = /* @__PURE__ */ new WeakMap();
    this.unknown = /* @__PURE__ */ new Set();
    this.observer = new MutationObserver((changes) => this.handleChanges(changes));
    this.observer.observe(this.container, {
      subtree: true,
      childList: true
    });
    for (const node of behaviorNodes(this.container)) {
      this.start(node);
    }
  }
  start(node) {
    if (this.active.has(node)) {
      return;
    }
    const name = node?.dataset?.simplyBehavior;
    const behavior = this.behaviors[name];
    if (!name || typeof behavior !== "function") {
      this.warnUnknown(name, node);
      return;
    }
    this.active.add(node);
    const cleanup = behavior.call(this.app || node, node);
    if (typeof cleanup === "function") {
      this.cleanups.set(node, cleanup);
    } else if (typeof cleanup !== "undefined") {
      console.warn("simplyflow/behavior: behavior may only return a cleanup function", { cause: cleanup });
    }
  }
  stop(node) {
    if (!this.active.has(node)) {
      return;
    }
    this.active.delete(node);
    const cleanup = this.cleanups.get(node);
    this.cleanups.delete(node);
    if (cleanup) {
      cleanup.call(this.app || node, node);
    }
  }
  handleChanges(changes) {
    const added = [];
    for (const change of changes) {
      if (change.type !== "childList") {
        continue;
      }
      for (const node of change.removedNodes) {
        for (const behaviorNode of behaviorNodes(node)) {
          this.stop(behaviorNode);
        }
      }
      for (const node of change.addedNodes) {
        added.push(...behaviorNodes(node));
      }
    }
    for (const node of added) {
      this.start(node);
    }
  }
  warnUnknown(name, node) {
    if (!name || this.unknown.has(name)) {
      return;
    }
    this.unknown.add(name);
    const suggestion = closest(name, Object.keys(this.behaviors));
    const suffix = suggestion ? `. Did you mean "${suggestion}"?` : "";
    console.warn(`simplyflow/behavior: unknown behavior "${name}"${suffix}`, { cause: node });
  }
  destroy() {
    this.observer.disconnect();
    for (const node of Array.from(this.active)) {
      this.stop(node);
    }
  }
};
function behaviors(options = {}) {
  return new SimplyBehaviors(options);
}
function behaviorNodes(root) {
  if (!root?.querySelectorAll) {
    return [];
  }
  const nodes = Array.from(root.querySelectorAll(BEHAVIOR_SELECTOR));
  if (root.matches?.(BEHAVIOR_SELECTOR)) {
    nodes.unshift(root);
  }
  return nodes;
}

// ../app/src/include.mjs
function throttle(callbackFunction, intervalTime) {
  let eventId = 0;
  return function throttledCallback(...params) {
    if (eventId) {
      return;
    }
    eventId = globalThis.setTimeout(() => {
      eventId = 0;
      callbackFunction.apply(this, params);
    }, intervalTime);
  };
}
var runWhenIdle = (() => {
  if (globalThis.requestIdleCallback) {
    return (callback) => {
      globalThis.requestIdleCallback(callback, { timeout: 500 });
    };
  }
  return globalThis.requestAnimationFrame || ((callback) => globalThis.setTimeout(callback, 0));
})();
function rebaseHref(relative, base, cacheBuster) {
  const url = new URL(relative, base);
  if (cacheBuster) {
    url.searchParams.set("cb", cacheBuster);
  }
  return url.href;
}
function cloneScript(script, base, cacheBuster) {
  const clone = globalThis.document.createElement("script");
  for (const attr of script.attributes) {
    clone.setAttribute(attr.name, attr.value);
  }
  clone.removeAttribute("data-simply-location");
  if (clone.hasAttribute("src")) {
    clone.src = rebaseHref(clone.getAttribute("src"), base, cacheBuster);
  } else {
    clone.textContent = script.textContent;
  }
  return clone;
}
function insertScript(script, placeholder) {
  placeholder.parentNode.insertBefore(script, placeholder);
  placeholder.parentNode.removeChild(placeholder);
}
function shouldWaitForScript(script) {
  return script.hasAttribute("src") && !script.hasAttribute("async");
}
function insertAndWaitForScript(script, placeholder) {
  return new Promise((resolve) => {
    const done = () => {
      script.removeEventListener("load", done);
      script.removeEventListener("error", done);
      resolve();
    };
    script.addEventListener("load", done);
    script.addEventListener("error", done);
    insertScript(script, placeholder);
  });
}
function findIncludeLinks(container) {
  const selector = 'link[rel="simply-include"],link[rel="simply-include-once"]';
  const links = Array.from(container.querySelectorAll(selector));
  if (container.matches?.(selector)) {
    links.unshift(container);
  }
  return links;
}
var SimplyIncludes = class {
  constructor(options = {}) {
    this.container = options.container || globalThis.document;
    this.cacheBuster = options.cacheBuster ?? defaultCacheBuster;
    this.included = /* @__PURE__ */ Object.create(null);
    this.scriptLocations = [];
    this.destroyed = false;
    this.handleChanges = throttle(() => {
      runWhenIdle(() => {
        if (!this.destroyed) {
          this.includeLinks(findIncludeLinks(this.container));
        }
      });
    }, 10);
    if (options.observe !== false) {
      this.observer = new MutationObserver(this.handleChanges);
      this.observer.observe(this.container, {
        subtree: true,
        childList: true
      });
      this.handleChanges();
    }
  }
  async scripts(scripts, base) {
    const arr = scripts.slice();
    for (const script of arr) {
      if (this.destroyed) {
        return;
      }
      const clone = cloneScript(script, base, this.cacheBuster);
      const node = this.scriptLocations[script.dataset.simplyLocation];
      if (!node?.parentNode) {
        continue;
      }
      const waitForLoad = shouldWaitForScript(clone);
      if (waitForLoad) {
        clone.async = false;
        await insertAndWaitForScript(clone, node);
      } else {
        insertScript(clone, node);
      }
    }
  }
  html(html, link) {
    const fragment = globalThis.document.createRange().createContextualFragment(html);
    const stylesheets = fragment.querySelectorAll('link[rel="stylesheet"],style');
    for (const stylesheet of stylesheets) {
      const href = stylesheet.getAttribute("href");
      if (href) {
        stylesheet.href = rebaseHref(href, link.href, this.cacheBuster);
      }
      globalThis.document.head.appendChild(stylesheet);
    }
    const scriptsFragment = globalThis.document.createDocumentFragment();
    const scripts = fragment.querySelectorAll("script");
    if (scripts.length) {
      for (const script of scripts) {
        const placeholder = globalThis.document.createComment(script.src || "inline script");
        script.parentNode.insertBefore(placeholder, script);
        script.dataset.simplyLocation = this.scriptLocations.length;
        this.scriptLocations.push(placeholder);
        scriptsFragment.appendChild(script);
      }
      globalThis.setTimeout(() => {
        this.scripts(Array.from(scriptsFragment.children), link ? link.href : globalThis.location.href);
      }, 10);
    }
    link.parentNode.insertBefore(fragment, link);
  }
  async includeLinks(links) {
    const remainingLinks = links.reduce((remainder, link) => {
      if (link.rel === "simply-include-once" && this.included[link.href]) {
        link.parentNode.removeChild(link);
      } else {
        this.included[link.href] = true;
        link.rel = "simply-include-loading";
        remainder.push(link);
      }
      return remainder;
    }, []);
    for (const link of remainingLinks) {
      if (this.destroyed || !link.href) {
        continue;
      }
      try {
        const response = await fetch(link.href);
        if (!response.ok) {
          console.warn(`simplyflow/include: failed to load "${link.href}" (${response.status})`);
          link.rel = "simply-include-error";
          continue;
        }
        const html = await response.text();
        if (this.destroyed || !link.parentNode) {
          continue;
        }
        this.html(html, link);
        link.parentNode?.removeChild(link);
      } catch (error) {
        console.warn(`simplyflow/include: failed to load "${link.href}"`, { cause: error });
        link.rel = "simply-include-error";
      }
    }
  }
  destroy() {
    this.destroyed = true;
    this.observer?.disconnect();
    this.observer = void 0;
  }
};
function includes(options = {}) {
  return new SimplyIncludes(options);
}
var defaultCacheBuster = null;

// ../app/src/index.mjs
var APP_OPTIONS = [
  "container",
  "data",
  "templates",
  "styles",
  "start",
  "onError",
  "components",
  "behaviors",
  "baseURL",
  "commands",
  "shortcuts",
  "routes",
  "actions",
  "transformers"
];
var SimplyApp = class {
  constructor(options = {}) {
    if (options.components) {
      const mergedOptions = {};
      mergeComponents(mergedOptions, options.components);
      mergeOptions(mergedOptions, options);
      options = mergedOptions;
    }
    this.container = options.container || document.body;
    this.destroyed = false;
    this.data = signal(options.data || {});
    this.start = options.start;
    this.onError = options.onError;
    this.components = options.components;
    this.baseURL = options.baseURL;
    this.transformers = options.transformers;
    installTemplates(this.container, options.templates);
    installStyles(this.container, options.styles);
    for (const key of Object.keys(options)) {
      switch (key) {
        case "container":
        case "data":
        case "templates":
        case "styles":
        case "start":
        case "onError":
        case "components":
        case "baseURL":
        case "transformers":
          break;
        case "commands":
          this.commands = commands({ app: this, container: this.container, commands: options.commands });
          break;
        case "shortcuts":
          this.shortcuts = shortcuts({ app: this, shortcuts: options.shortcuts });
          break;
        case "behaviors":
          this.behaviors = behaviors({ app: this, container: this.container, behaviors: options.behaviors });
          break;
        case "routes":
          this.routes = routes({ app: this, routes: options.routes });
          break;
        case "actions":
          this.actions = actions({ app: this, actions: options.actions });
          break;
        case "prototype":
        case "__proto__":
          break;
        default:
          warnLikelyOptionTypo(key);
          this[key] = options[key];
          break;
      }
    }
    this.binding = bind({
      root: this.data,
      container: this.container,
      attribute: "data-simply",
      transformers: this.transformers
    });
    this.includes = includes({ container: this.container });
    this.accesskeys = accesskeys({ app: this, container: this.container });
  }
  get app() {
    return this;
  }
  destroy() {
    this.destroyed = true;
    if (this.binding) {
      this.binding.destroy();
      this.binding = void 0;
    }
    if (this.commands) {
      destroyCommands(this.commands);
    }
    if (this.shortcuts) {
      destroyShortcuts(this.shortcuts);
    }
    if (this.accesskeys) {
      destroyAccesskeys(this.accesskeys);
      this.accesskeys = void 0;
    }
    if (this.routes) {
      this.routes.destroy();
      this.routes = void 0;
    }
    if (this.behaviors) {
      this.behaviors.destroy();
      this.behaviors = void 0;
    }
    if (this.includes) {
      this.includes.destroy();
      this.includes = void 0;
    }
  }
};
function installTemplates(container, templates) {
  if (!templates) {
    return;
  }
  for (const name of Object.keys(templates)) {
    const element2 = document.createElement("div");
    element2.innerHTML = templates[name];
    let template = container.querySelector("template#" + name);
    if (!template) {
      template = document.createElement("template");
      template.id = name;
      template.content.append(...element2.children);
      container.appendChild(template);
    } else {
      template.content.replaceChildren(...element2.children);
    }
  }
}
function installStyles(container, styles) {
  if (!styles) {
    return;
  }
  for (const name of Object.keys(styles)) {
    let style = container.querySelector("style#" + name + ".css");
    if (!style) {
      style = document.createElement("style");
      style.id = name + ".css";
      container.appendChild(style);
    }
    style.innerHTML = styles[name];
  }
}
function warnLikelyOptionTypo(key) {
  const suggestion = closest(key, APP_OPTIONS);
  if (suggestion) {
    console.warn(`simplyflow/app: unknown option "${key}". Did you mean "${suggestion}"? The option was still added to the app as "app.${key}".`);
  }
}
function initRoutes(app2) {
  if (app2.destroyed) {
    return;
  }
  if (app2.routes) {
    if (app2.baseURL) {
      app2.routes.init({ baseURL: app2.baseURL });
    }
    app2.routes.handleEvents();
    globalThis.setTimeout(() => {
      if (app2.destroyed || !app2.routes) {
        return;
      }
      if (app2.routes.has(globalThis.location?.hash)) {
        app2.routes.match(globalThis.location.hash);
      } else {
        app2.routes.match(globalThis.location?.pathname + globalThis.location?.hash);
      }
    });
  }
}
function handleAppError(app2, error, context) {
  if (app2.onError) {
    return app2.onError.call(app2, error, context);
  }
  throw error;
}
function app(options = {}) {
  const app2 = new SimplyApp(options);
  if (!app2.start) {
    initRoutes(app2);
    return app2;
  }
  try {
    const result = app2.start.call(app2);
    if (result instanceof Promise) {
      result.then(() => initRoutes(app2)).catch((error) => handleAppError(app2, error, app2.start));
    } else {
      initRoutes(app2);
    }
  } catch (error) {
    handleAppError(app2, error, app2.start);
  }
  return app2;
}
function mergeOptions(options, otherOptions) {
  for (const key of Object.keys(otherOptions)) {
    switch (typeof otherOptions[key]) {
      case "object":
        if (!otherOptions[key]) {
          continue;
        }
        if (!options[key]) {
          options[key] = otherOptions[key];
        } else {
          mergeOptions(options[key], otherOptions[key]);
        }
        break;
      default:
        options[key] = otherOptions[key];
    }
  }
}
function mergeComponents(options, components) {
  for (const name of Object.keys(components)) {
    const component = components[name];
    if (component.components) {
      mergeComponents(options, component.components);
    }
    if (!options.components) {
      options.components = {};
    }
    options.components[name] = component;
    for (const key of Object.keys(component)) {
      switch (key) {
        case "start":
        case "onError":
        // App lifecycle functions are app-level behavior, not merged component state.
        case "components":
          break;
        default:
          if (!options[key]) {
            options[key] = /* @__PURE__ */ Object.create(null);
          }
          mergeOptions(options[key], component[key]);
          break;
      }
    }
  }
}

// src/selection-anchor.mjs
var DEFAULT_SELECTOR = "[contenteditable]";
function createSelectionAnchor({ container = document.body, selector = DEFAULT_SELECTOR } = {}) {
  const element2 = document.createElement("div");
  element2.className = "simply-edit-selection-anchor";
  Object.assign(element2.style, {
    background: "#ea5922",
    display: "none",
    height: "10px",
    left: "0",
    pointerEvents: "none",
    position: "fixed",
    top: "0",
    transform: "rotate(45deg)",
    transformOrigin: "top left",
    width: "10px",
    zIndex: "9999"
  });
  element2.style.setProperty("anchor-name", "--cursor-anchor");
  container.appendChild(element2);
  return {
    element: element2,
    update({ referenceElement, allowCollapsed = true } = {}) {
      const position = getCursorPosition(container, { selector, referenceElement, allowCollapsed }) || getReferencePosition(referenceElement);
      if (!position) {
        this.hide();
        return null;
      }
      element2.style.left = `${position.viewportX}px`;
      element2.style.top = `${position.viewportY + position.height}px`;
      element2.style.display = "block";
      return position;
    },
    hide() {
      element2.style.display = "none";
    },
    destroy() {
      element2.remove();
    }
  };
}
function hasVisibleSelection(container = document.body, options = {}) {
  return Boolean(getCursorPosition(container, Object.assign({}, options, { allowCollapsed: false })));
}
function hasCaretOrSelection(container = document.body, options = {}) {
  return Boolean(getCursorPosition(container, Object.assign({}, options, { allowCollapsed: true })));
}
function getSelectionRect(container = document.body, options = {}) {
  const position = getCursorPosition(container, options);
  if (!position) {
    return null;
  }
  return {
    left: position.viewportX,
    right: position.viewportX,
    top: position.viewportY,
    bottom: position.viewportY + position.height,
    width: 0,
    height: position.height,
    x: position.viewportX,
    y: position.viewportY
  };
}
function getCursorPosition(container = document.body, { selector = DEFAULT_SELECTOR, referenceElement, allowCollapsed = true } = {}) {
  const selection = globalThis.getSelection?.();
  if (!selection || !selection.rangeCount) {
    return null;
  }
  if (!allowCollapsed && selection.isCollapsed) {
    return null;
  }
  const focusNode = selection.focusNode || selection.anchorNode;
  if (!focusNode || !nodeIsInside(container, focusNode)) {
    return null;
  }
  const cursorElement = focusNode.nodeType === Node.TEXT_NODE ? focusNode.parentElement : focusNode;
  if (!cursorElement?.getBoundingClientRect) {
    return null;
  }
  const editableElement = cursorElement.closest?.(selector);
  if (!editableElement && !(referenceElement && referenceElement.contains?.(focusNode))) {
    return null;
  }
  const range = document.createRange();
  try {
    range.setStart(focusNode, selection.focusOffset ?? selection.anchorOffset ?? 0);
    range.collapse(true);
  } catch (error) {
    return null;
  }
  const containerRect = container.getBoundingClientRect?.() ?? { left: 0, top: 0 };
  const rects = range.getClientRects?.();
  let viewportX;
  let viewportY;
  let height;
  if (rects && rects.length > 0) {
    const rect = rects[0];
    viewportX = rect.left;
    viewportY = rect.top;
    height = rect.height || getLineHeight(cursorElement);
  } else {
    const style = globalThis.getComputedStyle?.(cursorElement) ?? {};
    const cursorRect = cursorElement.getBoundingClientRect();
    viewportX = cursorRect.left + parseFloat(style.paddingLeft || 0);
    viewportY = cursorRect.top + parseFloat(style.paddingTop || 0);
    height = getLineHeight(cursorElement, style);
  }
  return {
    x: viewportX - containerRect.left,
    y: viewportY - containerRect.top,
    viewportX,
    viewportY,
    height,
    element: cursorElement,
    editableElement
  };
}
function positionNearSelection(element2, { container = document.body, referenceElement, anchor: anchor2 } = {}) {
  const position = anchor2?.update?.({ referenceElement }) || getCursorPosition(container, { referenceElement });
  if (!position) {
    element2.style.left = "1rem";
    element2.style.top = "1rem";
    element2.style.transform = "";
    return;
  }
  positionNearAnchor(element2, anchor2?.element, position);
}
function positionNearAnchor(element2, anchorElement, fallbackPosition) {
  element2.style.setProperty("position-anchor", "--cursor-anchor");
  element2.style.setProperty("position-area", "end span-all");
  element2.style.transform = "";
  if (supportsAnchorPositioning()) {
    element2.style.left = "";
    element2.style.top = "";
    return;
  }
  const rect = anchorElement?.getBoundingClientRect?.();
  const hasRect = rect && (rect.left || rect.top || rect.right || rect.bottom || rect.width || rect.height);
  const anchorX = hasRect ? rect.left + rect.width / 2 : fallbackPosition.viewportX;
  const anchorBottom = hasRect ? rect.bottom : fallbackPosition.viewportY + fallbackPosition.height;
  const width = element2.offsetWidth || element2.getBoundingClientRect?.().width || 0;
  const viewportWidth = globalThis.innerWidth || document.documentElement?.clientWidth || 0;
  const padding = 8;
  const x = width ? anchorX - width / 2 : anchorX;
  const maxX = viewportWidth && width ? viewportWidth - width - padding : x;
  element2.style.left = `${Math.max(padding, Math.min(x, maxX))}px`;
  element2.style.top = `${Math.max(padding, anchorBottom)}px`;
}
function supportsAnchorPositioning() {
  return Boolean(globalThis.CSS?.supports?.("position-anchor: --cursor-anchor"));
}
function getReferencePosition(referenceElement) {
  const rect = referenceElement?.getBoundingClientRect?.();
  if (!rect) {
    return null;
  }
  return {
    x: rect.left,
    y: rect.top,
    viewportX: rect.left + rect.width / 2,
    viewportY: rect.top,
    height: rect.height,
    element: referenceElement,
    editableElement: referenceElement
  };
}
function nodeIsInside(container, node) {
  if (node === container) {
    return true;
  }
  return container.contains?.(node) ?? false;
}
function getLineHeight(element2, style = globalThis.getComputedStyle?.(element2) ?? {}) {
  const lineHeight = parseFloat(style.lineHeight);
  if (!Number.isNaN(lineHeight)) {
    return lineHeight;
  }
  const fontSize = parseFloat(style.fontSize);
  return Number.isNaN(fontSize) ? 16 : fontSize;
}

// src/engines/html-dom-engine.mjs
var COMMANDS = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
  link: "createLink",
  unlink: "unlink"
};
function createHtmlDomEngine(options = {}) {
  return {
    name: "html-dom",
    mount({ element: element2, html = "", onChange, onSelectionChange } = {}) {
      return mountHtmlSession({ element: element2, html, onChange, onSelectionChange, options });
    }
  };
}
function mountHtmlSession({ element: element2, html = "", onChange, onSelectionChange, options }) {
  if (!element2) {
    throw new Error("simplyedit/html-dom-engine: mount() needs an element");
  }
  let destroyed = false;
  const previousContentEditable = element2.getAttribute("contenteditable");
  const previousSpellcheck = element2.getAttribute("spellcheck");
  element2.innerHTML = html ?? "";
  element2.setAttribute("contenteditable", "true");
  if (options.spellcheck !== void 0) {
    element2.setAttribute("spellcheck", options.spellcheck ? "true" : "false");
  }
  const emitChange = () => {
    if (!destroyed) {
      onChange?.(element2.innerHTML);
    }
  };
  const emitSelection = () => {
    if (!destroyed) {
      onSelectionChange?.(session);
    }
  };
  const handleKeydown = (event) => {
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }
    switch (event.key.toLowerCase()) {
      case "b":
        event.preventDefault();
        session.execute("bold");
        break;
      case "i":
        event.preventDefault();
        session.execute("italic");
        break;
      case "u":
        event.preventDefault();
        session.execute("underline");
        break;
      case "k":
        event.preventDefault();
        session.execute("link");
        break;
    }
  };
  element2.addEventListener("input", emitChange);
  element2.addEventListener("keyup", emitSelection);
  element2.addEventListener("mouseup", emitSelection);
  element2.addEventListener("keydown", handleKeydown);
  document.addEventListener("selectionchange", emitSelection);
  const session = {
    element: element2,
    getHTML() {
      return element2.innerHTML;
    },
    setHTML(html2 = "") {
      if (element2.innerHTML !== html2) {
        element2.innerHTML = html2;
      }
    },
    focus() {
      element2.focus();
    },
    blur() {
      element2.blur();
    },
    getSelection() {
      const selection = globalThis.getSelection?.();
      if (!selection || !selection.rangeCount || !element2.contains(selection.anchorNode)) {
        return null;
      }
      return selection;
    },
    getSelectionRect() {
      return getSelectionRect(element2);
    },
    execute(command, value) {
      if (command === "link" && !value) {
        value = globalThis.prompt?.("Link URL");
        if (!value) {
          return false;
        }
      }
      const domCommand = COMMANDS[command];
      if (!domCommand) {
        return false;
      }
      const result = execCommand(domCommand, value);
      emitChange();
      emitSelection();
      return result;
    },
    query(command) {
      const domCommand = COMMANDS[command];
      if (!domCommand || !document.queryCommandState) {
        return false;
      }
      try {
        return document.queryCommandState(domCommand);
      } catch (error) {
        return false;
      }
    },
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      element2.removeEventListener("input", emitChange);
      element2.removeEventListener("keyup", emitSelection);
      element2.removeEventListener("mouseup", emitSelection);
      element2.removeEventListener("keydown", handleKeydown);
      document.removeEventListener("selectionchange", emitSelection);
      if (previousContentEditable === null) {
        element2.removeAttribute("contenteditable");
      } else {
        element2.setAttribute("contenteditable", previousContentEditable);
      }
      if (previousSpellcheck === null) {
        element2.removeAttribute("spellcheck");
      } else {
        element2.setAttribute("spellcheck", previousSpellcheck);
      }
    }
  };
  return session;
}
function execCommand(command, value) {
  if (!document.execCommand) {
    return false;
  }
  try {
    return document.execCommand(command, false, value);
  } catch (error) {
    return false;
  }
}

// src/toolbar.mjs
var DEFAULT_BUTTONS = [
  { label: "Bold", command: "bold", icon: "B" },
  { label: "Italic", command: "italic", icon: "I" },
  { label: "Underline", command: "underline", icon: "U" },
  { label: "Link", command: "expand", value: "link", icon: "\u2197", expands: true }
];
var DEFAULT_TOOLBARS = {
  link: {
    label: "Link",
    buttons: [
      { label: "Set link", command: "link", icon: "\u2197" },
      { label: "Remove", command: "unlink", icon: "\xD7" }
    ]
  }
};
function createToolbar({ container = document.body, buttons = DEFAULT_BUTTONS, toolbars = DEFAULT_TOOLBARS, onCommand } = {}) {
  const anchor2 = createSelectionAnchor({ container });
  const host = document.createElement("div");
  host.className = "simply-edit-toolbar-host";
  host.hidden = true;
  container.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
<style>
:host {
    --simply-edit-primary: #ea5922;
    --simply-edit-border: #d0d0d0;
    --simply-edit-shadow: 0 1px 1px rgba(0,0,0,.11), 0 2px 2px rgba(0,0,0,.09), 0 4px 4px rgba(0,0,0,.07);
    --simply-edit-sub-background: #eee;
    color: #333;
    font-family: Arial, Helvetica, sans-serif;
}
.simply-edit-toolbar-frame {
    background: white;
    box-shadow: var(--simply-edit-shadow);
    display: inline-block;
    white-space: nowrap;
}
.simply-edit-toolbar {
    align-items: stretch;
    display: flex;
    min-height: 50px;
    min-width: 100px;
    position: relative;
    white-space: nowrap;
}
.simply-edit-toolbar-main {
    background: linear-gradient(180deg, white 0, white 95%, #ccc 100%);
    border-top: 2px solid var(--simply-edit-primary);
}
.simply-edit-toolbar-sub {
    background: var(--simply-edit-sub-background);
}
.simply-edit-toolbar-sub[hidden] {
    display: none;
}
.simply-edit-toolbar-subbar {
    background: var(--simply-edit-sub-background);
    min-height: 40px;
}
.simply-edit-button {
    background: transparent;
    border: 0;
    border-bottom: 2px solid transparent;
    color: inherit;
    cursor: pointer;
    font: inherit;
    font-size: 11px;
    min-height: 50px;
    min-width: 50px;
    padding: 0 4px;
    position: relative;
    text-align: center;
    user-select: none;
}
.simply-edit-toolbar-subbar .simply-edit-button {
    min-height: 40px;
    min-width: 40px;
}
.simply-edit-button:hover,
.simply-edit-button[aria-pressed="true"] {
    border-bottom-color: var(--simply-edit-primary);
}
.simply-edit-button-expanded {
    background: var(--simply-edit-sub-background);
}
.simply-edit-button-expands:not(.simply-edit-button-expanded)::after {
    border-left: 3px solid transparent;
    border-right: 3px solid transparent;
    border-top: 3px solid #888;
    bottom: 2px;
    content: "";
    display: block;
    left: 50%;
    margin-left: -3px;
    position: absolute;
    width: 0;
}
.simply-edit-icon {
    display: block;
    font-size: 22px;
    font-weight: bold;
    line-height: 26px;
    margin: -2px auto -2px;
}
.simply-edit-toolbar-subbar .simply-edit-icon {
    font-size: 18px;
    line-height: 22px;
}
.simply-edit-label {
    display: block;
    font-size: 11px;
}
</style>
<div class="simply-edit-toolbar-frame">
    <nav class="simply-edit-toolbar simply-edit-toolbar-main" aria-label="Text formatting" data-simply-list="buttons">
        <template>
            <button type="button" class="simply-edit-button" data-simply-field=":value" data-simply-transform="toolbarButton">
                <span class="simply-edit-icon" data-simply-field="icon"></span>
                <span class="simply-edit-label" data-simply-field="label"></span>
            </button>
        </template>
    </nav>
    <div class="simply-edit-toolbar-sub" data-simply-map="toolbars" hidden>
        <template>
            <nav class="simply-edit-toolbar simply-edit-toolbar-subbar" data-simply-field=":key" data-simply-transform="toolbarPanel">
                <div data-simply-list="buttons">
                    <template>
                        <button type="button" class="simply-edit-button" data-simply-field=":value" data-simply-transform="toolbarButton">
                            <span class="simply-edit-icon" data-simply-field="icon"></span>
                            <span class="simply-edit-label" data-simply-field="label"></span>
                        </button>
                    </template>
                </div>
            </nav>
        </template>
    </div>
</div>`;
  let expanded = null;
  const app2 = app({
    container: shadow,
    data: { buttons, toolbars },
    transformers: {
      toolbarButton(context) {
        const button2 = normalizeButton(context.value);
        const el = context.element;
        el.value = button2.value ?? button2.command ?? "";
        el.dataset.toolbarCommand = button2.command || "";
        if (button2.value != null) {
          el.dataset.toolbarValue = "" + button2.value;
        } else {
          delete el.dataset.toolbarValue;
        }
        el.dataset.simplyCommand = "toolbarCommand";
        el.classList.toggle("simply-edit-button-expands", button2.expands || button2.command === "expand");
        el.title = button2.title || button2.label || button2.command || "";
        return context;
      },
      toolbarPanel(context) {
        context.element.dataset.toolbarPanel = context.value;
        context.element.hidden = context.value !== expanded;
        return context;
      }
    },
    commands: {
      toolbarCommand(button2) {
        const command = button2.dataset.toolbarCommand || button2.value;
        const value = button2.dataset.toolbarValue || button2.value;
        if (command === "expand") {
          setExpanded(expanded === value ? null : value);
          return;
        }
        onCommand?.(command, value, button2);
      }
    }
  });
  Object.assign(host.style, {
    marginTop: "-4px",
    position: "fixed",
    zIndex: "10000"
  });
  function setExpanded(name) {
    expanded = name;
    const subHost = shadow.querySelector(".simply-edit-toolbar-sub");
    if (subHost) {
      subHost.hidden = !expanded;
    }
    for (const panel of shadow.querySelectorAll("[data-toolbar-panel]")) {
      panel.hidden = panel.dataset.toolbarPanel !== expanded;
    }
    for (const button2 of shadow.querySelectorAll('[data-toolbar-command="expand"]')) {
      button2.classList.toggle("simply-edit-button-expanded", button2.dataset.toolbarValue === expanded);
    }
  }
  function updatePosition(session, referenceElement, allowCollapsed) {
    const position = anchor2.update({
      referenceElement: referenceElement || session?.element,
      allowCollapsed
    });
    if (position) {
      positionNearAnchor(host, anchor2.element, position);
    }
    return position;
  }
  return {
    element: host,
    app: app2,
    anchor: anchor2,
    show({ session, referenceElement, allowCollapsed = false } = {}) {
      const position = updatePosition(session, referenceElement, allowCollapsed);
      if (!position) {
        this.hide();
        return false;
      }
      host.hidden = false;
      updatePressedState(shadow, session);
      return true;
    },
    hide() {
      host.hidden = true;
      setExpanded(null);
      anchor2.hide();
    },
    update({ session, referenceElement, allowCollapsed = false } = {}) {
      if (host.hidden) {
        return false;
      }
      const position = updatePosition(session, referenceElement, allowCollapsed);
      if (!position) {
        this.hide();
        return false;
      }
      updatePressedState(shadow, session);
      return true;
    },
    expand(name) {
      setExpanded(name);
    },
    destroy() {
      app2.destroy();
      anchor2.destroy();
      host.remove();
    }
  };
}
function normalizeButton(button2) {
  if (!button2 || typeof button2 !== "object") {
    return { label: "" + button2, command: "" + button2, icon: "" + button2 };
  }
  return button2;
}
function updatePressedState(root, session) {
  for (const button2 of root.querySelectorAll("[data-toolbar-command]")) {
    const command = button2.dataset.toolbarCommand;
    const pressed = command && command !== "expand" && session?.query?.(command) ? "true" : "false";
    button2.setAttribute("aria-pressed", pressed);
  }
}

// src/path.mjs
function getValueByPath2(root, path2) {
  if (!path2) {
    return root;
  }
  let current = root;
  for (const part of path2.split(".")) {
    if (!part || part === ":value") {
      continue;
    }
    if (part === ":root") {
      current = root;
      continue;
    }
    if (current == null) {
      return void 0;
    }
    current = current[decodeURIComponent(part)];
  }
  return current;
}
function setValueByPath2(root, path2, value) {
  if (!path2) {
    throw new Error("simplyedit: cannot set an empty data path");
  }
  const parts = path2.split(".").filter(Boolean).map(decodeURIComponent);
  const last = parts.pop();
  let current = root;
  for (const part of parts) {
    if (current[part] == null || typeof current[part] !== "object") {
      current[part] = {};
    }
    current = current[part];
  }
  current[last] = value;
}
function getFieldPath(element2, attribute = "data-simply") {
  return element2.getAttribute(attribute + "-field") || element2.getAttribute(attribute + "-edit");
}

// src/sortable-list.mjs
var DEFAULT_ATTRIBUTE = "data-simply";
var HANDLE_ATTRIBUTE = "data-simply-sort-handle";
var LIST_HANDLE_ATTRIBUTE = "data-simply-list-handle";
var STYLE_ID = "simply-edit-sortable-style";
var DRAG_THRESHOLD = 4;
function createSortableLists({ container = document.body, app: app2, attribute = DEFAULT_ATTRIBUTE } = {}) {
  if (!app2?.data) {
    throw new Error("simplyedit: sortable lists need an app with data");
  }
  injectSortableStyles(container.ownerDocument || document);
  const sortable = new SortableLists({ container, app: app2, attribute });
  sortable.start();
  return sortable;
}
var SortableLists = class {
  constructor({ container, app: app2, attribute }) {
    this.container = container;
    this.app = app2;
    this.attribute = attribute;
    this.listSelector = `[${attribute}-list][${attribute}-sortable]`;
    this.keyAttribute = `${attribute}-key`;
    this._listeners = [];
    this._scanQueued = false;
    this.drag = null;
    this.listHandles = /* @__PURE__ */ new Map();
    this.toolbar = createSortActionToolbar(container.ownerDocument || document, (action) => this.handleToolbarAction(action));
    this.toolbarContext = null;
  }
  start() {
    this.listen(this.container, "pointerdown", (event) => this.handlePointerDown(event));
    this.listen(document, "keydown", (event) => this.handleKeydown(event));
    this.listen(document, "click", (event) => this.handleClick(event));
    this.listen(window, "resize", () => this.queueScan());
    this.listen(window, "scroll", () => this.positionListHandles(), { capture: true, passive: true });
    this.observer = new MutationObserver(() => this.queueScan());
    this.observer.observe(this.container, { childList: true, subtree: true });
    this.queueScan();
    return this;
  }
  listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this._listeners.push(() => target.removeEventListener(type, handler, options));
  }
  queueScan() {
    if (this._scanQueued) {
      return;
    }
    this._scanQueued = true;
    queueMicrotask(() => {
      this._scanQueued = false;
      this.scan();
    });
  }
  scan() {
    const seen = /* @__PURE__ */ new Set();
    for (const list2 of this.container.querySelectorAll(this.listSelector)) {
      seen.add(list2);
      this.prepareList(list2);
    }
    for (const [list2, handle] of Array.from(this.listHandles.entries())) {
      if (!seen.has(list2) || !list2.isConnected) {
        handle.remove();
        this.listHandles.delete(list2);
      }
    }
    this.positionListHandles();
  }
  prepareList(list2) {
    list2.classList.add("simply-edit-sortable-list");
    this.ensureListHandle(list2);
    for (const item of getSortableItems(list2, this.keyAttribute)) {
      ensureSortHandle(item);
    }
  }
  ensureListHandle(list2) {
    let handle = this.listHandles.get(list2);
    if (handle?.isConnected) {
      return handle;
    }
    handle = createDefaultListHandle(list2.ownerDocument || document);
    handle._simplyEditSortableList = list2;
    (this.container.ownerDocument?.body || document.body).appendChild(handle);
    this.listHandles.set(list2, handle);
    return handle;
  }
  positionListHandles() {
    for (const [list2, handle] of this.listHandles.entries()) {
      if (!list2.isConnected) {
        handle.remove();
        this.listHandles.delete(list2);
        continue;
      }
      const rect = list2.getBoundingClientRect();
      const hasRect = rect.width || rect.height || rect.left || rect.top;
      handle.hidden = !hasRect;
      if (!hasRect) {
        continue;
      }
      Object.assign(handle.style, {
        left: `${Math.max(4, rect.left - 34)}px`,
        top: `${Math.max(4, rect.top)}px`
      });
    }
  }
  handleClick(event) {
    const action = event.target?.closest?.("[data-simply-sort-action]");
    if (action && this.toolbar.element.contains(action)) {
      event.preventDefault();
      this.handleToolbarAction(action.dataset.simplySortAction);
      return;
    }
    const listHandle = event.target?.closest?.(`[${LIST_HANDLE_ATTRIBUTE}]`);
    if (listHandle && this.container.contains(listHandle._simplyEditSortableList || this.container)) {
      event.preventDefault();
      const list2 = listHandle._simplyEditSortableList;
      if (list2) {
        this.showListToolbar({ list: list2, handle: listHandle });
      }
      return;
    }
    if (!event.target?.closest?.("[data-simply-sort-action-toolbar], [data-simply-sort-handle], [data-simply-list-handle]")) {
      this.hideToolbar();
    }
  }
  handlePointerDown(event) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const handle = event.target?.closest?.(`[${HANDLE_ATTRIBUTE}]`);
    if (!handle || !this.container.contains(handle)) {
      return;
    }
    const item = handle.closest(`[${this.keyAttribute}]`);
    const list2 = item?.parentElement?.closest?.(this.listSelector);
    if (!item || !list2 || item.parentElement !== list2) {
      return;
    }
    const array = this.getListArray(list2);
    if (!Array.isArray(array)) {
      console.warn("simplyedit: data-simply-sortable only supports data-simply-list values that are arrays", { cause: list2 });
      return;
    }
    event.preventDefault();
    handle.setPointerCapture?.(event.pointerId);
    this.drag = {
      pointerId: event.pointerId,
      handle,
      list: list2,
      item,
      array,
      from: getItemIndex(item, this.keyAttribute),
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      dragging: false,
      placeholder: null,
      rect: null,
      cleanup: []
    };
    const move = (moveEvent) => this.handlePointerMove(moveEvent);
    const up = (upEvent) => this.handlePointerUp(upEvent);
    const cancel = (cancelEvent) => this.cancelDrag(cancelEvent);
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", cancel);
    this.drag.cleanup.push(() => document.removeEventListener("pointermove", move));
    this.drag.cleanup.push(() => document.removeEventListener("pointerup", up));
    this.drag.cleanup.push(() => document.removeEventListener("pointercancel", cancel));
  }
  handlePointerMove(event) {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    if (!drag.dragging) {
      const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      if (distance < DRAG_THRESHOLD) {
        return;
      }
      this.startDrag(event);
    }
    event.preventDefault();
    this.updateDraggedItem(event);
    this.updatePlaceholder(event);
  }
  startDrag(event) {
    const drag = this.drag;
    if (!drag || drag.dragging) {
      return;
    }
    this.hideToolbar();
    drag.dragging = true;
    drag.rect = drag.item.getBoundingClientRect();
    drag.placeholder = document.createElement(drag.item.tagName);
    drag.placeholder.className = "simply-edit-sort-placeholder";
    drag.placeholder.style.height = `${Math.max(1, drag.rect.height)}px`;
    drag.placeholder.style.width = `${Math.max(1, drag.rect.width)}px`;
    drag.item.parentNode.insertBefore(drag.placeholder, drag.item);
    drag.item.classList.add("simply-edit-sort-dragging");
    drag.list.classList.add("simply-edit-sorting");
    drag.handle.setAttribute("aria-pressed", "true");
    Object.assign(drag.item.style, {
      boxSizing: "border-box",
      left: `${drag.rect.left}px`,
      pointerEvents: "none",
      position: "fixed",
      top: `${drag.rect.top}px`,
      width: `${drag.rect.width}px`,
      zIndex: "10001"
    });
    this.updateDraggedItem(event);
    this.updatePlaceholder(event);
  }
  updateDraggedItem(event) {
    const drag = this.drag;
    if (!drag?.dragging) {
      return;
    }
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    drag.item.style.left = `${drag.rect.left + dx}px`;
    drag.item.style.top = `${drag.rect.top + dy}px`;
  }
  updatePlaceholder(event) {
    const drag = this.drag;
    if (!drag?.dragging) {
      return;
    }
    const items = getSortableItems(drag.list, this.keyAttribute).filter((item) => item !== drag.item);
    for (const item of items) {
      const rect = item.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      if (event.clientY < midpoint) {
        if (drag.placeholder.nextSibling !== item) {
          drag.list.insertBefore(drag.placeholder, item);
        }
        return;
      }
    }
    if (drag.placeholder.parentNode === drag.list) {
      drag.list.appendChild(drag.placeholder);
    }
  }
  handlePointerUp(event) {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    event.preventDefault();
    if (!drag.dragging) {
      const context = {
        list: drag.list,
        item: drag.item,
        index: drag.from,
        handle: drag.handle
      };
      this.finishDrag({ commit: false });
      this.showItemToolbar(context);
      return;
    }
    const to = getPlaceholderIndex(drag.list, drag.placeholder, drag.item, this.keyAttribute);
    this.finishDrag({ commit: true, to });
  }
  cancelDrag(event) {
    if (!this.drag || event?.pointerId != null && event.pointerId !== this.drag.pointerId) {
      return;
    }
    this.finishDrag({ commit: false });
  }
  finishDrag({ commit = false, to } = {}) {
    const drag = this.drag;
    if (!drag) {
      return;
    }
    for (const remove of drag.cleanup.splice(0)) {
      remove();
    }
    drag.handle.releasePointerCapture?.(drag.pointerId);
    drag.handle.removeAttribute("aria-pressed");
    if (drag.dragging) {
      resetDraggedItem(drag.item);
      drag.item.classList.remove("simply-edit-sort-dragging");
      drag.list.classList.remove("simply-edit-sorting");
      if (drag.placeholder?.parentNode) {
        drag.placeholder.parentNode.insertBefore(drag.item, drag.placeholder);
        drag.placeholder.remove();
      }
    }
    this.drag = null;
    if (commit && Number.isInteger(to)) {
      moveArrayItem(drag.array, drag.from, to);
      this.queueScan();
      focusMovedHandle(drag.list, this.keyAttribute, to);
    }
  }
  handleKeydown(event) {
    const listHandle = event.target?.closest?.(`[${LIST_HANDLE_ATTRIBUTE}]`);
    if (listHandle?._simplyEditSortableList) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.showListToolbar({ list: listHandle._simplyEditSortableList, handle: listHandle });
      } else if (event.key === "Escape") {
        this.hideToolbar();
      }
      return;
    }
    const handle = event.target?.closest?.(`[${HANDLE_ATTRIBUTE}]`);
    if (!handle || !this.container.contains(handle)) {
      return;
    }
    const item = handle.closest(`[${this.keyAttribute}]`);
    const list2 = item?.parentElement?.closest?.(this.listSelector);
    if (!item || !list2 || item.parentElement !== list2) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.showItemToolbar({
        list: list2,
        item,
        index: getItemIndex(item, this.keyAttribute),
        handle
      });
      return;
    }
    if (event.key === "Escape") {
      this.hideToolbar();
      return;
    }
    const from = getItemIndex(item, this.keyAttribute);
    let to = from;
    if (event.key === "ArrowUp") {
      to = Math.max(0, from - 1);
    } else if (event.key === "ArrowDown") {
      const last = Math.max(0, getSortableItems(list2, this.keyAttribute).length - 1);
      to = Math.min(last, from + 1);
    } else if (event.key === "Home") {
      to = 0;
    } else if (event.key === "End") {
      to = Math.max(0, getSortableItems(list2, this.keyAttribute).length - 1);
    } else {
      return;
    }
    event.preventDefault();
    if (to === from) {
      return;
    }
    const array = this.getListArray(list2);
    if (!Array.isArray(array)) {
      return;
    }
    moveArrayItem(array, from, to);
    this.queueScan();
    focusMovedHandle(list2, this.keyAttribute, to);
  }
  showItemToolbar({ list: list2, item, index, handle }) {
    this.toolbarContext = { type: "item", list: list2, item, index };
    this.toolbar.show({
      handle,
      buttons: [
        { action: "delete", label: "Delete", icon: "\xD7" },
        { action: "append", label: "Append item", icon: "+" }
      ]
    });
  }
  showListToolbar({ list: list2, handle }) {
    this.toolbarContext = { type: "list", list: list2 };
    this.toolbar.show({
      handle,
      buttons: [
        { action: "insert", label: "Insert item", icon: "+" }
      ]
    });
  }
  hideToolbar() {
    this.toolbarContext = null;
    this.toolbar.hide();
  }
  handleToolbarAction(action) {
    const context = this.toolbarContext;
    if (!context) {
      return false;
    }
    if (action === "delete" && context.type === "item") {
      return this.deleteItem(context);
    }
    if (action === "append" && context.type === "item") {
      return this.insertItem(context.list, context.index + 1, context.index);
    }
    if (action === "insert" && context.type === "list") {
      return this.insertItem(context.list, 0);
    }
    return false;
  }
  deleteItem({ list: list2, index }) {
    const array = this.getListArray(list2);
    if (!Array.isArray(array) || index < 0 || index >= array.length) {
      return false;
    }
    batch(() => array.splice(index, 1));
    this.hideToolbar();
    this.queueScan();
    focusMovedHandle(list2, this.keyAttribute, Math.min(index, array.length - 1), { fallbackListHandle: this.listHandles.get(list2) });
    return true;
  }
  insertItem(list2, index, sourceIndex) {
    const array = this.getListArray(list2);
    if (!Array.isArray(array)) {
      return false;
    }
    const item = createDefaultItemValue(list2, this.attribute, array, sourceIndex);
    const to = Math.max(0, Math.min(index, array.length));
    batch(() => array.splice(to, 0, item));
    this.hideToolbar();
    this.queueScan();
    focusMovedHandle(list2, this.keyAttribute, to, { fallbackListHandle: this.listHandles.get(list2) });
    return true;
  }
  getListArray(list2) {
    const path2 = list2.getAttribute(`${this.attribute}-list`);
    return getValueByPath2(this.app.data, path2);
  }
  destroy() {
    this.cancelDrag();
    this.observer?.disconnect();
    for (const remove of this._listeners.splice(0)) {
      remove();
    }
    this.toolbar.destroy();
    for (const handle of this.listHandles.values()) {
      handle.remove();
    }
    this.listHandles.clear();
    for (const item of this.container.querySelectorAll(".simply-edit-has-default-sort-handle")) {
      const handle = item.querySelector(':scope > .simply-edit-sort-handle[data-simply-generated="true"]');
      handle?.remove();
      item.classList.remove("simply-edit-has-default-sort-handle");
    }
  }
};
function ensureSortHandle(item) {
  const existing = item.querySelector(`[${HANDLE_ATTRIBUTE}]`);
  if (existing) {
    return existing;
  }
  const handle = createDefaultHandle(item.ownerDocument || document);
  if (item instanceof HTMLTableRowElement) {
    const cell = item.ownerDocument.createElement("td");
    cell.className = "simply-edit-sort-handle-cell";
    cell.appendChild(handle);
    item.insertBefore(cell, item.firstChild);
  } else {
    item.insertBefore(handle, item.firstChild);
  }
  item.classList.add("simply-edit-has-default-sort-handle");
  return handle;
}
function createDefaultHandle(doc) {
  const handle = doc.createElement("button");
  handle.type = "button";
  handle.className = "simply-edit-sort-handle";
  handle.setAttribute(HANDLE_ATTRIBUTE, "");
  handle.setAttribute("data-simply-generated", "true");
  handle.setAttribute("aria-label", "Move or edit item");
  handle.setAttribute("title", "Move or edit item");
  handle.textContent = "\u22EE\u22EE";
  return handle;
}
function createDefaultListHandle(doc) {
  const handle = doc.createElement("button");
  handle.type = "button";
  handle.className = "simply-edit-list-handle";
  handle.setAttribute(LIST_HANDLE_ATTRIBUTE, "");
  handle.setAttribute("data-simply-generated", "true");
  handle.setAttribute("aria-label", "Insert item");
  handle.setAttribute("title", "Insert item");
  handle.textContent = "+";
  return handle;
}
function createSortActionToolbar(doc, onAction) {
  const toolbar = doc.createElement("div");
  toolbar.className = "simply-edit-sort-action-toolbar";
  toolbar.setAttribute("data-simply-sort-action-toolbar", "");
  toolbar.setAttribute("role", "toolbar");
  toolbar.hidden = true;
  (doc.body || doc.documentElement).appendChild(toolbar);
  return {
    element: toolbar,
    show({ handle, buttons }) {
      toolbar.replaceChildren(...buttons.map((button2) => createToolbarButton(doc, button2)));
      const rect = handle.getBoundingClientRect();
      toolbar.hidden = false;
      Object.assign(toolbar.style, {
        left: `${Math.max(4, rect.left)}px`,
        top: `${Math.max(4, rect.bottom + 4)}px`
      });
    },
    hide() {
      toolbar.hidden = true;
      toolbar.replaceChildren();
    },
    destroy() {
      toolbar.remove();
    }
  };
}
function createToolbarButton(doc, button2) {
  const element2 = doc.createElement("button");
  element2.type = "button";
  element2.className = "simply-edit-sort-action-button";
  element2.dataset.simplySortAction = button2.action;
  element2.title = button2.label;
  element2.innerHTML = `<span class="simply-edit-sort-action-icon">${escapeHTML2(button2.icon || "")}</span><span class="simply-edit-sort-action-label">${escapeHTML2(button2.label || button2.action)}</span>`;
  return element2;
}
function getSortableItems(list2, keyAttribute) {
  return Array.from(list2.children).filter((child) => child instanceof HTMLElement && child.hasAttribute(keyAttribute));
}
function getItemIndex(item, keyAttribute) {
  return Number.parseInt(item.getAttribute(keyAttribute), 10);
}
function getPlaceholderIndex(list2, placeholder, draggedItem, keyAttribute) {
  const children = Array.from(list2.children).filter((child) => child !== draggedItem && child.tagName !== "TEMPLATE");
  return Math.max(0, children.indexOf(placeholder));
}
function resetDraggedItem(item) {
  item.style.boxSizing = "";
  item.style.left = "";
  item.style.pointerEvents = "";
  item.style.position = "";
  item.style.top = "";
  item.style.width = "";
  item.style.zIndex = "";
}
function moveArrayItem(array, from, to) {
  if (!Array.isArray(array) || from === to || from < 0 || to < 0 || from >= array.length || to >= array.length) {
    return false;
  }
  batch(() => {
    const [item] = array.splice(from, 1);
    array.splice(to, 0, item);
  });
  return true;
}
function focusMovedHandle(list2, keyAttribute, index, { fallbackListHandle } = {}) {
  setTimeout(() => {
    const item = Array.from(list2.children).find((child) => child.getAttribute?.(keyAttribute) === "" + index);
    const handle = item?.querySelector?.(`[${HANDLE_ATTRIBUTE}]`);
    if (handle) {
      handle.focus?.();
      return;
    }
    fallbackListHandle?.focus?.();
  }, 0);
}
function createDefaultItemValue(list2, attribute, array, sourceIndex) {
  const source = Number.isInteger(sourceIndex) ? array[sourceIndex] : array[0];
  if (source !== void 0) {
    return createEmptyValueLike(source);
  }
  return createValueFromTemplate(list2, attribute);
}
function createEmptyValueLike(value) {
  if (Array.isArray(value)) {
    return [];
  }
  if (value && typeof value === "object") {
    const result = {};
    for (const key of Object.keys(value)) {
      result[key] = createEmptyValueLike(value[key]);
    }
    return result;
  }
  if (typeof value === "boolean") {
    return false;
  }
  if (typeof value === "number") {
    return 0;
  }
  return "";
}
function createValueFromTemplate(list2, attribute) {
  const template = Array.from(list2.children).find((child) => child.tagName === "TEMPLATE");
  if (!template?.content) {
    return {};
  }
  const result = {};
  const selector = [`[${attribute}-field]`, `[${attribute}-edit]`, `[${attribute}-list]`].join(",");
  for (const element2 of template.content.querySelectorAll(selector)) {
    const listPath = element2.getAttribute(`${attribute}-list`);
    const fieldPath = element2.getAttribute(`${attribute}-field`) || element2.getAttribute(`${attribute}-edit`);
    const path2 = listPath || fieldPath;
    if (!path2 || path2.startsWith(":") || path2.startsWith("/")) {
      continue;
    }
    setValueByPath2(result, path2, listPath ? [] : "");
  }
  return Object.keys(result).length ? result : "";
}
function injectSortableStyles(doc) {
  if (doc.getElementById(STYLE_ID)) {
    return;
  }
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.simply-edit-sortable-list {
    position: relative;
}
.simply-edit-has-default-sort-handle {
    position: relative;
}
.simply-edit-sort-handle,
.simply-edit-list-handle {
    align-items: center;
    background: #fff;
    border: 1px solid #d0d0d0;
    border-radius: 3px;
    color: #555;
    cursor: grab;
    display: inline-flex;
    font: inherit;
    font-size: 14px;
    justify-content: center;
    line-height: 1;
    min-height: 1.75rem;
    min-width: 1.75rem;
    padding: .15rem .25rem;
    touch-action: none;
    user-select: none;
    z-index: 9998;
}
.simply-edit-sort-handle[data-simply-generated="true"] {
    left: -2.25rem;
    margin: 0;
    position: absolute;
    top: .35rem;
}
.simply-edit-list-handle {
    cursor: pointer;
    font-weight: bold;
    position: fixed;
}
.simply-edit-sort-handle:hover,
.simply-edit-sort-handle:focus,
.simply-edit-list-handle:hover,
.simply-edit-list-handle:focus {
    border-color: #ea5922;
    outline: 2px solid transparent;
}
.simply-edit-sorting .simply-edit-sort-handle,
.simply-edit-sort-dragging .simply-edit-sort-handle {
    cursor: grabbing;
}
.simply-edit-sort-dragging {
    background: #fff;
    box-shadow: 0 2px 8px rgba(0,0,0,.18);
    opacity: .96;
}
.simply-edit-sort-placeholder {
    background: rgba(234, 89, 34, .08);
    border: 2px dashed #ea5922;
    box-sizing: border-box;
    list-style: none;
    min-height: 1.75rem;
}
.simply-edit-sort-handle-cell {
    width: 1%;
    white-space: nowrap;
}
.simply-edit-sort-action-toolbar {
    background: white;
    border-top: 2px solid #ea5922;
    box-shadow: 0 1px 1px rgba(0,0,0,.11), 0 2px 2px rgba(0,0,0,.09), 0 4px 4px rgba(0,0,0,.07);
    display: flex;
    min-height: 40px;
    position: fixed;
    white-space: nowrap;
    z-index: 10000;
}
.simply-edit-sort-action-toolbar[hidden] {
    display: none;
}
.simply-edit-sort-action-button {
    background: transparent;
    border: 0;
    border-bottom: 2px solid transparent;
    color: #333;
    cursor: pointer;
    font: 11px Arial, Helvetica, sans-serif;
    min-height: 40px;
    min-width: 54px;
    padding: 0 5px;
    text-align: center;
}
.simply-edit-sort-action-button:hover,
.simply-edit-sort-action-button:focus {
    border-bottom-color: #ea5922;
    outline: 2px solid transparent;
}
.simply-edit-sort-action-icon {
    display: block;
    font-size: 18px;
    font-weight: bold;
    line-height: 20px;
}
.simply-edit-sort-action-label {
    display: block;
}
`;
  doc.head?.appendChild(style);
}
function escapeHTML2(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

// src/editor.mjs
var DEFAULT_SELECTOR2 = "[data-simply-editable]";
var SimplyEdit = class {
  constructor(options = {}) {
    this.container = options.container || document.body;
    this.attribute = options.attribute || "data-simply";
    this.selector = options.selector || DEFAULT_SELECTOR2;
    this.engine = options.engine || createHtmlDomEngine(options.engineOptions);
    this.toolbar = options.toolbar === false ? null : options.toolbar || createToolbar({
      container: this.container,
      buttons: options.buttons,
      toolbars: options.toolbars,
      onCommand: (command, value) => this.execute(command, value)
    });
    this.app = options.app || app({
      container: this.container,
      data: options.data || {},
      transformers: options.transformers
    });
    this.sortable = options.sortable === false ? null : createSortableLists({
      container: this.container,
      app: this.app,
      attribute: this.attribute
    });
    this.activeElement = null;
    this.activeSession = null;
    this.toolbarRequested = false;
    this._listeners = [];
    this.start();
  }
  start() {
    this.listen(this.container, "focusin", (event) => this.activateFromEvent(event));
    this.listen(this.container, "click", (event) => this.activateFromEvent(event));
    this.listen(document, "selectionchange", () => this.updateToolbar());
    this.listen(document, "keydown", (event) => this.handleKeydown(event));
    return this;
  }
  listen(target, event, handler) {
    target.addEventListener(event, handler);
    this._listeners.push(() => target.removeEventListener(event, handler));
  }
  activateFromEvent(event) {
    const element2 = event.target?.closest?.(this.selector);
    if (!element2 || !this.container.contains(element2)) {
      return;
    }
    if (event.type === "click") {
      this.toolbarRequested = false;
    }
    this.activate(element2);
  }
  activate(element2) {
    if (this.activeElement === element2 && this.activeSession) {
      this.updateToolbar();
      return this.activeSession;
    }
    this.deactivate();
    const path2 = getFieldPath(element2, this.attribute);
    if (!path2) {
      throw new Error("simplyedit: editable elements need data-simply-field or data-simply-edit");
    }
    this.activeElement = element2;
    element2.classList.add("simply-edit-active");
    const html = getValueByPath2(this.app.data, path2) ?? element2.innerHTML;
    this.activeSession = this.engine.mount({
      element: element2,
      html,
      onChange: (value) => {
        setValueByPath2(this.app.data, path2, value);
      },
      onSelectionChange: () => this.updateToolbar()
    });
    this.activeSession.focus();
    this.updateToolbar();
    return this.activeSession;
  }
  deactivate() {
    if (this.activeSession) {
      this.activeSession.destroy?.();
    }
    if (this.activeElement) {
      this.activeElement.classList.remove("simply-edit-active");
    }
    this.activeSession = null;
    this.activeElement = null;
    this.toolbarRequested = false;
    this.toolbar?.hide();
  }
  execute(command, value) {
    if (!this.activeSession) {
      return false;
    }
    return this.activeSession.execute(command, value);
  }
  handleKeydown(event) {
    if (event.key === "Escape" && this.toolbar && !this.toolbar.element.hidden) {
      event.preventDefault();
      this.hideToolbar();
      return;
    }
    if (!isControlSpace(event)) {
      return;
    }
    const element2 = event.target?.closest?.(this.selector) || this.activeElement;
    if (!element2 || !this.container.contains(element2)) {
      return;
    }
    event.preventDefault();
    if (this.activeElement !== element2 || !this.activeSession) {
      this.activate(element2);
    }
    this.showToolbar({ allowCollapsed: true });
  }
  showToolbar({ allowCollapsed = false } = {}) {
    if (!this.activeSession) {
      return false;
    }
    this.toolbarRequested = allowCollapsed;
    return this.toolbar?.show({
      session: this.activeSession,
      referenceElement: this.activeElement,
      allowCollapsed
    }) ?? false;
  }
  hideToolbar() {
    this.toolbarRequested = false;
    this.toolbar?.hide();
  }
  updateToolbar() {
    if (!this.activeSession) {
      this.toolbar?.hide();
      return;
    }
    if (hasVisibleSelection(this.container, { referenceElement: this.activeElement })) {
      this.toolbarRequested = false;
      this.toolbar?.show({
        session: this.activeSession,
        referenceElement: this.activeElement,
        allowCollapsed: false
      });
      return;
    }
    if (this.toolbarRequested && hasCaretOrSelection(this.container, { referenceElement: this.activeElement })) {
      this.toolbar?.show({
        session: this.activeSession,
        referenceElement: this.activeElement,
        allowCollapsed: true
      });
      return;
    }
    this.toolbar?.hide();
  }
  destroy() {
    this.deactivate();
    for (const remove of this._listeners.splice(0)) {
      remove();
    }
    this.toolbar?.destroy?.();
    this.sortable?.destroy?.();
    this.app?.destroy?.();
  }
};
function edit(options = {}) {
  return new SimplyEdit(options);
}
function isControlSpace(event) {
  return event.ctrlKey && !event.altKey && !event.metaKey && (event.key === " " || event.key === "Spacebar" || event.code === "Space");
}
export {
  SimplyEdit,
  createHtmlDomEngine,
  createSelectionAnchor,
  createSortableLists,
  createToolbar,
  edit,
  getCursorPosition,
  getSelectionRect,
  positionNearAnchor,
  positionNearSelection
};
