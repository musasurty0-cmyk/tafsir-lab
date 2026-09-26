/**
 * Seed the Recitations library, in the page, for capture only.
 *
 * The app reads every recording's metadata on boot and only touches the audio
 * store on playback, so a two-second silent wav per recording is enough to
 * make sixteen recordings across five reciters behave like a real archive.
 * Evaluated by record.mjs in a throwaway headless profile; nothing here can
 * reach a real one.
 */
(async () => {
  const AYAHS = [0, 7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111,
    110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75,
    85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11,
    18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19,
    26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6];
  const toAbs = (s, a) => { let n = 0; for (let i = 1; i < s; i++) n += AYAHS[i]; return n + a; };

  const db = await new Promise((res, rej) => {
    const rq = indexedDB.open('majlis', 1);
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });

  const sr = 8000, n = sr * 2, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  const blob = new Blob([buf], { type: 'audio/wav' });

  const QARIS = [
    ['q1', 'Abdul Basit Abdus Samad'], ['q2', 'Mahmoud Khalil Al-Husary'],
    ['q3', 'Mishary Rashid Alafasy'], ['q4', 'Muhammad Siddiq Al-Minshawi'],
    ['q5', 'Saad Al-Ghamdi'],
  ];
  const RECS = [
    ['q1', 1, 1, 2, 141, 47, 'Juz 1 — Cairo, 1961'], ['q1', 12, 1, 12, 111, 38, 'Surat Yusuf, complete'],
    ['q1', 19, 1, 19, 98, 21, ''], ['q1', 36, 1, 36, 83, 17, 'Ya-Sin'],
    ['q1', 55, 1, 56, 96, 26, 'Ar-Rahman and Al-Waqiah'],
    ['q2', 2, 142, 2, 252, 44, 'Juz 2'], ['q2', 18, 1, 18, 110, 33, 'Al-Kahf — Friday'],
    ['q2', 36, 1, 36, 83, 16, ''],
    ['q3', 67, 1, 70, 44, 18, 'Tabarak to Al-Maarij'], ['q3', 78, 1, 84, 25, 24, 'Juz Amma, first half'],
    ['q3', 85, 1, 114, 6, 29, 'Juz Amma, second half'],
    ['q4', 3, 1, 3, 200, 52, "Ali 'Imran, complete"], ['q4', 17, 1, 17, 111, 28, 'Al-Isra'],
    ['q4', 39, 1, 41, 54, 41, ''],
    ['q5', 4, 1, 4, 176, 55, 'An-Nisa'], ['q5', 7, 1, 7, 206, 49, "Al-A'raf"],
    ['q5', 29, 1, 33, 73, 46, 'Juz 21'],
  ];

  const now = Date.now();
  const tx = db.transaction(['qaris', 'recordings', 'audio'], 'readwrite');
  const qs = tx.objectStore('qaris'), rs = tx.objectStore('recordings'), as = tx.objectStore('audio');
  QARIS.forEach(([id, name], i) => qs.put({ id, name, createdAt: now - (QARIS.length - i) * 864e5 }));
  RECS.forEach((r, i) => {
    const [qariId, s0, a0, s1, a1, mins, note] = r, id = 'r' + (i + 1);
    rs.put({
      id, qariId, startSurah: s0, startAyah: a0, endSurah: s1, endAyah: a1,
      startAbsolute: toAbs(s0, a0),
      fileName: (note || 'recitation').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.mp3',
      mimeType: 'audio/mpeg', size: Math.round(mins * 60 * 16000), duration: mins * 60,
      note: note || undefined, createdAt: now - (RECS.length - i) * 36e5,
    });
    as.put(blob, id);          // out-of-line key: the audio store has no keyPath
  });
  await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  return { qaris: QARIS.length, recordings: RECS.length };
})()
