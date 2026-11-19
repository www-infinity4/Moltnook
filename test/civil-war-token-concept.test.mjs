import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const concept = readFileSync(new URL('../concepts/civil-war-token/index.html', import.meta.url), 'utf8');
const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const inlineScripts = [...concept.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
const revealScript = inlineScripts.at(-1)?.[1];

test('Civil War token concept has a discoverable source and working homepage route', () => {
  assert.match(home, /href="concepts\/civil-war-token\/index\.html"/);
  assert.match(concept, /Staudinger/i);
  assert.match(concept, /116 Broadway/i);
  assert.match(concept, /E Pluribus Unum/i);
  assert.match(concept, /https:\/\/www\.proxibid\.com\/[^"\s]+/);
  assert.match(concept, /<title>[^<]+<\/title>/);
  assert.ok(revealScript, 'expected concept page reveal script');
});

test('Civil War token content remains visible without IntersectionObserver', () => {
  const visible = new Set();
  const element = { classList: { add(name) { visible.add(name); } }, style: {} };
  const document = { querySelectorAll(selector) {
    assert.equal(selector, '.fade-up');
    return [element];
  } };
  runInNewContext(revealScript, { document }, { timeout: 1000 });
  assert.ok(visible.has('visible'), 'fallback must reveal content on unsupported browsers');
});

test('Civil War token reveal observes elements when supported', () => {
  let observed = 0;
  const element = { classList: { add() {} }, style: {} };
  class Observer {
    constructor(callback) { assert.equal(typeof callback, 'function'); }
    observe() { observed++; }
    unobserve() {}
  }
  runInNewContext(revealScript, {
    document: { querySelectorAll() { return [element]; } },
    IntersectionObserver: Observer,
  }, { timeout: 1000 });
  assert.equal(observed, 1);
});
