import {db,ApiError} from './storage';
import {requireAccount} from './auth';
import type {Settings} from './course';
export {db,bucket,ApiError,failure,sameOrigin} from './storage';
export async function identity(){const a=await requireAccount();return {id:a.id,email:a.username,username:a.username}}
export async function context(){const a=await requireAccount();const row=await db().prepare('SELECT * FROM settings WHERE id=1').first();if(!row)throw new ApiError('老师尚未完成教学设置，请联系老师。',503);const settings=JSON.parse(row.data) as Settings;if(a.role==='teacher'&&row.owner===a.id)return {id:a.id,email:a.username,username:a.username,role:'teacher' as const,settings};if(a.role==='student'&&settings.studentId===a.id)return {id:a.id,email:a.username,username:a.username,role:'student' as const,settings};throw new ApiError('账号暂时不可用，请联系老师。',403)}
