export function validWalletState(p){
 return p?.ok===true&&p.user&&['string','number'].includes(typeof p.user.id)&&String(p.user.id).length>0&&p.balances&&['STARCOIN','QUANT','MUSIC_QUANT','INFINITY'].every(k=>typeof p.balances[k]==='number'&&Number.isFinite(p.balances[k])&&p.balances[k]>=0)&&Array.isArray(p.tokens)&&Array.isArray(p.history)&&Number.isFinite(p.updatedAt);
}
