import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp} from '../server.js';
import {openStorage} from '../backend/storage.js';

test('production refuses missing MySQL settings and unconfirmed local SQLite',async()=>{
  await assert.rejects(openStorage({NODE_ENV:'production'},tmpdir()),/Missing DB_HOST/);
  await assert.rejects(openStorage({NODE_ENV:'production',STORAGE_DRIVER:'sqlite'},tmpdir()),/confirmed persistent disk/);
});

test('first account is seeded once; password changes survive startup with old seed credentials',async()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'lulu-seed-'));
  const env={NODE_ENV:'development',STORAGE_DRIVER:'sqlite',ADMIN_USERNAME:'luluadmin',ADMIN_PASSWORD:'initial-test-password-123'};
  let site;
  try {
    site=await createApp({dataDir:dir,env});await site.close();site=undefined;
    const store=await openStorage(env,dir);
    const account=await store.getAdmin();assert.equal(account.username,'luluadmin');
    await store.setAdmin({...account,passwordHash:'replacement-for-test'});await store.close();
    site=await createApp({dataDir:dir,env});await site.close();site=undefined;
    const reopened=await openStorage(env,dir);
    assert.equal((await reopened.getAdmin()).passwordHash,'replacement-for-test');await reopened.close();
  } finally {if(site)await site.close();rmSync(dir,{recursive:true,force:true});}
});

test('MySQL persistence, revisions, enquiries and account survive a new connection pool', {skip:!process.env.LULU_TEST_MYSQL}, async()=>{
  const env={...process.env,STORAGE_DRIVER:'mysql'};
  // Use an empty disposable database: this test inserts and updates test records.
  let store=await openStorage(env,tmpdir());
  try {
    let state=await store.getContent();
    assert.equal(await store.saveContent({values:{test:'persistent'},settings:state.settings},state.revision),1);
    assert.equal(await store.saveContent({values:{test:'stale'},settings:state.settings},state.revision),0);
    await store.insertEnquiry('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',new Date().toISOString(),'{"name":"Test"}');
    await store.setEmailStatus('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee','sent');
    await store.setAdmin({username:'testadmin',passwordHash:'persistent-test-hash'});
    await store.close();store=await openStorage(env,tmpdir());
    assert.equal((await store.getContent()).values.test,'persistent');
    assert.equal((await store.getEnquiry('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')).email_status,'sent');
    assert.equal((await store.getAdmin()).passwordHash,'persistent-test-hash');
    await store.health();
  } finally {await store.close();}
});
