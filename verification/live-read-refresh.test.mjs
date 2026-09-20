import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLiveReadRefresh, refreshOnReturn, readWithDeadline } from '../src/services/liveReadRefresh.ts';

const deferred = () => { let resolve, reject; const promise = new Promise((yes,no) => { resolve=yes; reject=no; }); return { promise, resolve, reject }; };
const flush = async () => { for(let i=0;i<15;i++) await Promise.resolve(); };

test('late old-week response cannot overwrite new-week data', async () => {
  const first=deferred(), second=deferred(), applied=[];
  const old=createLiveReadRefresh({load:()=>first.promise,apply:v=>applied.push(v),error:()=>{},intervalMs:30000});
  const oldRead=old.refresh(); old.dispose();
  const current=createLiveReadRefresh({load:()=>second.promise,apply:v=>applied.push(v),error:()=>{},intervalMs:30000});
  const currentRead=current.refresh(); second.resolve('week 2'); await currentRead;
  first.resolve('week 1'); await oldRead;
  assert.deepEqual(applied,['week 2']); current.dispose();
});
test('focus, online and polling wakeups share one in-flight request', async () => {
  const result=deferred(); let calls=0;
  const reader=createLiveReadRefresh({load:()=>{calls++;return result.promise;},apply:()=>{},error:()=>{},intervalMs:15000});
  const first=reader.refresh(); assert.equal(first,reader.refresh()); assert.equal(first,reader.refresh());
  await flush(); assert.equal(calls,1); result.resolve(1); await first; reader.dispose();
});
test('temporary failure retries after two seconds without reloading the page', async t => {
  t.mock.timers.enable({apis:['setTimeout']}); let calls=0; const applied=[], errors=[];
  const reader=createLiveReadRefresh({load:async()=>{if(++calls===1)throw Error('offline');return 7;},apply:v=>applied.push(v),error:e=>errors.push(e.message),intervalMs:15000});
  await reader.refresh(); assert.deepEqual(errors,['offline']);
  t.mock.timers.tick(1999); await flush(); assert.equal(calls,1);
  t.mock.timers.tick(1); await flush(); assert.deepEqual(applied,[7]); reader.dispose();
});
test('a stalled read times out; its late result cannot replace the retry', async t => {
  t.mock.timers.enable({apis:['setTimeout']}); const stuck=deferred(), applied=[]; let calls=0, failures=0;
  const reader=createLiveReadRefresh({load:()=>++calls===1?stuck.promise:Promise.resolve('fresh'),apply:v=>applied.push(v),error:()=>failures++,intervalMs:15000,timeoutMs:1000});
  void reader.refresh(); await flush(); t.mock.timers.tick(1000); await flush(); assert.equal(failures,1);
  t.mock.timers.tick(2000); await flush(); assert.deepEqual(applied,['fresh']);
  stuck.resolve('stale'); await flush(); assert.deepEqual(applied,['fresh']); reader.dispose();
});
test('failed background refresh retains the last successful value', async () => {
  let value=null,calls=0;
  const reader=createLiveReadRefresh({load:async()=>{if(++calls>1)throw Error('network');return 'saved';},apply:v=>value=v,error:()=>{},intervalMs:15000});
  await reader.refresh(); await reader.refresh(); assert.equal(value,'saved'); reader.dispose();
});
test('disposed account emits no error/loading completion and schedules no retry', async t => {
  t.mock.timers.enable({apis:['setTimeout']}); const read=deferred(); const events=[]; let calls=0;
  const reader=createLiveReadRefresh({load:()=>{calls++;return read.promise;},apply:()=>events.push('value'),error:()=>events.push('error'),loading:v=>events.push(v),intervalMs:15000});
  const request=reader.refresh(); reader.dispose(); read.reject(Error('old session')); await request;
  t.mock.timers.tick(60000); await flush(); assert.deepEqual(events,[true]); assert.equal(calls,1);
});
test('returning to visible tab or reconnecting refreshes; cleanup removes all listeners', async () => {
  const oldWindow=globalThis.window, oldDocument=globalThis.document;
  globalThis.window=new EventTarget(); globalThis.document=new EventTarget(); document.visibilityState='visible';
  try {
    let calls=0; const cleanup=refreshOnReturn(async()=>{calls++;});
    window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('online'));
    document.dispatchEvent(new Event('visibilitychange')); assert.equal(calls,3);
    document.visibilityState='hidden'; window.dispatchEvent(new Event('focus')); assert.equal(calls,3);
    cleanup(); document.visibilityState='visible'; window.dispatchEvent(new Event('online'));
    document.dispatchEvent(new Event('visibilitychange')); assert.equal(calls,3);
  } finally { globalThis.window=oldWindow; globalThis.document=oldDocument; }
});


test('a stalled league-week read releases hydration and a later retry recovers without writes', async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const { createLeagueWeekSync } = await import('../src/services/leagueWeekSync.ts');
  const stuck=deferred(), applied=[], states=[]; let calls=0, writes=0;
  const sync=createLeagueWeekSync({
    load:()=>readWithDeadline(()=>++calls===1?stuck.promise:Promise.resolve(2),1000),
    save:async()=>{writes++;return 3;}, apply:v=>applied.push(v),
    publish:s=>states.push(s),canManage:false,
  });
  const first=sync.refresh(); await flush(); t.mock.timers.tick(1000); await first;
  assert.equal(states.at(-1).hydrated,false); assert.match(states.at(-1).error,/timed out/);
  await sync.refresh(); assert.deepEqual(applied,[2]); assert.equal(states.at(-1).hydrated,true);
  stuck.resolve(1); await flush(); assert.deepEqual(applied,[2]); assert.equal(writes,0);
  sync.dispose();
});

test('read deadline clears its timer after success and preserves rejection', async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  assert.equal(await readWithDeadline(async()=>42,100),42);
  await assert.rejects(readWithDeadline(async()=>{throw Error('offline');},100),/offline/);
  t.mock.timers.tick(1000);
});
