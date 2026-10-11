// Import a content backup downloaded from the original live admin API.
// Example: npm run import-content -- /absolute/path/lulu-content-backup.json
import {readFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeCatalog,validateContent} from '../backend/content.js';
import {openStorage} from '../backend/storage.js';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
if(!process.argv[2]) throw new Error('Provide the path to lulu-content-backup.json.');
const content=validateContent(JSON.parse(readFileSync(process.argv[2],'utf8')),makeCatalog(root));
const dataDir=path.resolve(process.env.DATA_DIR || path.join(root,'data'));
mkdirSync(dataDir,{recursive:true});
const store=await openStorage(process.env,dataDir);
try {
  const current=await store.getContent();
  if(Object.keys(current.values).length) throw new Error('Destination already has edited content. Import is refused to protect it.');
  if(!await store.saveContent(content,current.revision)) throw new Error('Content changed during import. Nothing was replaced.');
  console.log('Content imported. Copy any referenced uploads separately, then check the site.');
} finally {await store.close();}
