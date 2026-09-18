import {headers} from 'next/headers';
import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {db,ApiError} from './storage';

export const COOKIE='__Host-ed_session';
const SEVEN_DAYS=7*86400;
const options={N:16384,r:8,p:5,maxmem:32*1024*1024};
export type Account={id:string;username:string;role:'teacher'|'student';password_hash:string};
export const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
export function hashPassword(password:string){const salt=randomBytes(16).toString('hex');return JSON.stringify({v:1,salt,hash:scryptSync(password,salt,32,options).toString('hex')})}
export function verifyPassword(password:string,record:string){try{const p=JSON.parse(record);if(p.v!==1||!/^([a-f0-9]{32})$/.test(p.salt)||!/^([a-f0-9]{64})$/.test(p.hash))return false;const actual=scryptSync(password,p.salt,32,options);return timingSafeEqual(actual,Buffer.from(p.hash,'hex'))}catch{return false}}
const DUMMY=JSON.stringify({v:1,salt:'00000000000000000000000000000000',hash:'0'.repeat(64)});
export function checkPassword(password:string,a:Account|null){const ok=verifyPassword(password,a?.password_hash||DUMMY);return !!a&&ok}
export async function sessionTokenHash(){const h=await headers();const raw=(h.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);return raw&&/^[a-f0-9]{64}$/.test(raw)?digest(raw):null}
export async function currentAccount():Promise<Account|null>{const token=await sessionTokenHash();if(!token)return null;return await db().prepare('SELECT a.* FROM accounts a JOIN sessions s ON s.account_id=a.id WHERE s.token_hash=? AND s.expires>?').bind(token,Math.floor(Date.now()/1000)).first()}
export async function requireAccount(){const a=await currentAccount();if(!a)throw new ApiError('请使用网站用户名和密码登录。',401);return a}
export async function ownerProof():Promise<{id:string;email:string}|null>{return null}
export async function issueSession(id:string){const token=randomBytes(32).toString('hex');const expiry=Math.floor(Date.now()/1000)+SEVEN_DAYS;await db().prepare('INSERT INTO sessions (token_hash,account_id,expires) VALUES (?,?,?)').bind(digest(token),id,expiry).run();return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SEVEN_DAYS}`}
export const clearCookie=()=>`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
export async function limitLogin(username:string){const h=await headers(),now=Math.floor(Date.now()/1000);const ip=h.get('x-real-ip')||'unknown';const keys=[{key:'global:'+Math.floor(now/60),max:30,expires:now+60},{key:'ip:'+digest(ip)+':'+Math.floor(now/900),max:12,expires:now+900},{key:'user:'+digest(username)+':'+Math.floor(now/900),max:6,expires:now+900}];const results=await db().batch(keys.map(k=>db().prepare('INSERT INTO auth_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(k.key,k.expires)));if(results.some((r:any,i:number)=>r.results[0].count>keys[i].max))throw new ApiError('尝试次数过多，请稍后再试（最长等待 15 分钟）。',429);await db().batch([db().prepare('DELETE FROM auth_limits WHERE expires < ?').bind(now),db().prepare('DELETE FROM sessions WHERE expires < ?').bind(now)]);}
