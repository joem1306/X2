import { emptyDiary, assertDiary } from './model.js';
export class ConflictError extends Error {}
export function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('Le stockage local est indisponible dans ce navigateur.'));
    const request = indexedDB.open('x2-diary', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('records');
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Fermez les autres fenêtres X2 puis réessayez.'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}
export function readDiary(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', 'readonly');
    const request = tx.objectStore('records').get('diary');
    tx.oncomplete = () => {
      try {
        const stored = request.result;
        if (stored && (!Number.isSafeInteger(stored.revision) || stored.revision < 1)) throw new Error('Invalid revision');
        resolve(stored ? { diary: assertDiary(stored.diary), revision: stored.revision } : { diary: emptyDiary(), revision: 0 });
      } catch { reject(new Error('Les données locales sont illisibles. Rien n’a été remplacé. Conservez cet appareil et votre dernière sauvegarde.')); }
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Lecture interrompue.'));
  });
}
// Read, compare and replace within ONE transaction: atomic restore and no lost tab writes.
export function writeDiary(db, diary, expectedRevision) {
  const valid = assertDiary(diary);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', 'readwrite');
    const store = tx.objectStore('records');
    let conflict = false, failure;
    const read = store.get('diary');
    read.onsuccess = () => {
      if ((read.result?.revision || 0) !== expectedRevision) { conflict = true; tx.abort(); return; }
      try { store.put({ diary: valid, revision: expectedRevision + 1 }, 'diary'); }
      catch (error) { failure = error; tx.abort(); }
    };
    tx.oncomplete = () => resolve(expectedRevision + 1);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(conflict ? new ConflictError('Une autre fenêtre a modifié le journal. Les données récentes ont été rechargées ; vérifiez puis recommencez votre modification.') : (failure || tx.error || new Error('Enregistrement interrompu.')));
  });
}
export function readSelection(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', 'readonly');
    const read = tx.objectStore('records').get('selected-day');
    tx.oncomplete = () => resolve(['day-1', 'day-2', 'day-3'].includes(read.result) ? read.result : 'day-1');
    tx.onerror = () => reject(tx.error);
  });
}
export function writeSelection(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', 'readwrite');
    tx.objectStore('records').put(id, 'selected-day');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Sélection non enregistrée.'));
  });
}
