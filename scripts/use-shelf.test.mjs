import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(readFileSync(new URL("../src/lib/useShelf.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

function setup() {
  const states = [];
  const effects = [];
  const listeners = new Map();
  const captured = new Set();
  let clock = 1000;
  let reduced = false;
  let disconnected = false;
  const shelf = {
    scrollLeft: 0, scrollWidth: 1200, clientWidth: 400, style: {},
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
    setPointerCapture: id => captured.add(id),
    hasPointerCapture: id => captured.has(id),
    releasePointerCapture: id => captured.delete(id),
    scrollBy: options => { shelf.lastScroll = options; },
  };
  const context = {
    exports: {},
    require: () => ({
      useRef: current => ({ current }),
      useState: initial => { const i = states.push(initial) - 1; return [initial, value => { states[i] = typeof value === "function" ? value(states[i]) : value; }]; },
      useEffect: fn => effects.push(fn),
    }),
    performance: { now: () => clock },
    matchMedia: () => ({ matches: reduced }),
    requestAnimationFrame: fn => { fn(); return 1; },
    cancelAnimationFrame: () => {},
    ResizeObserver: class { observe() {} disconnect() { disconnected = true; } },
  };
  runInNewContext(source, context);
  const hook = context.exports.useShelf(10);
  hook.ref.current = shelf;
  const cleanups = effects.map(fn => fn());
  const pointer = (overrides = {}) => ({ currentTarget: shelf, pointerId: 1, pointerType: "mouse", button: 0, clientX: 300, clientY: 20, preventDefault() { this.prevented = true; }, ...overrides });
  const click = (detail = 1) => ({ detail, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } });
  return { hook, shelf, states, pointer, click, captured, listeners, advance: () => { clock += 400; }, reduce: () => { reduced = true; }, cleanup: () => { cleanups.forEach(fn => fn?.()); return disconnected; } };
}

test("arrows track start, middle, end and non-overflow shelves", () => {
  const s = setup();
  assert.equal(s.states[0].previous, false);
  assert.equal(s.states[0].next, true);
  s.shelf.scrollLeft = 350; s.listeners.get("scroll")();
  assert.equal(s.states[0].previous, true); assert.equal(s.states[0].next, true);
  s.shelf.scrollLeft = 799; s.listeners.get("scroll")();
  assert.equal(s.states[0].next, false);
  s.shelf.scrollWidth = 400; s.shelf.scrollLeft = 0; s.listeners.get("scroll")();
  assert.equal(s.states[0].previous, false); assert.equal(s.states[0].next, false);
});
test("arrows move 80% of viewport and honor reduced motion", () => {
  const s = setup(); s.hook.scroll(1);
  assert.equal(s.shelf.lastScroll.left, 320); assert.equal(s.shelf.lastScroll.behavior, "smooth");
  s.reduce(); s.hook.scroll(-1);
  assert.equal(s.shelf.lastScroll.left, -320); assert.equal(s.shelf.lastScroll.behavior, "auto");
});
test("mouse drag crosses threshold, captures, moves, cleans up and suppresses click", () => {
  const s = setup(); s.hook.handlers.onPointerDown(s.pointer());
  s.hook.handlers.onPointerMove(s.pointer({ clientX: 296 }));
  assert.equal(s.shelf.scrollLeft, 0); assert.equal(s.captured.size, 0);
  s.hook.handlers.onPointerMove(s.pointer({ clientX: 180 }));
  assert.equal(s.shelf.scrollLeft, 120); assert.equal(s.states[1], true); assert.equal(s.captured.has(1), true);
  assert.equal(s.shelf.style.scrollSnapType, "none");
  s.hook.handlers.onPointerUp(s.pointer());
  assert.equal(s.states[1], false); assert.equal(s.captured.size, 0); assert.equal(s.shelf.style.scrollSnapType, "");
  const event = s.click(); s.hook.handlers.onClickCapture(event);
  assert.equal(event.prevented, true); assert.equal(event.stopped, true);
});
test("ordinary poster click and vertical mouse movement stay untouched", () => {
  const s = setup(); s.hook.handlers.onPointerDown(s.pointer());
  s.hook.handlers.onPointerMove(s.pointer({ clientX: 290, clientY: 60 }));
  s.hook.handlers.onPointerUp(s.pointer());
  const event = s.click(); s.hook.handlers.onClickCapture(event);
  assert.equal(event.prevented, undefined); assert.equal(s.shelf.scrollLeft, 0);
});
test("touch, pen and right mouse do not enter drag mode", () => {
  for (const overrides of [{ pointerType: "touch" }, { pointerType: "pen" }, { button: 2 }]) {
    const s = setup(); s.hook.handlers.onPointerDown(s.pointer(overrides));
    const event = s.pointer({ ...overrides, clientX: 100 }); s.hook.handlers.onPointerMove(event);
    assert.equal(s.shelf.scrollLeft, 0); assert.equal(event.prevented, undefined);
  }
});
test("pointer cancellation and lost capture restore snap and state", () => {
  for (const handler of ["onPointerCancel", "onLostPointerCapture"]) {
    const s = setup(); s.hook.handlers.onPointerDown(s.pointer()); s.hook.handlers.onPointerMove(s.pointer({ clientX: 100 }));
    s.hook.handlers[handler](s.pointer());
    assert.equal(s.states[1], false); assert.equal(s.shelf.style.scrollSnapType, ""); assert.equal(s.captured.size, 0);
  }
});
test("keyboard clicks remain allowed and suppression expires", () => {
  const s = setup(); s.hook.handlers.onPointerDown(s.pointer()); s.hook.handlers.onPointerMove(s.pointer({ clientX: 100 })); s.hook.handlers.onPointerUp(s.pointer());
  const key = s.click(0); s.hook.handlers.onClickCapture(key); assert.equal(key.prevented, undefined);
  s.advance(); const event = s.click(); s.hook.handlers.onClickCapture(event); assert.equal(event.prevented, undefined);
});
test("leaving before threshold cancels pending drag; unmount removes observers", () => {
  const s = setup(); s.hook.handlers.onPointerDown(s.pointer()); s.hook.handlers.onPointerLeave(); s.hook.handlers.onPointerMove(s.pointer({ clientX: 100 }));
  assert.equal(s.shelf.scrollLeft, 0); assert.equal(s.cleanup(), true); assert.equal(s.listeners.size, 0);
});
