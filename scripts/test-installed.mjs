import assert from 'node:assert/strict';
import {cpSync,existsSync,mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fork,spawnSync} from 'node:child_process';
import {join,relative,resolve,isAbsolute} from 'node:path';
import {parseArgs} from 'node:util';
import {createRequire} from 'node:module';
const root=resolve(import.meta.dirname,'..');
const {values}=parseArgs({options:{'work-dir':{type:'string'}}});
if(!values['work-dir'])throw Error('--work-dir is required');
const work=resolve(values['work-dir']),rel=relative(root,work);
if(!rel||(!rel.startsWith('..')&&!isAbsolute(rel)))throw Error('Test outside the checkout');
mkdirSync(work,{recursive:true});
const fixture=mkdtempSync(join(work,'native-acceptance-'));
const env={...process.env,DSH_TELEMETRY_DISABLED:'1'};
for(const k of Object.keys(env))if(/API_KEY|TOKEN|SECRET|PASSWORD|AUTHORIZATION|^DSH_HOME$|^DSH_SUPERGROK_/i.test(k))delete env[k];
const run=(args,expected=0,cwd=root)=>{
 const r=spawnSync(process.execPath,args,{cwd,env,encoding:'utf8',windowsHide:true,timeout:240000});
 if(r.error)throw r.error;assert.equal(r.status,expected,r.stderr+'\n'+r.stdout);
 return r.stdout;
};
const installer=join(root,'scripts/install-suite.mjs'),bundle=join(work,'bundle');
const target=profile=>({runtime:join(fixture,profile,'runtime'),data:join(fixture,profile,'data'),backups:join(fixture,profile,'backups'),profile});
const args=(t,b=bundle)=>[installer,'install','--bundle',b,'--runtime',t.runtime,'--data',t.data,'--backups',t.backups,'--profile',t.profile,'--proxy-url','http://127.0.0.1:1'];
const marker=t=>JSON.parse(readFileSync(join(t.runtime,'.dsh-supergrok-install.json'),'utf8'));
const web=target('web'),headless=target('headless');
for(const t of [web,headless]){
 run(args(t));assert.ok(!existsSync(t.runtime)&&!existsSync(t.data)&&!existsSync(t.backups));
 run([...args(t),'--apply']);assert.equal(marker(t).schemaVersion,2);
 const pkg=JSON.parse(readFileSync(join(t.data,'profiles',t.profile,'package.json'),'utf8'));
 for(const p of ['dsh-llm-grok-oauth','grok-optimized-preset'])assert.equal(pkg.dsh.profile.bundles.filter(x=>x===p).length,1);
}
console.log('PASS dry-run, locked official runtime and two native plugin installations');
run([join(web.runtime,'node_modules/pnpm/bin/pnpm.cjs'),'audit','--audit-level=low'],0,join(web.data,'profiles/web'));
console.log('PASS current native profile dependency advisory check');
const {strToU8,strFromU8,zipSync,unzipSync}=createRequire(join(web.runtime,'package.json'))('fflate');
assert.equal(strFromU8(unzipSync(zipSync({'fixture.txt':strToU8('synthetic archive')}))['fixture.txt']),'synthetic archive');
const unknown=target('unknown');mkdirSync(unknown.runtime,{recursive:true});unknown.profile='web';run([...args(unknown),'--apply'],1);
const existingHome=target('existing-home');existingHome.profile='web';mkdirSync(existingHome.data,{recursive:true});writeFileSync(join(existingHome.data,'legacy.txt'),'synthetic old data');run([...args(existingHome),'--apply'],1);assert.ok(!existsSync(existingHome.runtime));
const invalid=[...args(web)];invalid[invalid.length-1]='http://user:password@127.0.0.1:1';run(invalid,1);
const first=marker(web),sentinel=join(web.data,'synthetic-session.json');writeFileSync(sentinel,'{"fixture":"session-preservation"}\n');const before=readFileSync(sentinel);
const damaged=join(fixture,'damaged-bundle');cpSync(bundle,damaged,{recursive:true});writeFileSync(join(damaged,'profile.lock.yaml'),'invalid:\n  - [\n');
const damagedManifest=JSON.parse(readFileSync(join(damaged,'suite-manifest.json'),'utf8'));damagedManifest.files['profile.lock.yaml']=createHash('sha256').update(readFileSync(join(damaged,'profile.lock.yaml'))).digest('hex');writeFileSync(join(damaged,'suite-manifest.json'),JSON.stringify(damagedManifest));
run([...args(web,damaged),'--apply'],1);assert.equal(marker(web).id,first.id);assert.deepEqual(readFileSync(sentinel),before);
console.log('PASS unknown/legacy targets, invalid proxy and failed candidate preservation');
const browserPath=process.env.PLAYWRIGHT_BROWSERS_PATH??join(work,'browsers');process.env.PLAYWRIGHT_BROWSERS_PATH=browserPath;
const {chromium}=await import('playwright');
async function verifyWeb(cold=false){
 const ready=join(fixture,'ready-'+Date.now()+'.json');
 const child=fork(join(root,'test/native-profile.mjs'),['web',web.data,web.runtime,ready],{cwd:root,env,stdio:['ignore','pipe','pipe','ipc'],windowsHide:true});
 let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
 const exited=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));
 let browser;
 try{
  for(let i=0;i<300&&!existsSync(ready);i++){if(child.exitCode!==null)throw Error(output);await new Promise(r=>setTimeout(r,100));}
  assert.ok(existsSync(ready),output);
  const readyData=JSON.parse(readFileSync(ready,'utf8'));assert.equal(readyData.providerLoaded,true);
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({locale:'zh-CN'});const blocked=[];
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===new URL(readyData.url).origin)return route.continue();blocked.push(u.origin);return route.abort();});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(readyData.url);
  const welcome=page.getByRole('button',{name:'继续',exact:true});
  try{await welcome.waitFor({timeout:2000});await welcome.click();}catch(error){if(error.name!=='TimeoutError')throw error;}
  await page.getByText('设置',{exact:true}).click();await page.getByText('模型',{exact:true}).click();
  await page.getByText('本周已用 37.0% · 剩余 63.0%',{exact:true}).waitFor();
  await page.getByRole('button',{name:'管理',exact:true}).click();
  await page.getByText('Synthetic model',{exact:true}).waitFor();
  assert.equal(await page.locator('input[type=number]').inputValue(),cold?'75':'60');
  if(!cold){await page.locator('input[type=number]').fill('75');await page.getByRole('button',{name:'保存',exact:true}).click();await page.getByText('已保存',{exact:true}).waitFor();}
  assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
  await browser.close();browser=undefined;
  child.send('finish');
  const end=await Promise.race([exited,new Promise(r=>setTimeout(()=>r({code:'timeout'}),10000))]);
  assert.equal(end.code,0,output);
  const result=output.split(/\r?\n/).filter(l=>l.startsWith('{"profile":"web"')).map(l=>JSON.parse(l)).at(-1);
  assert.equal(result?.realModelRequests,0);
  assert.ok(result.blocked.every(call=>call==='execFile:reg.exe'),'Only blocked native Windows app-discovery probes are expected');
  assert.match(output,/\/v1\/billing/);assert.match(output,/\/v1\/models/);
  console.log('PASS actual Web, synthetic catalog/quota, native Config '+(cold?'cold replay':'save')+' and scoped preset parity');
 }finally{await browser?.close();if(child.exitCode===null)child.kill();}
}
await verifyWeb();await verifyWeb(true);
const headlessOutput=run([join(root,'test/native-profile.mjs'),'headless',headless.data,headless.runtime]);
assert.match(headlessOutput,/OFFLINE_PROFILE_OK/);
console.log('PASS actual headless single synthetic turn; no real model request');
run([...args(web),'--apply']);const second=marker(web);assert.notEqual(second.id,first.id);
assert.deepEqual(readFileSync(sentinel),before);assert.match(readFileSync(join(web.data,'profiles/web/cordis.patch.yml'),'utf8'),/modelsRefreshSeconds: 75/);
const receipt=join(web.backups,second.id,'receipt.json');
const rollback=[installer,'rollback','--runtime',web.runtime,'--receipt',receipt];
run(rollback);assert.equal(marker(web).id,second.id);
run([...rollback,'--apply']);assert.equal(marker(web).id,first.id);assert.deepEqual(readFileSync(sentinel),before);
run([...rollback,'--apply'],1);
console.log('PASS replacement, managed configuration restoration and one-use rollback; session bytes preserved');
console.log('PASS native installed acceptance (synthetic services only)');
