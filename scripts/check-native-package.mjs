import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const pkg=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
assert.equal(pkg.peerDependencies['@deepseek-ai/dsh-llm'],'0.2.0-rc.2');
assert.equal(pkg.dsh.bundle.patch,'./cordis.patch.yml');
const manifest=JSON.parse(readFileSync(resolve(root,'supergrok-hardening.json'),'utf8'));
assert.equal(manifest.upgradeRequestBoundary,undefined);
for(const file of ['lib/index.js','lib/adapter.js','lib/client.js']) {
 const code=readFileSync(resolve(root,file),'utf8');
 assert.doesNotMatch(code,/grokRequestBoundary|grok-oauth\/before-model-request|settingsScope/);
}
const env={...process.env,XAI_API_KEY:''};
for(const k of Object.keys(env))if(/API_KEY|TOKEN|SECRET|PASSWORD|AUTHORIZATION|^DSH_HOME$|^DSH_SUPERGROK_/i.test(k))delete env[k];
const result=spawnSync(process.execPath,['--input-type=module','-e',"await import('./lib/index.js'); console.log('native provider import ok')"],{cwd:root,encoding:'utf8',windowsHide:true,env});
assert.equal(result.status,0,result.stderr);
assert.ok(pkg.files.every(file=>!file.startsWith('deployment')&&!file.startsWith('contracts')));
console.log('PASS native package dependencies, client service, retired integrations and import');
