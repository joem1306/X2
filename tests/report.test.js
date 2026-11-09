import test from 'node:test';
import assert from 'node:assert/strict';
import { reportRows } from '../js/export-pdf.js';
import { emptyDiary, parseLocalTimestamp, setDayDate } from '../js/model.js';
process.env.TZ='Europe/Paris';
test('report rows use local dates, all entries, sleep markers and explicit morning convention', () => {
  const diary=emptyDiary(); setDayDate(diary,'day-1','2040-11-09'); const day=diary.days[0];
  day.events=[['wake','wake','2040-11-10T06:50',null],['morning','void','2040-11-10T07:00',230],['bed','bedtime','2040-11-09T22:15',null],['night','void','2040-11-10T03:10',120]].map(([id,kind,local,volumeMl])=>({id,kind,...parseLocalTimestamp(local),volumeMl,drinkType:null,drinkLabel:'',urgency:null,remarks:kind==='void'?'Remarque synthétique':''}));
  const rows=reportRows(day); assert.equal(rows.length,4);
  assert.match(rows[0][0],/22:15/); assert.equal(rows[0][3],'Coucher');
  assert.match(rows[1][3],/Nuit/); assert.match(rows[1][0],/10\/11\/2040/);
  assert.match(rows[3][3],/Première miction du matin/); assert.equal(rows[3][2],'230');
  assert.ok(rows.every(row => !row.join('').includes('undefined')));
});
