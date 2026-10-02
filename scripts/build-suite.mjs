import {cpSync,existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {dirname,join,resolve,relative,isAbsolute} from 'node:path';
import {parseArgs} from 'node:util';
const root=resolve(import.meta.dirname,'..');
const {values}=parseArgs({options:{'work-dir':{type:'string'},'update-locks':{type:'boolean',default:false}}});
if(Number(process.versions.node.split('.')[0])!==24) throw Error('Node.js 24 is required');
if(!values['work-dir']) throw Error('--work-dir is required');
const work=resolve(values['work-dir']),rel=relative(root,work);
if(!rel||(!rel.startsWith('..')&&!isAbsolute(rel))) throw Error('Build outside the checkout');
const bundle=join(work,'bundle');
if(existsSync(bundle)) throw Error('Choose a fresh build directory');
mkdirSync(join(bundle,'vendor'),{recursive:true});
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const npm=process.env.npm_execpath??join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
const env={...process.env,npm_config_cache:join(work,'npm-cache'),DSH_TELEMETRY_DISABLED:'1'};
for(const k of Object.keys(env)) if(/API_KEY|TOKEN|SECRET|PASSWORD|AUTHORIZATION|^DSH_HOME$|^DSH_SUPERGROK_/i.test(k)) delete env[k];
const run=(args,cwd)=>{const r=spawnSync(process.execPath,args,{cwd,env,encoding:'utf8',windowsHide:true});if(r.error)throw r.error;if(r.status!==0)throw Error(r.stderr||r.stdout);return r.stdout;};
const components=json(join(root,'components.lock.json')),packages=[];
for(const source of [root,join(root,'presets/grok-optimized')]) {
 const info=JSON.parse(run([npm,'pack','--json','--ignore-scripts','--pack-destination',join(bundle,'vendor')],source))[0];
 for(const required of ['package.json','LICENSE','NOTICE']) if(!info.files.some(f=>f.path===required)) throw Error('Package attribution missing: '+required);
 if(!info.files.some(f=>/Apache-2.0/.test(f.path)))throw Error('Apache-2.0 license missing');
 packages.push({name:info.name,version:info.version,file:info.filename,integrity:info.integrity,sha256:createHash('sha256').update(readFileSync(join(bundle,'vendor',info.filename))).digest('hex')});
}
save(join(bundle,'package.json'),{name:'dsh-supergrok-native-runtime',version:components.distribution.suiteVersion,private:true,type:'module',engines:{node:'>=24 <25'},dependencies:{'@deepseek-ai/dsh':components.dsh.version,pnpm:components.toolchain.pnpm},overrides:components.distribution.dependencyOverrides});
const lock=join(root,'build-locks/runtime.lock.json');
if(values['update-locks']) { run([npm,'install','--package-lock-only','--ignore-scripts','--no-audit','--no-fund'],bundle);cpSync(join(bundle,'package-lock.json'),lock); }
else cpSync(lock,join(bundle,'package-lock.json'));
const graph=json(join(bundle,'package-lock.json'));
if(JSON.stringify(graph.packages[''].dependencies)!==JSON.stringify(json(join(bundle,'package.json')).dependencies)) throw Error('Runtime lock differs from component/toolchain pins');
const files={};
let profileLock=readFileSync(join(root,'build-locks/profile.lock.yaml'),'utf8');
for(const p of packages){
 const marker=', tarball: file:vendor/'+p.file+'}';
 const lines=profileLock.split('\n'),matches=lines.filter(l=>l.includes(marker));
 if(matches.length!==1)throw Error('Native profile lock does not describe the local package');
 profileLock=profileLock.replace(matches[0],matches[0].replace(/integrity: sha512-[A-Za-z0-9+/=]+/, 'integrity: '+p.integrity));
}
writeFileSync(join(bundle,'profile.lock.yaml'),profileLock);
for(const f of ['package.json','package-lock.json','profile.lock.yaml',...packages.map(p=>'vendor/'+p.file)])files[f]=createHash('sha256').update(readFileSync(join(bundle,f))).digest('hex');
save(join(bundle,'suite-manifest.json'),{schemaVersion:2,suiteVersion:components.distribution.suiteVersion,dshVersion:components.dsh.version,upstreamCommit:components.dsh.upstreamCommit,packages,files});
console.log('Built two attributed native plugins and a locked official DSH runtime bundle.');
