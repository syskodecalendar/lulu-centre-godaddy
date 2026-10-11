import express from 'express';
import multer from 'multer';
import nodemailer from 'nodemailer';
import {randomBytes, scrypt, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeCatalog, defaults, validateContent, renderContent, renderCSS} from './backend/content.js';
import {openStorage} from './backend/storage.js';
const root = path.dirname(fileURLToPath(import.meta.url));
const derive = promisify(scrypt);
// The public domain is not a secret. Keep a fixed trusted production default
// so a missing or malformed hosting variable cannot take this website offline.
export function resolveAppOrigin(value, production) {
  const fallback = 'https://lulucentre.com';
  let candidate = String(value || '').trim().replace(/^APP_ORIGIN\s*=\s*/i,'');
  if ((candidate.startsWith('"') && candidate.endsWith('"')) ||
      (candidate.startsWith("'") && candidate.endsWith("'"))) candidate = candidate.slice(1,-1).trim();
  if (!candidate) return {origin:production ? fallback : '', fallback:production};
  try {
    const url = new URL(candidate);
    if (!['https:', ...(production ? [] : ['http:'])].includes(url.protocol) || url.username || url.password) throw new Error('Invalid origin');
    return {origin:url.origin, fallback:false};
  } catch {
    return {origin:production ? fallback : '', fallback:production};
  }
}
export async function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await derive(password,salt,64)).toString('hex')}`;
}
async function checkPassword(password, hash) {
  if (!hash || typeof password !== 'string' || password.length > 256) return false;
  const [salt, hex] = hash.split(':');
  if (!salt || !/^[a-f0-9]{128}$/.test(hex || '')) return false;
  return timingSafeEqual(await derive(password,salt,64),Buffer.from(hex,'hex'));
}
export async function createApp(options = {}) {
  const env = {...process.env,...options.env};
  const production = env.NODE_ENV === 'production';
  const originConfig = resolveAppOrigin(env.APP_ORIGIN,production);
  env.APP_ORIGIN = originConfig.origin;
  if (production && originConfig.fallback) console.warn('[Lulu Centre] APP_ORIGIN missing or invalid; using the confirmed domain https://lulucentre.com.');
  if (production) console.info(`[Lulu Centre] Allowed request origin: ${env.APP_ORIGIN}`);
  const dataDir = path.resolve(options.dataDir || env.DATA_DIR || path.join(root,'data'));
  mkdirSync(dataDir,{recursive:true,mode:0o700});
  const catalog = makeCatalog(root);
  const db = await openStorage(env,dataDir);
  const uploadsDir = path.resolve(options.uploadsDir || env.UPLOADS_DIR || (db.driver === 'mysql' ? path.join(root,'public/assets/uploads') : path.join(dataDir,'uploads')));
  mkdirSync(uploadsDir,{recursive:true});
  // Environment credentials seed a new account only; later password changes stay in MySQL.
  if (!await db.getAdmin() && (env.ADMIN_USERNAME || env.ADMIN_PASSWORD)) {
    if (!/^[a-zA-Z0-9_.-]{3,80}$/.test(env.ADMIN_USERNAME || '') || !env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 12 || env.ADMIN_PASSWORD.length > 256) {
      await db.close();throw new Error('Set ADMIN_USERNAME (3–80 characters) and ADMIN_PASSWORD (12–256 characters).');
    }
    await db.seedAdmin({username:env.ADMIN_USERNAME,passwordHash:await passwordHash(env.ADMIN_PASSWORD)});
  }
  const getContent = () => db.getContent();
  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY === '1') app.set('trust proxy',1);
  const sessions = new Map();
  const attempts = new Map();
  const rate = (kind,max,windowMs) => (req,res,next) => {
    const now=Date.now();const key=`${kind}:${req.ip}`;
    if (attempts.size > 10000) for (const [k,v] of attempts) if (v.until < now) attempts.delete(k);
    let value=attempts.get(key);
    if (!value || value.until < now) value={count:0,until:now+windowMs};
    attempts.set(key,value);
    if (++value.count > max) return res.status(429).json({error:'Too many attempts. Please try again later.'});
    next();
  };
  app.use((req,res,next)=>{
    res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'SAMEORIGIN'});
    if (req.path.startsWith('/api') || req.path.startsWith('/admin')) res.set('Cache-Control','no-store');
    next();
  });
  app.use(express.json({limit:'1mb'}));
  const sameOrigin = (req,res,next) => {
    const origin=req.get('origin');
    const expected=env.APP_ORIGIN || `${req.protocol}://${req.get('host')}`;
    if (origin && origin !== expected) return res.status(403).json({error:'Request origin rejected.'});
    if (production && !origin) return res.status(403).json({error:'Request origin required.'});
    next();
  };
  const cookieName = production ? '__Host-lulu_admin' : 'lulu_admin';
  const cookieOptions = {httpOnly:true,secure:production,sameSite:'strict',path:'/',maxAge:8*60*60*1000};
  const requireAdmin = (req,res,next) => {
    const match=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='));
    const token=match?.slice(cookieName.length+1);
    const session=sessions.get(token);
    if (!session || session.expires < Date.now()) {sessions.delete(token);return res.status(401).json({error:'Please sign in.'});}
    req.session=session;req.sessionToken=token;next();
  };
  const csrf = (req,res,next) => {
    if (req.get('X-CSRF-Token') !== req.session.csrf) return res.status(403).json({error:'Security token expired. Sign in again.'});
    next();
  };
  app.get('/api/admin/session',requireAdmin,(req,res)=>res.json({csrf:req.session.csrf}));
  app.post('/api/admin/login',sameOrigin,rate('login',10,15*60*1000),async(req,res)=>{
    let config;
    config=await db.getAdmin();
    if (!config) return res.status(503).json({error:'Admin account is not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD, then restart.'});
    const ok=await checkPassword(req.body?.password,config.passwordHash);
    if (!ok || req.body?.username !== config.username) return res.status(401).json({error:'Incorrect username or password.'});
    for (const [key,s] of sessions) if (s.expires<Date.now()) sessions.delete(key);
    const token=randomBytes(32).toString('hex');const securityToken=randomBytes(32).toString('hex');
    sessions.set(token,{csrf:securityToken,expires:Date.now()+cookieOptions.maxAge});
    res.cookie(cookieName,token,cookieOptions).json({csrf:securityToken});
  });
  app.post('/api/admin/logout',sameOrigin,requireAdmin,csrf,(req,res)=>{sessions.delete(req.sessionToken);res.clearCookie(cookieName,{...cookieOptions,maxAge:undefined}).json({ok:true});});
  app.get('/api/admin/content',requireAdmin,async(req,res)=>res.json({...await getContent(),fields:catalog.fields}));
  app.put('/api/admin/content',sameOrigin,requireAdmin,csrf,async(req,res)=>{
    let content;
    try {content=validateContent(req.body,catalog);} catch(error) {return res.status(400).json({error:error.message});}
    const revision=Number(req.body.revision);
    if (!Number.isSafeInteger(revision) || revision < 1) return res.status(400).json({error:'Invalid content revision.'});
    const changed=await db.saveContent(content,revision);
    if (!changed) return res.status(409).json({error:'Content changed in another session. Reload before saving.'});
    res.json({ok:true,revision:revision+1});
  });
  const allowedTypes=new Map([['image/png','.png'],['image/jpeg','.jpg'],['image/webp','.webp'],['image/gif','.gif'],['video/mp4','.mp4'],['video/webm','.webm']]);
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:50*1024*1024,files:1,fields:0},fileFilter:(req,file,cb)=>cb(null,allowedTypes.has(file.mimetype))});
  app.post('/api/admin/upload',sameOrigin,requireAdmin,csrf,upload.single('file'),(req,res)=>{
    const file=req.file;
    if (!file) return res.status(400).json({error:'Choose a PNG, JPEG, WebP, GIF, MP4 or WebM file (maximum 50 MB).'});
    const b=file.buffer;
    const actual=b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':b[0]===255&&b[1]===216&&b[2]===255?'image/jpeg':b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'?'image/webp':/^GIF8[79]a/.test(b.toString('ascii',0,6))?'image/gif':b.toString('ascii',4,8)==='ftyp'?'video/mp4':b.subarray(0,4).equals(Buffer.from([26,69,223,163]))?'video/webm':null;
    if (actual !== file.mimetype) return res.status(400).json({error:'The file contents do not match the selected media type.'});
    const filename=randomBytes(18).toString('hex')+allowedTypes.get(actual);
    writeFileSync(path.join(uploadsDir,filename),b,{flag:'wx'});
    res.json({url:`uploads/${filename}`});
  });
  const smtpConfigured=Boolean(env.SMTP_HOST && env.SMTP_FROM && env.SMTP_USER && env.SMTP_PASS);
  const transporter=options.transporter || (smtpConfigured ? nodemailer.createTransport({host:env.SMTP_HOST,port:Number(env.SMTP_PORT||587),secure:env.SMTP_SECURE==='true',requireTLS:env.SMTP_SECURE!=='true',auth:{user:env.SMTP_USER,pass:env.SMTP_PASS},connectionTimeout:10000,socketTimeout:15000,disableFileAccess:true,disableUrlAccess:true}) : null);
  const mailing=new Set();
  async function sendEnquiry(id) {
    if (mailing.has(id)) return 'sending';
    const row=await db.getEnquiry(id);
    if (!row || row.email_status==='sent') return row?.email_status;
    if (!transporter) return 'pending';
    mailing.add(id);
    const info=JSON.parse(row.payload);
    try {
      const mail=await transporter.sendMail({from:env.SMTP_FROM,to:(await getContent()).settings.enquiryEmail,replyTo:info.email,subject:'New Lulu Centre leasing enquiry',text:`Name: ${info.name}\nCompany / brand: ${info.company}\nEmail: ${info.email}\nPhone: ${info.phone}\nReceived: ${row.created}\nReference: ${id}\n\nRequirements:\n${info.message}\n\nContact consent: provided`});
      if (mail.rejected?.length) throw new Error('Recipient rejected');
      await db.setEmailStatus(id,'sent');
      return 'sent';
    } catch {await db.setEmailStatus(id,'failed');return 'failed';}
    finally {mailing.delete(id);}
  }
  app.post('/api/enquiries',sameOrigin,rate('enquiry',8,60*60*1000),async(req,res)=>{
    const body=req.body || {};
    if (body.website) return res.json({message:'Thank you. Your enquiry has been received.'});
    const info={};
    for(const [key,max] of Object.entries({name:120,company:160,email:254,phone:40,message:4000})) {
      const value=body[key];
      if (typeof value!=='string' || !value.trim() || value.length>max || (key!=='message' && /[\r\n\u0000]/.test(value))) return res.status(400).json({error:'Please complete all fields with valid details.'});
      info[key]=value.trim();
    }
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(info.email) || body.consent!==true || !/^[\d+().\s-]{5,40}$/.test(info.phone)) return res.status(400).json({error:'Check your email, phone number and contact consent.'});
    if (!Number.isFinite(body.startedAt) || Date.now()-body.startedAt < 1500 || Date.now()-body.startedAt > 24*60*60*1000) return res.status(400).json({error:'Please reopen the form and try again.'});
    if (typeof body.requestId!=='string' || !/^[a-f0-9-]{36}$/.test(body.requestId)) return res.status(400).json({error:'Invalid enquiry reference.'});
    const existing=await db.getEnquiry(body.requestId);
    if (existing && existing.payload !== JSON.stringify(info)) return res.status(409).json({error:'Please reopen the form to send a new enquiry.'});
    await db.insertEnquiry(body.requestId,new Date().toISOString(),JSON.stringify(info));
    const stored=await db.getEnquiry(body.requestId);
    if (stored.payload !== JSON.stringify(info)) return res.status(409).json({error:'Please reopen the form to send a new enquiry.'});
    await sendEnquiry(body.requestId);
    res.json({message:'Thank you. Your enquiry has been received. Our leasing team will get in touch.'});
  });
  app.get('/api/admin/enquiries',requireAdmin,async(req,res)=>res.json({emailConfigured:Boolean(transporter),enquiries:(await db.listEnquiries()).map(r=>({...JSON.parse(r.payload),id:r.id,created:r.created,emailStatus:r.email_status}))}));
  app.post('/api/admin/enquiries/:id/retry',sameOrigin,requireAdmin,csrf,async(req,res)=>{
    if (!await db.getEnquiry(req.params.id)) return res.status(404).json({error:'Enquiry not found.'});
    const status=await sendEnquiry(req.params.id);res.json({status});
  });
  app.post('/api/admin/password',sameOrigin,requireAdmin,csrf,rate('password',10,15*60*1000),async(req,res)=>{
    const config=await db.getAdmin();
    if (!await checkPassword(req.body?.currentPassword,config.passwordHash)) return res.status(400).json({error:'Current password is incorrect.'});
    const password=req.body?.newPassword;
    if (typeof password!=='string'||password.length<12||password.length>256) return res.status(400).json({error:'Use a password with 12 to 256 characters.'});
    config.passwordHash=await passwordHash(password);
    await db.setAdmin(config);
    sessions.clear();res.clearCookie(cookieName,{...cookieOptions,maxAge:undefined}).json({ok:true});
  });
  app.get(['/', '/index.html'],async(req,res)=>res.type('html').set('Cache-Control','no-cache').send(renderContent(catalog,await getContent())));
  app.get('/styles.css',async(req,res)=>res.type('css').set('Cache-Control','no-cache').send(renderCSS(catalog,await getContent())));
  app.get('/health',async(req,res)=>{try{await db.health();res.json({ok:true,storage:db.driver,origin:env.APP_ORIGIN});}catch{res.status(503).json({ok:false});}});
  app.use('/admin',express.static(path.join(root,'admin')));
  app.use('/assets',express.static(path.join(root,'assets'),{dotfiles:'deny',maxAge:'1d'}));
  app.use('/uploads',express.static(uploadsDir,{dotfiles:'deny',maxAge:'1y',immutable:true}));
  for(const file of ['script.js','leasing.js']) app.get('/'+file,(req,res)=>res.sendFile(path.join(root,file)));
  app.use((req,res)=>res.status(404).send('Page not found.'));
  app.use((error,req,res,next)=>res.status(error.status||400).json({error:error instanceof multer.MulterError ? 'Upload failed. Maximum file size is 50 MB.' : 'The request could not be completed.'}));
  return {app,close:()=>db.close()};
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const {app}=await createApp();
  app.listen(Number(process.env.PORT||3000),process.env.HOST||'0.0.0.0',()=>console.log(`Lulu Centre running on port ${process.env.PORT||3000}`));
}
