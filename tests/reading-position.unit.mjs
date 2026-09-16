import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// These are deterministic source-logic checks, not layout or browser coverage.
// Evaluate the actual page functions/listeners with a controlled clock and DOM
// measurements; do not maintain a second implementation of the scroll logic.
const source = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function sourceBlock(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
  assert.equal(source.lastIndexOf(startMarker), start, `Ambiguous source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert.ok(end > start, `Missing ending source marker: ${endMarker}`);
  return source.slice(start, end);
}

const readingSource = sourceBlock('    let readingTimer = null;', '    function clearClosingTimer(card) {');
const printSource = sourceBlock('    let printCardStates = null;', '  </script>');

function makeCard({ top = 20, bottom = 52, open = true, closing = false } = {}) {
  const classes = new Set(closing ? ['is-closing'] : []);
  return {
    open,
    classes,
    classList: {
      contains: name => classes.has(name),
      remove: (...names) => names.forEach(name => classes.delete(name)),
    },
    querySelector(selector) {
      assert.equal(selector, '.card-title');
      return { getBoundingClientRect: () => ({ top, bottom }) };
    },
  };
}

function harness({ reducedMotion = true, cards = [] } = {}) {
  const timers = new Map();
  const frames = new Map();
  const listeners = new Map();
  const scrolls = [];
  let nextId = 1;
  let now = 0;
  let navUpdates = 0;
  let closingClears = 0;
  const window = {
    innerHeight: 900,
    setTimeout(callback, delay) {
      const id = nextId++;
      timers.set(id, { callback, delay, at: now + delay });
      return id;
    },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame(callback) {
      const id = nextId++;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame: id => frames.delete(id),
    matchMedia(query) {
      assert.equal(query, '(prefers-reduced-motion: reduce)');
      return { matches: reducedMotion };
    },
    scrollBy({ top, behavior }) { scrolls.push({ top, behavior }); },
    addEventListener(type, callback, options) {
      const handlers = listeners.get(type) ?? [];
      handlers.push({ callback, options });
      listeners.set(type, handlers);
    },
  };
  const context = vm.createContext({
    window,
    document: {
      querySelector(selector) {
        assert.equal(selector, '.topbar');
        return { getBoundingClientRect: () => ({ bottom: 66 }) };
      },
    },
    cards,
    clearClosingTimer() { closingClears++; },
    queueActiveNavUpdate() { navUpdates++; },
  });
  vm.runInContext(`${readingSource}\n${printSource}`, context, {
    filename: 'index.html:reading-position-and-print',
    timeout: 1000,
  });

  return {
    timers, frames, listeners, scrolls,
    keep: card => context.keepHeadingVisible(card),
    get navUpdates() { return navUpdates; },
    get closingClears() { return closingClears; },
    dispatch(type, event = {}) {
      assert.ok(listeners.has(type), `Missing actual page listener: ${type}`);
      for (const { callback } of listeners.get(type)) callback(event);
    },
    advanceTimers(milliseconds) {
      const target = now + milliseconds;
      while (true) {
        const next = [...timers.entries()]
          .filter(([, timer]) => timer.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        const [id, timer] = next;
        timers.delete(id);
        now = timer.at;
        timer.callback();
      }
      now = target;
    },
    runFrame() {
      const pending = [...frames.entries()];
      for (const [id, callback] of pending) {
        if (!frames.delete(id)) continue;
        callback(now);
      }
    },
  };
}

let passed = 0;
function check(name, run) {
  run();
  passed++;
  console.log(`PASS ${name}`);
}

check('reduced motion queues one frame and corrects an obscured heading', () => {
  const h = harness();
  h.keep(makeCard());
  assert.equal(h.timers.size, 0);
  assert.equal(h.frames.size, 1);
  assert.deepEqual(h.scrolls, []);
  h.runFrame();
  assert.deepEqual(h.scrolls, [{ top: -58, behavior: 'instant' }]);
  assert.equal(h.navUpdates, 1);
  assert.equal(h.frames.size, 0);
});

for (const [name, box] of [
  ['top safe boundary', { top: 78, bottom: 110 }],
  ['bottom safe boundary', { top: 852, bottom: 884 }],
]) {
  check(`visible heading at ${name} does not scroll`, () => {
    const h = harness();
    h.keep(makeCard(box));
    h.runFrame();
    assert.deepEqual(h.scrolls, []);
    assert.equal(h.navUpdates, 1);
  });
}

check('a heading overflowing the viewport bottom moves below navigation', () => {
  const h = harness();
  h.keep(makeCard({ top: 870, bottom: 902 }));
  h.runFrame();
  assert.deepEqual(h.scrolls, [{ top: 792, behavior: 'instant' }]);
});

for (const state of ['closed', 'closing']) {
  check(`a card becoming ${state} before its frame skips adjustment`, () => {
    const h = harness();
    const card = makeCard();
    h.keep(card);
    if (state === 'closed') card.open = false;
    else card.classes.add('is-closing');
    h.runFrame();
    assert.deepEqual(h.scrolls, []);
    assert.equal(h.navUpdates, 0);
  });
}

check('normal motion waits 500 ms and then a frame before adjustment', () => {
  const h = harness({ reducedMotion: false });
  h.keep(makeCard());
  assert.equal(h.timers.size, 1);
  assert.equal([...h.timers.values()][0].delay, 500);
  assert.equal(h.frames.size, 0);
  h.advanceTimers(499);
  assert.equal(h.frames.size, 0);
  assert.deepEqual(h.scrolls, []);
  h.advanceTimers(1);
  assert.equal(h.timers.size, 0);
  assert.equal(h.frames.size, 1);
  assert.deepEqual(h.scrolls, []);
  h.runFrame();
  assert.deepEqual(h.scrolls, [{ top: -58, behavior: 'instant' }]);
});

check('a new selection cancels the previous delayed callback', () => {
  const h = harness({ reducedMotion: false });
  h.keep(makeCard({ top: -200, bottom: -168 }));
  h.advanceTimers(250);
  h.keep(makeCard({ top: 40, bottom: 72 }));
  assert.equal(h.timers.size, 1);
  h.advanceTimers(250);
  assert.equal(h.frames.size, 0);
  h.advanceTimers(250);
  assert.equal(h.frames.size, 1);
  h.runFrame();
  assert.deepEqual(h.scrolls, [{ top: -38, behavior: 'instant' }]);
});

check('a new selection cancels the previous queued frame', () => {
  const h = harness();
  h.keep(makeCard({ top: -200, bottom: -168 }));
  h.keep(makeCard({ top: 40, bottom: 72 }));
  assert.equal(h.frames.size, 1);
  h.runFrame();
  assert.deepEqual(h.scrolls, [{ top: -38, behavior: 'instant' }]);
});

for (const type of ['wheel', 'touchstart', 'pointerdown']) {
  for (const reducedMotion of [false, true]) {
    check(`${type} cancels a pending ${reducedMotion ? 'frame' : 'timer'}`, () => {
      const h = harness({ reducedMotion });
      h.keep(makeCard());
      assert.equal(h.listeners.get(type)[0].options.passive, true);
      h.dispatch(type);
      assert.equal(h.timers.size, 0);
      assert.equal(h.frames.size, 0);
      h.advanceTimers(1000);
      h.runFrame();
      assert.deepEqual(h.scrolls, []);
      assert.equal(h.navUpdates, 0);
    });
  }
}

for (const key of ['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', 'Tab', ' ']) {
  check(`keyboard ${JSON.stringify(key)} cancels pending reading adjustment`, () => {
    for (const reducedMotion of [false, true]) {
      const h = harness({ reducedMotion });
      h.keep(makeCard());
      h.dispatch('keydown', { key });
      assert.equal(h.timers.size, 0);
      assert.equal(h.frames.size, 0);
      h.advanceTimers(1000);
      h.runFrame();
      assert.deepEqual(h.scrolls, []);
    }
  });
}

check('a non-navigation key leaves the reading adjustment scheduled', () => {
  const h = harness();
  h.keep(makeCard());
  h.dispatch('keydown', { key: 'Shift' });
  assert.equal(h.frames.size, 1);
  h.runFrame();
  assert.equal(h.scrolls.length, 1);
});

for (const reducedMotion of [false, true]) {
  check(`beforeprint cancels a pending ${reducedMotion ? 'frame' : 'timer'} and restores card state`, () => {
    const selected = makeCard();
    const closed = makeCard({ open: false });
    const closing = makeCard({ closing: true });
    const cards = [selected, closed, closing];
    const h = harness({ reducedMotion, cards });
    h.keep(selected);
    h.dispatch('beforeprint');
    assert.equal(h.timers.size, 0);
    assert.equal(h.frames.size, 0);
    assert.deepEqual(cards.map(card => card.open), [true, true, true]);
    assert.equal(h.closingClears, 3);
    h.advanceTimers(1000);
    h.runFrame();
    assert.deepEqual(h.scrolls, []);
    h.dispatch('beforeprint');
    assert.equal(h.closingClears, 3, 'Duplicate print start must preserve the original snapshot');
    h.dispatch('afterprint');
    assert.deepEqual(cards.map(card => card.open), [true, false, false]);
    assert.equal(h.navUpdates, 1);
    h.dispatch('afterprint');
    assert.equal(h.navUpdates, 1, 'Duplicate print end should have no effect');
  });
}

console.log(`\n${passed} reading-position source-logic checks passed (not browser layout coverage).`);
