import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyHekomiIntent, HekomiMemory, replyAsHekomi } from '../../lib/hekomi-core.mjs';

function storage(){const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}

test('classifies the companion intents',()=>{
  assert.equal(classifyHekomiIntent('hey Hekomi'), 'greeting');
  assert.equal(classifyHekomiIntent('recommend an anime'), 'anime');
  assert.equal(classifyHekomiIntent('show me manga'), 'manga');
  assert.equal(classifyHekomiIntent('remember that I love mystery'), 'remember');
  assert.equal(classifyHekomiIntent('what do you remember about me'), 'recall');
});

test('stores, recalls and forgets only explicit notes',()=>{
  const store=storage(),memory=new HekomiMemory(store);
  const saved=replyAsHekomi('remember that I love psychological anime',memory);
  assert.match(saved.text,/keep that note/i);
  assert.deepEqual(memory.summary(),['I love psychological anime']);
  assert.match(replyAsHekomi('what do you remember?',memory).text,/psychological anime/);
  replyAsHekomi('forget my memories',memory);
  assert.deepEqual(memory.summary(),[]);
});

test('does not save facts unless explicitly asked',()=>{
  const memory=new HekomiMemory(storage());
  replyAsHekomi('I love sci-fi anime',memory);
  assert.deepEqual(memory.summary(),[]);
});

test('unknown questions are handled honestly',()=>{
  const result=replyAsHekomi('solve quantum gravity',new HekomiMemory(storage()));
  assert.equal(result.intent,'unknown');
  assert.match(result.text,/tiny handcrafted brain/i);
});
