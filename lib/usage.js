import { fetchWithProxy, readResponseJson } from './net.js';
import { buildProtocolHeaders } from './protocol.js';
import { createHash } from 'node:crypto';

const URL = 'https://cli-chat-proxy.grok.com/v1/billing?format=credits';
const present = (v) => v !== undefined && v !== null;
function timestamp(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d\d-\d\dT.*(?:Z|[+-][0-9][0-9]:[0-9][0-9])$/.test(v)) return null;
  const n = Date.parse(v);
  return Number.isFinite(n) ? new Date(n).toISOString() : null;
}
function cents(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const n = v.val === undefined ? 0 : typeof v.val === 'string' && /^\d+$/.test(v.val) ? Number(v.val) : v.val;
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}
export function normalizeUsage(body, now = Date.now()) {
  const c = body?.config;
  if (!c || typeof c !== 'object' || Array.isArray(c)) throw new Error('invalid_billing_response');
  let usedPercent = null;
  if (present(c.creditUsagePercent)) {
    if (typeof c.creditUsagePercent === 'number' && Number.isFinite(c.creditUsagePercent) && c.creditUsagePercent >= 0) usedPercent = c.creditUsagePercent;
  } else {
    const used = cents(c.used), limit = cents(c.monthlyLimit);
    if (used !== null && limit !== null && limit > 0) usedPercent = used / limit * 100;
  }
  const resetAt = present(c.currentPeriod?.end) ? timestamp(c.currentPeriod.end) : timestamp(c.billingPeriodEnd);
  const type = c.currentPeriod?.type;
  const period = type === 'USAGE_PERIOD_TYPE_WEEKLY' ? 'weekly' : type === 'USAGE_PERIOD_TYPE_MONTHLY' ? 'monthly' : !present(c.currentPeriod) && resetAt ? 'monthly' : 'unknown';
  return {usedPercent, remainingPercent: usedPercent === null ? null : Math.max(0, 100-usedPercent), resetAt, period, fetchedAt:new Date(now).toISOString(), complete:usedPercent !== null && resetAt !== null};
}

/** Login-scoped memory only; optional dashboard failures never reach inference. */
export class UsageService {
  constructor(oauth, {fetchImpl=fetchWithProxy, now=Date.now}={}) {
    this.oauth=oauth; this.fetch=fetchImpl; this.now=now; this.epoch=0; this.last=null; this.pending=null; this.lastAttempt=-Infinity;
  }
  clear() { this.epoch++; this.controller?.abort(); this.last=null; this.pending=null; this.lastError=null; this.lastAttempt=-Infinity; }
  async get(force=false) {
    let epoch=this.epoch;
    const signed=(await this.oauth.uiStatus()).oauthStatus === 'signed-in';
    if (epoch!==this.epoch) return {status:'signed-out', snapshot:null};
    if (!signed) {this.clear(); return {status:'signed-out',snapshot:null};}
    let token;
    try {token=await this.oauth.getAccessToken();} catch {return {status:this.last?'stale':'unavailable',snapshot:this.last,error:'authentication_unavailable'};}
    if(epoch!==this.epoch) return {status:'signed-out',snapshot:null};
    if(!token) {this.clear();return {status:'signed-out',snapshot:null};}
    const identity=createHash('sha256').update(token).digest('hex');
    if(this.identity!==identity) {this.clear();this.identity=identity;epoch=this.epoch;}
    if (this.pending) return this.pending;
    const age=this.last ? this.now()-Date.parse(this.last.fetchedAt) : Infinity;
    if ((!force && age<60000) || this.now()-this.lastAttempt<5000) return {status:this.last ? !this.lastError&&age<60000?'ready':'stale':'unavailable',snapshot:this.last,...(this.lastError?{error:this.lastError}:{})};
    this.lastAttempt=this.now();
    const controller=new AbortController();this.controller=controller;
    const run=(async()=>{
      try {
        const response=await this.fetch(URL,{method:'GET',headers:buildProtocolHeaders({accessToken:token}),timeoutMs:15000,signal:controller.signal},'usage');
        if (!response.ok) {await response.body?.cancel?.(); throw new Error(`http_${response.status}`);}
        const snapshot=normalizeUsage(await readResponseJson(response),this.now());
        if(epoch!==this.epoch) return {status:'signed-out',snapshot:null};
        this.last=snapshot; this.lastError=null;
        return {status:'ready',snapshot};
      } catch(error) {
        if(epoch!==this.epoch) return {status:'signed-out',snapshot:null};
        this.lastError=/^http_\d{3}$/.test(error.message)?error.message:'usage_unavailable';
        return {status:this.last?'stale':'unavailable',snapshot:this.last,error:this.lastError};
      }
    })();
    this.pending=run;
    try {return await run;} finally {if(this.pending===run)this.pending=null;}
  }
}
