const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('const PORTFOLIO_SHOWCASE_RECORDS=');
const end = html.indexOf('function App(){', start);
assert.ok(start > 0 && end > start, 'data initialization code exists');
const source = html.slice(start, end);

function scenario({demo,stored = {},legacy = false,day = '2026-09-15'}) {
  const values = new Map();
  values.set(demo ? 'wp_v3final_demo' : 'wp_v3final', JSON.stringify(stored));
  if (legacy) {
    values.set('wp_v3final_greenhouse_demo_version', 'old-seed');
    values.set('wp_v3final_showcase_version', 'old-showcase');
  }
  const context = {
    URLSearchParams,
    window: {location: {search: demo ? '?demo=1' : ''}},
    localStorage: {getItem: key => values.get(key) || null},
    todayKey: () => day,
    migrateData: raw => raw,
    pickPlant: () => 'calla',
  };
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.testApi={initialData,demoHistoryForDate,ensureTodayEntry}`, context);
  return context.testApi;
}

const fresh = scenario({demo: false}).initialData();
assert.equal(fresh['2026-09-15'].totalMl, 0);
assert.equal(Object.keys(fresh).length, 1);

const demoApi = scenario({demo: true});
const demo = demoApi.initialData();
const past = Object.keys(demo).filter(key => key < '2026-09-15');
assert.equal(past.length, 14);
assert.equal(demo['2026-09-15'].totalMl, 0);
assert.ok(past.every(key => key < '2026-09-15'));

const archive = demoApi.demoHistoryForDate('2026-09-15');
const legacy = scenario({demo: false, legacy: true, stored: {
  ...archive,
  '2026-09-15': {...archive['2026-09-14'], plantType: 'tulip'},
  '2026-08-31': {drinks: [{time: '13:00', ml: 250, text: '我的真实记录'}], totalMl: 250, plantType: 'calla'},
}}).initialData();
assert.equal(legacy['2026-09-15'].totalMl, 0);
assert.equal(legacy['2026-08-31'].totalMl, 250);
assert.equal(Object.keys(legacy).length, 2);

const tomorrow = demoApi.ensureTodayEntry({...demo, '2026-09-15': {
  drinks: [{time: '10:00', ml: 250, text: '今天'}], totalMl: 250, plantType: 'calla',
}}, '2026-09-16');
assert.equal(tomorrow['2026-09-16'].totalMl, 0);
assert.equal(tomorrow['2026-09-15'].totalMl, 250);

console.log('PASS: fresh user, demo history, legacy cleanup, and next-day rollover');
