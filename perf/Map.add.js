var runSuite = require('./runSuite'),
	Benchmark = require("benchmark"),
	mori = require("mori"),
	Immutable = require("immutable"),
	Faucett = require("@nathanfaucett/immutable-hash_map"),
	hamt = require('hamt'),
	CollectableMap = require('@collectable/map'),
	champ = require('./champ'),
	Inline = champ.Inline,
	Entry = champ.Entry,
	Hamt = champ.Hamt,
	Oop = champ.Oop

;


var suite = new Benchmark.Suite('compare add 2 pair');

var SIZE = 64
// var SIZE = 1024
// var SIZE = 32768


suite.add('immutable-js', function() {
	var map = Immutable.Map()
	for (var i = 0; SIZE > i; i++)
		map = map.set('key' + i, 'val' + i)
})

suite.add('faucett', function() {
	var map = Faucett.EMPTY
	for (var i = 0; SIZE > i; i++)
		map = map.set('key' + i, 'val' + i)
})

// suite.add('mori', function() {
// 	var map = mori.hashMap(0,0)
// 	for (var i = 0; SIZE > i; i++)
// 		map = mori.assoc(map,'key' + i, 'val' + i)
// 	//mori.hashMap(0, 1, 2, 3);
// })

suite.add('hamt', function() {
	var map = hamt.empty
	for (var i = 0; SIZE > i; i++)
		map = map.set('key' + i, 'val' + i)
})

suite.add('collectable', function() {
	var map = CollectableMap.empty()
	for (var i = 0; SIZE > i; i++)
		map = CollectableMap.set('key' + i, 'val' + i, map)
})

suite.add('champ:inline', function() {
	var map = Inline.empty()
	for (var i = 0; SIZE > i; i++)
		map = map.put('key' + i, 'val' + i)
})

suite.add('champ:entry', function() {
	var map = Entry.empty()
	for (var i = 0; SIZE > i; i++)
		map = Entry.put('key' + i, 'val' + i, map)
})

suite.add('champ:oop', function() {
	var map = Oop.empty()
	for (var i = 0; SIZE > i; i++)
		map = map.put('key' + i, 'val' + i)
})

suite.add('champ:oop-transient', function() {
	var map = Oop.empty()
	var tr = map.start()
	for (var i = 0; SIZE > i; i++)
		map = map.put('key' + i, 'val' + i, tr)
})

suite.add('native js object', function() {
	var map = {}
	for (var i = 0; SIZE > i; i++)
		map['key' + i] = 'val' + i
	return map
})

runSuite(suite)