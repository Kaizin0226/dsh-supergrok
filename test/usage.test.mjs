import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeUsage,UsageService} from '../lib/usage.js';
import {assertAllowedOutboundUrl} from '../lib/net.js';
const good={config:{creditUsagePercent:76,currentPeriod:{type:'USAGE_PERIOD_TYPE_WEEKLY',end:'2026-09-11T22:06:36.320172+00:00'}}};
test('live weekly response and time zone normalization',()=>{
 const v=normalizeUsage(good);assert.equal(v.usedPercent,76);assert.equal(v.remainingPercent,24);assert.equal(v.period,'weekly');assert.equal(v.resetAt,'2026-09-11T22:06:36.320Z');
});
test('zero, full, missing and invalid new values never become false zero',()=>{
 for(const p of [0,100])assert.equal(normalizeUsage({config:{creditUsagePercent:p}}).usedPercent,p);
 assert.equal(normalizeUsage({config:{}}).usedPercent,null);
 assert.equal(normalizeUsage({config:{creditUsagePercent:'bad',used:{val:4},monthlyLimit:{val:10}}}).usedPercent,null);
 assert.equal(normalizeUsage({config:{currentPeriod:{end:'wrong'},billingPeriodEnd:good.config.currentPeriod.end}}).resetAt,null);
 assert.equal(normalizeUsage({config:{used:{},monthlyLimit:{val:'100'}}}).usedPercent,0);
 assert.equal(normalizeUsage({config:{used:{val:10},monthlyLimit:{}}}).usedPercent,null);
});
test('only exact billing query is admitted',()=>{
 assertAllowedOutboundUrl('https://cli-chat-proxy.grok.com/v1/billing?format=credits','usage');
 for(const q of ['','?format=other','?format=credits&x=1','?format=credits&format=credits'])assert.throws(()=>assertAllowedOutboundUrl('https://cli-chat-proxy.grok.com/v1/billing'+q,'usage'));
 assert.throws(()=>assertAllowedOutboundUrl('https://cli-chat-proxy.grok.com/v1/models?format=credits','catalog'));
});
test('single flight, TTL, failures, signout and account isolation',async()=>{
 let time=100000, calls=0, bad=false, signed=true, token='first';
 const oauth={uiStatus:async()=>({oauthStatus:signed?'signed-in':'signed-out'}),getAccessToken:async()=>token};
 const service=new UsageService(oauth,{now:()=>time,fetchImpl:async()=>{calls++;if(bad)throw Error('network');return new Response(JSON.stringify(good));}});
 const results=await Promise.all([service.get(),service.get()]);assert.equal(calls,1);assert.equal(results[0].snapshot.usedPercent,76);
 await service.get();assert.equal(calls,1);
 time+=60001;bad=true;assert.equal((await service.get()).status,'stale');
 token='second';assert.equal((await service.get()).snapshot,null);
 signed=false;assert.equal((await service.get()).status,'signed-out');assert.equal(service.last,null);
});
test('manual refresh failure remains stale through throttle and cached reads',async()=>{
 let time=100000,bad=false;
 const service=new UsageService({uiStatus:async()=>({oauthStatus:'signed-in'}),getAccessToken:async()=>'fixture'}, {now:()=>time,fetchImpl:async()=>{if(bad)throw Error('private failure');return new Response(JSON.stringify(good));}});
 await service.get();time+=5001;bad=true;
 assert.equal((await service.get(true)).status,'stale');
 assert.equal((await service.get()).status,'stale');
 time+=5001;bad=false;assert.equal((await service.get(true)).status,'ready');
 service.clear();assert.equal(service.last,null);
});
