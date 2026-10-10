import * as nodeTest from 'node:test';
// Loaded only for the native Node fallback, never for a project's Jest/Vitest runner.
for(const name of ['describe','it','test','before','after','beforeEach','afterEach']){
 if(!Object.hasOwn(globalThis,name))Object.defineProperty(globalThis,name,{value:nodeTest[name],writable:true,configurable:true});
}
