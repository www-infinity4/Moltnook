import test from 'node:test';
import assert from 'node:assert/strict';
import {safePath,applyEdits,inside,duplicateOnlyObjectEntries} from './patch.mjs';
test('source edits cannot traverse paths or mutate credentials ',()=>{
 for(const p of ['../file','/tmp/x','a/../../x','.git/config','.env','config/secrets.json','a\\b'])assert.throws(()=>safePath(p));
 assert.equal(safePath('.github/workflows/run.yml'),'.github/workflows/run.yml');
 assert.equal(inside('/tmp/repo','src/page.js'),'/tmp/repo/src/page.js');
});
test('engine binds edits to unique source and explicit new files',()=>{
 assert.deepEqual(applyEdits({'src/a.js':'const value=1;','src/new.js':null},[{path:'src/a.js',before:'value=1',after:'value=2'},{path:'src/new.js',before:null,after:'export default 2;'}]),{'src/a.js':'const value=2;','src/new.js':'export default 2;'});
 assert.throws(()=>applyEdits({'a.js':'same same'},[{path:'a.js',before:'same',after:'other'}]));
 assert.throws(()=>applyEdits({'a.js':'exists'},[{path:'a.js',before:null,after:'replacement'}]));
 assert.throws(()=>applyEdits({'a.js':'unchanged'},[{path:'a.js',before:'unchanged',after:'unchanged'}]));
 assert.throws(()=>applyEdits({'a.js':'old'},[{path:'a.js',before:'missing',after:'new'}]));
});


test('Robot PR #565 duplicate alias insertions cannot count as an implementation',()=>{
 const source="const OWNER_REPOS={\n 'hbo':'www-infinity4/HBO',\n 'tv-database':'www-infinity4/TV-Database',\n 'widgetphi':'www-infinity4/WidgetPhi'\n};\n";
 const duplicate=" 'hbo':'www-infinity4/HBO',\n 'tv-database':'www-infinity4/TV-Database',\n";
 const patched=source.replace(" 'widgetphi':",duplicate+" 'widgetphi':");
 assert.equal(duplicateOnlyObjectEntries(source,patched),true);
 assert.throws(()=>applyEdits({'bubbles-brain-actions.js':source},[
  {path:'bubbles-brain-actions.js',before:source,after:patched}
 ]),/only duplicates existing object entries/);
});
test('real new source behavior and unrelated repeated structural lines are not blocked',()=>{
 const original="const routes={\n 'hbo':'www-infinity4/HBO',\n};\n";
 const meaningful=original.replace("};"," 'new':'www-infinity4/New',\n};");
 assert.equal(duplicateOnlyObjectEntries(original,meaningful),false);
 assert.deepEqual(applyEdits({'routes.js':original},[
  {path:'routes.js',before:original,after:meaningful}
 ]),{'routes.js':meaningful});
 const repeatedMarkup="function render(){\n return '<div></div>';\n}\n";
 assert.equal(duplicateOnlyObjectEntries(repeatedMarkup,repeatedMarkup+" return '<div></div>';\n"),false);
});
