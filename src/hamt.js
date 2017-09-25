'use strict';

function _typeof(obj) {
	return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}



/* Configuration
 ******************************************************************************/
var SIZE = 5;

var BUCKET_SIZE = Math.pow(2, SIZE);

var MASK = BUCKET_SIZE - 1;

var MAX_INDEX_NODE = BUCKET_SIZE / 2;

var MIN_ARRAY_NODE = BUCKET_SIZE / 4;

/*
 ******************************************************************************/
var Nothing = {};

function constant(x) {
	return function () {
		return x;
	};
}

function defaultValBind(f, defaultValue) {
	return function (x) {
		return f(arguments.length === 0 ? defaultValue : x);
	};
}

function hash(str) {
	var type = typeof str;

	if (type === 'undefined') return 0;
	if (type === 'number') return str;
	str += '';

	var hash = 0;
	for (var i = 0, len = str.length; i < len; ++i) {
		var c = str.charCodeAt(i);
		hash = (hash << 5) - hash + c | 0;
	}
	return hash;
}

/* Bit Ops
 ******************************************************************************/
/**
 Hamming weight.

 Taken from: http://jsperf.com/hamming-weight
 */
function popcount(x) {
	x -= x >> 1 & 0x55555555;
	x = (x & 0x33333333) + (x >> 2 & 0x33333333);
	x = x + (x >> 4) & 0x0f0f0f0f;
	x += x >> 8;
	x += x >> 16;
	return x & 0x7f;
}

function hashFragment(shift, h) {
	return h >>> shift & MASK;
}

function toBitmap(x) {
	return 1 << x;
}

function fromBitmap(bitmap, bit) {
	var v = bitmap & (bit - 1)
	v = v - ((v >> 1) & 0x55555555);
	v = (v & 0x33333333) + ((v >> 2) & 0x33333333);
	return ((v + (v >> 4) & 0xF0F0F0F) * 0x1010101) >> 24;
}

var Bitwise = {
	popcount(x) {
		x -= x >> 1 & 0x55555555;
		x = (x & 0x33333333) + (x >> 2 & 0x33333333);
		x = x + (x >> 4) & 0x0f0f0f0f;
		x += x >> 8;
		x += x >> 16;
		return x & 0x7f;
	}

	, hashFragment(shift, h) {
		return h >>> shift & MASK;
	}
	, toBitmap(x) {
		return 1 << x;
	}
	, fromBitmap(bitmap, bit) {
		return this.popcount(bitmap & bit - 1);
	}
}

/* Array Ops
 ******************************************************************************/

var Arrays = {
	aUpdate(at, v, arr) {
		var len = arr.length;
		var out = new Array(len);
		for (var i = 0; i < len; ++i) {
			out[i] = arr[i];
		}out[at] = v;
		return out;
	}

	, aSpliceOut(at, arr) {
		var len = arr.length;
		var out = new Array(len - 1);
		var i = 0,
			g = 0;
		while (i < at) {
			out[g++] = arr[i++];
		}++i;
		while (i < len) {
			out[g++] = arr[i++];
		}return out;
	}
	, aSpliceIn(at, v, arr) {
		var len = arr.length;
		var out = new Array(len + 1);
		var i = 0,
			g = 0;
		while (i < at) {
			out[g++] = arr[i++];
		}out[g++] = v;
		while (i < len) {
			out[g++] = arr[i++];
		}return out;
	}
}
/**
 Set a value in an array.

 @param at Index to change.
 @param v New value
 @param arr Array.
 */
var arrayUpdate = function arrayUpdate(at, v, arr) {
	var len = arr.length;
	var out = new Array(len);
	for (var i = 0; i < len; ++i) {
		out[i] = arr[i];
	}out[at] = v;
	return out;
};

/**
 Remove a value from an array.

 @param at Index to remove.
 @param arr Array.
 */
var arraySpliceOut = function arraySpliceOut(at, arr) {
	var len = arr.length;
	var out = new Array(len - 1);
	var i = 0,
		g = 0;
	while (i < at) {
		out[g++] = arr[i++];
	}++i;
	while (i < len) {
		out[g++] = arr[i++];
	}return out;
};

/**
 Insert a value into an array.

 @param at Index to insert at.
 @param v Value to insert,
 @param arr Array.
 */
