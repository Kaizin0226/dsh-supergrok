// Recoverable native installation; no process or session-data management.
import {cpSync,existsSync,lstatSync,mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {dirname,isAbsolute,join,parse,relative,resolve,sep} from 'node:path';
import {parseArgs} from 'node:util';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolveProxyUrl} from '../lib/net.js';
if(process.platform!=='win32'||Number(process.versions.node.split('.')[0])!==24)throw Error('Windows and Node.js 24 are required');
const {values,positionals}=parseArgs({allowPositionals:true,options:{bundle:{type:'string'},runtime:{type:'string'},backups:{type:'string'},data:{type:'string'},profile:{type:'string'},'proxy-url':{type:'string'},receipt:{type:'string'},apply:{type:'boolean',default:false}}});
const command=positionals[0];
if(positionals.length!==1||!['install','rollback'].includes(command))throw Error('Choose install or rollback');
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const markerName='.dsh-supergrok-install.json';
function ordinary(p){for(let c=p;;c=dirname(c)){let s;try{s=lstatSync(c);}catch(e){if(e.code!=='ENOENT')throw e;}if(s?.isSymbolicLink())throw Error('Target boundaries must not contain junctions or links');if(dirname(c)===c)break;}}
function fixed(n){if(!values[n]||!isAbsolute(values[n]))throw Error('--'+n+' requires an explicit absolute path');const p=resolve(values[n]);if(p===parse(p).root)throw Error('A drive root is not a target');ordinary(p);return p;}
function separate(a,b){const within=(p,c)=>{const r=relative(p,c);return !r||(!r.startsWith('..'+sep)&&r!=='..'&&!isAbsolute(r));};if(within(a,b)||within(b,a))throw Error('Runtime, home, bundle and backups must be separate');}
function payload(root,f){if(typeof f!=='string'||f.includes('\\')||isAbsolute(f)||f.split('/').some(x=>!x||x==='..'))throw Error('Unsafe bundle path');const p=join(root,f);ordinary(p);if(!lstatSync(p).isFile())throw Error('Non-file payload');return p;}
function bundleCheck(b){const m=json(payload(b,'suite-manifest.json'));if(m.schemaVersion!==2||m.dshVersion!=='0.2.0-rc.2'||m.packages?.length!==2||!m.files?.['package-lock.json']||!m.files?.['package.json'])throw Error('Incomplete native bundle');for(const [f,h]of Object.entries(m.files)){if(!/^[a-f0-9]{64}$/.test(h)||createHash('sha256').update(readFileSync(payload(b,f))).digest('hex')!==h)throw Error('Bundle integrity mismatch: '+f);}for(const p of m.packages)if(m.files['vendor/'+p.file]!==p.sha256)throw Error('Package integrity mismatch');return m;}
const runtime=fixed('runtime');
if(command==='install'){
 const bundle=fixed('bundle'),backups=fixed('backups'),data=fixed('data'),profile=values.profile;
 if(!['web','headless'].includes(profile))throw Error('Explicit --profile web or headless is required');
 const proxyUrl=resolveProxyUrl(values['proxy-url']);
 for(const [i,a]of [runtime,bundle,backups,data].entries())for(const b of [runtime,bundle,backups,data].slice(i+1))separate(a,b);
 if([backups,data].some(p=>parse(p).root.toLowerCase()!==parse(runtime).root.toLowerCase()))throw Error('Runtime, new home and backups must share a drive for recoverable renames');
 const manifest=bundleCheck(bundle);
 function managed(p){if(!existsSync(join(p,markerName)))throw Error('Unknown installation; choose a fresh directory');const m=json(join(p,markerName));if(m.schemaVersion!==2||m.dshMajor!==2||m.runtime!==runtime||m.data!==data||m.profile!==profile)throw Error('Only this tool\'s matching 0.2 installation can be replaced');return m;}
 const old=existsSync(runtime)?managed(runtime):null,targetProfile=join(data,'profiles',profile);
 if(existsSync(data)&&(!old||!existsSync(join(data,markerName))||json(join(data,markerName)).id!==old.id))throw Error('DSH_HOME must be new or match this managed 0.2 installation');
 if(old&&!existsSync(targetProfile))throw Error('Managed profile is missing');
 if(old){const dependencies=json(join(targetProfile,'package.json')).dependencies??{};if(Object.keys(dependencies).some(k=>!manifest.packages.some(p=>p.name===k)))throw Error('Profile has additional dependencies; use official plugin management instead');}
 console.log(JSON.stringify({operation:command,apply:values.apply,runtime,data,profile,proxyUrl,dshVersion:manifest.dshVersion}));
 if(!values.apply)process.exit(0);
 const id=randomUUID(),transaction=join(backups,id),candidate=join(transaction,'candidate'),stageHome=join(transaction,'profile-home'),stageProfile=join(stageHome,'profiles',profile);
 mkdirSync(candidate,{recursive:true});
 for(const f of Object.keys(manifest.files)){mkdirSync(dirname(join(candidate,f)),{recursive:true});cpSync(payload(bundle,f),join(candidate,f));}
 cpSync(join(bundle,'suite-manifest.json'),join(candidate,'suite-manifest.json'));
 const env={...process.env,npm_config_cache:join(transaction,'npm-cache'),DSH_HOME:stageHome,DSH_TELEMETRY_DISABLED:'1'};
 for(const k of Object.keys(env))if(/API_KEY|TOKEN|SECRET|PASSWORD|AUTHORIZATION|^DSH_SUPERGROK_/i.test(k))delete env[k];
 for(const k of Object.keys(env))if(/^(?:http|https|all|no)_proxy$/i.test(k))delete env[k];
 const pathKey=Object.keys(env).find(k=>k.toLowerCase()==='path'),inherited=env[pathKey]??'';
 for(const k of Object.keys(env))if(k.toLowerCase()==='path')delete env[k];
 env.Path=join(candidate,'node_modules/.bin')+';'+inherited;
 const run=(args,cwd=candidate)=>{const r=spawnSync(process.execPath,args,{cwd,env,stdio:'inherit',windowsHide:true});if(r.error)throw r.error;if(r.status!==0)throw Error('Candidate operation failed; previous environment retained');};
 const npm=process.env.npm_execpath??join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
 run([npm,'ci','--ignore-scripts','--no-audit','--no-fund']);
 mkdirSync(join(stageProfile,'vendor'),{recursive:true});
 const bin=join(candidate,'node_modules/@deepseek-ai/dsh/lib/bin.js');
 const req=createRequire(join(candidate,'node_modules/@deepseek-ai/dsh/package.json'));
 const {initProfile,PROFILE_TEMPLATES}=await import(pathToFileURL(req.resolve('@deepseek-ai/dsh-app-boot')).href);
 initProfile(stageProfile,PROFILE_TEMPLATES[profile].bundles);
 if(old)for(const f of ['package.json','cordis.yml','cordis.patch.yml'])if(existsSync(join(targetProfile,f)))cpSync(join(targetProfile,f),join(stageProfile,f));
 const profileManifest=json(join(stageProfile,'package.json'));
 profileManifest.dependencies=Object.fromEntries(manifest.packages.map(p=>[p.name,'file:vendor/'+p.file]));
 for(const p of manifest.packages)if(!profileManifest.dsh.profile.bundles.includes(p.name))profileManifest.dsh.profile.bundles.push(p.name);
 save(join(stageProfile,'package.json'),profileManifest);
 cpSync(join(candidate,'profile.lock.yaml'),join(stageProfile,'pnpm-lock.yaml'));
 for(const p of manifest.packages){cpSync(join(candidate,'vendor',p.file),join(stageProfile,'vendor',p.file));}
 const reviewedProfileLock=readFileSync(join(stageProfile,'pnpm-lock.yaml'),'utf8');
 run([bin,'plugin','--profile',profile,'add',...manifest.packages.map(p=>'file:vendor/'+p.file),'--ignore-scripts','--config.frozen-lockfile=true','--store-dir',join(stageHome,'pnpm-store')],stageProfile);
 if(readFileSync(join(stageProfile,'pnpm-lock.yaml'),'utf8')!==reviewedProfileLock)throw Error('Native package manager changed the reviewed dependency lock');
 const patch=join(stageProfile,'cordis.patch.yml'),existing=existsSync(patch)?readFileSync(patch,'utf8'):'';
 const webPackage=join(candidate,'node_modules/@deepseek-ai/dsh-web-app');
 const standard=readFileSync(join(webPackage,'presets/standard.patch.yml'),'utf8').replace(/\r\n/g,'\n');
 if(standard!==readFileSync(join(stageProfile,'node_modules/grok-optimized-preset/upstream-standard.patch.yml'),'utf8').replace(/\r\n/g,'\n'))throw Error('Official standard differs from the reviewed preset baseline');
 let nativeHeadless='';
 if(profile==='headless'&&!old){
  const officialWeb=readFileSync(join(webPackage,'cordis.patch.yml'),'utf8').replace(/\r\n/g,'\n');
  const offset=officialWeb.indexOf('\n- id: tool-plugin-manager\n');
  if(offset<0||!officialWeb.slice(offset).includes('id: agent-preset-registry'))throw Error('Official preset-plane layout changed');
  nativeHeadless=officialWeb.slice(offset)+'\n'+standard+'\n- insert:\n    - id: subagent-model-selection-settings\n      name: "@deepseek-ai/dsh-tool-subagent/model-selection-settings"\n';
 }
 writeFileSync(patch,nativeHeadless+existing.replace(/^\[\]\r?$/m,'')+'\n- id: llm-grok-oauth\n  config:\n    proxyUrl: '+JSON.stringify(proxyUrl)+'\n');
 run([bin,profile,'--dump-config']);
 save(join(candidate,markerName),{schemaVersion:2,dshMajor:2,id,runtime,data,profile});
 const previous=old?join(transaction,'previous'):null,previousProfile=old?join(transaction,'previous-profile'):null;
 save(join(transaction,'receipt.json'),{schemaVersion:2,id,runtime,data,profile,transaction,previous,previousProfile});
 ordinary(runtime);ordinary(data);ordinary(backups);
 mkdirSync(dirname(runtime),{recursive:true});mkdirSync(join(data,'profiles'),{recursive:true});
 if(old){renameSync(runtime,previous);try{renameSync(targetProfile,previousProfile);}catch(e){renameSync(previous,runtime);throw e;}}
 let movedRuntime=false,movedProfile=false;
 try{renameSync(candidate,runtime);movedRuntime=true;renameSync(stageProfile,targetProfile);movedProfile=true;save(join(data,markerName),{schemaVersion:2,id,runtime,data,profile});}
 catch(e){if(movedProfile)renameSync(targetProfile,stageProfile);if(movedRuntime)renameSync(runtime,candidate);if(old){renameSync(previous,runtime);renameSync(previousProfile,targetProfile);save(join(data,markerName),old);}throw e;}
 console.log('Installed native plugins. Rollback receipt: '+join(transaction,'receipt.json'));
}else{
 const receiptPath=fixed('receipt'),r=json(receiptPath);
 if(r.schemaVersion!==2||r.runtime!==runtime||r.transaction!==dirname(receiptPath)||!/^[-a-f0-9]{36}$/.test(r.id))throw Error('Receipt does not identify this runtime');
 if(!isAbsolute(r.data)||!['web','headless'].includes(r.profile))throw Error('Invalid receipt targets');
 ordinary(r.data);separate(runtime,r.data);separate(runtime,r.transaction);
 for(const [name,expected]of [['previous','previous'],['previousProfile','previous-profile']])if(r[name]!==null&&r[name]!==join(r.transaction,expected))throw Error('Invalid receipt recovery path');
 const m=json(join(runtime,markerName));if(m.schemaVersion!==2||m.id!==r.id||m.data!==r.data||m.profile!==r.profile)throw Error('Installation changed since receipt');
 const profile=join(r.data,'profiles',r.profile),displaced=join(r.transaction,'rolled-back'),displacedProfile=join(r.transaction,'rolled-back-profile');
 if(existsSync(displaced)||existsSync(displacedProfile))throw Error('Rollback already ran');
 if(r.previous&&(!existsSync(r.previous)||!existsSync(r.previousProfile)))throw Error('Previous environment missing');
 ordinary(profile);ordinary(r.transaction);console.log(JSON.stringify({operation:command,apply:values.apply,runtime,profile}));
 if(values.apply){renameSync(runtime,displaced);try{renameSync(profile,displacedProfile);if(r.previous){renameSync(r.previous,runtime);renameSync(r.previousProfile,profile);save(join(r.data,markerName),json(join(runtime,markerName)));}else save(join(r.data,markerName),{schemaVersion:2,retired:true});}catch(e){if(existsSync(runtime)&&r.previous)renameSync(runtime,r.previous);if(existsSync(profile)&&r.previousProfile)renameSync(profile,r.previousProfile);if(existsSync(displacedProfile))renameSync(displacedProfile,profile);renameSync(displaced,runtime);throw e;}console.log('Restored managed installation and profile. Session data was not changed.');}
}
