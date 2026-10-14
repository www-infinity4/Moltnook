// Oracle Octaves compile-time guard for model-produced CSS source edits.
// Source of truth: ../../.github/oracle-octaves-style.json (reviewed in main).
import {readFileSync} from 'node:fs';
export const styleDictionary=JSON.parse(readFileSync(new URL('../../.github/oracle-octaves-style.json',import.meta.url),'utf8'));
export function contrast(fg,bg){
 const hex=s=>{if(!/^#[0-9a-f]{6}$/i.test(s))throw Error('Invalid Oracle color');return [1,3,5].map(i=>parseInt(s.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4)};
 const luminance=s=>{const c=hex(s);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
 const a=luminance(fg),b=luminance(bg);
 return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
export function validateStyleDictionary(policy=styleDictionary){
 if(policy.schemaVersion!==1||!policy.componentVault||!policy.colors)throw Error('Oracle dictionary invalid');
 if(policy.minimumTouchTargetPx<44||policy.cardRadiusPx!==18)throw Error('Oracle Android tap/card contract invalid');
 if(contrast(policy.colors.primaryText,policy.colors.primary)<policy.minimumNormalContrast)throw Error('Oracle primary button contrast too low');
 if(contrast(policy.colors.ink,policy.colors.paper)<policy.minimumNormalContrast)throw Error('Oracle paper text contrast too low');
 for(const name of ['oracle-card','oracle-action','oracle-image','oracle-player','oracle-receipt']){
  if(!policy.componentVault[name]||!Array.isArray(policy.componentVault[name].slots))throw Error('Missing Oracle component vault contract: '+name);
 }
 return true;
}
export function validateOracleCssEdit(path,after){
 validateStyleDictionary();
 if(!/\.css$/i.test(path))return {checked:false};
 if(typeof after!=='string')throw Error('Oracle style patch missing CSS');
 if(/:has\s*\(/i.test(after))throw Error('Oracle CSS rejects unsupported :has() selectors');
 if(/color-scheme\s*:\s*dark\b/i.test(after))throw Error('New Oracle components cannot force dark browser surfaces');
 if(/(?:background|background-color)\s*:\s*#(?:000000|000|030613|04050f)\b/i.test(after))throw Error('Oracle daylight components cannot introduce obsolete black page backgrounds');
 if(/(?:wallet|checkout|collect|starquest|quant).*?\{[^{}]*display\s*:\s*none\s*!important/i.test(after))throw Error('Protected wallet or StarQuest controls cannot be hidden');
 // Extract literal local CSS color pairs when present; dynamic vars/gradients need browser verification.
 const blocks=after.match(/[^{}]+\{[^{}]*\}/g)||[];
 for(const block of blocks){
  const color=block.match(/(?:^|[;{])\s*color\s*:\s*(#[0-9a-f]{6})\b/i)?.[1];
  const bg=block.match(/(?:^|[;{])\s*background(?:-color)?\s*:\s*(#[0-9a-f]{6})\b/i)?.[1];
  if(color&&bg&&contrast(color,bg)<styleDictionary.minimumNormalContrast)throw Error('Oracle text/background contrast fails WCAG AA');
 }
 return {checked:true,contrastPrimary:Number(contrast(styleDictionary.colors.primaryText,styleDictionary.colors.primary).toFixed(2)),componentVault:Object.keys(styleDictionary.componentVault)};
}
