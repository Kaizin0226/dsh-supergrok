import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8',windowsHide:true}).split('\0').filter(f=>f.endsWith('.md')&&existsSync(resolve(root,f)));
let links=0;
for(const file of files){
 const text=readFileSync(resolve(root,file),'utf8');
 if(!file.endsWith('/persona-prefix.md')&&(!text.includes('English')||!/(中文|简体中文)/.test(text)))throw Error('Bilingual sections missing: '+file);
 for(const match of text.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g)){
  const href=match[1];if(/^(?:https?:|#)/.test(href))continue;
  const target=decodeURIComponent(href.split('#')[0]);if(target&&!existsSync(resolve(dirname(resolve(root,file)),target)))throw Error('Broken document link: '+file+' -> '+target);
  links++;
 }
}
const readme=readFileSync(resolve(root,'README.md'),'utf8');
for(const version of ['0.2.0-rc.2','0.9.0-hardened.1','1.1.0','suite-v0.9.0-preview.1'])if(readme.split(version).length<3)throw Error('README version differs across languages');
if(existsSync(resolve(root,'README.zh.md'))||existsSync(resolve(root,'README.en.md')))throw Error('README languages must share one file');
console.log('PASS bilingual documents, same-file README, component versions and '+links+' local links');
