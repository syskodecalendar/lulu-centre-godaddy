import {readFileSync} from 'node:fs';
import {load} from 'cheerio';
export function makeCatalog(root) {
  const template = readFileSync(`${root}/index.html`, 'utf8');
  const css = readFileSync(`${root}/styles.css`, 'utf8');
  const $ = load(template);
  const fields = [];
  let nodeNumber = 0;
  $('*').each((_, element) => {
    const node = $(element);
    if (node.is('script, style, svg, path') || node.parents('script, style, svg').length) return;
    const region = node.closest('section, header, footer, nav, dialog, #preloader');
    const group = region.attr('id') || region.attr('class')?.split(' ')[0] || (node.closest('head').length ? 'SEO & browser title' : 'General & navigation');
    const nodeId = `n${++nodeNumber}`;
    node.attr('data-cms-node', nodeId);
    node.contents().each((index, child) => {
      if (child.type !== 'text' || !child.data.trim()) return;
      // Counters derive their displayed value from data-count.
      if (node.attr('data-count')) return;
      fields.push({id:`${nodeId}:text:${index}`, nodeId, type:'text', index, group, label:child.data.trim().slice(0,85), value:child.data.trim()});
    });
    const attributes = ['alt','title','aria-label','placeholder'];
    if (node.is('img, source, iframe')) attributes.push('src');
    if (node.is('video')) attributes.push('poster');
    if (node.is('a,link[rel="icon"]')) attributes.push('href');
    if (node.is('meta[name="description"],meta[property^="og:"]')) attributes.push('content');
    if (node.attr('data-count')) attributes.push('data-count');
    for (const attr of attributes) {
      const value = node.attr(attr);
      if (value === undefined) continue;
      const type = ['src','poster'].includes(attr) || (attr === 'href' && node.is('link')) ? 'media' : attr === 'href' ? 'link' : attr === 'data-count' ? 'number' : 'text';
      fields.push({id:`${nodeId}:attr:${attr}`, nodeId, attr, type, group, label:`${node.attr('alt') || node.text().trim().slice(0,55) || node.attr('id') || element.name} · ${attr}`, value});
    }
  });
  let cssIndex = 0;
  for (const match of css.matchAll(/url\(['"]?(assets\/[^)'"\s]+)['"]?\)/g)) {
    if (fields.some(f => f.type === 'background' && f.value === match[1])) continue;
    fields.push({id:`background:${++cssIndex}`, type:'background', group:'Background images', label:match[1].split('/').pop(), value:match[1]});
  }
  return {template:$.html(), css, fields};
}
export const defaults = {headerLogoHeight:80,headerLogoHeightMobile:66,enquiryEmail:'leasing@lulucentre.com'};
export function validURL(value, type) {
  if (/^[\s\S]*[\u0000-\u001f\\<>"']/.test(value)) return false;
  if (!value) return true;
  if (type === 'link' && (/^#[\w-]*$/.test(value) || /^(mailto:|tel:)[^\s]+$/i.test(value))) return true;
  if (/^(assets|uploads)\/[\w ./%-]+$/.test(value) && !value.includes('..')) return true;
  try {return new URL(value).protocol === 'https:';} catch {return false;}
}
export function validateContent(input, catalog) {
  if (!input || !input.values || typeof input.values !== 'object' || !input.settings) throw new Error('Invalid content.');
  const known = new Map(catalog.fields.map(f=>[f.id,f]));
  const values = {};
  for (const [id, value] of Object.entries(input.values)) {
    const field = known.get(id);
    if (!field || typeof value !== 'string' || value.length > 10000) throw new Error('Invalid content field.');
    if (['media','link','background'].includes(field.type) && !validURL(value, field.type)) throw new Error(`Use an assets/uploads path or an HTTPS URL for ${field.label}.`);
    if (field.type === 'number' && !/^\d{1,9}$/.test(value)) throw new Error('Counters must be positive whole numbers.');
    values[id] = value;
  }
  const settings = {...defaults};
  for (const key of ['headerLogoHeight','headerLogoHeightMobile']) {
    const n = Number(input.settings[key]);
    if (!Number.isFinite(n) || n < 30 || n > 140) throw new Error('Logo height is outside the supported range.');
    settings[key] = n;
  }
  if (typeof input.settings.enquiryEmail !== 'string' || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(input.settings.enquiryEmail) || input.settings.enquiryEmail.length > 254) throw new Error('Enter a valid leasing email address.');
  settings.enquiryEmail = input.settings.enquiryEmail;
  return {values,settings};
}
export function renderContent(catalog, content) {
  const $ = load(catalog.template);
  for (const field of catalog.fields) {
    const value = content.values[field.id];
    if (value === undefined || field.type === 'background') continue;
    const node = $(`[data-cms-node="${field.nodeId}"]`);
    if (field.attr) {
      node.attr(field.attr, value);
      if (field.attr === 'data-count') node.text(Number(value).toLocaleString('en-US'));
    } else {
      const child = node.contents()[field.index];
      if (child?.type === 'text') {
        const before = child.data.match(/^\s*/)[0];
        const after = child.data.match(/\s*$/)[0];
        child.data = before + value + after;
      }
    }
  }
  const s = {...defaults,...content.settings};
  $('head').append(`<style id="cms-logo-settings">:root{--header-logo-height:${s.headerLogoHeight}px;--header-logo-height-mobile:${s.headerLogoHeightMobile}px}</style>`);
  return $.html();
}
export function renderCSS(catalog, content) {
  let result = catalog.css;
  for (const field of catalog.fields.filter(f=>f.type==='background')) {
    if (content.values[field.id] !== undefined) result = result.split(field.value).join(content.values[field.id]);
  }
  return result;
}
