if(!self.define){let e,s={};const i=(i,o)=>(i=new URL(i+".js",o).href,s[i]||new Promise((s=>{if("document"in self){const e=document.createElement("script");e.src=i,e.onload=s,document.head.appendChild(e)}else e=i,importScripts(i),s()})).then((()=>{let e=s[i];if(!e)throw new Error(`Module ${i} didn’t register its module`);return e})));self.define=(o,r)=>{const n=e||("document"in self?document.currentScript.src:"")||location.href;if(s[n])return;let c={};const t=e=>i(e,n),d={module:{uri:n},exports:c,require:t};s[n]=Promise.all(o.map((e=>d[e]||t(e)))).then((e=>(r(...e),c)))}}define(["./workbox-088bfcc4"],(function(e){"use strict";self.skipWaiting(),e.clientsClaim(),e.precacheAndRoute([{url:"__snapshots__/oscd-designer.spec.snap.js",revision:"1d56ce4c9f87a89505e97f4736f51ed3"},{url:"about.html",revision:"151c6bb02f96f55515cc3b5e737cb9de"},{url:"assets/about-977b8a3b.html",revision:"151c6bb02f96f55515cc3b5e737cb9de"},{url:"foundation.js",revision:"67739884aa65b94ede75868d8bd2a804"},{url:"icons.js",revision:"ac0a5a5f472c99789bbb3c3e8efe199a"},{url:"oscd-designer.js",revision:"e4eb7e27a5af9a48fa1f2013b2e12954"},{url:"oscd-designer.spec.js",revision:"64979aa0b2358bfab41b52f55566a5ac"},{url:"sld-editor.js",revision:"260a7b296a54a05284aa5835622b0f99"},{url:"util.js",revision:"d728c658543df94d189d009ae04db55c"}],{}),e.registerRoute(new e.NavigationRoute(e.createHandlerBoundToURL("/index.html"))),e.registerRoute("polyfills/*.js",new e.CacheFirst,"GET")}));
//# sourceMappingURL=sw.js.map
