import {test} from 'node:test';import assert from 'node:assert/strict';
import {WIDGET_LAYOUT,validWidgetBlueprint,widgetPlanSections} from './widget-layout.mjs';
const paths=['src/components/WidgetCard.tsx','src/pages/index.html'];
const good={targetPath:paths[0],slots:['topic-heading','search-filter-sort','media-preview','source-and-metadata','card-actions','detail-or-player'],userAction:'Open a playable radio kit preview inside the viewer',sourceFeature:'Reuse existing repository card metadata and search components',acceptance:'Android responsive 44px buttons, keyboard focus, source link, empty state and playback proof'};
test('catalog reference gives bots actual design settings, not blind layout guesses',()=>{
 assert.equal(WIDGET_LAYOUT.defaults.design,'Oracle Octaves');
 assert.equal(WIDGET_LAYOUT.defaults.minTapPx,44);
 assert.ok(WIDGET_LAYOUT.slots.includes('search-filter-sort'));
 assert.ok(WIDGET_LAYOUT.guardrails.some(x=>/trade dress/i.test(x)));
 assert.equal(validWidgetBlueprint(good,paths),true);
 assert.match(widgetPlanSections(good),/Verified destination file/);
});
test('rejects invented target paths, missing UX slots and unsafe brand-clones',()=>{
 assert.equal(validWidgetBlueprint({...good,targetPath:'src/MadeUpWidget.tsx'},paths),false);
 assert.equal(validWidgetBlueprint({...good,slots:['media-preview']},paths),false);
 assert.equal(validWidgetBlueprint({...good,userAction:'Copy eBay logo and publish the same checkout'},paths),false);
 assert.equal(validWidgetBlueprint({...good,acceptance:'Works great'},paths),false);
 assert.equal(validWidgetBlueprint(good,[]),false);
});
test('existing reuse scheduler only opens model-reviewed source-grounded proposed widget jobs',async()=>{
 const fs=await import('node:fs/promises');
 const source=await fs.readFile(new URL('./runner.mjs',import.meta.url),'utf8');
 assert.match(source,/validWidgetBlueprint\(response\.widgetPlan,paths\[proposed\.target\]\)/);
 assert.match(source,/widgetPlanSections\(response\.widgetPlan\)/);
 assert.match(source,/targetPath to EXACTLY match/);
 assert.match(source,/\breport\.opened>=3\b/);
});
