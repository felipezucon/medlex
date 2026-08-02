
const CACHE="medlex-v4";
const ASSETS=[
  "./","./index.html","./styles.css","./app.js","./cards.csv","./manifest.webmanifest","./icon.svg",
  "./js/exam.mjs","./js/exam-data.mjs","./js/exam-storage.mjs","./js/exam-grading.mjs",
  "./js/practice.mjs","./js/practice-data.mjs","./js/practice-storage.mjs","./js/practice-grading.mjs",
  "./data/exams/index.json","./data/exams/prefinal-a.json","./data/exams/prefinal-b.json","./data/exams/prefinal-c.json","./data/exams/prefinal-d.json","./data/exams/prefinal-e.json","./data/exams/prefinal-f.json",
  "./data/exams/exam-smoking-depression.json","./data/exams/simulado-01-sleep-apnea.json","./data/exams/simulado-02-pitavastatin-hiv.json","./data/exams/simulado-03-post-infectious-mecfs.json","./data/exams/simulado-04-cannabis-cardiovascular.json","./data/exams/simulado-05-antibiotic-resistance.json",
  "./data/practice/index.json","./data/practice/ing-forms.json"
];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener("fetch",e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
