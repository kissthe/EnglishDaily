import {randomUUID,randomBytes,scryptSync} from 'node:crypto';
import {openDatabase} from '../lib/runtime.mjs';
const username=(process.env.TEACHER_USERNAME||'').trim().toLowerCase();
const password=process.env.TEACHER_PASSWORD||'';
if(!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username)||password.length<12||password.length>128){console.error('Set TEACHER_USERNAME (3–32 characters) and TEACHER_PASSWORD (12–128 characters).');process.exit(1)}
const db=openDatabase();
if(db.prepare("SELECT id FROM accounts WHERE role='teacher'").get()){console.error('Teacher already exists; no data changed.');process.exit(1)}
const id=randomUUID(),salt=randomBytes(16).toString('hex');
const hash=JSON.stringify({v:1,salt,hash:scryptSync(password,salt,32,{N:16384,r:8,p:5,maxmem:32*1024*1024}).toString('hex')});
db.exec('BEGIN IMMEDIATE');try{
 if(db.prepare('SELECT id FROM settings WHERE id=1').get())throw Error('Existing settings found. Restore/migrate the matching accounts instead of reinitializing.');
 db.prepare("INSERT INTO accounts(id,username,role,password_hash,created) VALUES (?,?,'teacher',?,?)").run(id,username,hash,new Date().toISOString());
 db.prepare('INSERT INTO settings(id,owner,data) VALUES (1,?,?)').run(id,JSON.stringify({studentEmail:'',studentName:'同学',textbook:'待设置',region:'待设置',minutes:20}));
 db.exec('COMMIT');console.log('Teacher created. Sign in, configure teaching settings, then create the student account.');
}catch(e){db.exec('ROLLBACK');throw e}finally{db.close()}