var arraySpliceIn = function arraySpliceIn(at, v, arr) {
	var len = arr.length;
	var out = new Array(len + 1);
	var i = 0,
		g = 0;
	while (i < at) {
		out[g++] = arr[i++];
	}out[g++] = v;
	while (i < len) {
		out[g++] = arr[i++];
	}return out;
};

/* Node Structures
 ******************************************************************************/
var LEAF = 1;
var COLLISION = 2;
var INDEX = 3;
var ARRAY = 4;

/**
 Empty node.
 */
var emptyNode = { __hamt_isEmpty: true };

function isEmptyNode(x) {
	return x === emptyNode || x && x.__hamt_isEmpty;
}

/**
 Leaf holding a value.

 @member hash Hash of key.
 @member key Key.
 @member value Value stored.
 */
function Leaf(hash, key, value) {
	return {
		type: LEAF,
		hash: hash,
		key: key,
		value: value,
		_modify: Leaf__modify
	}
}

/**
 Leaf holding multiple values with the same hash but different keys.

 @member hash Hash of key.
 @member children Array of collision children node.
 */
function Collision(hash, children) {
	return {
		type: COLLISION,
		hash: hash,
		children: children,
		_modify: Collision__modify
	}
}

/**
 Internal node with a sparse set of children.

 Uses a bitmap and array to pack children.

 @member mask Bitmap that encode the positions of children in the array.
 @member children Array of child nodes.
 */
function IndexedNode(mask, children) {
	return {
		type: INDEX,
		mask: mask,
		children: children,
		_modify: IndexedNode__modify
	}
}

/**
 Internal node with many children.

 @member size Number of children.
 @member children Array of child nodes.
 */
function ArrayNode(size, children) {
	return {
		type: ARRAY,
		size: size,
		children: children,
		_modify: ArrayNode__modify
	}
}

/**
 Is `node` a leaf node?
 */
function isLeaf(node) {
	return node === emptyNode || node.type === LEAF || node.type === COLLISION;
}

/* Internal node operations.
 ******************************************************************************/
/**
 Expand an indexed node into an array node.

 @param frag Index of added child.
 @param child Added child.
 @param mask Index node mask before child added.
 @param subNodes Index node children before child added.
 */
function expand(frag, child, bitmap, subNodes) {
	var arr = [];
	var bit = bitmap;
	var count = 0;
	for (var i = 0; bit; ++i) {
		if (bit & 1) arr[i] = subNodes[count++];
		bit >>>= 1;
	}
	arr[frag] = child;
	return ArrayNode(count + 1, arr);
}

/**
 Collapse an array node into a indexed node.

 @param count Number of elements in new array.
 @param removed Index of removed element.
 @param elements Array node children before remove.
 */
function pack(count, removed, elements) {
	var children = new Array(count - 1);
	var g = 0;
	var bitmap = 0;
	for (var i = 0, len = elements.length; i < len; ++i) {
		if (i !== removed) {
			var elem = elements[i];
			if (elem && !isEmptyNode(elem)) {
				children[g++] = elem;
				bitmap |= 1 << i;
			}
		}
	}
	return IndexedNode(bitmap, children);
}

/**
 Merge two leaf nodes.

 @param shift Current shift.
 @param h1 Node 1 hash.
 @param n1 Node 1.
 @param h2 Node 2 hash.
 @param n2 Node 2.
 */
function mergeLeaves(shift, h1, n1, h2, n2) {
	if (h1 === h2) return Collision(h1, [n2, n1]);

	var subH1 = hashFragment(shift, h1);
	var subH2 = hashFragment(shift, h2);
	return IndexedNode(toBitmap(subH1) | toBitmap(subH2), subH1 === subH2 ? [mergeLeaves(shift + SIZE, h1, n1, h2, n2)] : subH1 < subH2 ? [n1, n2] : [n2, n1]);
}

/**
 Update an entry in a collision list.

 @param hash Hash of collision.
 @param list Collision list.
 @param f Update function.
 @param k Key to update.
 @param size Size reference
 */
function updateCollisionList(h, list, f, k, size) {
	var len = list.length;
	for (var i = 0; i < len; ++i) {
		var child = list[i];
		if (child.key === k) {
			var value = child.value;
			var _newValue = f(value);
			if (_newValue === value) return list;

			if (_newValue === Nothing) {
				--size.value;
				return arraySpliceOut(i, list);
			}
			return arrayUpdate(i, Leaf(h, k, _newValue), list);
		}
	}

	var newValue = f();
	if (newValue === Nothing) return list;
	++size.value;
	return arrayUpdate(len, Leaf(h, k, newValue), list);
}

