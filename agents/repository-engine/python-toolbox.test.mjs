import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRepository,validateRef,validateLock} from './python-toolbox.mjs';
test('toolbox only accepts a named owner repository and pinned commit',()=>{
 assert.equal(validateRepository('www-infinity4/QuantaPhi'),'www-infinity4/QuantaPhi');
 assert.equal(validateRef('a'.repeat(40)),'a'.repeat(40));
 for(const value of ['evil/repo','www-infinity4/x/../../y','www-infinity4/name;echo hacked'])assert.throws(()=>validateRepository(value));
 for(const value of ['main','feature/new','a'.repeat(39),'z'.repeat(40)])assert.throws(()=>validateRef(value));
});
test('only wheel hash pins can be installed',()=>{
 assert.deepEqual(validateLock('numpy==2.1.1 --hash=sha256:'+'a'.repeat(64)),['numpy==2.1.1 --hash=sha256:'+'a'.repeat(64)]);
 for(const value of ['-e git+https://evil','pip install requests','requests>=2','-r other.txt','requests==2.0','x==1 --extra-index-url https://evil'])assert.throws(()=>validateLock(value));
});
