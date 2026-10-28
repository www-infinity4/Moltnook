import test from 'node:test';
import assert from 'node:assert/strict';
import {safePath,applyEdits,inside,duplicateOnlyObjectEntries} from './patch.mjs';
test('source edits cannot traverse paths or mutate credentials ',()=>{
 for(const p of ['../file','/tmp/x','a/../../x','.git/config','.env','config/secrets.json','a\\b'])assert.throws(()=>safePath(p));
 assert.equal(safePath('.github/workflows/run.yml'),'.github/workflows/run.yml');
 assert.equal(inside('/tmp/repo','src/page.js'),'/tmp/repo/src/page.js');
});
test('nested credential dotfiles and control characters never become edit targets or diagnostics',()=>{
 const protectedPaths=[
  'src/.env','src/.env.production','config/deep/.git/config',
  'pkg/.npmrc','pkg/.netrc','pkg/.pypirc','team/.envrc',
  'team/.ssh/id_ed25519','team/.aws/credentials',
  'src/.ENV','src/.Env.Production','config/deep/.GIT/config',
  'pkg/.NPMRC','pkg/.NETRC','pkg/.PYPIRC','team/.EnvRc',
  'team/.SSH/id_ed25519','team/.AWS/credentials',
  'src/bad\nname.js','src/bad\rname.js','src/bad\0name.js'
 ];
 for(const file of protectedPaths){
  assert.throws(()=>safePath(file),/outside writer policy/,JSON.stringify(file));
  assert.throws(()=>inside('/tmp/repo',file),/outside writer policy/,JSON.stringify(file));
  assert.throws(()=>applyEdits({[file]:'safe'},[{path:file,before:'safe',after:'changed'}]),/outside writer policy/,JSON.stringify(file));
 }
 assert.equal(safePath('src/.gitignore'),'src/.gitignore');
 assert.equal(safePath('.github/workflows/check.yml'),'.github/workflows/check.yml');
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

test('immutable edit mismatch identifies source path and count without exposing source text',()=>{
 const cases=[
  {original:{'src/one.js':'const TOP_SECRET_FIXTURE=1;'},edit:{path:'src/one.js',before:'not present',after:'x'},matches:0,source:'present'},
  {original:{'src/two.js':'repeat repeat'},edit:{path:'src/two.js',before:'repeat',after:'x'},matches:2,source:'present'},
  {original:{'src/missing.js':null},edit:{path:'src/missing.js',before:'needle',after:'x'},matches:0,source:'missing'}
 ];
 for(const {original,edit,matches,source} of cases){
  assert.throws(()=>applyEdits(original,[edit]),error=>{
   assert.equal(error.code,'immutable_edit_match_count');
   assert.equal(error.sourcePath,edit.path);
   assert.equal(error.matchCount,matches);
   assert.match(error.message,/Edit must match immutable source exactly once/);
   assert.ok(error.message.includes('path='+JSON.stringify(edit.path)));
   assert.ok(error.message.includes('matches='+matches+', source='+source));
   assert.ok(!error.message.includes('TOP_SECRET_FIXTURE'));
   assert.ok(!error.message.includes('needle'));
   return true;
  });
 }
});
