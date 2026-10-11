const $ = s => document.querySelector(s);
let csrf = '', model, group, activeView='content', dirty=false;
const status = text => {$('#status').textContent=text;};
const names = {openingStory:'Home & welcome',experienceStory:'Experience & why Lulu',retailStory:'Retail, hypermarket & food',leasingDialog:'Leasing popup','General & navigation':'Navigation & floating buttons'};
const pretty = value => names[value] || value.replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
async function api(url,method='GET',body) {
  const headers={'X-CSRF-Token':csrf};
  if (body && !(body instanceof FormData)) headers['Content-Type']='application/json';
  const response=await fetch(url,{method,headers,body:body instanceof FormData ? body : body ? JSON.stringify(body) : undefined});
  const result=await response.json();
  if (!response.ok) {if(response.status===401 && url!=='/api/admin/login') showLogin();throw new Error(result.error||'Request failed.');}
  return result;
}
function showLogin(){csrf='';$('#dashboard').hidden=true;$('#loginView').hidden=false;}
function changed(){dirty=true;status('You have unsaved changes.');}
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
async function loadDashboard(){
  model=await api('/api/admin/content');dirty=false;
  $('#loginView').hidden=true;$('#dashboard').hidden=false;
  const groups=[...new Set(model.fields.map(f=>f.group))];
  $('#sections').replaceChildren();
  for(const name of groups){const b=document.createElement('button');b.className='nav';b.textContent=pretty(name);b.dataset.group=name;b.addEventListener('click',()=>showView('content',name));$('#sections').append(b);}
  for(const [key,value] of Object.entries(model.settings)){const input=document.getElementById(key);if(input) input.value=value;}
  showView('content',groups.find(g=>g==='openingStory')||groups[0]);
}
function showView(view,selectedGroup=group){
  activeView=view;group=selectedGroup;
  for(const name of ['content','settings','enquiries','security']) $(`#${name}View`).hidden=name!==view;
  $('#save').hidden=!['content','settings'].includes(view);
  $('#viewTitle').textContent=view==='content'?pretty(group):{settings:'Logo & email settings',enquiries:'Leasing enquiries',security:'Account security'}[view];
  $('#viewDescription').textContent=view==='content'?'Edit text, images and links, then save to update the website.':view==='settings'?'Adjust your branding and enquiry recipient.':view==='enquiries'?'Review enquiries and check email delivery.':'Keep your admin account secure.';
  document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',view==='content'?b.dataset.group===group:b.dataset.view===view));
  if(view==='content'){$('#search').value='';renderFields();}
  if(view==='enquiries') loadEnquiries().catch(e=>status(e.message));
}
function renderFields(){
  const query=$('#search').value.toLowerCase();$('#fields').replaceChildren();
  for(const field of model.fields.filter(f=>f.group===group && (!query || `${f.label} ${model.values[f.id]??f.value}`.toLowerCase().includes(query)))) {
    const card=document.createElement('article');card.className='field';
    const label=document.createElement('label');const title=document.createElement('span');title.className='field-title';title.textContent=field.label;label.append(title);
    const value=model.values[field.id]??field.value;
    const input=document.createElement(field.type==='text' && value.length>90 ? 'textarea':'input');input.value=value;if(field.type==='number')input.type='number';label.append(input);card.append(label);
    const media=['media','background'].includes(field.type);
    let preview;
    const updatePreview = () => {
      if(preview) preview.remove();
      const source=input.value;
      if(/\.(mp4|webm)(\?|$)/i.test(source)){preview=document.createElement('video');preview.controls=true;preview.preload='metadata';}
      else if(/\.(png|jpe?g|gif|webp)(\?|$)/i.test(source)){preview=document.createElement('img');preview.alt='Current image';}
      else return;
      preview.src=/^(assets|uploads)\//.test(source)?'/'+source:source;card.append(preview);
    };
    input.addEventListener('input',()=>{model.values[field.id]=input.value;changed();});
    if(media){
      updatePreview();input.addEventListener('change',updatePreview);
      const uploadLabel=document.createElement('label');uploadLabel.textContent='Replace with an uploaded image or video';
      const file=document.createElement('input');file.type='file';file.accept='image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm';uploadLabel.append(file);card.append(uploadLabel);
      file.addEventListener('change',async()=>{
        if(!file.files[0])return;if(file.files[0].size>50*1024*1024){status('Choose a file smaller than 50 MB.');return;}
        const body=new FormData();body.append('file',file.files[0]);file.disabled=true;status('Uploading media…');
        try{const result=await api('/api/admin/upload','POST',body);input.value=result.url;model.values[field.id]=result.url;updatePreview();changed();}catch(e){status(e.message);}finally{file.disabled=false;}
      });
      const help=document.createElement('small');help.textContent='Upload media, or enter an assets/uploads path or HTTPS URL. Save changes to publish.';card.append(help);
    }
    $('#fields').append(card);
  }
}
$('#search').addEventListener('input',renderFields);
$('#loginForm').addEventListener('submit',async event=>{
  event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;$('#loginStatus').textContent='Signing in…';
  try{const result=await api('/api/admin/login','POST',Object.fromEntries(new FormData(event.target)));csrf=result.csrf;event.target.reset();await loadDashboard();$('#loginStatus').textContent='';}catch(e){$('#loginStatus').textContent=e.message;}finally{button.disabled=false;}
});
$('#logout').addEventListener('click',async()=>{if(dirty&&!confirm('Discard unsaved changes and sign out?'))return;try{await api('/api/admin/logout','POST',{});dirty=false;showLogin();}catch(e){status(e.message);}});
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
for(const key of ['headerLogoHeight','headerLogoHeightMobile','enquiryEmail']) document.getElementById(key).addEventListener('input',event=>{model.settings[key]=key==='enquiryEmail'?event.target.value:Number(event.target.value);changed();});
$('#save').addEventListener('click',async()=>{
  $('#save').disabled=true;status('Saving…');
  try{const result=await api('/api/admin/content','PUT',{values:model.values,settings:model.settings,revision:model.revision});model.revision=result.revision;dirty=false;status('Saved. Your website is updated.');}catch(e){status(e.message);}finally{$('#save').disabled=false;}
});
async function loadEnquiries(){
  const result=await api('/api/admin/enquiries');
  $('#emailNotice').textContent=result.emailConfigured?'Email sending is configured. Check delivery status below.':'SMTP is not configured. Enquiries are saved here, but email delivery is pending. Ask your developer to configure SMTP, then resend pending enquiries.';
  $('#enquiryList').replaceChildren();
  if(!result.enquiries.length){$('#enquiryList').textContent='No leasing enquiries yet.';return;}
  for(const enquiry of result.enquiries){
    const card=document.createElement('article');card.className='enquiry';
    const heading=document.createElement('h2');heading.textContent=`${enquiry.name} · ${enquiry.company}`;card.append(heading);
    const badge=document.createElement('span');badge.className='badge';badge.textContent=`EMAIL ${enquiry.emailStatus.toUpperCase()}`;card.append(badge);
    const details=document.createElement('p');details.className='details';details.textContent=`${new Date(enquiry.created).toLocaleString()} · ${enquiry.email} · ${enquiry.phone}`;card.append(details);
    const text=document.createElement('p');text.className='message';text.textContent=enquiry.message;card.append(text);
    const link=document.createElement('a');link.href='mailto:'+enquiry.email;link.textContent='Reply to enquiry ↗';card.append(link);
    if(enquiry.emailStatus!=='sent'){const retry=document.createElement('button');retry.style.marginLeft='16px';retry.textContent='Retry email';retry.addEventListener('click',async()=>{retry.disabled=true;try{const outcome=await api(`/api/admin/enquiries/${enquiry.id}/retry`,'POST',{});status(outcome.status==='sent'?'Email sent.':'Email is still pending or failed. Check SMTP settings.');await loadEnquiries();}catch(e){status(e.message);}finally{retry.disabled=false;}});card.append(retry);}
    $('#enquiryList').append(card);
  }
}
$('#refreshEnquiries').addEventListener('click',()=>loadEnquiries().catch(e=>status(e.message)));
$('#passwordForm').addEventListener('submit',async event=>{
  event.preventDefault();const values=Object.fromEntries(new FormData(event.target));
  if(values.newPassword!==values.confirmPassword){status('The new passwords do not match.');return;}
  try{await api('/api/admin/password','POST',values);dirty=false;event.target.reset();showLogin();$('#loginStatus').textContent='Password updated. Please sign in again.';}catch(e){status(e.message);}
});
api('/api/admin/session').then(async result=>{csrf=result.csrf;await loadDashboard();}).catch(()=>showLogin());

$('#exportContent').addEventListener('click',async()=>{
  try {
    const saved=await api('/api/admin/content');
    const url=URL.createObjectURL(new Blob([JSON.stringify(saved,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='lulu-content-backup.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);status('Saved content downloaded. Uploaded media files need a separate backup.');
  } catch(e) {status(e.message);}
});
$('#importContent').addEventListener('click',()=>$('#contentBackupFile').click());
$('#contentBackupFile').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try {
    if(file.size>1024*1024)throw new Error('The content backup must be smaller than 1 MB.');
    const backup=JSON.parse(await file.text());
    if(!backup.values || !backup.settings)throw new Error('Choose a valid Lulu Centre content backup.');
    if(!confirm('Replace the current website text, links and settings with this backup? Any unsaved changes will be discarded.'))return;
    await api('/api/admin/content','PUT',{values:backup.values,settings:backup.settings,revision:model.revision});
    await loadDashboard();status('Content restored. Copy any referenced uploaded media files separately.');
  } catch(e) {status(e.message);}finally{event.target.value='';}
});
