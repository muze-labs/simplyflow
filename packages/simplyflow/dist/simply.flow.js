(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // ../state/src/index.mjs
  var src_exports = {};
  __export(src_exports, {
    addTracer: () => addTracer,
    batch: () => batch,
    clockEffect: () => clockEffect,
    clone: () => clone,
    createSignal: () => createSignal,
    destroy: () => destroy,
    effect: () => effect,
    getSignal: () => getSignal,
    isSignal: () => isSignal,
    makeContext: () => makeContext,
    notifyGet: () => notifyGet,
    notifySet: () => notifySet,
    raw: () => raw,
    registerSignal: () => registerSignal,
    signal: () => signal,
    signals: () => signals,
    throttledEffect: () => throttledEffect,
    trace: () => trace,
    untracked: () => untracked
  });

  // ../state/src/symbols.mjs
  var DEP = {
    ITERATE: Symbol.for("@simplyedit/simplyflow.iterate"),
    XRAY: Symbol.for("@simplyedit/simplyflow.xRay"),
    SIGNAL: Symbol.for("@simplyedit/simplyflow.Signal"),
    RERENDER: Symbol.for("@simplyedit/simplyflow.rerender"),
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
      const descriptor = Object.getOwnPropertyDescriptor(target, property);
      if (descriptor?.configurable === false && (Object.hasOwn(descriptor, "value") && descriptor.writable === false || Object.hasOwn(descriptor, "get") && descriptor.get === void 0)) return value;
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
  function trace(target, prop) {
    if (typeof target === "function") {
      tracing = true;
      try {
        return target();
      } finally {
        tracing = false;
      }
    }
    if (!isSignal(target)) {
      throw new TypeError("simplyflow/state: trace() expects either a function or a signal");
    }
    return getListeners(target, prop).map((listener) => ({
      effect: listener.effectType,
      fn: listener.effectFunction,
      signal: signals.get(listener.effectFunction)
    }));
  }
  function addTracer(tracer) {
    if (!tracer || typeof tracer !== "object") {
      throw new TypeError("simplyflow/state: addTracer() expects a tracer object");
    }
    if (!tracer.get && !tracer.set) {
      throw new Error('simplyflow/state: addTracer: missing "get" or "set" property in tracer');
    }
    if (tracer.get && typeof tracer.get !== "function") {
      throw new Error('simplyflow/state: addTracer: "get" is not a function');
    }
    if (tracer.set && typeof tracer.set !== "function") {
      throw new Error('simplyflow/state: addTracer: "set" is not a function');
    }
    tracers.push(tracer);
  }
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
  function getListeners(self, property) {
    return Array.from(listenersFor(self, property));
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
  function effect(fn) {
    assertFunction(fn, "effect");
    assertNotRecursive(fn);
    effectStack.push(fn);
    const connectedSignal = effectSignal(fn);
    const compute = function computeEffect() {
      runTracked(compute, connectedSignal, fn, effect);
    };
    compute.fn = fn;
    effectMap.set(connectedSignal, compute);
    compute();
    return connectedSignal;
  }
  function destroy(connectedSignal, { flush = false } = {}) {
    if (!isSignal(connectedSignal)) {
      throw new TypeError("simplyflow/state: destroy() expects an effect signal");
    }
    const compute = effectMap.get(connectedSignal);
    if (!compute) {
      return;
    }
    compute.destroy?.(flush);
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
  function scheduleTimeout(run, delay) {
    const timer = globalThis.setTimeout(run, delay);
    return () => globalThis.clearTimeout(timer);
  }
  function throttledEffect(fn, throttleTime, { schedule = scheduleTimeout } = {}) {
    assertFunction(fn, "throttledEffect");
    if (!Number.isFinite(throttleTime) || throttleTime < 0) {
      throw new TypeError("simplyflow/state: throttledEffect() expects throttleTime to be a non-negative number");
    }
    assertNotRecursive(fn);
    effectStack.push(fn);
    const connectedSignal = effectSignal(fn);
    let throttledUntil = 0;
    let hasChange = true;
    let cancelPending = null;
    const compute = function computeEffect() {
      const now = Date.now();
      if (throttledUntil > now) {
        hasChange = true;
        scheduleUpdate();
        return;
      }
      runTracked(compute, connectedSignal, fn, throttledEffect);
      hasChange = false;
      throttledUntil = Date.now() + throttleTime;
    };
    function scheduleUpdate() {
      if (cancelPending) {
        return;
      }
      const delay = Math.max(0, throttledUntil - Date.now());
      cancelPending = schedule(() => {
        cancelPending = null;
        if (hasChange) {
          compute();
        }
      }, delay);
    }
    compute.fn = fn;
    compute.destroy = (flush) => {
      try {
        if (flush && hasChange) {
          throttledUntil = 0;
          compute();
        }
      } finally {
        cancelPending?.();
        cancelPending = null;
        hasChange = false;
      }
    };
    effectMap.set(connectedSignal, compute);
    try {
      compute();
    } catch (error) {
      destroy(connectedSignal);
      throw error;
    }
    return connectedSignal;
  }
  var clockQueues = /* @__PURE__ */ new WeakMap();
  function readClockTime(clock) {
    return raw(clock).time;
  }
  function getClockQueue(clock) {
    if (!clockQueues.has(clock)) {
      const queue = {
        clock,
        effects: /* @__PURE__ */ new Set(),
        pending: /* @__PURE__ */ new Set(),
        time: readClockTime(clock)
      };
      queue.tick = function tickClockEffects() {
        const time = readClockTime(clock);
        if (time <= queue.time) {
          return;
        }
        queue.time = time;
        const pending = Array.from(queue.pending);
        queue.pending.clear();
        for (const compute of pending) {
          compute.clockPending = false;
          if (queue.effects.has(compute)) {
            compute();
          }
        }
      };
      queue.tick.effectFunction = queue.tick;
      queue.tick.effectType = clockEffect;
      setListeners(clock, "time", queue.tick);
      clockQueues.set(clock, queue);
    }
    return clockQueues.get(clock);
  }
  function detachClockEffect(compute) {
    const queue = compute.clockQueue;
    if (!queue) {
      return;
    }
    queue.pending.delete(compute);
    queue.effects.delete(compute);
    if (!queue.effects.size) {
      clearListeners(queue.tick);
      clockQueues.delete(queue.clock);
    }
  }
  function clockEffect(fn, clock) {
    assertFunction(fn, "clockEffect");
    if (!clock || typeof clock !== "object" || typeof raw(clock).time !== "number") {
      throw new TypeError("simplyflow/state: clockEffect() expects a clock object with a numeric .time property");
    }
    const clockSignal = isSignal(clock) ? clock : signal(raw(clock));
    const connectedSignal = effectSignal(fn);
    const queue = getClockQueue(clockSignal);
    const compute = function computeEffect() {
      clearListeners(compute);
      compute.effectFunction = fn;
      compute.effectType = clockEffect;
      computeStack.push(compute);
      let result;
      try {
        result = fn(compute, computeStack);
      } finally {
        computeStack.pop();
        setEffectResult(connectedSignal, result);
      }
    };
    compute.fn = fn;
    compute.clockQueue = queue;
    compute.skipDependency = (self, property) => self === clockSignal && property === "time";
    compute.scheduleClock = () => {
      if (!compute.clockPending) {
        compute.clockPending = true;
        queue.pending.add(compute);
      }
    };
    compute.destroy = () => detachClockEffect(compute);
    queue.effects.add(compute);
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
  function cloneOptions(options) {
    if (typeof options === "boolean") {
      return { deep: options };
    }
    if (options === void 0) {
      return { deep: true };
    }
    if (!options || typeof options !== "object") {
      throw new TypeError("simplyflow/state: clone() expects options to be a boolean or object");
    }
    return { deep: options.deep !== false };
  }
  function typeName(value) {
    return value?.constructor?.name || Object.prototype.toString.call(value).slice(8, -1);
  }
  function isPlainObject(value) {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }
  function isTypedArray(value) {
    return ArrayBuffer.isView(value) && !(value instanceof DataView);
  }
  function isIntegerKey(property) {
    if (typeof property !== "string" || property === "") {
      return false;
    }
    const index = Number(property);
    return Number.isInteger(index) && index >= 0 && String(index) === property;
  }
  function hasToClone(value) {
    return typeof value.toClone === "function";
  }
  function cannotClone(value, path2) {
    throw new TypeError(
      `simplyflow/state: clone() cannot clone ${typeName(value)} at ${path2}; add a toClone() method for custom objects`
    );
  }
  function cloneDescriptorProperties(source, result, cloneValue, skip = () => false) {
    const descriptors = Object.getOwnPropertyDescriptors(source);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (skip(key)) {
        delete descriptors[key];
        continue;
      }
      const descriptor = descriptors[key];
      if (!Object.hasOwn(descriptor, "value")) {
        cannotClone(source, String(key));
      }
      descriptor.value = cloneValue(descriptor.value, String(key));
    }
    Object.defineProperties(result, descriptors);
    return result;
  }
  function cloneArrayBuffer(value) {
    return value.slice(0);
  }
  function cloneSharedArrayBuffer(value) {
    const result = new SharedArrayBuffer(value.byteLength);
    new Uint8Array(result).set(new Uint8Array(value));
    return result;
  }
  function cloneErrorObject(value, cloneValue, path2) {
    const standardErrors = /* @__PURE__ */ new Set([
      Error,
      EvalError,
      RangeError,
      ReferenceError,
      SyntaxError,
      TypeError,
      URIError,
      typeof AggregateError === "undefined" ? void 0 : AggregateError
    ]);
    if (!standardErrors.has(value.constructor)) {
      cannotClone(value, path2);
    }
    const options = Object.hasOwn(value, "cause") ? { cause: cloneValue(value.cause, "cause") } : void 0;
    if (typeof AggregateError !== "undefined" && value instanceof AggregateError) {
      const errors = Array.from(value.errors || [], (error, index) => cloneValue(error, `errors.${index}`));
      return new AggregateError(errors, value.message, options);
    }
    return new value.constructor(value.message, options);
  }
  function clone(value, options) {
    const { deep } = cloneOptions(options);
    const seen = /* @__PURE__ */ new Map();
    function cloneChild(value2, path2) {
      return deep ? cloneValue(value2, path2) : raw(value2);
    }
    function cloneValue(value2, path2 = "value") {
      const source = raw(value2);
      if (!isObjectLike(source)) {
        return source;
      }
      if (seen.has(source)) {
        return seen.get(source);
      }
      if (hasToClone(source)) {
        const result = raw(source.toClone());
        if (Object.is(result, source)) {
          throw new TypeError(`simplyflow/state: clone() toClone() returned the original object at ${path2}`);
        }
        seen.set(source, result);
        return result;
      }
      if (Array.isArray(source)) {
        const result = new Array(source.length);
        seen.set(source, result);
        return cloneDescriptorProperties(source, result, cloneChild, (key) => key === "length");
      }
      if (isPlainObject(source)) {
        const result = Object.create(Object.getPrototypeOf(source));
        seen.set(source, result);
        return cloneDescriptorProperties(source, result, cloneChild);
      }
      if (source instanceof Map) {
        const result = /* @__PURE__ */ new Map();
        seen.set(source, result);
        source.forEach((mapValue, mapKey) => {
          result.set(cloneChild(mapKey, "map key"), cloneChild(mapValue, "map value"));
        });
        return cloneDescriptorProperties(source, result, cloneChild);
      }
      if (source instanceof Set) {
        const result = /* @__PURE__ */ new Set();
        seen.set(source, result);
        source.forEach((setValue) => result.add(cloneChild(setValue, "set value")));
        return cloneDescriptorProperties(source, result, cloneChild);
      }
      if (source instanceof Date) {
        const result = new Date(source.getTime());
        seen.set(source, result);
        return cloneDescriptorProperties(source, result, cloneChild);
      }
      if (source instanceof RegExp) {
        const result = new RegExp(source.source, source.flags);
        result.lastIndex = source.lastIndex;
        seen.set(source, result);
        return cloneDescriptorProperties(source, result, cloneChild, (key) => key === "lastIndex");
      }
      if (source instanceof ArrayBuffer) {
        const result = cloneArrayBuffer(source);
        seen.set(source, result);
        return cloneDescriptorProperties(source, result, cloneChild);
      }
      if (typeof SharedArrayBuffer !== "undefined" && source instanceof SharedArrayBuffer) {
        const result = cloneSharedArrayBuffer(source);
        seen.set(source, result);
        return cloneDescriptorProperties(source, result, cloneChild);
      }
      if (source instanceof DataView) {
        const buffer = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
        const result = new DataView(buffer);
        seen.set(source, result);
        return cloneDescriptorProperties(source, result, cloneChild);
      }
      if (isTypedArray(source)) {
        const result = new source.constructor(source);
        seen.set(source, result);
        return cloneDescriptorProperties(source, result, cloneChild, isIntegerKey);
      }
      if (typeof URL !== "undefined" && source instanceof URL) {
        const result = new URL(source.href);
        seen.set(source, result);
        return result;
      }
      if (typeof URLSearchParams !== "undefined" && source instanceof URLSearchParams) {
        const result = new URLSearchParams(source);
        seen.set(source, result);
        return result;
      }
      if (typeof File !== "undefined" && source instanceof File) {
        const result = new File([source], source.name, {
          type: source.type,
          lastModified: source.lastModified
        });
        seen.set(source, result);
        return result;
      }
      if (typeof Blob !== "undefined" && source instanceof Blob) {
        const result = source.slice(0, source.size, source.type);
        seen.set(source, result);
        return result;
      }
      if (source instanceof Error) {
        const result = cloneErrorObject(source, cloneChild, path2);
        seen.set(source, result);
        return cloneDescriptorProperties(source, result, cloneChild, (key) => key === "message" || key === "cause" || key === "errors" || key === "stack");
      }
      if (typeof Node !== "undefined" && source instanceof Node && typeof source.cloneNode === "function") {
        const result = source.cloneNode(deep);
        seen.set(source, result);
        return result;
      }
      cannotClone(source, path2);
    }
    return cloneValue(value);
  }

  // ../bind/src/dom.mjs
  var dom_exports = {};
  __export(dom_exports, {
    findAttribute: () => findAttribute,
    releaseDomBinding: () => releaseDomBinding,
    signal: () => signal2,
    trackDomField: () => trackDomField,
    trackDomList: () => trackDomList
  });

  // ../bind/src/item-key.mjs
  var commentKeys = /* @__PURE__ */ new WeakMap();
  function getItemKey(node, attribute) {
    return node.getAttribute?.(attribute) ?? commentKeys.get(node);
  }
  function setItemKey(node, attribute, key) {
    if (node.nodeType === Node.COMMENT_NODE) {
      commentKeys.set(node, String(key));
    } else {
      node.setAttribute(attribute, key);
    }
  }
  var commandKeyPaths = /* @__PURE__ */ new WeakMap();

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
  var stableRowKeys = /* @__PURE__ */ new WeakMap();
  function listKeys(values, path2) {
    const seen = /* @__PURE__ */ new Set();
    return Array.from(values, (value) => {
      const key = getValueByPath(value, path2);
      if (typeof key !== "string" && !Number.isFinite(key) || seen.has(key)) {
        throw new Error(
          `simplyflow/bind: list key "${path2}" must give each row a unique string or finite number`
        );
      }
      seen.add(key);
      return key;
    });
  }
  function arrayByTemplates(context) {
    const attribute = this.options.attribute;
    const attributes2 = [attribute + "-field", attribute + "-edit", attribute + "-list", attribute + "-map", attribute + "-value-path"];
    const valueAttribute = attribute + "-value";
    const attrQuery = "[" + [...attributes2, valueAttribute].join("],[") + "]";
    const keyAttribute = attribute + "-key";
    const items = Array.from(context.element.childNodes).filter((node) => getItemKey(node, keyAttribute) != null);
    const usedItems = /* @__PURE__ */ new Set();
    let cursor = 0;
    const host = context.element;
    const keyPath = host.getAttribute(attribute + "-list-key");
    const keys = keyPath ? listKeys(context.value, keyPath) : null;
    const rowsByKey = keys ? new Map(items.map((item) => [stableRowKeys.get(item), item])) : null;
    const focused = keys ? host.getRootNode().activeElement : null;
    const preserveFocus = focused && host.contains(focused);
    context.list = context.value;
    function createRow(binding, key) {
      const fragment = binding.applyTemplate(context);
      if (keys) {
        const root = Array.from(fragment.childNodes).find((node) => node[DEP.TEMPLATE]);
        if (root) {
          stableRowKeys.set(root, key);
        }
      }
      return fragment;
    }
    for (let index = 0; index < context.value.length; index++) {
      context.index = index;
      const value = context.list[index];
      const item = nextUnusedItem(items, usedItems, cursor);
      const stableKey = keys?.[index];
      if (!item) {
        host.appendChild(createRow(this, stableKey));
        continue;
      }
      const newTemplate = this.findTemplate(context.templates, value);
      const reusableItem = rowsByKey ? rowsByKey.get(stableKey) : item[DEP.VALUE] === value ? item : findReusableItem(items, usedItems, value, newTemplate, cursor + 1);
      if (reusableItem) {
        const replace = newTemplate !== reusableItem[DEP.TEMPLATE] || context.refreshTemplate && newTemplate === context.refreshTemplate;
        if (replace) {
          const replacement = createRow(this, stableKey);
          if (keys && reusableItem !== item) {
            host.insertBefore(replacement, item);
            reusableItem.remove();
          } else {
            host.replaceChild(replacement, reusableItem);
          }
        } else {
          if (reusableItem !== item) {
            if (keys && host.moveBefore) {
              host.moveBefore(reusableItem, item);
            } else {
              host.insertBefore(reusableItem, item);
            }
          }
          const changed = keys && (getItemKey(reusableItem, keyAttribute) !== String(index) || reusableItem[DEP.VALUE] !== value);
          updateItemKey(reusableItem, index, context.path, keyAttribute, attributes2, attrQuery, valueAttribute);
          reusableItem[DEP.VALUE] = value;
          if (keys && changed && reusableItem.nodeType === Node.ELEMENT_NODE) {
            this.rebindListItem(reusableItem);
          }
        }
        usedItems.add(reusableItem);
        if (reusableItem === item) {
          cursor++;
        }
        continue;
      }
      host.insertBefore(createRow(this, stableKey), item);
    }
    for (const item of items) {
      if (!usedItems.has(item)) {
        item.remove();
      }
    }
    if (preserveFocus && host.contains(focused) && host.getRootNode().activeElement !== focused) {
      focused.focus({ preventScroll: true });
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
  function updateItemKey(item, key, path2, keyAttribute, attributes2, attrQuery, valueAttribute) {
    const oldKey = getItemKey(item, keyAttribute);
    const newKey = "" + key;
    if (oldKey === newKey) {
      return;
    }
    setItemKey(item, keyAttribute, newKey);
    if (item.nodeType === Node.COMMENT_NODE) {
      return;
    }
    const oldPrefix = path2 + "." + oldKey;
    const newPrefix = path2 + "." + newKey;
    const bindings = Array.from(item.querySelectorAll(attrQuery));
    if (item.matches(attrQuery)) {
      bindings.unshift(item);
    }
    for (let binding of bindings) {
      const commandPath = commandKeyPaths.get(binding);
      if (commandPath === oldPrefix) {
        binding.setAttribute(valueAttribute, newKey);
        commandKeyPaths.set(binding, newPrefix);
      } else if (commandPath?.startsWith(oldPrefix + ".")) {
        commandKeyPaths.set(binding, newPrefix + commandPath.slice(oldPrefix.length));
      }
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
    const valueAttribute = attribute + "-value";
    const attrQuery = "[" + [...attributes2, valueAttribute].join("],[") + "]";
    const keyAttribute = attribute + "-key";
    const items = Array.from(context.element.childNodes).filter((node) => getItemKey(node, keyAttribute) != null);
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
      if (getItemKey(item, keyAttribute) === key) {
        reusableItem = item;
      } else {
        reusableItem = findItemByKey(items, usedItems, key, keyAttribute) || findReusableItem(items, usedItems, value, newTemplate, cursor);
      }
      if (reusableItem) {
        if (newTemplate !== reusableItem[DEP.TEMPLATE] || context.refreshTemplate && newTemplate === context.refreshTemplate) {
          context.element.replaceChild(this.applyTemplate(context), reusableItem);
        } else {
          if (reusableItem !== item) {
            context.element.insertBefore(reusableItem, item);
          }
          updateItemKey(reusableItem, key, context.path, keyAttribute, attributes2, attrQuery, valueAttribute);
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
      if (!usedItems.has(item) && getItemKey(item, keyAttribute) === stringKey) {
        return item;
      }
    }
  }
  function fieldByTemplates(context) {
    const rendered = Array.from(context.element.childNodes).find((node) => node[DEP.TEMPLATE] || node.nodeType === Node.ELEMENT_NODE && node.tagName !== "TEMPLATE");
    const template = this.findTemplate(context.templates, context.value);
    context.parent = getParentPath(context.element);
    if (rendered) {
      if (template) {
        if (rendered[DEP.TEMPLATE] !== template || template === context.refreshTemplate) {
          const clone2 = this.applyTemplate(context);
          context.element.replaceChild(clone2, rendered);
        }
      } else {
        context.element.removeChild(rendered);
      }
    } else if (template) {
      const clone2 = this.applyTemplate(context);
      context.element.appendChild(clone2);
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
  var domEffects = /* @__PURE__ */ new WeakMap();
  function releaseDomBinding(element2, flush) {
    const effect2 = domEffects.get(element2);
    if (effect2) {
      domEffects.delete(element2);
      destroy(effect2, { flush });
    }
  }
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
    if (domEffects.has(element2)) {
      return getSignal(element2);
    }
    if (!this.getBindingPath(element2)) {
      throw new Error("Could not find binding path for element", { cause: element2 });
    }
    const s = signal2(element2, {
      childList: true
    });
    const keyAttribute = (this.options.attribute || "data-flow") + "-key";
    const effect2 = throttledEffect(() => {
      notifyGet(s, "children");
      untracked(() => {
        batch(() => {
          let key = 0;
          const path2 = this.getBindingPath(element2);
          if (!path2) {
            return;
          }
          const currentList = getValueByPath(this.options.root, path2);
          const source = currentList.slice();
          for (const item of element2.childNodes) {
            if (item.tagName === "TEMPLATE") {
              continue;
            }
            const oldKey = getItemKey(item, keyAttribute);
            if (oldKey != null) {
              if (oldKey != key) {
                setValueByPath(
                  this.options.root,
                  path2 + "." + key,
                  source[oldKey]
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
    }, 50, { schedule: this.scheduleUpdate });
    domEffects.set(element2, effect2);
    return s;
  }
  function trackDomField(element2, props, valueIsString, stringProperty = "innerHTML", getUpdateValue, context) {
    if (domEffects.has(element2)) {
      return;
    }
    if (!this.getBindingPath(element2)) {
      throw new Error("Could not find binding path for element", { cause: element2 });
    }
    const s = signal2(element2);
    batch(() => {
      const effect2 = throttledEffect(() => {
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
          const path2 = this.getBindingPath(element2);
          if (!path2) {
            return;
          }
          const currentValue = getValueByPath(this.options.root, path2);
          if (getUpdateValue) {
            updateValue = getUpdateValue.call(this, s, currentValue);
          }
          if (typeof updateValue === "undefined") {
            return;
          }
          if (context) {
            context.path = path2;
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
      }, 50, { schedule: this.scheduleUpdate });
      domEffects.set(element2, effect2);
    });
    return s;
  }
  function findAttribute(el, attr) {
    return el.closest("[" + attr + "]")?.getAttribute(attr);
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
    #pendingUpdates = 0;
    #idleWaiters = [];
    #idleTimer = null;
    /**
     * @param Object options - a set of options for this instance, options may include:
     *  - root (signal) (required) - the root data object that contains al signals that can be bound
     *  - container (HTMLElement) - the dom element to use as the root for all bindings
     *  - attribute (string) - the prefix for the field, edit, list and map attributes, e.g. 'data-bind'
     *  - transformers (object name:function) - a map of transformer names and functions
     *  - app (object) - optional owning app, available as this.app in transformers
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
      this.app = options.app;
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
      const renderElement = (el, refreshTemplate) => {
        this.bindings.set(el, throttledEffect(() => {
          if (!el.isConnected) {
            this.releaseBinding(el);
            return;
          }
          let context = {
            templates: Array.from(el.children).filter((child) => child.localName === "template"),
            attribute: getBindingAttribute(el),
            refreshTemplate
          };
          refreshTemplate = void 0;
          context.edit = context.attribute === this.options.attribute + "-edit";
          context.path = this.getBindingPath(el);
          context.value = getValueByPath(this.options.root, context.path);
          context.element = el;
          track(el, context);
          runTransformers(context);
        }, 50, { schedule: this.scheduleUpdate }));
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
      this.rerender = (element2, template) => {
        if (!template || !this.observer || !this.options.container.contains(element2)) {
          return false;
        }
        const standalone = element2[DEP.TEMPLATE] === template && element2[DEP.RERENDER];
        const roots = standalone ? [element2] : Array.from(element2.childNodes).filter((child) => child[DEP.TEMPLATE] === template);
        if (!roots.length || roots.some((root) => root.contains(root.ownerDocument.activeElement))) {
          return false;
        }
        if (standalone) {
          standalone();
        } else {
          const previous = this.bindings.get(element2);
          if (!previous) {
            return false;
          }
          renderElement(element2, template);
          destroy(previous);
        }
        for (const node of this.bindings.keys()) {
          if (!node.isConnected && roots.some((root) => root.contains(node))) {
            this.releaseBinding(node, true);
          }
        }
        return true;
      };
      const selector = bindAttributes.map((name) => `[${name}]`).join(",");
      this.rebindListItem = (item) => {
        queueMicrotask(() => {
          if (!this.observer || !this.options.container.contains(item)) {
            return;
          }
          for (const node of [item, ...item.querySelectorAll(selector)]) {
            const previous = this.bindings.get(node);
            if (previous) {
              renderElement(node);
              destroy(previous);
            }
          }
        });
      };
      const applyBindings = (bindings2) => {
        for (let bindingEl of bindings2) {
          if (!this.bindings.get(bindingEl)) {
            renderElement(bindingEl);
          }
        }
      };
      const updateBindings = (changes) => {
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
      const content = template.content;
      const hasRootText = Array.from(content.childNodes).some(
        (node) => node.nodeType === Node.TEXT_NODE && /[^\t\n\f\r ]/.test(node.data)
      );
      if (content.childElementCount > 1 || hasRootText) {
        throw new Error(
          "simplyflow/bind: template must be empty or contain a single root element",
          { cause: template }
        );
      }
      const clone2 = content.cloneNode(true);
      let root = clone2.firstElementChild;
      if (!root) {
        const params = new URLSearchParams({ "simply-template": template.id });
        root = template.ownerDocument.createComment(` ${params} `);
        clone2.replaceChildren(root);
      }
      const attribute = this.options.attribute;
      const attributes2 = [attribute + "-field", attribute + "-edit", attribute + "-list", attribute + "-map"];
      const bindings = clone2.querySelectorAll(`[${attribute}-field],[${attribute}-edit],[${attribute}-list],[${attribute}-map]`);
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
      this.applyTemplateCommandValues(clone2, template.links, path2, index);
      if (typeof index !== "undefined") {
        setItemKey(root, attribute + "-key", index);
      }
      root[DEP.TEMPLATE] = template;
      root[DEP.VALUE] = value;
      return clone2;
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
          if (value === ":key" && index != null) {
            commandKeyPaths.set(element2, templateItemPath(path2, index));
          }
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
      const appTransformers = this.app?.transformers;
      return el.getAttribute(transformAttribute).split(" ").filter(Boolean).map((name) => {
        const transformer = appTransformers && Object.hasOwn(appTransformers, name) ? appTransformers[name] : this.options.transformers[name];
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
        const container = this.options.container;
        const replacement = container.querySelector("template#" + CSS.escape(rel));
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
    scheduleUpdate = (run, delay) => {
      this.#pendingUpdates++;
      const finish = () => {
        this.#pendingUpdates--;
        this.#checkIdle();
      };
      const timer = setTimeout(() => {
        try {
          run();
        } finally {
          finish();
        }
      }, delay);
      return () => {
        clearTimeout(timer);
        finish();
      };
    };
    whenIdle() {
      if (!this.observer) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        this.#idleWaiters.push(resolve);
        this.#checkIdle();
      });
    }
    #checkIdle() {
      if (this.#pendingUpdates || !this.#idleWaiters.length || this.#idleTimer !== null) {
        return;
      }
      this.#idleTimer = setTimeout(() => {
        this.#idleTimer = null;
        if (!this.#pendingUpdates) {
          this.#resolveIdleWaiters();
        }
      }, 0);
    }
    #resolveIdleWaiters() {
      for (const resolve of this.#idleWaiters.splice(0)) {
        resolve();
      }
    }
    releaseBinding(element2, flush = false) {
      const binding = this.bindings.get(element2);
      if (binding) {
        this.bindings.delete(element2);
        untrack(element2, this.getBindingPath(element2));
        destroy(binding);
        releaseDomBinding(element2, flush);
      }
    }
    destroy() {
      for (const element2 of this.bindings.keys()) {
        this.releaseBinding(element2);
      }
      this.observer?.disconnect();
      this.observer = null;
      clearTimeout(this.#idleTimer);
      this.#idleTimer = null;
      this.#resolveIdleWaiters();
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

  // ../model/src/index.mjs
  var src_exports2 = {};
  __export(src_exports2, {
    columns: () => columns,
    filter: () => filter,
    model: () => model,
    paging: () => paging,
    scroll: () => scroll,
    sort: () => sort
  });
  var destroyedModels = /* @__PURE__ */ new WeakSet();
  var SimplyFlowModel = class {
    /**
     * Creates a new datamodel, with a state property that contains
     * all the data passed to this constructor
     * @param state	Object with all the data for this model
     * @throws Error if state is not set
     */
    constructor(state) {
      if (!state) {
        throw new Error("no options set");
      }
      if (state.data == null || typeof state.data[Symbol.iterator] !== "function") {
        console.warn("SimplyFlowModel: options.data is not iterable");
      }
      this.state = signal(state);
      if (!this.state.options) {
        this.state.options = {};
      }
      this.view = effect(() => this.state.data);
      this.effects = [this.view];
    }
    /**
     * Adds an effect to run whenever a signal it depends on
     * changes. this.state is the usual signal.
     * The `fn` function param is not itself an effect, but must return
     * and effect function. `fn` takes one param, which is the data signal.
     * This signal will always have at least a `current` property.
     * The result of the effect function is pushed on to the this.effects
     * list. And the last effect added is set as this.view
     */
    addEffect(fn) {
      if (destroyedModels.has(raw(this))) {
        throw new Error("simplyflow/model: cannot add an effect to a destroyed model");
      }
      if (!fn || typeof fn !== "function") {
        throw new Error("addEffect requires an effect function as its parameter", { cause: fn });
      }
      const dataSignal = this.effects[this.effects.length - 1];
      const connectedSignal = fn.call(this, dataSignal);
      if (!isSignal(connectedSignal)) {
        throw new Error("addEffect function parameter must return a Signal", { cause: fn });
      }
      this.view = connectedSignal;
      this.effects.push(this.view);
    }
    destroy() {
      if (destroyedModels.has(raw(this))) {
        return;
      }
      destroyedModels.add(raw(this));
      for (const output of this.effects.toReversed()) {
        destroy(output);
      }
    }
  };
  function model(options) {
    return new SimplyFlowModel(options);
  }
  function sort(options = {}) {
    return function(data) {
      this.state.options.sort = Object.assign({
        direction: "asc",
        sortBy: null,
        sortFn: (a, b) => {
          const sort2 = this.state.options.sort;
          const sortBy = sort2.sortBy;
          if (!sort2.sortBy) {
            return 0;
          }
          const direction = sort2.sortDirection || sort2.direction || "asc";
          const larger = direction == "asc" ? 1 : -1;
          const smaller = direction == "asc" ? -1 : 1;
          if (typeof a?.[sortBy] === "undefined") {
            if (typeof b?.[sortBy] === "undefined") {
              return 0;
            }
            return larger;
          }
          if (typeof b?.[sortBy] === "undefined") {
            return smaller;
          }
          if (a[sortBy] < b[sortBy]) {
            return smaller;
          } else if (a[sortBy] > b[sortBy]) {
            return larger;
          } else {
            return 0;
          }
        }
      }, options);
      return throttledEffect(() => {
        const sort2 = this.state.options.sort;
        const direction = sort2?.sortDirection || sort2?.direction;
        if (sort2?.sortBy && direction) {
          const trackedSortFn = sort2.sortFn;
          const sortFn = raw(sort2).sortFn || trackedSortFn;
          return data.current.toSorted((a, b) => sortFn.call(this, a, b));
        }
        return data.current;
      }, 50);
    };
  }
  function paging(options = {}) {
    return function(data) {
      this.state.options.paging = Object.assign({
        page: 1,
        pageSize: 20,
        max: 1
      }, options);
      return throttledEffect(() => {
        return batch(() => {
          const paging2 = this.state.options.paging;
          if (!paging2.pageSize) {
            paging2.pageSize = 20;
          }
          paging2.max = Math.ceil(data.current.length / paging2.pageSize);
          paging2.page = Math.max(1, Math.min(paging2.max, paging2.page));
          const start = (paging2.page - 1) * paging2.pageSize;
          const end = start + paging2.pageSize;
          return data.current.slice(start, end);
        });
      }, 50);
    };
  }
  function filter(options) {
    if (!options?.name || typeof options.name !== "string") {
      throw new Error("filter requires options.name to be a string");
    }
    if (!options.matches || typeof options.matches !== "function") {
      throw new Error("filter requires options.matches to be a function");
    }
    return function(data) {
      if (this.state.options[options.name]) {
        throw new Error("a filter with this name already exists on this model");
      }
      this.state.options[options.name] = options;
      return throttledEffect(() => {
        const filterOptions = this.state.options[options.name];
        if (filterOptions.enabled) {
          const trackedMatches = filterOptions.matches;
          const matches = raw(filterOptions).matches || trackedMatches;
          return data.current.filter((row) => matches.call(this, row));
        }
        return data.current;
      }, 50);
    };
  }
  function columns(options = {}) {
    const columnOptions = options?.columns && typeof options.columns === "object" ? options.columns : options;
    if (!columnOptions || typeof columnOptions !== "object" || Object.keys(columnOptions).length === 0) {
      throw new Error("columns requires options to be an object with at least one property");
    }
    return function(data) {
      this.state.options.columns = columnOptions;
      const projections = /* @__PURE__ */ new WeakMap();
      return throttledEffect(() => {
        const visibleKeys = [];
        const visible = /* @__PURE__ */ new Set();
        const columns2 = this.state.options.columns;
        for (let key of Object.keys(columns2)) {
          if (columns2[key]?.visible !== false) {
            visibleKeys.push(key);
            visible.add(key);
          }
        }
        return data.current.map((input2) => {
          const source = raw(input2);
          let result = source && typeof source === "object" ? projections.get(source) : null;
          if (!result) {
            result = {};
            if (source && typeof source === "object") {
              projections.set(source, result);
            }
          }
          for (let key of visibleKeys) {
            const value = input2?.[key] ?? null;
            if (result[key] !== value) {
              result[key] = value;
            }
          }
          for (let key of Object.keys(result)) {
            if (!visible.has(key)) {
              delete result[key];
            }
          }
          return result;
        });
      }, 50);
    };
  }
  function scroll(options) {
    return function(data) {
      this.state.options.scroll = Object.assign({
        offset: 0,
        rowHeight: 26,
        rowCount: 20,
        itemsPerRow: 1,
        size: data.current.length
      }, options);
      const scrollOptions = this.state.options.scroll;
      const scrollbar = scrollOptions.scrollbar || scrollOptions.container?.querySelector("[data-flow-scrollbar]");
      if (scrollbar) {
        if (scrollOptions.container) {
          scrollOptions.container.addEventListener("scroll", (evt) => {
            scrollOptions.offset = Math.floor(
              scrollOptions.container.scrollTop / (scrollOptions.rowHeight * scrollOptions.itemsPerRow)
            );
          });
        }
        throttledEffect(() => {
          scrollOptions.size = data.current.length * scrollOptions.rowHeight;
          scrollbar.style.height = scrollOptions.size + "px";
        }, 50);
      }
      return throttledEffect(() => {
        if (scrollOptions.container) {
          scrollOptions.rowCount = Math.ceil(
            scrollOptions.container.getBoundingClientRect().height / scrollOptions.rowHeight
          );
        }
        scrollOptions.data = data.current;
        let start = Math.min(scrollOptions.offset, data.current.length - 1);
        let end = start + scrollOptions.rowCount;
        if (end > data.current.length) {
          end = data.current.length;
          start = Math.max(0, end - scrollOptions.rowCount);
        }
        return data.current.slice(start, end);
      }, 50);
    };
  }

  // src/render.mjs
  var SimplyRender = class extends HTMLElement {
    connectedCallback() {
      let templateId = this.getAttribute("rel");
      let template = document.getElementById(templateId);
      if (template) {
        this.render(template, this);
      } else {
        const observe = () => {
          const observer = new MutationObserver(() => {
            template = document.getElementById(templateId);
            if (template) {
              observer.disconnect();
              this.replaceWith(this);
            }
          });
          observer.observe(globalThis.document, {
            subtree: true,
            childList: true
          });
        };
        observe();
      }
    }
    render(template, previous) {
      const content = template.content;
      const hasRootText = Array.from(content.childNodes).some(
        (node) => node.nodeType === Node.TEXT_NODE && /[^\t\n\f\r ]/.test(node.data)
      );
      if (content.childElementCount !== 1 || hasRootText) {
        throw new Error(
          `simplyflow/render: template "${template.id}" must contain a single root element`,
          { cause: template }
        );
      }
      const root = content.firstElementChild.cloneNode(true);
      for (const nested of root.querySelectorAll("template")) {
        nested.setAttribute("simply-render", "");
      }
      for (const attr of this.attributes) {
        if (attr.name !== "rel") {
          root.setAttribute(attr.name, attr.value);
        }
      }
      root.setAttribute("data-simply-template", template.id);
      root[DEP.TEMPLATE] = template;
      root[DEP.RERENDER] = () => this.render(template, root);
      previous.replaceWith(root);
    }
  };
  if (!customElements.get("simply-render")) {
    customElements.define("simply-render", SimplyRender);
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
      this.$handlers = options.handlers || [...defaultHandlers];
      Object.defineProperties(this, Object.getOwnPropertyDescriptors(options.commands || {}));
      const commandHandler = (evt) => {
        const command = getCommand(evt, this.$handlers, this.app);
        if (!command) {
          return;
        }
        const handler = Object.hasOwn(this, command.name) ? this[command.name] : void 0;
        if (typeof handler !== "function") {
          warnUnknownCommand(this, command.name, command.source);
          return;
        }
        const shouldContinue = handler.call(options.app, command.source, command.value, evt);
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
      Object.defineProperties(this, Object.getOwnPropertyDescriptors(options.shortcuts || {}));
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

  // ../app/src/dragdrop.mjs
  var sourceSelector = "[data-simply-drag]";
  var targetSelector = "[data-simply-drop]";
  var handleSelector = "[data-simply-drag-handle]";
  var metadataPrefix = "application/x-simplyflow-drag-meta-v1-";
  var maxMetadataBytes = 512;
  var nativeEffects = {
    none: [],
    copy: ["copy"],
    move: ["move"],
    link: ["link"],
    copyMove: ["copy", "move"],
    copyLink: ["copy", "link"],
    linkMove: ["move", "link"],
    all: ["copy", "link", "move"],
    uninitialized: ["copy", "link", "move"]
  };
  function encodeMetadata(meta2) {
    const bytes = new TextEncoder().encode(JSON.stringify(meta2));
    if (bytes.length > maxMetadataBytes) {
      throw new RangeError("Drag metadata exceeds 512 UTF-8 bytes");
    }
    return metadataPrefix + Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  function readMetadata(types) {
    const markers = types.filter((type) => type.startsWith(metadataPrefix));
    if (markers.length !== 1) return;
    const hex = markers[0].slice(metadataPrefix.length);
    if (!hex.length || hex.length > 2 * maxMetadataBytes || hex.length % 2 || /[^0-9a-f]/.test(hex)) return;
    try {
      const bytes = Uint8Array.from(hex.match(/../g), (byte) => Number.parseInt(byte, 16));
      const meta2 = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      if (meta2 && typeof meta2 === "object" && !Array.isArray(meta2)) return meta2;
    } catch {
    }
  }
  function dragdrop({ app: app2, container = app2.container, drags = {}, drops = {} }) {
    const document2 = container.ownerDocument;
    const listeners = new AbortController();
    let nativeSource;
    let touch;
    let preview;
    function listen(type, handler, options) {
      container.addEventListener(type, handler, { ...options, signal: listeners.signal });
    }
    function value(element2) {
      return element2.hasAttribute("data-simply-value-path") ? path_default.get(app2.data, element2.dataset.simplyValuePath) : element2.dataset.simplyValue;
    }
    function describe(source, event) {
      const name = source.dataset.simplyDrag;
      if (!Object.hasOwn(drags, name)) return;
      const description = drags[name].call(app2, source, value(source), event);
      if (!description) return;
      const { meta: meta2, data = {}, effects = ["copy"] } = description;
      const allowed = Object.keys(nativeEffects).find((key) => key !== "uninitialized" && nativeEffects[key].length === effects.length && nativeEffects[key].every((effect2) => effects.includes(effect2)));
      if (!allowed || allowed === "none") return;
      const formats = Object.fromEntries(Object.entries(data).map(([type, payload]) => {
        type = type.toLowerCase();
        if (type === "text") type = "text/plain";
        if (type === "url") type = "text/uri-list";
        if (type.startsWith(metadataPrefix) || typeof payload !== "string") {
          throw new TypeError("Drag data must map non-reserved formats to strings");
        }
        return [type, payload];
      }));
      if (meta2 !== void 0) formats[encodeMetadata(meta2)] = "1";
      return { formats, allowed };
    }
    function readDrag(types, allowed) {
      return {
        meta: readMetadata(types),
        types: types.filter((type) => !type.startsWith(metadataPrefix)),
        effects: nativeEffects[allowed] ?? nativeEffects.uninitialized
      };
    }
    function destination(node, drag, event, source, preferred) {
      let target = node?.closest?.(targetSelector);
      while (target && container.contains(target)) {
        const name = target.dataset.simplyDrop;
        const handler = Object.hasOwn(drops, name) ? drops[name] : void 0;
        if (typeof handler?.drop === "function") {
          const effects = drag.effects.filter((effect3) => !handler.effects || handler.effects.includes(effect3));
          const effect2 = [preferred, source ? "move" : "copy", ...effects].find((candidate) => effects.includes(candidate));
          if (effect2) {
            const targetValue = value(target);
            const context = { ...drag, effect: effect2 };
            const before = insertion(target, source, event);
            if (before !== void 0) context.before = before ? value(before) : null;
            if (!handler.accepts || handler.accepts.call(app2, target, targetValue, context, event) === true) {
              return { target, targetValue, handler, context, before };
            }
          }
        }
        target = target.parentElement?.closest(targetSelector);
      }
    }
    function insertion(target, source, event) {
      const axis = target.dataset.simplySort;
      if (axis !== "vertical" && axis !== "horizontal") return;
      const horizontal = axis === "horizontal";
      for (const card of target.children) {
        if (card === source || !card.matches(sourceSelector) || value(card) == null) continue;
        const rect = card.getBoundingClientRect();
        const midpoint = horizontal ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
        if ((horizontal ? event.clientX : event.clientY) < midpoint) return card;
      }
      return null;
    }
    function show(next) {
      if (preview?.target === next?.target && preview?.before === next?.before) return;
      preview?.target.removeAttribute("data-simply-drag-over");
      preview?.target.removeAttribute("data-simply-drop-end");
      preview?.before?.removeAttribute("data-simply-drop-before");
      preview = next;
      next?.target.setAttribute("data-simply-drag-over", "");
      if (next?.before === null) next.target.setAttribute("data-simply-drop-end", "");
      next?.before?.setAttribute("data-simply-drop-before", "");
    }
    function report(error, event) {
      if (app2.onError) app2.onError.call(app2, error, event);
      else console.error(error);
    }
    function commit(match, data, event) {
      const { target, targetValue, handler, context } = match;
      try {
        const result = handler.drop.call(app2, target, targetValue, { ...context, data }, event);
        Promise.resolve(result).catch((error) => report(error, event));
      } catch (error) {
        report(error, event);
      }
    }
    function nativeTarget(event) {
      const dt = event.dataTransfer;
      if (!dt) return;
      const drag = readDrag(Array.from(dt.types), dt.effectAllowed);
      const preferred = event.ctrlKey ? "copy" : event.shiftKey ? "move" : dt.dropEffect;
      return destination(event.target, drag, event, nativeSource, preferred);
    }
    function nativeHover(event) {
      const match = nativeTarget(event);
      show(match);
      if (!match) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = match.context.effect;
    }
    function cancel() {
      const previous = touch;
      touch = void 0;
      nativeSource = void 0;
      show();
      if (previous?.handle.hasPointerCapture(previous.id)) {
        previous.handle.releasePointerCapture(previous.id);
      }
    }
    listen("dragstart", (event) => {
      const source = event.target.closest?.(sourceSelector);
      if (!source || !container.contains(source) || !event.dataTransfer) return;
      if (!Object.hasOwn(drags, source.dataset.simplyDrag)) return;
      cancel();
      try {
        const description = describe(source, event);
        if (!description) {
          event.preventDefault();
          return;
        }
        const dt = event.dataTransfer;
        dt.clearData();
        for (const [type, payload] of Object.entries(description.formats)) dt.setData(type, payload);
        dt.effectAllowed = description.allowed;
        nativeSource = source;
      } catch (error) {
        event.preventDefault();
        report(error, event);
      }
    });
    listen("dragenter", nativeHover);
    listen("dragover", nativeHover);
    listen("dragleave", (event) => {
      if (!preview?.target.contains(event.relatedTarget)) show();
    });
    listen("drop", (event) => {
      const match = nativeTarget(event);
      cancel();
      if (!match) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = match.context.effect;
      const data = Object.fromEntries(match.context.types.filter((type) => type !== "Files").map((type) => [type, event.dataTransfer.getData(type)]));
      commit(match, data, event);
    });
    document2.addEventListener("dragend", cancel, { signal: listeners.signal });
    listen("pointerdown", (event) => {
      if (event.pointerType !== "touch" || !event.isPrimary || touch) return;
      const handle = event.target.closest?.(handleSelector);
      const source = handle?.closest(sourceSelector);
      if (!source || !container.contains(source)) return;
      if (!Object.hasOwn(drags, source.dataset.simplyDrag)) return;
      handle.setPointerCapture(event.pointerId);
      touch = { handle, source, id: event.pointerId, x: event.clientX, y: event.clientY };
    });
    function touchTarget(event) {
      const node = document2.elementFromPoint(event.clientX, event.clientY);
      return destination(node, touch.drag, event, touch.source, "move");
    }
    listen("pointermove", (event) => {
      if (touch?.id !== event.pointerId) return;
      if (!touch.drag) {
        if (Math.hypot(event.clientX - touch.x, event.clientY - touch.y) < 6) return;
        try {
          const description = describe(touch.source, event);
          if (!description) return cancel();
          touch.drag = readDrag(Object.keys(description.formats), description.allowed);
          touch.data = Object.fromEntries(touch.drag.types.map((type) => [type, description.formats[type]]));
        } catch (error) {
          cancel();
          report(error, event);
          return;
        }
      }
      event.preventDefault();
      show(touchTarget(event));
    });
    listen("pointerup", (event) => {
      if (touch?.id !== event.pointerId) return;
      const match = touch.drag && touchTarget(event);
      const data = touch.data;
      cancel();
      if (match) commit(match, data, event);
    });
    for (const type of ["pointercancel", "lostpointercapture"]) {
      listen(type, (event) => {
        if (touch?.id === event.pointerId) cancel();
      });
    }
    listen("keydown", (event) => {
      if (event.key === "Escape") cancel();
    });
    return {
      cancel,
      destroy() {
        listeners.abort();
        cancel();
      }
    };
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
    const clone2 = globalThis.document.createElement("script");
    for (const attr of script.attributes) {
      clone2.setAttribute(attr.name, attr.value);
    }
    clone2.removeAttribute("data-simply-location");
    if (clone2.hasAttribute("src")) {
      clone2.src = rebaseHref(clone2.getAttribute("src"), base, cacheBuster);
    } else {
      clone2.textContent = script.textContent;
    }
    return clone2;
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
        const clone2 = cloneScript(script, base, this.cacheBuster);
        const node = this.scriptLocations[script.dataset.simplyLocation];
        if (!node?.parentNode) {
          continue;
        }
        const waitForLoad = shouldWaitForScript(clone2);
        if (waitForLoad) {
          clone2.async = false;
          await insertAndWaitForScript(clone2, node);
        } else {
          insertScript(clone2, node);
        }
      }
    }
    html(html2, link) {
      const fragment = globalThis.document.createRange().createContextualFragment(html2);
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
          const html2 = await response.text();
          if (this.destroyed || !link.parentNode) {
            continue;
          }
          this.html(html2, link);
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
  var defaultInclude = () => new SimplyIncludes({
    container: globalThis.document,
    cacheBuster: defaultCacheBuster,
    observe: false
  });
  var include = {
    get cacheBuster() {
      return defaultCacheBuster;
    },
    set cacheBuster(value) {
      defaultCacheBuster = value;
    },
    scripts: (scripts, base) => defaultInclude().scripts(scripts, base),
    html: (html2, link) => defaultInclude().html(html2, link),
    links: (links) => defaultInclude().includeLinks(Array.from(links))
  };

  // ../app/src/composition.mjs
  function* componentDefinitions(components) {
    for (const name of Object.keys(components)) {
      if (name === "app") {
        throw new Error('simplyflow/app: component name "app" is reserved for the top-level app definition');
      }
      const definition = components[name];
      if (!definition) {
        continue;
      }
      if (definition.components) {
        yield* componentDefinitions(definition.components);
      }
      yield [name, definition];
    }
  }
  function isRecord(value) {
    if (!value || typeof value !== "object") {
      return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || prototype === Object.prototype;
  }
  var registryKey = Symbol.for("@muze-labs/simplyflow.mergeableMaps");
  var markedMaps = globalThis[registryKey] ??= /* @__PURE__ */ new WeakSet();
  var sections = /* @__PURE__ */ new Set([
    "actions",
    "behaviors",
    "commands",
    "drags",
    "drops",
    "routes",
    "shortcuts",
    "styles",
    "templates",
    "transformers"
  ]);
  var groupedSections = /* @__PURE__ */ new Set(["drops", "shortcuts", "transformers"]);
  function mergeable(object) {
    if (!isRecord(object)) {
      throw new TypeError("simplyflow/app: mergeable() expects an object literal or a null-prototype map");
    }
    mapDescriptors(object);
    markedMaps.add(object);
    return object;
  }
  function childShape(shape, key) {
    if (shape === "app" && sections.has(key)) {
      return groupedSections.has(key) ? "groups" : "map";
    }
    if (shape === "groups") {
      return "map";
    }
  }
  function composes(value, shape) {
    return markedMaps.has(value) || shape && isRecord(value);
  }
  function mapDescriptors(source) {
    const descriptors = Object.getOwnPropertyDescriptors(source);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (!descriptors[key].configurable) {
        throw new TypeError(`simplyflow/app: cannot compose non-configurable property "${String(key)}" in an editable map`);
      }
    }
    return descriptors;
  }
  function mergeDescriptor(previous, next, shape, seen = /* @__PURE__ */ new WeakMap()) {
    if (!composes(previous?.value, shape) || !composes(next.value, shape) || previous.value === next.value) {
      return next;
    }
    const earlier = previous.value;
    const later = next.value;
    let pairs = seen.get(earlier);
    if (!pairs) {
      pairs = /* @__PURE__ */ new WeakMap();
      seen.set(earlier, pairs);
    }
    if (pairs.has(later)) {
      return { ...next, value: pairs.get(later) };
    }
    const merged = Object.create(Object.getPrototypeOf(later), mapDescriptors(earlier));
    pairs.set(later, merged);
    markedMaps.add(merged);
    const entries = mapDescriptors(later);
    for (const key of Reflect.ownKeys(entries)) {
      const previous2 = Object.getOwnPropertyDescriptor(merged, key);
      Object.defineProperty(
        merged,
        key,
        mergeDescriptor(previous2, entries[key], childShape(shape, key), seen)
      );
    }
    return { ...next, value: merged };
  }
  function dataProperty(value) {
    return { value, enumerable: true, writable: true, configurable: true };
  }
  function cloneComponentData(source) {
    const copy = structuredClone(source);
    function markDataMap(original, cloned) {
      if (markedMaps.has(cloned)) {
        return;
      }
      markedMaps.add(cloned);
      for (const key of Object.keys(cloned)) {
        const child = Object.getOwnPropertyDescriptor(original, key)?.value;
        if (markedMaps.has(child)) {
          markDataMap(child, cloned[key]);
        }
      }
    }
    if (isRecord(source)) {
      markDataMap(source, copy);
    }
    return copy;
  }
  function copyMap(source, shape, seen = /* @__PURE__ */ new WeakMap()) {
    if (seen.has(source)) {
      return seen.get(source);
    }
    const copy = Object.create(Object.getPrototypeOf(source));
    seen.set(source, copy);
    const descriptors = mapDescriptors(source);
    for (const key of Reflect.ownKeys(descriptors)) {
      const descriptor = descriptors[key];
      const nestedShape = childShape(shape, key);
      if (composes(descriptor.value, nestedShape)) {
        descriptor.value = copyMap(descriptor.value, nestedShape, seen);
      }
    }
    seen.delete(source);
    return Object.defineProperties(copy, descriptors);
  }
  function composeApp(definition) {
    const { data, components: suppliedComponents } = definition;
    const authored = Object.getOwnPropertyDescriptors(definition);
    delete authored.data;
    const components = { ...suppliedComponents };
    if (suppliedComponents != null) {
      authored.components = dataProperty({ ...components });
    } else {
      delete authored.components;
    }
    const appDefinition = Object.create(Object.getPrototypeOf(definition), authored);
    const definitions = [...componentDefinitions(components), ["app", appDefinition]];
    const descriptors = /* @__PURE__ */ Object.create(null);
    let initialData;
    for (const [name, source] of definitions) {
      if (!Object.hasOwn(components, name)) {
        Object.defineProperty(components, name, dataProperty(source));
      }
      if (Object.hasOwn(source, "data")) {
        const defaults = source.data;
        if (defaults != null) {
          initialData = mergeDescriptor(
            initialData,
            dataProperty(cloneComponentData(defaults)),
            "map"
          );
        }
      }
      for (const key of Reflect.ownKeys(source)) {
        if (["components", "data", "__proto__", "prototype"].includes(key) || name !== "app" && ["start", "destroy", "onError"].includes(key)) {
          continue;
        }
        const entry = Object.getOwnPropertyDescriptor(source, key);
        if (entry.value === null && suppliedComponents || sections.has(key) && "value" in entry && entry.value == null) {
          continue;
        }
        descriptors[key] = mergeDescriptor(descriptors[key], entry, childShape("app", key));
      }
    }
    for (const section of sections) {
      descriptors[section] ??= dataProperty(/* @__PURE__ */ Object.create(null));
    }
    const container = descriptors.container;
    if (!container || "value" in container && !container.value) {
      descriptors.container = dataProperty(document.body);
    }
    if (data != null) {
      initialData = mergeDescriptor(initialData, dataProperty(data), "map");
    }
    const options = copyMap(Object.create(null, descriptors), "app");
    return { data: initialData?.value, options, components };
  }

  // ../app/src/index.mjs
  var APP_OPTIONS = [
    "container",
    "data",
    "attribute",
    "templates",
    "styles",
    "start",
    "destroy",
    "onError",
    "components",
    "behaviors",
    "baseURL",
    "commands",
    "drags",
    "drops",
    "shortcuts",
    "routes",
    "actions",
    "transformers"
  ];
  var runtimeProperties = /* @__PURE__ */ new Set([
    "commands",
    "actions",
    "shortcuts",
    "routes",
    "behaviors",
    "binding",
    "dragdrop",
    "includes",
    "accesskeys",
    "destroy"
  ]);
  var SimplyApp = class {
    constructor(definition = {}) {
      const { data, options, components } = composeApp(definition);
      const app2 = this;
      const { container } = options;
      this.data = signal(data || {});
      this.components = components;
      this.destroyed = false;
      for (const key of Reflect.ownKeys(options)) {
        if (runtimeProperties.has(key) || key in this) {
          continue;
        }
        if (typeof key === "string" && !APP_OPTIONS.includes(key)) {
          warnLikelyOptionTypo(key);
        }
        Object.defineProperty(this, key, Object.getOwnPropertyDescriptor(options, key));
      }
      installMarkup(container, options.templates, "template");
      installMarkup(container, options.styles, "style");
      this.commands = commands({ app: app2, commands: options.commands });
      this.actions = actions({ app: app2, actions: options.actions });
      this.shortcuts = shortcuts({ app: app2, shortcuts: options.shortcuts });
      this.routes = routes({ app: app2, routes: options.routes });
      this.behaviors = behaviors({ app: app2, container, behaviors: options.behaviors });
      this.binding = bind({
        root: this.data,
        container,
        attribute: options.attribute || "data-simply",
        app: app2
      });
      this.dragdrop = dragdrop({ app: app2, drags: options.drags, drops: options.drops });
      this.includes = includes({ container });
      this.accesskeys = accesskeys({ app: app2, container });
      const {
        binding,
        commands: commandApi,
        shortcuts: shortcutApi,
        accesskeys: keys,
        routes: router,
        behaviors: behaviorApi,
        dragdrop: dragApi,
        includes: includeApi
      } = this;
      this.destroy = () => {
        if (this.destroyed) return;
        this.destroyed = true;
        const dispose = [
          () => {
            const destroy2 = options.destroy;
            if (typeof destroy2 === "function") {
              destroy2.call(this);
            }
          },
          () => dragApi.destroy(),
          () => binding.destroy(),
          () => destroyCommands(commandApi),
          () => destroyShortcuts(shortcutApi),
          () => destroyAccesskeys(keys),
          () => router.destroy(),
          () => behaviorApi.destroy(),
          () => includeApi.destroy()
        ];
        const errors = [];
        for (const cleanup of dispose) {
          try {
            cleanup();
          } catch (error) {
            errors.push(error);
          }
        }
        this.binding = void 0;
        this.routes = void 0;
        this.behaviors = void 0;
        this.includes = void 0;
        this.accesskeys = void 0;
        if (errors.length === 1) throw errors[0];
        if (errors.length > 1) {
          throw new AggregateError(errors, "simplyflow/app: multiple cleanups failed");
        }
      };
    }
    get app() {
      return this;
    }
  };
  function installMarkup(container, definitions, tag) {
    for (const name of Object.keys(definitions)) {
      const id = tag === "style" ? name + ".css" : name;
      let node = Array.from(container.querySelectorAll(tag)).find((node2) => node2.id === id);
      if (!node) {
        node = document.createElement(tag);
        node.id = id;
        container.appendChild(node);
      }
      if (tag === "template") {
        node.innerHTML = definitions[name];
      } else {
        node.textContent = definitions[name];
      }
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
    const router = app2.routes;
    if (typeof router?.handleEvents === "function") {
      if (app2.baseURL) {
        router.init({ baseURL: app2.baseURL });
      }
      router.handleEvents();
      globalThis.setTimeout(() => {
        if (app2.destroyed || app2.routes !== router) {
          return;
        }
        if (router.has(globalThis.location?.hash)) {
          router.match(globalThis.location.hash);
        } else {
          router.match(globalThis.location?.pathname + globalThis.location?.hash);
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

  // ../app/src/highlight.mjs
  function html(strings, ...values) {
    const outputArray = values.map(
      (value, index) => `${strings[index]}${value}`
    );
    return outputArray.join("") + strings[strings.length - 1];
  }
  function css(strings, ...values) {
    return html(strings, ...values);
  }

  // src/index.mjs
  if (!globalThis.simply) {
    globalThis.simply = {};
  }
  globalThis.html = html;
  globalThis.css = css;
  var modelApi = Object.assign(model, {
    model,
    sort,
    paging,
    filter,
    columns,
    scroll
  });
  Object.assign(globalThis.simply, {
    app,
    mergeable,
    bind,
    model: modelApi,
    state: src_exports,
    signal,
    effect,
    batch,
    clone,
    destroy,
    untracked,
    throttledEffect,
    clockEffect,
    createSignal,
    isSignal,
    raw,
    dom: dom_exports,
    behaviors,
    actions,
    commands,
    include,
    includes,
    shortcuts,
    path: path_default,
    routes
  });
  delete globalThis.simply.advanced;
  var index_default = globalThis.simply;
})();
