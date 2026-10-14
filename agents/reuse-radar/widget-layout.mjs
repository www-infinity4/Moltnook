// Functional information-architecture inspiration, never a third-party skin.
// Ground every widget candidate in source and destination repository paths.
export const WIDGET_LAYOUT={
 pattern:'catalog-discovery -> filter/sort -> result cards -> detail viewer -> user actions',
 inspiration:'The useful organization of a modern marketplace such as eBay, NOT its brand, code, page assets or trade dress.',
 defaults:{design:'Oracle Octaves',surface:'#ffffff',paper:'#f7f4f0',ink:'#312722',button:'#b83b32',minTapPx:44,radiusPx:18},
 slots:['topic-heading','category-navigation','search-filter-sort','media-preview','source-and-metadata','card-actions','detail-or-player','empty-loading-error'],
 guardrails:[
  'Discover actual existing destination components; never invent file paths or deployed routes.',
  'Preserve existing QuantaPhi search, collect/share, StarCoin settlement and image/video players.',
  'Only use authentic sources, dates, receipts, and media which can legally be reused.',
  'No imitation marketplace branding, scraped account data, unauthorized API or copied trade dress.',
  'Review compact Android layout, contrast, keyboard interaction, labels, empty states and accessible 44px targets.',
  'Pink independently tests the source and suggested widget adaptation before Green proposes a patch; Purple checks full evidence.'
 ]
};
export function validWidgetBlueprint(plan,targetPaths=[]){
 if(!plan||typeof plan!=='object'||!Array.isArray(targetPaths)||!targetPaths.length)return false;
 const path=String(plan.targetPath||'');
 if(!targetPaths.includes(path)||!/\.(?:html|js|jsx|ts|tsx|css)$/.test(path))return false;
 const slots=Array.isArray(plan.slots)?plan.slots:[];
 if(slots.length<4||slots.length>8||new Set(slots).size!==slots.length||slots.some(s=>!WIDGET_LAYOUT.slots.includes(s)))return false;
 const action=String(plan.userAction||''),tests=String(plan.acceptance||''),source=String(plan.sourceFeature||'');
 if(action.length<12||tests.length<25||source.length<15)return false;
 if(/\b(?:eBay logo|copy eBay|clone eBay|scrape passwords|disable checkout verification)\b/i.test([action,tests,source].join(' ')))return false;
 if(!/\b(?:44|mobile|android|keyboard|accessib|touch|responsive)\b/i.test(tests))return false;
 return true;
}
export function widgetPlanSections(plan){
 return [
  '**Verified destination file:** `'+plan.targetPath+'`',
  '**Visible information layout:** '+plan.slots.join(' → '),
  '**Proposed user action:** '+plan.userAction,
  '**Existing reusable source:** '+plan.sourceFeature,
  '**Acceptance and mobile proof:** '+plan.acceptance
 ].join('\n\n');
}
