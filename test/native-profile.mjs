import assert from 'node:assert/strict';
import {createRequire,syncBuiltinESMExports} from 'node:module';
import {cpSync,mkdirSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import net from 'node:net';
import tls from 'node:tls';
import child from 'node:child_process';
import {randomUUID} from 'node:crypto';
const [profile,homeArg,runtimeArg,readyFile]=process.argv.slice(2);
assert.ok(['web','headless'].includes(profile));
const home=resolve(homeArg),runtime=resolve(runtimeArg);
for(const k of Object.keys(process.env))if(/API_KEY|TOKEN|SECRET|PASSWORD|AUTHORIZATION|^DSH_SUPERGROK_|_PROXY$/i.test(k))delete process.env[k];
process.env.DSH_HOME=home;process.env.DSH_TELEMETRY_DISABLED='1';process.env.DSH_SUPERGROK_ACCEPTANCE='1';process.env.XAI_API_KEY='';
for(const k of ['HOME','USERPROFILE','APPDATA','LOCALAPPDATA','DSH_AGENTS_HOME']){process.env[k]=join(home,'isolated-user',k.toLowerCase());mkdirSync(process.env[k],{recursive:true});}
process.chdir(home);
const blocked=[];
net.Socket.prototype.connect=function(){blocked.push('socket');throw Error('Offline test blocks all outbound sockets');};
tls.connect=()=>{blocked.push('tls');throw Error('Offline test blocks TLS');};
globalThis.fetch=()=>{blocked.push('fetch');throw Error('Offline test blocks fetch');};
for(const k of ['spawn','exec','execFile','fork','spawnSync','execSync','execFileSync'])child[k]=(...args)=>{blocked.push(k+':'+basename(String(args[0])));throw Error('Offline test blocks subprocesses');};
syncBuiltinESMExports();
const req=createRequire(realpathSync(join(runtime,'node_modules/@deepseek-ai/dsh/package.json')));
const fixtureRequests=[];
const mockFetch=async (raw,init={})=>{
 const url=new URL(raw);
 assert.equal(url.origin,'https://cli-chat-proxy.grok.com');
 fixtureRequests.push(url.pathname);
 if(url.pathname==='/v1/models'||url.pathname==='/v1/models-v2')return new Response(JSON.stringify({models:[{id:'grok-synthetic',name:'Synthetic model',api_backend:'chat',reasoning_efforts:[{id:'high',name:'High',is_default:true}],input_modalities:['text','image']}]}),{headers:{'content-type':'application/json'}});
 if(url.pathname==='/v1/billing')return new Response(JSON.stringify({config:{creditUsagePercent:37,currentPeriod:{type:'USAGE_PERIOD_TYPE_WEEKLY',end:'2030-01-02T03:04:05Z'}}}),{headers:{'content-type':'application/json'}});
 throw Error('Synthetic host forbids OAuth and inference networking');
};
for(const anchor of [join(runtime,'package.json'),join(home,'profiles',profile,'node_modules/dsh-llm-grok-oauth/package.json')]){
 try{createRequire(anchor)('undici').fetch=mockFetch;}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
}
const imp=n=>import(pathToFileURL(req.resolve(n)).href);
const [{loadLayeredEnv},{LlmAdapter},cli]=await Promise.all([imp('@deepseek-ai/dsh-app-boot'),imp('@deepseek-ai/dsh-llm'),import(pathToFileURL(join(runtime,'node_modules/@deepseek-ai/dsh/lib/profile-boot.js')).href)]);
let inferenceCount=0,launchUrl;
const log=console.log.bind(console);
console.log=(...args)=>{for(const v of args)if(typeof v==='string'){const m=/dsh web: (http:\/\/[^\s]+)/.exec(v);if(m)launchUrl=m[1];}log(...args.map(v=>typeof v==='string'?v.replace(/([?&]token=)[^\s&]+/g,'$1<redacted>'):v));};
class FixtureAdapter extends LlmAdapter{
 async resolveModel(provider,id){return {provider,id,name:id,inputModalities:['text','image']};}
 async *stream(){inferenceCount++;yield {type:'block-start',index:0,blockType:'text'};yield {type:'text-delta',index:0,text:'OFFLINE_PROFILE_OK'};yield {type:'block-end',index:0,block:{type:'text',text:'OFFLINE_PROFILE_OK'}};yield {type:'finish',reason:{kind:'stop'}};}
}
const patch=join(home,'acceptance.patch.yml');
const fixture=join(home,'fixture-provider.mjs');
writeFileSync(fixture,readFileSync(join(import.meta.dirname,'fixture-provider.mjs'),'utf8').replace("'@deepseek-ai/dsh-llm'",JSON.stringify(pathToFileURL(req.resolve('@deepseek-ai/dsh-llm')).href)));
writeFileSync(patch,'- insert:\n    - id: offline-fixture\n      name: '+JSON.stringify(fixture.replaceAll('\\','/'))+'\n- id: session-telemetry-otel\n  disabled: true\n- id: session-title-llm\n  disabled: true\n- id: agent-default-model\n  config:\n    provider: offline-fixture\n    model: synthetic\n');
let mounted;
const app=await cli.runProfile({profile,patchFiles:[patch],args:profile==='web'?['--host','127.0.0.1','--port','0','--no-open']:['offline fixture only'],environment:loadLayeredEnv('offline-profile',home)});
const ctx=app.ctx;
try{
 assert.ok(ctx.get('agentLoop'));assert.ok(ctx.get('llm'));
 assert.ok(ctx.llm.listProviders().some(p=>p.id==='grok-oauth'));
 assert.ok(ctx.llm.listProviders().some(p=>p.id==='offline-fixture'));
 if(profile==='web'){
  const adapter=ctx.llm.adapters.get('grok-oauth').adapter;
  adapter.fetch=mockFetch;
  await adapter.oauth.store.save({access_token:'fixture',expires_at:Date.now()+3600000,obtained_at:Date.now()});
  adapter.invalidateCatalog();
 }
 assert.equal(ctx.agentPresets.defaultId,'standard');
 if(profile==='headless'){
  await new Promise(resolve=>process.once('beforeExit',resolve));
  assert.equal(globalThis.syntheticInferenceCount,1);
  assert.equal(process.exitCode,0);
  assert.deepEqual(blocked,[]);
  log(JSON.stringify({profile,startupPassed:true,providerLoaded:true,realModelRequests:0,inferenceCount:1,blocked}));
  process.exit(0); // Native runner has finished and drained its owned resources.
 }
 const {assembleContextFor}=await imp('@deepseek-ai/dsh-agent'),{scopeOf}=await imp('@deepseek-ai/dsh-scope'),{SessionId}=await imp('@deepseek-ai/dsh-session');
 const presets=[];
 for(const preset of ['standard','grok-optimized']){
  const {agent}=await ctx.agents.create({sessionId:SessionId('offline-'+preset+'-'+randomUUID()),meta:{cwd:home,agentPreset:preset},agentOptions:{provider:'offline-fixture',model:'synthetic'},setup:async scope=>{await ctx.agentPresets.mount(scope,preset);}});
  const schemas=ctx.tools.schemas(scopeOf(agent.ctx));
  assert.ok(!schemas.some(s=>s.name==='recall_image_attachment'));
  const prompt=await ctx.systemPrompt.assemble(assembleContextFor(agent));
  assert.ok(!prompt.contexts.some(s=>s.name==='grok-optimized:work-state'));
  presets.push({preset,toolNames:schemas.map(s=>s.name).sort()});
 }
 assert.deepEqual(presets[0].toolNames,presets[1].toolNames);
 if(profile==='headless')for(let i=0;i<300&&!(globalThis.syntheticInferenceCount>0);i++)await new Promise(r=>setTimeout(r,10));
 if(profile==='headless')assert.equal(globalThis.syntheticInferenceCount,1);
 assert.deepEqual(blocked,[]);
 if(profile==='web'&&readyFile){assert.ok(launchUrl);writeFileSync(readyFile,JSON.stringify({url:launchUrl,profile,providerLoaded:true,presets}));await new Promise(resolve=>process.once('message',m=>{if(m==='finish')resolve();}));}
 log(JSON.stringify({profile,startupPassed:true,providerLoaded:true,realModelRequests:0,inferenceCount:globalThis.syntheticInferenceCount??0,presets,fixtureRequests,blocked}));
}finally{await mounted?.dispose();await ctx.fiber.dispose();}
