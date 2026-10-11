import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {passwordHash} from '../server.js';
import {openStorage} from '../backend/storage.js';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDir=path.resolve(process.env.DATA_DIR||path.join(root,'data'));
mkdirSync(dataDir,{recursive:true,mode:0o700});
if(!stdin.isTTY) throw new Error('Run setup-admin interactively in a terminal.');
const store=await openStorage(process.env,dataDir);
const rl=createInterface({input:stdin,output:stdout});
const username=(await rl.question('Admin username: ')).trim();
if(!/^[a-zA-Z0-9_.-]{3,80}$/.test(username)){rl.close();throw new Error('Use 3–80 letters, numbers, underscores, dots or hyphens.');}
if(await store.getAdmin()){const yes=await rl.question('An account exists. Replace it? Type yes: ');if(yes!=='yes'){rl.close();await store.close();process.exit(0);}}
rl.close();
function hiddenPrompt(prompt){return new Promise(resolve=>{
  stdout.write(prompt);let password='';stdin.setRawMode(true);stdin.resume();
  const listener=buffer=>{for(const char of buffer.toString()){
    if(char==='\u0003'){stdin.setRawMode(false);process.exit(130);}
    if(char==='\r'||char==='\n'){stdin.off('data',listener);stdin.setRawMode(false);stdin.pause();stdout.write('\n');resolve(password);return;}
    if(char==='\u007f'||char==='\b')password=password.slice(0,-1);else if(char>=' ')password+=char;
  }};stdin.on('data',listener);
});}
const password=await hiddenPrompt('Admin password (12+ characters, hidden): ');
const confirm=await hiddenPrompt('Confirm password: ');
if(password!==confirm||password.length<12||password.length>256)throw new Error('Passwords must match and be 12–256 characters.');
await store.setAdmin({username,passwordHash:await passwordHash(password)});
await store.close();
console.log('Admin account saved. Restart the server to invalidate any previous sessions. Visit /admin/ to sign in.');
