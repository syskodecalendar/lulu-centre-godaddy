import mysql from 'mysql2/promise';
import path from 'node:path';
import {readFileSync, writeFileSync, renameSync} from 'node:fs';
import {defaults} from './content.js';

export async function openStorage(env, dataDir) {
  const driver = env.STORAGE_DRIVER || (env.NODE_ENV === 'production' ? 'mysql' : 'sqlite');
  if (!['mysql', 'sqlite'].includes(driver)) throw new Error('STORAGE_DRIVER must be mysql or sqlite.');
  if (driver === 'mysql') {
    for (const key of ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']) {
      if (!env[key]) throw new Error(`Missing ${key}. Configure the GoDaddy MySQL database before starting.`);
    }
    const pool = mysql.createPool({host:env.DB_HOST, port:Number(env.DB_PORT || 3306), database:env.DB_NAME,
      user:env.DB_USER, password:env.DB_PASSWORD, connectionLimit:5, charset:'utf8mb4',
      ...(env.DB_SSL === 'true' ? {ssl:{rejectUnauthorized:true}} : {})});
    const query = async (sql, params = []) => (await pool.execute(sql, params))[0];
    try {
      await query(`CREATE TABLE IF NOT EXISTS lulu_content (id TINYINT PRIMARY KEY, revision INT NOT NULL, payload LONGTEXT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await query(`CREATE TABLE IF NOT EXISTS lulu_enquiries (id CHAR(36) PRIMARY KEY, created VARCHAR(30) NOT NULL, payload TEXT NOT NULL, email_status VARCHAR(16) NOT NULL DEFAULT 'pending') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await query(`CREATE TABLE IF NOT EXISTS lulu_admin (id TINYINT PRIMARY KEY, username VARCHAR(80) NOT NULL, password_hash VARCHAR(200) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await query('INSERT IGNORE INTO lulu_content VALUES (1,1,?)', [JSON.stringify({values:{},settings:defaults})]);
    } catch (error) {await pool.end(); throw error;}
    return {
      driver,
      async getContent() {const [r] = await query('SELECT * FROM lulu_content WHERE id=1'); return {...JSON.parse(r.payload), revision:r.revision};},
      async saveContent(content, revision) {return (await query('UPDATE lulu_content SET payload=?, revision=revision+1 WHERE id=1 AND revision=?', [JSON.stringify(content), revision])).affectedRows;},
      async getEnquiry(id) {return (await query('SELECT * FROM lulu_enquiries WHERE id=?', [id]))[0];},
      async insertEnquiry(id, created, payload) {await query('INSERT IGNORE INTO lulu_enquiries (id,created,payload) VALUES (?,?,?)', [id,created,payload]);},
      async setEmailStatus(id, status) {await query('UPDATE lulu_enquiries SET email_status=? WHERE id=?', [status,id]);},
      async listEnquiries() {return query('SELECT * FROM lulu_enquiries ORDER BY created DESC LIMIT 500');},
      async getAdmin() {const [r] = await query('SELECT * FROM lulu_admin WHERE id=1'); return r && {username:r.username,passwordHash:r.password_hash};},
      async seedAdmin(config) {await query('INSERT IGNORE INTO lulu_admin VALUES (1,?,?)', [config.username, config.passwordHash]);},
      async setAdmin(config) {await query('INSERT INTO lulu_admin VALUES (1,?,?) ON DUPLICATE KEY UPDATE username=VALUES(username),password_hash=VALUES(password_hash)', [config.username, config.passwordHash]);},
      async health() {await query('SELECT 1');},
      close:() => pool.end()
    };
  }
  if (env.NODE_ENV === 'production' && env.ALLOW_LOCAL_SQLITE !== 'true') throw new Error('Production SQLite requires a confirmed persistent disk and ALLOW_LOCAL_SQLITE=true. Use mysql on GoDaddy.');
  const {DatabaseSync} = await import('node:sqlite');
  const db = new DatabaseSync(path.join(dataDir,'site.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS content (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS enquiries (id TEXT PRIMARY KEY, created TEXT NOT NULL, payload TEXT NOT NULL, email_status TEXT NOT NULL DEFAULT 'pending');`);
  db.prepare('INSERT OR IGNORE INTO content VALUES (1,1,?)').run(JSON.stringify({values:{},settings:defaults}));
  return {
    driver,
    async getContent() {const r=db.prepare('SELECT * FROM content WHERE id=1').get();return {...JSON.parse(r.payload),revision:r.revision};},
    async saveContent(content, revision) {return db.prepare('UPDATE content SET payload=?,revision=revision+1 WHERE id=1 AND revision=?').run(JSON.stringify(content),revision).changes;},
    async getEnquiry(id) {return db.prepare('SELECT * FROM enquiries WHERE id=?').get(id);},
    async insertEnquiry(id,created,payload) {db.prepare('INSERT OR IGNORE INTO enquiries (id,created,payload) VALUES (?,?,?)').run(id,created,payload);},
    async setEmailStatus(id,status) {db.prepare('UPDATE enquiries SET email_status=? WHERE id=?').run(status,id);},
    async listEnquiries() {return db.prepare('SELECT * FROM enquiries ORDER BY created DESC LIMIT 500').all();},
    async getAdmin() {try{return JSON.parse(readFileSync(path.join(dataDir,'admin.json'),'utf8'));}catch(error){if(error.code==='ENOENT')return undefined;throw error;}},
    async seedAdmin(config) {if (!await this.getAdmin()) await this.setAdmin(config);},
    async setAdmin(config) {const file=path.join(dataDir,'admin.json');writeFileSync(file+'.tmp',JSON.stringify(config),{mode:0o600});renameSync(file+'.tmp',file);},
    async health() {db.prepare('SELECT 1').get();},
    async close() {db.close();}
  };
}