/* Editing
 ******************************************************************************/
function Leaf__modify(shift, f, h, k, size) {
	if (k === this.key) {
		var _v = f(this.value);
		if (_v === this.value) return this;
		if (_v === Nothing) {
			--size.value;
			return emptyNode;
		}
		return Leaf(h, k, _v);
	}
	var v = f();
	if (v === Nothing) return this;
	++size.value;
	return mergeLeaves(shift, this.hash, this, h, Leaf(h, k, v));
}

function Collision__modify(shift, f, h, k, size) {
	if (h === this.hash) {
		var list = updateCollisionList(this.hash, this.children, f, k, size);
		if (list === this.children) return this;

		return list.length > 1 ? Collision(this.hash, list) : list[0]; // collapse single element collision list
	}
	var v = f();
	if (v === Nothing) return this;
	++size.value;
	return mergeLeaves(shift, this.hash, this, h, Leaf(h, k, v));
}

function IndexedNode__modify(shift, f, h, k, size) {
	var mask = this.mask;
	var children = this.children;
	var frag = hashFragment(shift, h);
	var bit = toBitmap(frag);
	var indx = fromBitmap(mask, bit);
	var exists = mask & bit;
	var current = exists ? children[indx] : emptyNode;
	var child = current._modify(shift + SIZE, f, h, k, size);

	if (current === child) return this;

	if (exists && isEmptyNode(child)) {
		// remove
		var bitmap = mask & ~bit;
		if (!bitmap) return emptyNode;
		return children.length <= 2 && isLeaf(children[indx ^ 1]) ? children[indx ^ 1] // collapse
			: IndexedNode(bitmap, arraySpliceOut(indx, children));
	}
	if (!exists && !isEmptyNode(child)) {
		// add
		return children.length >= MAX_INDEX_NODE ? expand(frag, child, mask, children) : IndexedNode(mask | bit, arraySpliceIn(indx, child, children));
	}

	// modify
	return IndexedNode(mask, arrayUpdate(indx, child, children));
}

function ArrayNode__modify(shift, f, h, k, size) {
	var count = this.size;
	var children = this.children;
	var frag = hashFragment(shift, h);
	var child = children[frag];
	var newChild = (child || emptyNode)._modify(shift + SIZE, f, h, k, size);

	if (child === newChild) return this;

	if (isEmptyNode(child) && !isEmptyNode(newChild)) {
		// add
		return ArrayNode(count + 1, arrayUpdate(frag, newChild, children));
	}
	if (!isEmptyNode(child) && isEmptyNode(newChild)) {
		// remove
		return count - 1 <= MIN_ARRAY_NODE ? pack(count, frag, children) : ArrayNode(count - 1, arrayUpdate(frag, emptyNode, children));
	}

	// modify
	return ArrayNode(count, arrayUpdate(frag, newChild, children));
}

emptyNode._modify = function (_, f, h, k, size) {
	var v = f();
	if (v === Nothing) return emptyNode;
	++size.value;
	return Leaf(h, k, v);
};





/* Queries
 ******************************************************************************/
/**
 Lookup the value for `key` in `map` using a custom `hash`.

 Returns the value or `alt` if none.
 */
function tryGetHash(alt, hash, key, map) {
	var node = map._root;
	var shift = 0;
	while (true) {
		switch (node.type) {
			case 1: //leaf
			{
				return key === node.key ? node.value : alt;
			}
			case 2: //collision
			{
				if (hash === node.hash) {
					var children = node.children;
					for (var i = 0, len = children.length; i < len; ++i) {
						var child = children[i];
						if (key === child.key) return child.value;
					}
				}
				return alt;
			}
			case 3: //indexed
			{

				var bit = 1 << (hash >>> shift & 31);
				if (node.mask & bit) {

					var v = node.mask & (bit - 1)
					v = v - ((v >> 1) & 0x55555555);
					v = (v & 0x33333333) + ((v >> 2) & 0x33333333);
					v = ((v + (v >> 4) & 0xF0F0F0F) * 0x1010101) >> 24;

					node = node.children[v];
					shift += SIZE;
					break;
				}
				return alt;
			}
			case 4: //array
			{
				node = node.children[(hash >>> shift & 31)];
				if (node) {
					shift += SIZE;
					break;
				}
				return alt;
			}
			default:
				return alt;
		}
	}
}


