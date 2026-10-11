// Pinned delivery transform from reviewed QuantaPhi aaf03b0a6e72b58c74794ec61735d50ffe15e01e.
// Deployed Worker v46 was read and matched before copying this deterministic transform.
const EDGE_VERSION = 'quantaphi-org-v46-channel-wallet';
const CANONICAL_ORIGIN = 'https://quantaphi.org';
const APPS = [
 { slug: '/infinity-phi/', aliases: ['/infinity/', '/InfinityPhi/', '/Infinity-Phi/'], repo: 'C13b0' },
 { slug: '/omni-phi/', aliases: ['/omni/', '/OmniPhi/'], repo: 'Omni-Phi' },
 { slug: '/news-phi/', aliases: ['/news/', '/NewsPhi/'], repo: 'News-Phi' },
 { slug: '/web-phi/', aliases: ['/web/', '/WebPhi/'], repo: 'Web-Phi' },
 { slug: '/builder-reserve/', aliases: ['/builder/', '/BuilderReserve/'], repo: 'Builder-Reserve' },
 { slug: '/infinity-radio/', aliases: ['/radio/', '/InfinityRadio/'], repo: 'Alien-Radio' },
 { slug: '/omni-tv/', aliases: ['/tv/', '/OmniTV/'], repo: 'Omni-TV' },
 { slug: '/alien-coin/', aliases: ['/alien/', '/AlienCoin/'], repo: 'Alien-Coin' },
 { slug: '/bitcoin-crusher/', aliases: ['/crusher/', '/BitcoinCrusher/'], repo: 'Bitcoin-Crusher' },
 { slug: '/oracle-octaves/', aliases: ['/octaves/'], repo: 'Oracle-Octaves' },
 { slug: '/mckee-coins/', aliases: ['/coins/', '/McKeeCoins/'], repo: 'Mckee-Coins-Inc' },
 { slug: '/shoplc/', aliases: ['/shop/'], repo: 'ShopLC' }
];
const SUPPORT_REPOS=[
 {prefix:'/TV-Database/',repo:'TV-Database'},
 {prefix:'/Mint-For-Infinity/',repo:'Mint-For-Infinity'},
 {prefix:'/Control-Phi/',repo:'Control-Phi'},
 {prefix:"/Hermit-TV/",repo:"Hermit-TV"},
 {prefix:"/Star-Launcher/",repo:"Star-Launcher"},
 {prefix:"/HBO/",repo:"HBO"},
 {prefix:"/Starz/",repo:"Starz"},
 {prefix:"/Cinemax/",repo:"Cinemax"},
 {prefix:"/Showtime/",repo:"Showtime"},
 {prefix:"/Encore/",repo:"Encore"},
 {prefix:"/Cartoon-Network/",repo:"Cartoon-Network"},
 {prefix:"/WGN/",repo:"WGN"},
 {prefix:"/TNT/",repo:"TNT"},
 {prefix:"/NBC/",repo:"NBC"},
 {prefix:"/FOX/",repo:"FOX"},
 {prefix:"/FX/",repo:"FX"},
 {prefix:"/Nickelodeon/",repo:"Nickelodeon"},
 {prefix:"/FSN/",repo:"FSN"},
 {prefix:"/ESPN/",repo:"ESPN"},
 {prefix:"/MTV/",repo:"MTV"},
 {prefix:"/VH1/",repo:"VH1"},
 {prefix:"/AMC/",repo:"AMC"},
 {prefix:"/Disney/",repo:"Disney"},
 {prefix:"/USA/",repo:"USA"},
 {prefix:"/Comedy-Central/",repo:"Comedy-Central"},
 {prefix:"/BET/",repo:"BET"},
 {prefix:"/Discovery/",repo:"Discovery"},
 {prefix:"/Nintendo-TV/",repo:"Nintendo-TV"},
 {prefix:"/Chiller/",repo:"Chiller"},
 {prefix:"/TBS/",repo:"TBS"},
 {prefix:"/ABC/",repo:"ABC"},
 {prefix:"/CBS/",repo:"CBS"},
 {prefix:"/PBS/",repo:"PBS"},
 {prefix:"/History-Channel/",repo:"History-Channel"},
 {prefix:"/CNN/",repo:"CNN"},
 {prefix:"/Trump-TV/",repo:"Trump-TV"},
 {prefix:"/ShopLC/",repo:"ShopLC"},
 {prefix:"/Ozzy-TV/",repo:"Ozzy-TV"},
 {prefix:"/CCR-TV/",repo:"CCR-TV"},
 {prefix:"/Motor-TV/",repo:"Motor-TV"},
 {prefix:"/Physics-TV/",repo:"Physics-TV"},
 {prefix:"/Adventure-TV/",repo:"Adventure-TV"},
 {prefix:"/Trigger-TV/",repo:"Trigger-TV"},
 {prefix:"/Time-Surfers/",repo:"Time-Surfers"},
 {prefix:"/Syncord/",repo:"Syncord"},
 {prefix:"/Astraflix/",repo:"Astraflix"},
 {prefix:"/Vintech/",repo:"Vintech"},
 {prefix:"/Flix-Blender/",repo:"Flix-Blender"},
 {prefix:"/Abstractia-/",repo:"Abstractia-"},
 {prefix:"/Animasync/",repo:"Animasync"},
 {prefix:"/SeekSync/",repo:"SeekSync"}
];
export function rewriteDeployedHTML(text) {
 // Preserve inline Crusher behavior even while the page origin serves older HTML.
 if(text.includes('id="quanta-inline-crusher"')){
  text=text.replace('<a class="bodyShoe left bitcoinCrusherShoe" id="bitcoinCrusherShoe" href="/bitcoin-crusher/"','<button type="button" class="bodyShoe left bitcoinCrusherShoe" id="bitcoinCrusherShoe"').replace('▶ Play here</small></span></a>','▶ Play here</small></span></button>');
  text=text.replace("  event?.preventDefault();\n  const opening=wrap.hidden;","  event?.preventDefault();\n  event?.stopImmediatePropagation();\n  const opening=wrap.hidden;").replace(" foot.addEventListener('click',show);"," foot.addEventListener('click',show,true);");
 }

 // This bridge must execute on the old storage origin. It authenticates
 // postMessage replies against that origin, so suite navigation rewriting
 // must never move the bridge itself to quantaphi.org.
 const bridgeUrl='https://www-infinity4.github.io/QuantaPhi/wallet-link.html';
 text=text.split(bridgeUrl).join('__QUANTAPHI_STORAGE_BRIDGE__');
 text=text.split('https://www-infinity4.github.io/Infinity-Phi/').join(CANONICAL_ORIGIN + '/infinity-phi/');
 text=text.split('https://www-infinity4.github.io/Infinity-Phi').join(CANONICAL_ORIGIN + '/infinity-phi');
 for(const support of SUPPORT_REPOS){
  text=text.split('https://www-infinity4.github.io/'+support.repo+'/').join(CANONICAL_ORIGIN+support.prefix);
 }
 for (const app of APPS) {
  const github = 'https://www-infinity4.github.io/' + app.repo;
  text = text.split(github + '/').join(CANONICAL_ORIGIN + app.slug);
  text = text.split(github).join(CANONICAL_ORIGIN + app.slug.slice(0, -1));
  text = text.split('/' + app.repo + '/').join(app.slug);
  text = text.split('/' + app.repo).join(app.slug.slice(0, -1));
 }
 text = text.split('https://www-infinity4.github.io/QuantaPhi/').join(CANONICAL_ORIGIN + '/');
 return text.split('__QUANTAPHI_STORAGE_BRIDGE__').join(bridgeUrl);
}

export const expectedEdgeVersion=EDGE_VERSION;
