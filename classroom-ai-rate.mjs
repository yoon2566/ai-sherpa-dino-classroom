import {DurableObject} from 'cloudflare:workers';
import {json,REQUESTS_PER_MINUTE} from './ai-gateway.mjs';

// Owned by Dino 2; neither this namespace nor its storage belongs to Dino 1.
export class GameRateLimit extends DurableObject{
  async fetch(){return this.ctx.storage.transaction(async storage=>{const minute=Math.floor(Date.now()/60000);let state=await storage.get('rate');if(!state||state.minute!==minute)state={minute,total:0};if(state.total>=REQUESTS_PER_MINUTE)return json({error:'요청이 많습니다. 잠시 후 다시 시도해 주세요.'},429,{'Retry-After':String(60-new Date().getSeconds())});state.total++;await storage.put('rate',state);return json({ok:true})})}
}