/**
 Lookup the value for `key` in `map` using internal hash function.

 @see `tryGetHash`
 */
function tryGet(alt, key, map) {
	return tryGetHash(alt, hash(key), key, map);
}

/**
 Lookup the value for `key` in `map` using a custom `hash`.

 Returns the value or `undefined` if none.
 */
function getHash(hash, key, map) {
	return tryGetHash(undefined, hash, key, map);
}


/**
 Does an entry exist for `key` in `map`? Uses custom `hash`.
 */
function hasHash(hash, key, map) {
	return tryGetHash(Nothing, hash, key, map) !== Nothing;
}


/**
 Does an entry exist for `key` in `map`? Uses internal hash function.
 */
function has(key, map) {
	return hasHash(hash(key), key, map);
}

/**
 Empty node.
 */
export const empty = new Map(emptyNode, 0);

/**
 Is `value` a map?
 */
function isMap(value) {
	return !!(value && value.__hamt_isMap);
}

/**
 Does `map` contain any elements?
 */
function isEmpty(map) {
	return !!(isMap(map) && isEmptyNode(map._root));
}

/* Updates
 ******************************************************************************/
/**
 Alter the value stored for `key` in `map` using function `f` using
 custom hash.

 `f` is invoked with the current value for `k` if it exists,
 or `defaultValue` if it is specified. Otherwise, `f` is invoked with no arguments
 if no such value exists.

 `modify` will always either update or insert a value into the map.

 Returns a map with the modified value. Does not alter `map`.
 */
function modifyHash(f, hash, key, map) {
	var size = { value: map._size };
	var newRoot = map._root._modify(0, f, hash, key, size);
	return map.setTree(newRoot, size.value);
}


/**
 Alter the value stored for `key` in `map` using function `f` using
 internal hash function.

 @see `modifyHash`
 */
function modify(f, key, map) {
	return modifyHash(f, hash(key), key, map);
}


/**
 Same as `modifyHash`, but invokes `f` with `defaultValue` if no entry exists.

 @see `modifyHash`
 */
function modifyValueHash(f, defaultValue, hash, key, map) {
	return modifyHash(defaultValBind(f, defaultValue), hash, key, map);
}


/**
 @see `modifyValueHash`
 */
function modifyValue(f, defaultValue, key, map) {
	return modifyValueHash(f, defaultValue, hash(key), key, map);
}


/**
 Store `value` for `key` in `map` using custom `hash`.

 Returns a map with the modified value. Does not alter `map`.
 */
function setHash(hash, key, value, map) {
	return modifyHash(constant(value), hash, key, map);
}


/**
 Store `value` for `key` in `map` using internal hash function.

 @see `setHash`
 */
function set(key, value, map) {
	return setHash(hash(key), key, value, map);
}

/**
 Remove the entry for `key` in `map`.

 Returns a map with the value removed. Does not alter `map`.
 */
var del = constant(Nothing);

function removeHash(hash, key, map) {
	return modifyHash(del, hash, key, map);
}

/**
 Remove the entry for `key` in `map` using internal hash function.

 @see `removeHash`
 */
export function remove(key, map) {
	return removeHash(hash(key), key, map);
}

/* Traversal
 ******************************************************************************/
/**
 Apply a continuation.
 */
function appk(k) {
	return k && lazyVisitChildren(k[0], k[1], k[2], k[3], k[4]);
}

/**
 Recursively visit all values stored in an array of nodes lazily.
 */
function lazyVisitChildren(len, children, i, f, k) {
	while (i < len) {
		var child = children[i++];
		if (child && !isEmptyNode(child)) return lazyVisit(child, f, [len, children, i, f, k]);
	}
	return appk(k);
}

/**
 Recursively visit all values stored in `node` lazily.
 */
function lazyVisit(node, f, k) {
	switch (node.type) {
		case LEAF:
			return { value: f(node), rest: k };

		case COLLISION:
		case ARRAY:
		case INDEX:
			var children = node.children;
			return lazyVisitChildren(children.length, children, 0, f, k);

		default:
			return appk(k);
	}
}

