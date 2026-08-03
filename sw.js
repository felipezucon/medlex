
const CONTENT_VERSION="2026.08.02.4";
const CACHE=`medlex-${CONTENT_VERSION}`;
const ASSETS=[
  "./","./index.html","./styles.css","./app.js","./cards.csv","./manifest.webmanifest","./icon.svg",
  "./js/storage.mjs","./js/exam.mjs","./js/exam-data.mjs","./js/exam-storage.mjs","./js/exam-grading.mjs",
  "./js/practice.mjs","./js/practice-data.mjs","./js/practice-storage.mjs","./js/practice-grading.mjs",
  "./js/api-key-vault.mjs","./js/ai-settings.mjs","./js/ai-grading-storage.mjs","./js/ai-grading.mjs","./js/gemini-client.mjs",
  "./data/exams/index.json","./data/exams/prefinal-a.json","./data/exams/prefinal-b.json","./data/exams/prefinal-c.json","./data/exams/prefinal-d.json","./data/exams/prefinal-e.json","./data/exams/prefinal-f.json",
  "./data/exams/exam-smoking-depression.json","./data/exams/simulado-01-sleep-apnea.json","./data/exams/simulado-02-pitavastatin-hiv.json","./data/exams/simulado-03-post-infectious-mecfs.json","./data/exams/simulado-04-cannabis-cardiovascular.json","./data/exams/simulado-05-antibiotic-resistance.json",
  "./data/practice/index.json","./data/practice/ing-forms.json"
];
self.addEventListener("install", event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await Promise.all(ASSETS.map(async asset => {
    const response = await fetch(asset, {cache: "reload"});
    if (!response.ok) throw new Error(`Falha ao armazenar ${asset}`);
    await cache.put(asset, response);
  }));
  await self.skipWaiting();
})()));

self.addEventListener("activate", event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys
    .filter(key => key.startsWith("medlex-") && key !== CACHE)
    .map(key => caches.delete(key)));
  await self.clients.claim();
})()));

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok) (await caches.open(CACHE)).put(event.request, response.clone());
      return response;
    } catch {
      return (await caches.match(event.request, {ignoreSearch: true})) || Response.error();
    }
  })());
});
