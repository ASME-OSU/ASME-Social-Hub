import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_CHANNELS,readChannelDefaults,saveChannelDefaults,resetChannelDefaults} from '../docs/channel-preferences.mjs';
const repo={owner:'ASME-OSU',name:'ASME-Social-Hub',branch:'main'};
function storage(){const data=new Map();return {data,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};}
test('browser preferences persist only explicit channel booleans and remain repository scoped',()=>{
 const store=storage();assert.deepEqual(readChannelDefaults(store,repo),DEFAULT_CHANNELS);
 saveChannelDefaults(store,repo,{feed:false,story:true,groupme:true,token:'must-not-save'});
 assert.deepEqual(readChannelDefaults(store,repo),{feed:false,story:true,groupme:true});
 assert.deepEqual(readChannelDefaults(store,{...repo,name:'Different'}),DEFAULT_CHANNELS);
 assert.deepEqual(readChannelDefaults(store,{...repo,branch:'other'}),DEFAULT_CHANNELS);
 assert.deepEqual(readChannelDefaults(store,{...repo,owner:'asme-osu'}),{feed:false,story:true,groupme:true});
 assert.doesNotMatch([...store.data.values()].join(''),/token|must-not-save/);
 resetChannelDefaults(store,repo);assert.deepEqual(readChannelDefaults(store,repo),DEFAULT_CHANNELS);
});
test('invalid or unavailable browser storage falls back safely and failed saves surface errors',()=>{
 const store=storage();saveChannelDefaults(store,repo,{feed:'false',story:null,groupme:true});
 assert.deepEqual(readChannelDefaults(store,repo),{feed:true,story:true,groupme:true});
 for(const value of ['bad json','null','{"version":2,"channels":{"groupme":true}}']){store.data.set([...store.data.keys()][0],value);assert.deepEqual(readChannelDefaults(store,repo),DEFAULT_CHANNELS);}
 const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}};
 assert.deepEqual(readChannelDefaults(blocked,repo),DEFAULT_CHANNELS);assert.throws(()=>saveChannelDefaults(blocked,repo,{groupme:true}),/blocked/);
});
