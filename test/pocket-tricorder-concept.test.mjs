import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const page = readFileSync(new URL('../concepts/pocket-tricorder/index.html', import.meta.url), 'utf8');
const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const revealScript = [...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].at(-1)?.[1];

test('Pocket Tricorder concept is discoverable and distinguishes research from hardware', () => {
  assert.match(home, /href="concepts\/pocket-tricorder\/index\.html"/);
  assert.match(page, /OLED/i);
  assert.match(page, /magnetometry/i);
  assert.match(page, /barometer/i);
  assert.match(page, /https:\/\/www\.unsw\.edu\.au\/[^"\s]+/);
  assert.ok(revealScript, 'expected reveal script');
});

test('Pocket Tricorder content remains visible on browsers without IntersectionObserver', () => {
  const classes = new Set();
  const element = { classList: { add(name) { classes.add(name); } }, style: {} };
  runInNewContext(revealScript, {
    document: { querySelectorAll(selector) { assert.equal(selector, '.fade-up'); return [element]; } },
  }, { timeout: 1000 });
  assert.ok(classes.has('visible'));
});

test('Pocket Tricorder uses observer when available', () => {
  let observed = 0;
  class Observer {
    constructor(cb) { assert.equal(typeof cb, 'function'); }
    observe() { observed++; }
    unobserve() {}
  }
  runInNewContext(revealScript, {
    document: { querySelectorAll() { return [{ classList: { add() {} }, style: {} }]; } },
    IntersectionObserver: Observer,
  }, { timeout: 1000 });
  assert.equal(observed, 1);
});

test('Pocket Tricorder remains readable without JavaScript and on 320px screens', () => {
  assert.ok(page.includes('<noscript><style>.fade-up { opacity: 1 !important;'));
  assert.ok(page.includes('minmax(min(100%, 260px), 1fr)'));
  assert.ok(page.includes('overflow-wrap: anywhere'));
});

test('Pocket Tricorder separates phone sensors from accessory spectroscopy and OLED lab hardware', () => {
  assert.ok(page.includes('not a standard sensor already inside consumer phones'));
  assert.ok(page.includes('analysis needs a calibrated external spectrometer'));
  assert.ok(page.includes('microwave resonator and excitation'));
  assert.ok(page.includes('A normal OLED panel'));
});
