import {env} from './runtime.mjs';
export function db(){const binding=(env as any).DB;if(!binding)throw new Error('数据库暂时不可用');return binding}
export function bucket(){const binding=(env as any).BUCKET;if(!binding)throw new Error('音频存储暂时不可用');return binding}
export class ApiError extends Error{constructor(message:string,public status=400){super(message)}}
export function failure(e:unknown){if(e instanceof ApiError)return Response.json({error:e.message},{status:e.status,headers:{'Cache-Control':'no-store'}});console.error('English Daily request failed',e instanceof Error?e.name:'unknown');return Response.json({error:'暂时无法完成请求，请稍后重试。'},{status:500,headers:{'Cache-Control':'no-store'}})}
export function sameOrigin(req:Request){const origin=req.headers.get('origin');if(!origin||origin!==(process.env.PUBLIC_ORIGIN||new URL(req.url).origin))throw new ApiError('请求来源验证失败，请刷新页面重试。',403)}
