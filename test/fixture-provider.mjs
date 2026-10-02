// Installed-profile fixture; never distributed in either plugin tarball.
import {LlmAdapter} from '@deepseek-ai/dsh-llm';
export const name='offline-fixture';
export const inject=['llm'];
class FixtureAdapter extends LlmAdapter {
 async resolveModel(provider,id){return {provider,id,name:id,inputModalities:['text','image']};}
 async *stream(){
  globalThis.syntheticInferenceCount=(globalThis.syntheticInferenceCount??0)+1;
  yield {type:'block-start',index:0,blockType:'text'};
  yield {type:'text-delta',index:0,text:'OFFLINE_PROFILE_OK'};
  yield {type:'block-end',index:0,block:{type:'text',text:'OFFLINE_PROFILE_OK'}};
  yield {type:'finish',reason:{kind:'stop'}};
 }
}
export function apply(ctx){ctx.llm.registerAdapter(['offline-fixture'],new FixtureAdapter());}