var DONE = { done: true };

/**
 Javascript iterator over a map.
 */
function MapIterator(v) {
	this.v = v;
}

MapIterator.prototype.next = function () {
	if (!this.v) return DONE;
	var v0 = this.v;
	this.v = appk(v0.rest);
	return v0;
}

MapIterator.prototype[Symbol.iterator] = function () {
	return this;
};

/**
 Lazily visit each value in map with function `f`.
 */
function visit(map, f) {
	return new MapIterator(lazyVisit(map._root, f));
}

/**
 Get a Javascsript iterator of `map`.

 Iterates over `[key, value]` arrays.
 */
function buildPairs(x) {
	return [x.key, x.value];
}
function entries(map) {
	return visit(map, buildPairs);
}


/**
 Get array of all keys in `map`.

 Order is not guaranteed.
 */
function buildKeys(x) {
	return x.key;
}

function keys(map) {
	return visit(map, buildKeys);
}


/**
 Get array of all values in `map`.

 Order is not guaranteed, duplicates are preserved.
 */
function buildValues(x) {
	return x.value;
}

function values(map) {
	return visit(map, buildValues);
}

/* Fold
 ******************************************************************************/
/**
 Visit every entry in the map, aggregating data.

 Order of nodes is not guaranteed.

 @param f Function mapping accumulated value, value, and key to new value.
 @param z Starting value.
 @param m HAMT
 */
export function fold(f, z, m) {
	var root = m._root;
	if (root.type === LEAF) return f(z, root.value, root.key);

	var toVisit = [root.children];
	var children = undefined;
	while (children = toVisit.pop()) {
		for (var i = 0, len = children.length; i < len;) {
			var child = children[i++];
			if (child && child.type) {
				if (child.type === LEAF) z = f(z, child.value, child.key);else toVisit.push(child.children);
			}
		}
	}
	return z;
}

/**
 Visit every entry in the map, aggregating data.

 Order of nodes is not guaranteed.

 @param f Function invoked with value and key
 @param map HAMT
 */
function forEach(f, map) {
	return fold(function (_, value, key) {
		return f(value, key, map);
	}, null, map);
}

/* Aggregate
 ******************************************************************************/
/**
 Get the number of entries in `map`.
 */
function count(map) {
	return map._size;
}


/*
 ******************************************************************************/
function Map(root, size) {
	this._root = root;
	this._size = size;
}

Object.defineProperty(Map.prototype, 'size', {
	get: Map.prototype.count
});


Object.assign(Map.prototype, {
	count: function() {
		return count(this)
	}
	, forEach: function(f) {
		return forEach(f, this)
	}
	, fold: function(f, seed) {
		return fold(f, seed, this)
	}
	, values: function() {
		return values(this)
	}
	, keys: function() {
		return keys(this)
	}
	, entries: function() {
		return entries(this)
	}
	, remove: function(key) {
		return remove(key, this)
	}
	, removeHash: function(hash, key) {
		return removeHash(hash, key, this)
	}
	, set: function(key, value) {
		return set(key, value, this);
	}
	, setHash: function (hash, key, value) {
		return setHash(hash, key, value, this);
	}
	, modifyValue: function (key, f, defaultValue) {
		return modifyValue(f, defaultValue, key, this);
	}
	, modifyValueHash: function (hash, key, f, defaultValue) {
		return modifyValueHash(f, defaultValue, hash, key, this);
	}
	, modify: function (key, f) {
		return modify(f, key, this);
	}
	, modifyHash: function (hash, key, f) {
		return modifyHash(f, hash, key, this);
	}
	, isEmpty: function () {
		return isEmpty(this);
	}
	, has: function (key) {
		return has(key, this);
	}
	, hasHash: function (hash, key) {
		return hasHash(hash, key, this);
	}
	, get: function (key, alt) {
		return tryGetHash(alt, hash(key), key, this);
	}
	, getHash: function (hash, key) {
		return getHash(hash, key, this);
	}
	, tryGet: function (alt, key) {
		return tryGetHash(alt, hash(key), key, this);
	}
	, tryGetHash: function(alt, hash, key) {
		return tryGetHash(alt, hash, key, this);
	}
	, setTree: function (root, size) {
		return root === this._root ? this : new Map(root, size);
	}
	, __hamt_isMap: true
})