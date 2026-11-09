import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

async function open(page) {
  await page.goto('/X2/'); await expect(page.locator('#journal')).toBeVisible();
}
async function startDay(page, date, slot = 1) {
  await page.getByRole('button', { name: new RegExp(`Jour ${slot}`) }).click();
  await page.locator('#date-button').click(); await page.locator('#day-date-input').fill(date);
  await page.getByRole('button', { name: 'Enregistrer la date', exact: true }).click();
  await expect(page.locator('#date-dialog')).not.toBeVisible();
}
async function add(page, kind, time, volume, extra = {}) {
  await page.locator(`[data-kind="${kind}"]`).click();
  await page.locator('#event-time').fill(time);
  if (volume) await page.locator('#event-volume').fill(String(volume));
  if (extra.remarks) await page.locator('#event-remarks').fill(extra.remarks);
  if (extra.drinkType) await page.locator('#drink-type').selectOption(extra.drinkType);
  if (extra.drinkLabel) await page.locator('#drink-label').fill(extra.drinkLabel);
  await page.locator('#save-event').click(); await expect(page.locator('#event-dialog')).not.toBeVisible();
}
async function stored(page) {
  return page.evaluate(async () => {
    const { openDatabase, readDiary } = await import('./js/db.js'); const db = await openDatabase();
    const value = await readDiary(db); db.close(); return value;
  });
}
async function restore(page, value) {
  await page.locator('#options-button').click();
  await page.locator('#restore-file').setInputFiles({ name:'synthetic.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(value)) });
  await expect(page.locator('#restore-preview')).toBeVisible();
  await page.locator('#confirm-restore').click(); await expect(page.locator('#options-dialog')).not.toBeVisible();
}
async function readyOffline(page) {
  await expect(page.locator('#offline-status')).toHaveText('Disponible hors ligne', { timeout:15_000 });
}
function syntheticReport() {
  const event = (id, kind, date, volumeMl=null, remarks='') => ({id,kind,occurredAt:date.replace('T','T')+':00.000Z',localDateTime:date,offsetMinutes:0,timeZone:'UTC',volumeMl,drinkType:kind==='drink'?'water':null,drinkLabel:'',urgency:null,remarks});
  return {format:'x2-diary',schemaVersion:1,days:[1,2,3].map((slot,i)=>({id:`day-${slot}`,slot,startDate:`2040-11-${['09','12','18'][i]}`,status:'completed',completedAt:'2040-12-01T00:00:00.000Z',events:slot===1?[
    event('drink','drink','2040-11-09T12:00',175),event('dayvoid','void','2040-11-09T14:00',180),
    event('bed','bedtime','2040-11-09T22:15'),event('night','void','2040-11-10T03:10',120),
    event('wake','wake','2040-11-10T06:50'),event('morning','void','2040-11-10T07:00',230,'Texte synthétique accentué : été, café, réveil.'),
  ]:[]}))};
}
test('entry, editing, deletion, completion, reopening, persistence and non-consecutive dates', async ({page}) => {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message)); page.on('dialog',d=>d.accept()); await open(page);
  await startDay(page,'2040-11-09');
  await add(page,'drink','2040-11-09T12:00',175);
  await add(page,'bedtime','2040-11-09T22:15'); await add(page,'void','2040-11-10T03:10',120,{remarks:'Saisie synthétique'});
  await add(page,'wake','2040-11-10T06:50'); await add(page,'void','2040-11-10T07:00',230);
  await expect(page.locator('.history-row')).toHaveCount(5);
  expect(await page.locator('.event-clock').allTextContents()).toEqual(['12:00','22:15','03:10','06:50','07:00']);
  await expect(page.locator('#history')).toContainText('Première miction du matin');
  expect((await stored(page)).diary.days[0].events.find(e=>e.kind==='void').urgency).toBe(null);
  await page.reload(); await expect(page.locator('.history-row')).toHaveCount(5);
  const nightRow=page.locator('.history-row').filter({hasText:'Saisie synthétique'});
  await nightRow.getByRole('button').click(); await page.locator('#event-time').fill('2040-11-09T21:30'); await page.locator('#event-volume').fill('150'); await page.locator('#save-event').click();
  expect(await page.locator('.event-clock').allTextContents()).toEqual(['12:00','21:30','22:15','06:50','07:00']);
  await page.locator('#complete-button').click(); await expect(page.locator('[data-kind="drink"]')).toBeDisabled();
  await page.locator('#complete-button').click(); await expect(page.locator('[data-kind="drink"]')).toBeEnabled();
  await nightRow.getByRole('button').click(); await page.locator('#delete-event').click(); await expect(page.locator('.history-row')).toHaveCount(4);
  await startDay(page,'2040-11-12',2); await startDay(page,'2040-11-18',3);
  const data=await stored(page); expect(data.diary.days.map(d=>d.startDate)).toEqual(['2040-11-09','2040-11-12','2040-11-18']);
  await page.locator('#date-button').click(); await page.locator('#day-date-input').fill('2040-11-09'); await page.getByRole('button',{name:'Enregistrer la date',exact:true}).click();
  await expect(page.locator('#date-error')).toContainText('déjà attribuée'); expect((await stored(page)).revision).toBe(data.revision);
  expect(errors).toEqual([]);
});
test('backup downloads, fresh-profile restore, malformed file rejection and cancelled overwrite', async ({page,browser}) => {
  page.on('dialog',d=>d.accept()); await open(page); await startDay(page,'2040-11-09'); await add(page,'drink','2040-11-09T12:00',175,{drinkType:'other',drinkLabel:'Boisson synthétique'});
  await page.locator('#options-button').click(); const downloadPromise=page.waitForEvent('download'); await page.locator('#backup-button').click(); const download=await downloadPromise;
  const backup=JSON.parse(await readFile(await download.path(),'utf8')); expect(backup.days[0].events[0].volumeMl).toBe(175);
  const clean=await browser.newContext({locale:'fr-FR',timezoneId:'Europe/Paris'}); const fresh=await clean.newPage(); fresh.on('dialog',d=>d.accept()); await open(fresh); await restore(fresh,backup);
  expect((await stored(fresh)).diary.days).toEqual(backup.days);
  await fresh.locator('#options-button').click(); const before=await stored(fresh);
  await fresh.locator('#restore-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"schemaVersion":999}')}); await expect(fresh.locator('#restore-error')).toBeVisible(); expect(await stored(fresh)).toEqual(before);
  await fresh.locator('#restore-file').setInputFiles({name:'good.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  fresh.removeAllListeners('dialog'); fresh.on('dialog',d=>d.dismiss()); await fresh.locator('#confirm-restore').click(); expect(await stored(fresh)).toEqual(before); await clean.close();
});
test('storage failure never reports save success and restore remains atomic', async ({page}) => {
  page.on('dialog',d=>d.accept()); await open(page); await startDay(page,'2040-11-09'); const before=await stored(page);
  await page.evaluate(()=>{ const original=IDBObjectStore.prototype.put; window.restorePut=()=>{IDBObjectStore.prototype.put=original;}; IDBObjectStore.prototype.put=function(){throw new DOMException('Espace de stockage insuffisant','QuotaExceededError');}; });
  await page.locator('[data-kind="drink"]').click(); await page.locator('#event-volume').fill('175'); await page.locator('#event-time').fill('2040-11-09T12:00'); await page.locator('#save-event').click();
  await expect(page.locator('#event-error')).toContainText('Espace'); await expect(page.locator('#event-dialog')).toBeVisible(); expect(await stored(page)).toEqual(before);
  await page.locator('#event-dialog .close-dialog').click(); await page.locator('#options-button').click();
  await page.locator('#restore-file').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(syntheticReport()))}); await page.locator('#confirm-restore').click();
  await expect(page.locator('#restore-error')).toContainText('Espace'); expect(await stored(page)).toEqual(before);
  await page.evaluate(()=>window.restorePut()); await page.locator('#confirm-restore').click(); await expect(page.locator('#options-dialog')).not.toBeVisible(); expect((await stored(page)).diary.days[0].events).toHaveLength(6);
});
test('offline reload and CRUD, base-path assets, no data-bearing network requests or caches', async ({page,context}) => {
  const requests=[], errors=[]; page.on('request',r=>requests.push({url:r.url(),method:r.method(),body:r.postData()})); page.on('pageerror',e=>errors.push(e.message)); page.on('dialog',d=>d.accept());
  await open(page); await readyOffline(page); await startDay(page,'2040-11-09'); await add(page,'void','2040-11-09T12:00',175,{remarks:'MARQUEUR_CONFIDENTIEL_<script>alert(1)</script>'});
  await context.setOffline(true); await page.reload(); await expect(page.locator('#history')).toContainText('MARQUEUR_CONFIDENTIEL_');
  await add(page,'drink','2040-11-09T13:00',210); await page.reload(); await expect(page.locator('.history-row')).toHaveCount(2);
  await page.locator('.event-edit').last().click(); await page.locator('#event-volume').fill('220'); await page.locator('#save-event').click();
  await expect(page.locator('#history')).toContainText('220 ml'); await page.locator('.event-edit').last().click(); await page.locator('#delete-event').click(); await expect(page.locator('.history-row')).toHaveCount(1);
  const cacheInfo=await page.evaluate(async()=>{const result=[];for(const key of await caches.keys()){const cache=await caches.open(key);for(const req of await cache.keys())result.push({url:req.url,text:await (await cache.match(req)).text()});}return result;});
  expect(cacheInfo.length).toBeGreaterThan(10); expect(cacheInfo.every(x=>!x.text.includes('MARQUEUR_CONFIDENTIEL_'))).toBe(true);
  expect(requests.every(r=>r.method==='GET'&&!r.body&&!r.url.includes('MARQUEUR_CONFIDENTIEL_')&&new URL(r.url).pathname.startsWith('/X2/'))).toBe(true);
  expect(errors).toEqual([]);
});
test('three-day A4 report, totals, local print and long-history pagination', async ({page},testInfo) => {
  page.on('dialog',d=>d.accept()); await open(page); const data=syntheticReport(); await restore(page,data);
  await page.locator('#options-button').click(); await page.locator('#report-button').click(); await expect(page.locator('#report-preview .report-page')).toHaveCount(3);
  await expect(page.locator('#report-preview')).toContainText('530 ml'); await expect(page.locator('#report-preview')).toContainText('350 ml'); await expect(page.locator('#report-preview')).toContainText('2 / 1');
  const pdf=testInfo.outputPath('synthetic-report.pdf'); await page.pdf({path:pdf,preferCSSPageSize:true,printBackground:true});
  const text=execFileSync('pdftotext',['-layout',pdf,'-'],{encoding:'utf8'}); expect(text).toContain('Jour 1'); expect(text).toContain('Jour 2'); expect(text).toContain('Jour 3'); expect(text).toContain('café'); expect(text).toContain('530 ml'); expect(text).not.toContain('Trois jours, à votre rythme.');
  const pageCount=execFileSync('pdfinfo',[pdf],{encoding:'utf8'}); expect(pageCount).toMatch(/Pages:\s+3/); expect(pageCount).toContain('A4');
  await page.locator('#report-dialog .close-dialog').click();
  for(let i=0;i<85;i++) data.days[0].events.push({...data.days[0].events[1],id:`overflow-${String(i).padStart(3,'0')}`,remarks:`Ligne synthétique ${i} — ${'Remarque longue. '.repeat(12)}`});
  await restore(page,data); await page.locator('#options-button').click(); await page.locator('#report-button').click();
  const overflow=testInfo.outputPath('synthetic-overflow.pdf'); await page.pdf({path:overflow,preferCSSPageSize:true}); const overflowText=execFileSync('pdftotext',[overflow,'-'],{encoding:'utf8'});
  expect(overflowText).toContain('Ligne synthétique 84'); expect(overflowText).toContain('15830 ml'); expect(overflowText).toContain('Jour 3');
});
test('narrow viewport, text scaling and notes rendered as inert text', async ({page}) => {
  page.on('dialog',d=>d.accept()); await page.setViewportSize({width:320,height:740}); await open(page); await startDay(page,'2040-11-09');
  await add(page,'void','2040-11-09T12:00',175,{remarks:'<img src=x onerror=alert(1)> & texte synthétique'});
  await expect(page.locator('#history img')).toHaveCount(0); await expect(page.locator('#history')).toContainText('<img src=x');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.evaluate(()=>document.styleSheets[0].insertRule(':root { font-size:24px; }',document.styleSheets[0].cssRules.length));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.locator('[data-kind="void"]').click(); await expect(page.locator('#event-volume')).toBeFocused();
  expect(await page.locator('#event-dialog').evaluate(n=>n.scrollWidth<=n.clientWidth)).toBe(true);
});
test('concurrent windows detect conflicts without discarding another saved event', async ({page,context})=>{
  page.on('dialog',d=>d.accept()); await open(page); await startDay(page,'2040-11-09');
  const other=await context.newPage(); other.on('dialog',d=>d.accept()); await open(other);
  await page.locator('[data-kind="drink"]').click(); await page.locator('#event-time').fill('2040-11-09T12:00'); await page.locator('#event-volume').fill('175');
  await add(other,'void','2040-11-09T13:00',120);
  await page.locator('#save-event').click(); await expect(page.locator('#event-error')).toContainText('autre fenêtre');
  expect((await stored(page)).diary.days[0].events).toHaveLength(1);
  await page.locator('#save-event').click(); await expect(page.locator('#event-dialog')).not.toBeVisible(); expect((await stored(page)).diary.days[0].events).toHaveLength(2);
});
test('an update activated in another window preserves an unsaved form and existing IndexedDB', async ({page,context})=>{
  const {createServer}=await import('node:http');
  const {extname,resolve}=await import('node:path');
  const root=resolve('.'); let nextVersion=false;
  const server=createServer(async(req,res)=>{
    try {
      const pathname=new URL(req.url,'http://local').pathname;
      if(!pathname.startsWith('/X2/')){res.writeHead(404).end();return;}
      const relative=pathname.slice(4)||'index.html';
      const file=resolve(root,relative); if(!file.startsWith(root+'/')){res.writeHead(404).end();return;}
      let content=await readFile(file);
      if(relative==='sw.js'&&nextVersion)content=Buffer.from(content.toString().replace('x2-shell-v1.0.0','x2-shell-v1.0.0-test-update'));
      res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(content);
    }catch{res.writeHead(404).end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r)); const origin=`http://127.0.0.1:${server.address().port}`;
  try {
    page.on('dialog',d=>d.accept()); await page.goto(origin+'/X2/'); await expect(page.locator('#journal')).toBeVisible(); await readyOffline(page);
    await startDay(page,'2040-11-09'); await add(page,'void','2040-11-09T10:00',120);
    const other=await context.newPage(); await other.goto(origin+'/X2/'); await expect(other.locator('#journal')).toBeVisible(); await readyOffline(other);
    await page.locator('[data-kind="drink"]').click(); await page.locator('#event-volume').fill('175'); await page.locator('#event-time').fill('2040-11-09T12:00');
    nextVersion=true; await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();});
    await expect(page.locator('#update-banner')).toBeVisible(); await expect(page.locator('#event-dialog')).toBeVisible();
    await other.reload(); await expect(other.locator('#update-banner')).toBeVisible();
    const reloaded=other.waitForEvent('domcontentloaded');
    await other.locator('#update-button').click(); await reloaded;
    await expect(other.locator('#journal')).toBeVisible();
    await expect.poll(()=>other.evaluate(async()=>!!(await caches.keys()).find(k=>k.endsWith('test-update')))).toBe(true);
    await expect(page.locator('#event-dialog')).toBeVisible(); await expect(page.locator('#event-volume')).toHaveValue('175');
    await page.locator('#save-event').click(); await expect(page.locator('.history-row')).toHaveCount(2);
    await page.reload(); await expect(page.locator('.history-row')).toHaveCount(2);
    await other.close();
  } finally { server.closeAllConnections(); await new Promise(r=>server.close(r)); }
});
