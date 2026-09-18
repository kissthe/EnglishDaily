import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,readdirSync} from 'node:fs';
import {readFile,writeFile,rename,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {Readable} from 'node:stream';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
export const dataDir=()=>path.resolve(process.env.DATA_DIR||'data');
let database;
export function openDatabase(){
 if(database)return database;
 mkdirSync(dataDir(),{recursive:true,mode:0o700});
 const db=new DatabaseSync(path.join(dataDir(),'english-daily.sqlite'));
 db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
 db.exec('CREATE TABLE IF NOT EXISTS selfhost_migrations (name TEXT PRIMARY KEY)');
 try{db.exec('BEGIN IMMEDIATE');for(const name of readdirSync(path.resolve('drizzle')).filter(n=>n.endsWith('.sql')).sort()){
  if(db.prepare('SELECT name FROM selfhost_migrations WHERE name=?').get(name))continue;
  db.exec(readFileSync(path.resolve('drizzle',name),'utf8'));db.prepare('INSERT INTO selfhost_migrations(name) VALUES (?)').run(name);
 }db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');db.close();throw e}
 database=db;return db;
}
function statement(query,args=[]){return {query,args,bind(...values){return statement(query,values)},async first(){return openDatabase().prepare(query).get(...args)||null},async all(){return {results:openDatabase().prepare(query).all(...args)}},async run(){const r=openDatabase().prepare(query).run(...args);return {success:true,meta:{changes:Number(r.changes)}}}}}
const DB={prepare:statement,async batch(statements){const db=openDatabase();db.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>{const q=db.prepare(s.query);return q.columns().length?{results:q.all(...s.args)}:{results:[],meta:{changes:Number(q.run(...s.args).changes)}}});db.exec('COMMIT');return results}catch(e){db.exec('ROLLBACK');throw e}}};
function location(key){if(typeof key!=='string'||!/^[-a-f0-9]{36}$/.test(key))throw Error('Invalid media key');const dir=path.join(dataDir(),'media');mkdirSync(dir,{recursive:true,mode:0o700});return path.join(dir,key)}
const BUCKET={
 async put(key,value,options){const file=location(key),temp=file+'.'+randomUUID()+'.tmp';const bytes=value instanceof ArrayBuffer?Buffer.from(value):Buffer.from(await new Response(value).arrayBuffer());await writeFile(temp,bytes,{mode:0o600});await rename(temp,file);await writeFile(file+'.json',JSON.stringify(options?.httpMetadata||{}),{mode:0o600})},
 async head(key){const file=location(key);try{const info=await stat(file);return {size:info.size,httpMetadata:JSON.parse(await readFile(file+'.json','utf8'))}}catch(e){if(e.code==='ENOENT')return null;throw e}},
 async get(key,options){const head=await this.head(key);if(!head)return null;const range=options?.range;return {...head,body:Readable.toWeb(createReadStream(location(key),range?{start:range.offset,end:range.offset+range.length-1}:{}))}}
};
export const env={DB,BUCKET};
