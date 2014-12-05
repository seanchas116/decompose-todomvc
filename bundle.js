(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],3:[function(require,module,exports){
(function() {
  'use strict';
  var Component, ComponentNode, EventEmitter, h,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  h = require('virtual-hyperscript');

  EventEmitter = (require('events')).EventEmitter;

  ComponentNode = require('../node/ComponentNode');

  module.exports = Component = (function(_super) {
    __extends(Component, _super);

    function Component(attrs) {
      this.assign(attrs);
      this.onInit();
    }

    Component.prototype.assign = function(attrs) {
      var key, value, willUpdate;
      willUpdate = false;
      for (key in attrs) {
        if (!__hasProp.call(attrs, key)) continue;
        value = attrs[key];
        if (this[key] !== value) {
          this[key] = value;
          willUpdate = true;
        }
      }
      if (willUpdate) {
        return this.emit('update');
      }
    };

    Component.prototype.destroy = function() {
      return this.onDestroy();
    };

    Component.prototype.update = function() {
      return this.emit('update');
    };

    Component.prototype.render = function() {
      return h('div');
    };

    Component.prototype.onInit = function() {};

    Component.prototype.onMount = function() {};

    Component.prototype.onUnmount = function() {};

    Component.render = function(attrs) {
      return new ComponentNode(this, attrs != null ? attrs : {});
    };

    return Component;

  })(EventEmitter);

}).call(this);

},{"../node/ComponentNode":7,"events":2,"virtual-hyperscript":37}],4:[function(require,module,exports){
(function() {
  'use strict';
  var Component, DomComponent, DomComponentNode,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Component = require('./Component');

  DomComponentNode = require('../node/DomComponentNode');


  /*
  DomComponent provides representation for components which hold and manage a real DOM element.
   */

  module.exports = DomComponent = (function(_super) {
    __extends(DomComponent, _super);

    DomComponent.prototype.tag = 'div';

    function DomComponent(attrs) {
      this.element = document.createElement(this.tag);
      DomComponent.__super__.constructor.call(this, attrs);
    }

    DomComponent.render = function(attrs) {
      return new DomComponentNode(this, attrs != null ? attrs : {});
    };

    return DomComponent;

  })(Component);

}).call(this);

},{"../node/DomComponentNode":8,"./Component":3}],5:[function(require,module,exports){
(function() {
  'use strict';
  module.exports = {
    Component: require('./component/Component'),
    DomComponent: require('./component/DomComponent'),
    Mount: require('./mount/Mount')
  };

}).call(this);

},{"./component/Component":3,"./component/DomComponent":4,"./mount/Mount":6}],6:[function(require,module,exports){
(function() {
  'use strict';
  var Mount, createDom, diff, findComponentNodes, patch;

  diff = require('virtual-dom/diff');

  patch = require('virtual-dom/patch');

  createDom = require('virtual-dom/create-element');

  module.exports = Mount = (function() {
    function Mount(component) {
      this.component = component;
      this.updateCallback = (function(_this) {
        return function() {
          return _this.update();
        };
      })(this);
    }

    Mount.prototype.update = function() {
      var newTree, patches;
      newTree = this.component.render();
      patches = diff(this.tree, newTree);
      this.domElement = patch(this.domElement, patches);
      return this.tree = newTree;
    };

    Mount.prototype.mount = function(placeholder) {
      var parent, selector;
      if (typeof placeholder === 'string') {
        selector = placeholder;
        placeholder = document.querySelector(selector);
        if (placeholder == null) {
          throw new Error("No such element found: '" + selector + "'");
        }
      }
      this.create();
      parent = placeholder.parentElement;
      return parent.replaceChild(this.domElement, placeholder);
    };

    Mount.prototype.create = function() {
      this.tree = this.component.render();
      this.domElement = createDom(this.tree);
      this.component.on('update', this.updateCallback);
      this.component.onMount();
      return this.domElement;
    };

    Mount.prototype.unmount = function() {
      this.component.removeListener('update', this.updateCallback);
      findComponentNodes(this.tree).forEach(function(node) {
        return node.destroy();
      });
      return this.component.onUnmount();
    };

    return Mount;

  })();

  findComponentNodes = require('../node/findComponentNodes');

}).call(this);

},{"../node/findComponentNodes":9,"virtual-dom/create-element":10,"virtual-dom/diff":11,"virtual-dom/patch":21}],7:[function(require,module,exports){
(function() {
  'use strict';
  var ComponentNode, Mount;

  Mount = require('../mount/Mount');

  module.exports = ComponentNode = (function() {
    ComponentNode.prototype.type = 'Widget';

    ComponentNode.prototype.widgetType = 'Component';

    function ComponentNode(klass, attrs) {
      this.klass = klass;
      this.attrs = attrs;
    }

    ComponentNode.prototype.init = function() {
      this.component = new this.klass();
      this.component.assign(this.attrs);
      this.mount = new Mount(this.component);
      return this.mount.create();
    };

    ComponentNode.prototype.update = function(old, dom) {
      if (old.klass !== this.klass) {
        return this.init();
      }
      this.component = old.component;
      this.mount = old.mount;
      this.component.assign(this.attrs);
      return this.mount.dom;
    };

    ComponentNode.prototype.destroy = function() {
      return this.mount.unmount();
    };

    return ComponentNode;

  })();

}).call(this);

},{"../mount/Mount":6}],8:[function(require,module,exports){
(function() {
  'use strict';
  var DomComponentNode;

  module.exports = DomComponentNode = (function() {
    DomComponentNode.prototype.type = 'Widget';

    DomComponentNode.prototype.widgetType = 'DomComponent';

    function DomComponentNode(klass, attrs) {
      this.klass = klass;
      this.attrs = attrs;
    }

    DomComponentNode.prototype.init = function() {
      this.component = new this.klass(this.attrs);
      return this.component.element;
    };

    DomComponentNode.prototype.update = function(old, dom) {
      if (old.klass !== this.klass) {
        return this.init();
      }
      this.component = old.component;
      return this.component.element;
    };

    DomComponentNode.prototype.destroy = function(dom) {
      return this.component.destroy();
    };

    return DomComponentNode;

  })();

}).call(this);

},{}],9:[function(require,module,exports){
(function() {
  'use strict';
  var concat, findComponentNodes, flatten, isVNode, isWidget;

  isVNode = require('vtree/is-vnode');

  isWidget = require('vtree/is-widget');

  concat = Array.prototype.concat;

  flatten = function(arrays) {
    return concat.apply([], arrays);
  };

  module.exports = findComponentNodes = function(tree) {
    switch (false) {
      case !(isVNode(tree) && tree.children):
        return flatten(tree.children.map(findComponentNodes));
      case !(isWidget(tree) && tree.widgetType === 'Component'):
        return [tree];
      default:
        return [];
    }
  };

}).call(this);

},{"vtree/is-vnode":26,"vtree/is-widget":28}],10:[function(require,module,exports){
var createElement = require("vdom/create-element")

module.exports = createElement

},{"vdom/create-element":14}],11:[function(require,module,exports){
var diff = require("vtree/diff")

module.exports = diff

},{"vtree/diff":22}],12:[function(require,module,exports){
module.exports = isObject

function isObject(x) {
    return typeof x === "object" && x !== null
}

},{}],13:[function(require,module,exports){
var isObject = require("is-object")
var isHook = require("vtree/is-vhook")

module.exports = applyProperties

function applyProperties(node, props, previous) {
    for (var propName in props) {
        var propValue = props[propName]

        if (propValue === undefined) {
            removeProperty(node, props, previous, propName);
        } else if (isHook(propValue)) {
            propValue.hook(node,
                propName,
                previous ? previous[propName] : undefined)
        } else {
            if (isObject(propValue)) {
                patchObject(node, props, previous, propName, propValue);
            } else if (propValue !== undefined) {
                node[propName] = propValue
            }
        }
    }
}

function removeProperty(node, props, previous, propName) {
    if (previous) {
        var previousValue = previous[propName]

        if (!isHook(previousValue)) {
            if (propName === "attributes") {
                for (var attrName in previousValue) {
                    node.removeAttribute(attrName)
                }
            } else if (propName === "style") {
                for (var i in previousValue) {
                    node.style[i] = ""
                }
            } else if (typeof previousValue === "string") {
                node[propName] = ""
            } else {
                node[propName] = null
            }
        }
    }
}

function patchObject(node, props, previous, propName, propValue) {
    var previousValue = previous ? previous[propName] : undefined

    // Set attributes
    if (propName === "attributes") {
        for (var attrName in propValue) {
            var attrValue = propValue[attrName]

            if (attrValue === undefined) {
                node.removeAttribute(attrName)
            } else {
                node.setAttribute(attrName, attrValue)
            }
        }

        return
    }

    if(previousValue && isObject(previousValue) &&
        getPrototype(previousValue) !== getPrototype(propValue)) {
        node[propName] = propValue
        return
    }

    if (!isObject(node[propName])) {
        node[propName] = {}
    }

    var replacer = propName === "style" ? "" : undefined

    for (var k in propValue) {
        var value = propValue[k]
        node[propName][k] = (value === undefined) ? replacer : value
    }
}

function getPrototype(value) {
    if (Object.getPrototypeOf) {
        return Object.getPrototypeOf(value)
    } else if (value.__proto__) {
        return value.__proto__
    } else if (value.constructor) {
        return value.constructor.prototype
    }
}

},{"is-object":12,"vtree/is-vhook":25}],14:[function(require,module,exports){
var document = require("global/document")

var applyProperties = require("./apply-properties")

var isVNode = require("vtree/is-vnode")
var isVText = require("vtree/is-vtext")
var isWidget = require("vtree/is-widget")
var handleThunk = require("vtree/handle-thunk")

module.exports = createElement

function createElement(vnode, opts) {
    var doc = opts ? opts.document || document : document
    var warn = opts ? opts.warn : null

    vnode = handleThunk(vnode).a

    if (isWidget(vnode)) {
        return vnode.init()
    } else if (isVText(vnode)) {
        return doc.createTextNode(vnode.text)
    } else if (!isVNode(vnode)) {
        if (warn) {
            warn("Item is not a valid virtual dom node", vnode)
        }
        return null
    }

    var node = (vnode.namespace === null) ?
        doc.createElement(vnode.tagName) :
        doc.createElementNS(vnode.namespace, vnode.tagName)

    var props = vnode.properties
    applyProperties(node, props)

    var children = vnode.children

    for (var i = 0; i < children.length; i++) {
        var childNode = createElement(children[i], opts)
        if (childNode) {
            node.appendChild(childNode)
        }
    }

    return node
}

},{"./apply-properties":13,"global/document":16,"vtree/handle-thunk":23,"vtree/is-vnode":26,"vtree/is-vtext":27,"vtree/is-widget":28}],15:[function(require,module,exports){
// Maps a virtual DOM tree onto a real DOM tree in an efficient manner.
// We don't want to read all of the DOM nodes in the tree so we use
// the in-order tree indexing to eliminate recursion down certain branches.
// We only recurse into a DOM node if we know that it contains a child of
// interest.

var noChild = {}

module.exports = domIndex

function domIndex(rootNode, tree, indices, nodes) {
    if (!indices || indices.length === 0) {
        return {}
    } else {
        indices.sort(ascending)
        return recurse(rootNode, tree, indices, nodes, 0)
    }
}

function recurse(rootNode, tree, indices, nodes, rootIndex) {
    nodes = nodes || {}


    if (rootNode) {
        if (indexInRange(indices, rootIndex, rootIndex)) {
            nodes[rootIndex] = rootNode
        }

        var vChildren = tree.children

        if (vChildren) {

            var childNodes = rootNode.childNodes

            for (var i = 0; i < tree.children.length; i++) {
                rootIndex += 1

                var vChild = vChildren[i] || noChild
                var nextIndex = rootIndex + (vChild.count || 0)

                // skip recursion down the tree if there are no nodes down here
                if (indexInRange(indices, rootIndex, nextIndex)) {
                    recurse(childNodes[i], vChild, indices, nodes, rootIndex)
                }

                rootIndex = nextIndex
            }
        }
    }

    return nodes
}

// Binary search for an index in the interval [left, right]
function indexInRange(indices, left, right) {
    if (indices.length === 0) {
        return false
    }

    var minIndex = 0
    var maxIndex = indices.length - 1
    var currentIndex
    var currentItem

    while (minIndex <= maxIndex) {
        currentIndex = ((maxIndex + minIndex) / 2) >> 0
        currentItem = indices[currentIndex]

        if (minIndex === maxIndex) {
            return currentItem >= left && currentItem <= right
        } else if (currentItem < left) {
            minIndex = currentIndex + 1
        } else  if (currentItem > right) {
            maxIndex = currentIndex - 1
        } else {
            return true
        }
    }

    return false;
}

function ascending(a, b) {
    return a > b ? 1 : -1
}

},{}],16:[function(require,module,exports){
(function (global){
var topLevel = typeof global !== 'undefined' ? global :
    typeof window !== 'undefined' ? window : {}
var minDoc = require('min-document');

if (typeof document !== 'undefined') {
    module.exports = document;
} else {
    var doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'];

    if (!doccy) {
        doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'] = minDoc;
    }

    module.exports = doccy;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"min-document":1}],17:[function(require,module,exports){
var applyProperties = require("./apply-properties")

var isWidget = require("vtree/is-widget")
var VPatch = require("vtree/vpatch")

var render = require("./create-element")
var updateWidget = require("./update-widget")

module.exports = applyPatch

function applyPatch(vpatch, domNode, renderOptions) {
    var type = vpatch.type
    var vNode = vpatch.vNode
    var patch = vpatch.patch

    switch (type) {
        case VPatch.REMOVE:
            return removeNode(domNode, vNode)
        case VPatch.INSERT:
            return insertNode(domNode, patch, renderOptions)
        case VPatch.VTEXT:
            return stringPatch(domNode, vNode, patch, renderOptions)
        case VPatch.WIDGET:
            return widgetPatch(domNode, vNode, patch, renderOptions)
        case VPatch.VNODE:
            return vNodePatch(domNode, vNode, patch, renderOptions)
        case VPatch.ORDER:
            reorderChildren(domNode, patch)
            return domNode
        case VPatch.PROPS:
            applyProperties(domNode, patch, vNode.properties)
            return domNode
        case VPatch.THUNK:
            return replaceRoot(domNode,
                renderOptions.patch(domNode, patch, renderOptions))
        default:
            return domNode
    }
}

function removeNode(domNode, vNode) {
    var parentNode = domNode.parentNode

    if (parentNode) {
        parentNode.removeChild(domNode)
    }

    destroyWidget(domNode, vNode);

    return null
}

function insertNode(parentNode, vNode, renderOptions) {
    var newNode = render(vNode, renderOptions)

    if (parentNode) {
        parentNode.appendChild(newNode)
    }

    return parentNode
}

function stringPatch(domNode, leftVNode, vText, renderOptions) {
    var newNode

    if (domNode.nodeType === 3) {
        domNode.replaceData(0, domNode.length, vText.text)
        newNode = domNode
    } else {
        var parentNode = domNode.parentNode
        newNode = render(vText, renderOptions)

        if (parentNode) {
            parentNode.replaceChild(newNode, domNode)
        }
    }

    destroyWidget(domNode, leftVNode)

    return newNode
}

function widgetPatch(domNode, leftVNode, widget, renderOptions) {
    if (updateWidget(leftVNode, widget)) {
        return widget.update(leftVNode, domNode) || domNode
    }

    var parentNode = domNode.parentNode
    var newWidget = render(widget, renderOptions)

    if (parentNode) {
        parentNode.replaceChild(newWidget, domNode)
    }

    destroyWidget(domNode, leftVNode)

    return newWidget
}

function vNodePatch(domNode, leftVNode, vNode, renderOptions) {
    var parentNode = domNode.parentNode
    var newNode = render(vNode, renderOptions)

    if (parentNode) {
        parentNode.replaceChild(newNode, domNode)
    }

    destroyWidget(domNode, leftVNode)

    return newNode
}

function destroyWidget(domNode, w) {
    if (typeof w.destroy === "function" && isWidget(w)) {
        w.destroy(domNode)
    }
}

function reorderChildren(domNode, bIndex) {
    var children = []
    var childNodes = domNode.childNodes
    var len = childNodes.length
    var i
    var reverseIndex = bIndex.reverse

    for (i = 0; i < len; i++) {
        children.push(domNode.childNodes[i])
    }

    var insertOffset = 0
    var move
    var node
    var insertNode
    for (i = 0; i < len; i++) {
        move = bIndex[i]
        if (move !== undefined && move !== i) {
            // the element currently at this index will be moved later so increase the insert offset
            if (reverseIndex[i] > i) {
                insertOffset++
            }

            node = children[move]
            insertNode = childNodes[i + insertOffset] || null
            if (node !== insertNode) {
                domNode.insertBefore(node, insertNode)
            }

            // the moved element came from the front of the array so reduce the insert offset
            if (move < i) {
                insertOffset--
            }
        }

        // element at this index is scheduled to be removed so increase insert offset
        if (i in bIndex.removes) {
            insertOffset++
        }
    }
}

function replaceRoot(oldRoot, newRoot) {
    if (oldRoot && newRoot && oldRoot !== newRoot && oldRoot.parentNode) {
        console.log(oldRoot)
        oldRoot.parentNode.replaceChild(newRoot, oldRoot)
    }

    return newRoot;
}

},{"./apply-properties":13,"./create-element":14,"./update-widget":19,"vtree/is-widget":28,"vtree/vpatch":32}],18:[function(require,module,exports){
var document = require("global/document")
var isArray = require("x-is-array")

var domIndex = require("./dom-index")
var patchOp = require("./patch-op")
module.exports = patch

function patch(rootNode, patches) {
    return patchRecursive(rootNode, patches)
}

function patchRecursive(rootNode, patches, renderOptions) {
    var indices = patchIndices(patches)

    if (indices.length === 0) {
        return rootNode
    }

    var index = domIndex(rootNode, patches.a, indices)
    var ownerDocument = rootNode.ownerDocument

    if (!renderOptions) {
        renderOptions = { patch: patchRecursive }
        if (ownerDocument !== document) {
            renderOptions.document = ownerDocument
        }
    }

    for (var i = 0; i < indices.length; i++) {
        var nodeIndex = indices[i]
        rootNode = applyPatch(rootNode,
            index[nodeIndex],
            patches[nodeIndex],
            renderOptions)
    }

    return rootNode
}

function applyPatch(rootNode, domNode, patchList, renderOptions) {
    if (!domNode) {
        return rootNode
    }

    var newNode

    if (isArray(patchList)) {
        for (var i = 0; i < patchList.length; i++) {
            newNode = patchOp(patchList[i], domNode, renderOptions)

            if (domNode === rootNode) {
                rootNode = newNode
            }
        }
    } else {
        newNode = patchOp(patchList, domNode, renderOptions)

        if (domNode === rootNode) {
            rootNode = newNode
        }
    }

    return rootNode
}

function patchIndices(patches) {
    var indices = []

    for (var key in patches) {
        if (key !== "a") {
            indices.push(Number(key))
        }
    }

    return indices
}

},{"./dom-index":15,"./patch-op":17,"global/document":16,"x-is-array":20}],19:[function(require,module,exports){
var isWidget = require("vtree/is-widget")

module.exports = updateWidget

function updateWidget(a, b) {
    if (isWidget(a) && isWidget(b)) {
        if ("name" in a && "name" in b) {
            return a.id === b.id
        } else {
            return a.init === b.init
        }
    }

    return false
}

},{"vtree/is-widget":28}],20:[function(require,module,exports){
var nativeIsArray = Array.isArray
var toString = Object.prototype.toString

module.exports = nativeIsArray || isArray

function isArray(obj) {
    return toString.call(obj) === "[object Array]"
}

},{}],21:[function(require,module,exports){
var patch = require("vdom/patch")

module.exports = patch

},{"vdom/patch":18}],22:[function(require,module,exports){
var isArray = require("x-is-array")
var isObject = require("is-object")

var VPatch = require("./vpatch")
var isVNode = require("./is-vnode")
var isVText = require("./is-vtext")
var isWidget = require("./is-widget")
var isThunk = require("./is-thunk")
var handleThunk = require("./handle-thunk")

module.exports = diff

function diff(a, b) {
    var patch = { a: a }
    walk(a, b, patch, 0)
    return patch
}

function walk(a, b, patch, index) {
    if (a === b) {
        if (isThunk(a) || isThunk(b)) {
            thunks(a, b, patch, index)
        } else {
            hooks(b, patch, index)
        }
        return
    }

    var apply = patch[index]

    if (isThunk(a) || isThunk(b)) {
        thunks(a, b, patch, index)
    } else if (b == null) {
        patch[index] = new VPatch(VPatch.REMOVE, a, b)
        destroyWidgets(a, patch, index)
    } else if (isVNode(b)) {
        if (isVNode(a)) {
            if (a.tagName === b.tagName &&
                a.namespace === b.namespace &&
                a.key === b.key) {
                var propsPatch = diffProps(a.properties, b.properties, b.hooks)
                if (propsPatch) {
                    apply = appendPatch(apply,
                        new VPatch(VPatch.PROPS, a, propsPatch))
                }
                apply = diffChildren(a, b, patch, apply, index)
            } else {
                apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
                destroyWidgets(a, patch, index)
            }
        } else {
            apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
            destroyWidgets(a, patch, index)
        }
    } else if (isVText(b)) {
        if (!isVText(a)) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
            destroyWidgets(a, patch, index)
        } else if (a.text !== b.text) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
        }
    } else if (isWidget(b)) {
        apply = appendPatch(apply, new VPatch(VPatch.WIDGET, a, b))

        if (!isWidget(a)) {
            destroyWidgets(a, patch, index)
        }
    }

    if (apply) {
        patch[index] = apply
    }
}

function diffProps(a, b, hooks) {
    var diff

    for (var aKey in a) {
        if (!(aKey in b)) {
            diff = diff || {}
            diff[aKey] = undefined
        }

        var aValue = a[aKey]
        var bValue = b[aKey]

        if (hooks && aKey in hooks) {
            diff = diff || {}
            diff[aKey] = bValue
        } else {
            if (isObject(aValue) && isObject(bValue)) {
                if (getPrototype(bValue) !== getPrototype(aValue)) {
                    diff = diff || {}
                    diff[aKey] = bValue
                } else {
                    var objectDiff = diffProps(aValue, bValue)
                    if (objectDiff) {
                        diff = diff || {}
                        diff[aKey] = objectDiff
                    }
                }
            } else if (aValue !== bValue) {
                diff = diff || {}
                diff[aKey] = bValue
            }
        }
    }

    for (var bKey in b) {
        if (!(bKey in a)) {
            diff = diff || {}
            diff[bKey] = b[bKey]
        }
    }

    return diff
}

function getPrototype(value) {
    if (Object.getPrototypeOf) {
        return Object.getPrototypeOf(value)
    } else if (value.__proto__) {
        return value.__proto__
    } else if (value.constructor) {
        return value.constructor.prototype
    }
}

function diffChildren(a, b, patch, apply, index) {
    var aChildren = a.children
    var bChildren = reorder(aChildren, b.children)

    var aLen = aChildren.length
    var bLen = bChildren.length
    var len = aLen > bLen ? aLen : bLen

    for (var i = 0; i < len; i++) {
        var leftNode = aChildren[i]
        var rightNode = bChildren[i]
        index += 1

        if (!leftNode) {
            if (rightNode) {
                // Excess nodes in b need to be added
                apply = appendPatch(apply,
                    new VPatch(VPatch.INSERT, null, rightNode))
            }
        } else {
            walk(leftNode, rightNode, patch, index)
        }

        if (isVNode(leftNode) && leftNode.count) {
            index += leftNode.count
        }
    }

    if (bChildren.moves) {
        // Reorder nodes last
        apply = appendPatch(apply, new VPatch(VPatch.ORDER, a, bChildren.moves))
    }

    return apply
}

// Patch records for all destroyed widgets must be added because we need
// a DOM node reference for the destroy function
function destroyWidgets(vNode, patch, index) {
    if (isWidget(vNode)) {
        if (typeof vNode.destroy === "function") {
            patch[index] = new VPatch(VPatch.REMOVE, vNode, null)
        }
    } else if (isVNode(vNode) && (vNode.hasWidgets || vNode.hasThunks)) {
        var children = vNode.children
        var len = children.length
        for (var i = 0; i < len; i++) {
            var child = children[i]
            index += 1

            destroyWidgets(child, patch, index)

            if (isVNode(child) && child.count) {
                index += child.count
            }
        }
    } else if (isThunk(vNode)) {
        thunks(vNode, null, patch, index)
    }
}

// Create a sub-patch for thunks
function thunks(a, b, patch, index) {
    var nodes = handleThunk(a, b);
    var thunkPatch = diff(nodes.a, nodes.b)
    if (hasPatches(thunkPatch)) {
        patch[index] = new VPatch(VPatch.THUNK, null, thunkPatch)
    }
}

function hasPatches(patch) {
    for (var index in patch) {
        if (index !== "a") {
            return true;
        }
    }

    return false;
}

// Execute hooks when two nodes are identical
function hooks(vNode, patch, index) {
    if (isVNode(vNode)) {
        if (vNode.hooks) {
            patch[index] = new VPatch(VPatch.PROPS, vNode.hooks, vNode.hooks)
        }

        if (vNode.descendantHooks) {
            var children = vNode.children
            var len = children.length
            for (var i = 0; i < len; i++) {
                var child = children[i]
                index += 1

                hooks(child, patch, index)

                if (isVNode(child) && child.count) {
                    index += child.count
                }
            }
        }
    }
}

// List diff, naive left to right reordering
function reorder(aChildren, bChildren) {

    var bKeys = keyIndex(bChildren)

    if (!bKeys) {
        return bChildren
    }

    var aKeys = keyIndex(aChildren)

    if (!aKeys) {
        return bChildren
    }

    var bMatch = {}, aMatch = {}

    for (var key in bKeys) {
        bMatch[bKeys[key]] = aKeys[key]
    }

    for (var key in aKeys) {
        aMatch[aKeys[key]] = bKeys[key]
    }

    var aLen = aChildren.length
    var bLen = bChildren.length
    var len = aLen > bLen ? aLen : bLen
    var shuffle = []
    var freeIndex = 0
    var i = 0
    var moveIndex = 0
    var moves = {}
    var removes = moves.removes = {}
    var reverse = moves.reverse = {}
    var hasMoves = false

    while (freeIndex < len) {
        var move = aMatch[i]
        if (move !== undefined) {
            shuffle[i] = bChildren[move]
            if (move !== moveIndex) {
                moves[move] = moveIndex
                reverse[moveIndex] = move
                hasMoves = true
            }
            moveIndex++
        } else if (i in aMatch) {
            shuffle[i] = undefined
            removes[i] = moveIndex++
            hasMoves = true
        } else {
            while (bMatch[freeIndex] !== undefined) {
                freeIndex++
            }

            if (freeIndex < len) {
                var freeChild = bChildren[freeIndex]
                if (freeChild) {
                    shuffle[i] = freeChild
                    if (freeIndex !== moveIndex) {
                        hasMoves = true
                        moves[freeIndex] = moveIndex
                        reverse[moveIndex] = freeIndex
                    }
                    moveIndex++
                }
                freeIndex++
            }
        }
        i++
    }

    if (hasMoves) {
        shuffle.moves = moves
    }

    return shuffle
}

function keyIndex(children) {
    var i, keys

    for (i = 0; i < children.length; i++) {
        var child = children[i]

        if (child.key !== undefined) {
            keys = keys || {}
            keys[child.key] = i
        }
    }

    return keys
}

function appendPatch(apply, patch) {
    if (apply) {
        if (isArray(apply)) {
            apply.push(patch)
        } else {
            apply = [apply, patch]
        }

        return apply
    } else {
        return patch
    }
}

},{"./handle-thunk":23,"./is-thunk":24,"./is-vnode":26,"./is-vtext":27,"./is-widget":28,"./vpatch":32,"is-object":29,"x-is-array":30}],23:[function(require,module,exports){
var isVNode = require("./is-vnode")
var isVText = require("./is-vtext")
var isWidget = require("./is-widget")
var isThunk = require("./is-thunk")

module.exports = handleThunk

function handleThunk(a, b) {
    var renderedA = a
    var renderedB = b

    if (isThunk(b)) {
        renderedB = renderThunk(b, a)
    }

    if (isThunk(a)) {
        renderedA = renderThunk(a, null)
    }

    return {
        a: renderedA,
        b: renderedB
    }
}

function renderThunk(thunk, previous) {
    var renderedThunk = thunk.vnode

    if (!renderedThunk) {
        renderedThunk = thunk.vnode = thunk.render(previous)
    }

    if (!(isVNode(renderedThunk) ||
            isVText(renderedThunk) ||
            isWidget(renderedThunk))) {
        throw new Error("thunk did not return a valid node");
    }

    return renderedThunk
}

},{"./is-thunk":24,"./is-vnode":26,"./is-vtext":27,"./is-widget":28}],24:[function(require,module,exports){
module.exports = isThunk

function isThunk(t) {
    return t && t.type === "Thunk"
}

},{}],25:[function(require,module,exports){
module.exports = isHook

function isHook(hook) {
    return hook && typeof hook.hook === "function" &&
        !hook.hasOwnProperty("hook")
}

},{}],26:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualNode

function isVirtualNode(x) {
    return x && x.type === "VirtualNode" && x.version === version
}

},{"./version":31}],27:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualText

function isVirtualText(x) {
    return x && x.type === "VirtualText" && x.version === version
}

},{"./version":31}],28:[function(require,module,exports){
module.exports = isWidget

function isWidget(w) {
    return w && w.type === "Widget"
}

},{}],29:[function(require,module,exports){
module.exports=require(12)
},{"/Users/seanchas116/Projects/decompose-todomvc/node_modules/decompose/node_modules/virtual-dom/node_modules/is-object/index.js":12}],30:[function(require,module,exports){
module.exports=require(20)
},{"/Users/seanchas116/Projects/decompose-todomvc/node_modules/decompose/node_modules/virtual-dom/node_modules/x-is-array/index.js":20}],31:[function(require,module,exports){
module.exports = "1"

},{}],32:[function(require,module,exports){
var version = require("./version")

VirtualPatch.NONE = 0
VirtualPatch.VTEXT = 1
VirtualPatch.VNODE = 2
VirtualPatch.WIDGET = 3
VirtualPatch.PROPS = 4
VirtualPatch.ORDER = 5
VirtualPatch.INSERT = 6
VirtualPatch.REMOVE = 7
VirtualPatch.THUNK = 8

module.exports = VirtualPatch

function VirtualPatch(type, vNode, patch) {
    this.type = Number(type)
    this.vNode = vNode
    this.patch = patch
}

VirtualPatch.prototype.version = version
VirtualPatch.prototype.type = "VirtualPatch"

},{"./version":31}],33:[function(require,module,exports){
(function (root, pluralize) {
  /* istanbul ignore else */
  if (typeof require === 'function' && typeof exports === 'object' && typeof module === 'object') {
    // Node.
    module.exports = pluralize();
  } else if (typeof define === 'function' && define.amd) {
    // AMD, registers as an anonymous module.
    define(function () {
      return pluralize();
    });
  } else {
    // Browser global.
    root.pluralize = pluralize();
  }
})(this, function () {
  // Rule storage - pluralize and singularize need to be run sequentially,
  // while other rules can be optimized using an object for instant lookups.
  var pluralRules      = [];
  var singularRules    = [];
  var uncountables     = {};
  var irregularPlurals = {};
  var irregularSingles = {};

  /**
   * Title case a string.
   *
   * @param  {string} str
   * @return {string}
   */
  function toTitleCase (str) {
    return str.charAt(0).toUpperCase() + str.substr(1).toLowerCase();
  }

  /**
   * Sanitize a pluralization rule to a usable regular expression.
   *
   * @param  {(RegExp|string)} rule
   * @return {RegExp}
   */
  function sanitizeRule (rule) {
    if (typeof rule === 'string') {
      return new RegExp('^' + rule + '$', 'i');
    }

    return rule;
  }

  /**
   * Pass in a word token to produce a function that can replicate the case on
   * another word.
   *
   * @param  {string}   word
   * @param  {string}   token
   * @return {Function}
   */
  function restoreCase (word, token) {
    // Upper cased words. E.g. "HELLO".
    if (word === word.toUpperCase()) {
      return token.toUpperCase();
    }

    // Title cased words. E.g. "Title".
    if (word[0] === word[0].toUpperCase()) {
      return toTitleCase(token);
    }

    // Lower cased words. E.g. "test".
    return token.toLowerCase();
  }

  /**
   * Interpolate a regexp string.
   *
   * @param  {[type]} str  [description]
   * @param  {[type]} args [description]
   * @return {[type]}      [description]
   */
  function interpolate (str, args) {
    return str.replace(/\$(\d{1,2})/g, function (match, index) {
      return args[index] || '';
    });
  }

  /**
   * Sanitize a word by passing in the word and sanitization rules.
   *
   * @param  {String}   word
   * @param  {Array}    collection
   * @return {String}
   */
  function sanitizeWord (word, collection) {
    // Empty string or doesn't need fixing.
    if (!word.length || uncountables.hasOwnProperty(word)) {
      return word;
    }

    var len = collection.length;

    // Iterate over the sanitization rules and use the first one to match.
    while (len--) {
      var rule = collection[len];

      // If the rule passes, return the replacement.
      if (rule[0].test(word)) {
        return word.replace(rule[0], function (match, index, word) {
          var result = interpolate(rule[1], arguments);

          if (match === '') {
            return restoreCase(word[index - 1], result);
          }

          return restoreCase(match, result);
        });
      }
    }

    return word;
  }

  /**
   * Replace a word with the updated word.
   *
   * @param  {Object}   replaceMap
   * @param  {Object}   keepMap
   * @param  {Array}    rules
   * @return {Function}
   */
  function replaceWord (replaceMap, keepMap, rules) {
    return function (word) {
      // Get the correct token and case restoration functions.
      var token = word.toLowerCase();

      // Check against the keep object map.
      if (keepMap.hasOwnProperty(token)) {
        return restoreCase(word, token);
      }

      // Check against the replacement map for a direct word replacement.
      if (replaceMap.hasOwnProperty(token)) {
        return restoreCase(word, replaceMap[token]);
      }

      // Run all the rules against the word.
      return sanitizeWord(word, rules);
    };
  }

  /**
   * Pluralize or singularize a word based on the passed in count.
   *
   * @param  {String}  word
   * @param  {Number}  count
   * @param  {Boolean} inclusive
   * @return {String}
   */
  function pluralize (word, count, inclusive) {
    var pluralized = count === 1 ?
      pluralize.singular(word) : pluralize.plural(word);

    return (inclusive ? count + ' ' : '') + pluralized;
  }

  /**
   * Pluralize a word.
   *
   * @type {Function}
   */
  pluralize.plural = replaceWord(
    irregularSingles, irregularPlurals, pluralRules
  );

  /**
   * Singularize a word.
   *
   * @type {Function}
   */
  pluralize.singular = replaceWord(
    irregularPlurals, irregularSingles, singularRules
  );

  /**
   * Add a pluralization rule to the collection.
   *
   * @param {(string|RegExp)} rule
   * @param {string}          replacement
   */
  pluralize.addPluralRule = function (rule, replacement) {
    pluralRules.push([sanitizeRule(rule), replacement]);
  };

  /**
   * Add a singularization rule to the collection.
   *
   * @param {(string|RegExp)} rule
   * @param {string}          replacement
   */
  pluralize.addSingularRule = function (rule, replacement) {
    singularRules.push([sanitizeRule(rule), replacement]);
  };

  /**
   * Add an uncountable word rule.
   *
   * @param {(string|RegExp)} word
   */
  pluralize.addUncountableRule = function (word) {
    if (typeof word === 'string') {
      return uncountables[word.toLowerCase()] = true;
    }

    // Set singular and plural references for the word.
    pluralize.addPluralRule(word, '$0');
    pluralize.addSingularRule(word, '$0');
  };

  /**
   * Add an irregular word definition.
   *
   * @param {String} single
   * @param {String} plural
   */
  pluralize.addIrregularRule = function (single, plural) {
    plural = plural.toLowerCase();
    single = single.toLowerCase();

    irregularSingles[single] = plural;
    irregularPlurals[plural] = single;
  };

  /**
   * Irregular rules.
   */
  [
    // Pronouns.
    ['I',        'we'],
    ['me',       'us'],
    ['he',       'they'],
    ['she',      'they'],
    ['them',     'them'],
    ['myself',   'ourselves'],
    ['yourself', 'yourselves'],
    ['itself',   'themselves'],
    ['herself',  'themselves'],
    ['himself',  'themselves'],
    ['themself', 'themselves'],
    ['this',     'these'],
    ['that',     'those'],
    // Words ending in with a consonant and `o`.
    ['volcano', 'volcanoes'],
    ['tornado', 'tornadoes'],
    ['torpedo', 'torpedoes'],
    // Ends with `us`.
    ['genus',  'genera'],
    ['viscus', 'viscera'],
    // Ends with `ma`.
    ['stigma',   'stigmata'],
    ['stoma',    'stomata'],
    ['dogma',    'dogmata'],
    ['lemma',    'lemmata'],
    ['schema',   'schemata'],
    ['anathema', 'anathemata'],
    // Other irregular rules.
    ['ox',      'oxen'],
    ['axe',     'axes'],
    ['die',     'dice'],
    ['yes',     'yeses'],
    ['foot',    'feet'],
    ['eave',    'eaves'],
    ['goose',   'geese'],
    ['tooth',   'teeth'],
    ['quiz',    'quizzes'],
    ['human',   'humans'],
    ['proof',   'proofs'],
    ['carve',   'carves'],
    ['valve',   'valves'],
    ['thief',   'thieves'],
    ['genie',   'genies'],
    ['groove',  'grooves'],
    ['pickaxe', 'pickaxes'],
    ['whiskey', 'whiskies']
  ].forEach(function (rule) {
    return pluralize.addIrregularRule(rule[0], rule[1]);
  });

  /**
   * Pluralization rules.
   */
  [
    [/s?$/i, 's'],
    [/([^aeiou]ese)$/i, '$1'],
    [/(ax|test)is$/i, '$1es'],
    [/(alias|[^aou]us|tlas|gas|ris)$/i, '$1es'],
    [/(e[mn]u)s?$/i, '$1s'],
    [/([^l]ias|[aeiou]las|[emjzr]as|[iu]am)$/i, '$1'],
    [/(alumn|syllab|octop|vir|radi|nucle|fung|cact|stimul|termin|bacill|foc|uter|loc|strat)(?:us|i)$/i, '$1i'],
    [/(alumn|alg|vertebr)(?:a|ae)$/i, '$1ae'],
    [/(seraph|cherub)(?:im)?$/i, '$1im'],
    [/(her|at|gr)o$/i, '$1oes'],
    [/(agend|addend|millenni|dat|extrem|bacteri|desiderat|strat|candelabr|errat|ov|symposi|curricul|automat|quor)(?:a|um)$/i, '$1a'],
    [/(apheli|hyperbat|periheli|asyndet|noumen|phenomen|criteri|organ|prolegomen|\w+hedr)(?:a|on)$/i, '$1a'],
    [/sis$/i, 'ses'],
    [/(?:(i)fe|(ar|l|ea|eo|oa|hoo)f)$/i, '$1$2ves'],
    [/([^aeiouy]|qu)y$/i, '$1ies'],
    [/([^ch][ieo][ln])ey$/i, '$1ies'],
    [/(x|ch|ss|sh|zz)$/i, '$1es'],
    [/(matr|cod|mur|sil|vert|ind|append)(?:ix|ex)$/i, '$1ices'],
    [/(m|l)(?:ice|ouse)$/i, '$1ice'],
    [/(pe)(?:rson|ople)$/i, '$1ople'],
    [/(child)(?:ren)?$/i, '$1ren'],
    [/eaux$/i, '$0'],
    [/m[ae]n$/i, 'men']
  ].forEach(function (rule) {
    return pluralize.addPluralRule(rule[0], rule[1]);
  });

  /**
   * Singularization rules.
   */
  [
    [/s$/i, ''],
    [/(ss)$/i, '$1'],
    [/((a)naly|(b)a|(d)iagno|(p)arenthe|(p)rogno|(s)ynop|(t)he)(?:sis|ses)$/i, '$1sis'],
    [/(^analy)(?:sis|ses)$/i, '$1sis'],
    [/([^aeflor])ves$/i, '$1fe'],
    [/(hive|tive|dr?ive)s$/i, '$1'],
    [/(ar|(?:wo|[ae])l|[eo][ao])ves$/i, '$1f'],
    [/([^aeiouy]|qu)ies$/i, '$1y'],
    [/(^[pl]|zomb|^(?:neck)?t|[aeo][lt]|cut)ies$/i, '$1ie'],
    [/([^c][eor]n|smil)ies$/i, '$1ey'],
    [/(m|l)ice$/i, '$1ouse'],
    [/(seraph|cherub)im$/i, '$1'],
    [/(x|ch|ss|sh|zz|tto|go|cho|alias|[^aou]us|tlas|gas|(?:her|at|gr)o|ris)(?:es)?$/i, '$1'],
    [/(e[mn]u)s?$/i, '$1'],
    [/(movie|twelve)s$/i, '$1'],
    [/(cris|test|diagnos)(?:is|es)$/i, '$1is'],
    [/(alumn|syllab|octop|vir|radi|nucle|fung|cact|stimul|termin|bacill|foc|uter|loc|strat)(?:us|i)$/i, '$1us'],
    [/(agend|addend|millenni|dat|extrem|bacteri|desiderat|strat|candelabr|errat|ov|symposi|curricul|automat|quor)a$/i, '$1um'],
    [/(apheli|hyperbat|periheli|asyndet|noumen|phenomen|criteri|organ|prolegomen|\w+hedr)a$/i, '$1on'],
    [/(alumn|alg|vertebr)ae$/i, '$1a'],
    [/(cod|mur|sil|vert|ind)ices$/i, '$1ex'],
    [/(matr|append)ices$/i, '$1ix'],
    [/(pe)(rson|ople)$/i, '$1rson'],
    [/(child)ren$/i, '$1'],
    [/(eau)x?$/i, '$1'],
    [/men$/i, 'man']
  ].forEach(function (rule) {
    return pluralize.addSingularRule(rule[0], rule[1]);
  });

  /**
   * Uncountable rules.
   */
  [
    // Singular words with no plurals.
    'advice',
    'agenda',
    'bison',
    'bream',
    'buffalo',
    'carp',
    'chassis',
    'cod',
    'cooperation',
    'corps',
    'digestion',
    'debris',
    'diabetes',
    'energy',
    'equipment',
    'elk',
    'excretion',
    'expertise',
    'flounder',
    'gallows',
    'graffiti',
    'headquarters',
    'health',
    'herpes',
    'highjinks',
    'homework',
    'information',
    'jeans',
    'justice',
    'kudos',
    'labour',
    'machinery',
    'mackerel',
    'media',
    'mews',
    'moose',
    'news',
    'pike',
    'plankton',
    'pliers',
    'pollution',
    'premises',
    'rain',
    'rice',
    'salmon',
    'scissors',
    'series',
    'sewage',
    'shambles',
    'shrimp',
    'species',
    'staff',
    'swine',
    'trout',
    'tuna',
    'whiting',
    'wildebeest',
    'wildlife',
    // Regexes.
    /pox$/i, // "chickpox", "smallpox"
    /ois$/i,
    /deer$/i, // "deer", "reindeer"
    /fish$/i, // "fish", "blowfish", "angelfish"
    /sheep$/i,
    /measles$/i,
    /[^aeiou]ese$/i // "chinese", "japanese"
  ].forEach(pluralize.addUncountableRule);

  return pluralize;
});

},{}],34:[function(require,module,exports){
var DataSet = require("data-set")

module.exports = DataSetHook;

function DataSetHook(value) {
    if (!(this instanceof DataSetHook)) {
        return new DataSetHook(value);
    }

    this.value = value;
}

DataSetHook.prototype.hook = function (node, propertyName) {
    var ds = DataSet(node)
    var propName = propertyName.substr(5)

    ds[propName] = this.value;
};

},{"data-set":39}],35:[function(require,module,exports){
var DataSet = require("data-set")

module.exports = DataSetHook;

function DataSetHook(value) {
    if (!(this instanceof DataSetHook)) {
        return new DataSetHook(value);
    }

    this.value = value;
}

DataSetHook.prototype.hook = function (node, propertyName) {
    var ds = DataSet(node)
    var propName = propertyName.substr(3)

    ds[propName] = this.value;
};

DataSetHook.prototype.unhook = function(node, propertyName) {
    var ds = DataSet(node);
    var propName = propertyName.substr(3);

    ds[propName] = undefined;
}

},{"data-set":39}],36:[function(require,module,exports){
module.exports = SoftSetHook;

function SoftSetHook(value) {
    if (!(this instanceof SoftSetHook)) {
        return new SoftSetHook(value);
    }

    this.value = value;
}

SoftSetHook.prototype.hook = function (node, propertyName) {
    if (node[propertyName] !== this.value) {
        node[propertyName] = this.value;
    }
};

},{}],37:[function(require,module,exports){
var TypedError = require("error/typed")

var VNode = require("vtree/vnode.js")
var VText = require("vtree/vtext.js")
var isVNode = require("vtree/is-vnode")
var isVText = require("vtree/is-vtext")
var isWidget = require("vtree/is-widget")
var isHook = require("vtree/is-vhook")
var isVThunk = require("vtree/is-thunk")

var parseTag = require("./parse-tag.js")
var softSetHook = require("./hooks/soft-set-hook.js")
var dataSetHook = require("./hooks/data-set-hook.js")
var evHook = require("./hooks/ev-hook.js")

var UnexpectedVirtualElement = TypedError({
    type: "virtual-hyperscript.unexpected.virtual-element",
    message: "Unexpected virtual child passed to h().\n" +
        "Expected a VNode / Vthunk / VWidget / string but:\n" +
        "got a {foreignObjectStr}.\n" +
        "The parent vnode is {parentVnodeStr}.\n" +
        "Suggested fix: change your `h(..., [ ... ])` callsite.",
    foreignObjectStr: null,
    parentVnodeStr: null,
    foreignObject: null,
    parentVnode: null
})

module.exports = h

function h(tagName, properties, children) {
    var childNodes = []
    var tag, props, key, namespace

    if (!children && isChildren(properties)) {
        children = properties
        props = {}
    }

    props = props || properties || {}
    tag = parseTag(tagName, props)

    // support keys
    if ("key" in props) {
        key = props.key
        props.key = undefined
    }

    // support namespace
    if ("namespace" in props) {
        namespace = props.namespace
        props.namespace = undefined
    }

    // fix cursor bug
    if (tag === "input" &&
        "value" in props &&
        props.value !== undefined &&
        !isHook(props.value)
    ) {
        props.value = softSetHook(props.value)
    }

    var keys = Object.keys(props)
    var propName, value
    for (var j = 0; j < keys.length; j++) {
        propName = keys[j]
        value = props[propName]
        if (isHook(value)) {
            continue
        }

        // add data-foo support
        if (propName.substr(0, 5) === "data-") {
            props[propName] = dataSetHook(value)
        }

        // add ev-foo support
        if (propName.substr(0, 3) === "ev-") {
            props[propName] = evHook(value)
        }
    }

    if (children !== undefined && children !== null) {
        addChild(children, childNodes, tag, props)
    }


    var node = new VNode(tag, props, childNodes, key, namespace)

    return node
}

function addChild(c, childNodes, tag, props) {
    if (typeof c === "string") {
        childNodes.push(new VText(c))
    } else if (isChild(c)) {
        childNodes.push(c)
    } else if (Array.isArray(c)) {
        for (var i = 0; i < c.length; i++) {
            addChild(c[i], childNodes, tag, props)
        }
    } else if (c === null || c === undefined) {
        return
    } else {
        throw UnexpectedVirtualElement({
            foreignObjectStr: JSON.stringify(c),
            foreignObject: c,
            parentVnodeStr: JSON.stringify({
                tagName: tag,
                properties: props
            }),
            parentVnode: {
                tagName: tag,
                properties: props
            }
        })
    }
}

function isChild(x) {
    return isVNode(x) || isVText(x) || isWidget(x) || isVThunk(x)
}

function isChildren(x) {
    return typeof x === "string" || Array.isArray(x) || isChild(x)
}

},{"./hooks/data-set-hook.js":34,"./hooks/ev-hook.js":35,"./hooks/soft-set-hook.js":36,"./parse-tag.js":54,"error/typed":45,"vtree/is-thunk":46,"vtree/is-vhook":47,"vtree/is-vnode":48,"vtree/is-vtext":49,"vtree/is-widget":50,"vtree/vnode.js":52,"vtree/vtext.js":53}],38:[function(require,module,exports){
module.exports = createHash

function createHash(elem) {
    var attributes = elem.attributes
    var hash = {}

    if (attributes === null || attributes === undefined) {
        return hash
    }

    for (var i = 0; i < attributes.length; i++) {
        var attr = attributes[i]

        if (attr.name.substr(0,5) !== "data-") {
            continue
        }

        hash[attr.name.substr(5)] = attr.value
    }

    return hash
}

},{}],39:[function(require,module,exports){
var createStore = require("weakmap-shim/create-store")
var Individual = require("individual")

var createHash = require("./create-hash.js")

var hashStore = Individual("__DATA_SET_WEAKMAP@3", createStore())

module.exports = DataSet

function DataSet(elem) {
    var store = hashStore(elem)

    if (!store.hash) {
        store.hash = createHash(elem)
    }

    return store.hash
}

},{"./create-hash.js":38,"individual":40,"weakmap-shim/create-store":41}],40:[function(require,module,exports){
(function (global){
var root = typeof window !== 'undefined' ?
    window : typeof global !== 'undefined' ?
    global : {};

module.exports = Individual

function Individual(key, value) {
    if (root[key]) {
        return root[key]
    }

    Object.defineProperty(root, key, {
        value: value
        , configurable: true
    })

    return value
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],41:[function(require,module,exports){
var hiddenStore = require('./hidden-store.js');

module.exports = createStore;

function createStore() {
    var key = {};

    return function (obj) {
        if (typeof obj !== 'object' || obj === null) {
            throw new Error('Weakmap-shim: Key must be object')
        }

        var store = obj.valueOf(key);
        return store && store.identity === key ?
            store : hiddenStore(obj, key);
    };
}

},{"./hidden-store.js":42}],42:[function(require,module,exports){
module.exports = hiddenStore;

function hiddenStore(obj, key) {
    var store = { identity: key };
    var valueOf = obj.valueOf;

    Object.defineProperty(obj, "valueOf", {
        value: function (value) {
            return value !== key ?
                valueOf.apply(this, arguments) : store;
        },
        writable: true
    });

    return store;
}

},{}],43:[function(require,module,exports){
module.exports = function(obj) {
    if (typeof obj === 'string') return camelCase(obj);
    return walk(obj);
};

function walk (obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (isDate(obj) || isRegex(obj)) return obj;
    if (isArray(obj)) return map(obj, walk);
    return reduce(objectKeys(obj), function (acc, key) {
        var camel = camelCase(key);
        acc[camel] = walk(obj[key]);
        return acc;
    }, {});
}

function camelCase(str) {
    return str.replace(/[_.-](\w|$)/g, function (_,x) {
        return x.toUpperCase();
    });
}

var isArray = Array.isArray || function (obj) {
    return Object.prototype.toString.call(obj) === '[object Array]';
};

var isDate = function (obj) {
    return Object.prototype.toString.call(obj) === '[object Date]';
};

var isRegex = function (obj) {
    return Object.prototype.toString.call(obj) === '[object RegExp]';
};

var has = Object.prototype.hasOwnProperty;
var objectKeys = Object.keys || function (obj) {
    var keys = [];
    for (var key in obj) {
        if (has.call(obj, key)) keys.push(key);
    }
    return keys;
};

function map (xs, f) {
    if (xs.map) return xs.map(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        res.push(f(xs[i], i));
    }
    return res;
}

function reduce (xs, f, acc) {
    if (xs.reduce) return xs.reduce(f, acc);
    for (var i = 0; i < xs.length; i++) {
        acc = f(acc, xs[i], i);
    }
    return acc;
}

},{}],44:[function(require,module,exports){
var nargs = /\{([0-9a-zA-Z]+)\}/g
var slice = Array.prototype.slice

module.exports = template

function template(string) {
    var args

    if (arguments.length === 2 && typeof arguments[1] === "object") {
        args = arguments[1]
    } else {
        args = slice.call(arguments, 1)
    }

    if (!args || !args.hasOwnProperty) {
        args = {}
    }

    return string.replace(nargs, function replaceArg(match, i, index) {
        var result

        if (string[index - 1] === "{" &&
            string[index + match.length] === "}") {
            return i
        } else {
            result = args.hasOwnProperty(i) ? args[i] : null
            if (result === null || result === undefined) {
                return ""
            }

            return result
        }
    })
}

},{}],45:[function(require,module,exports){
var camelize = require("camelize")
var template = require("string-template")
var extend = require("xtend/mutable")

module.exports = TypedError

function TypedError(args) {
    if (!args) {
        throw new Error("args is required");
    }
    if (!args.type) {
        throw new Error("args.type is required");
    }
    if (!args.message) {
        throw new Error("args.message is required");
    }

    var message = args.message

    if (args.type && !args.name) {
        var errorName = camelize(args.type) + "Error"
        args.name = errorName[0].toUpperCase() + errorName.substr(1)
    }

    createError.type = args.type;
    createError._name = args.name;

    return createError;

    function createError(opts) {
        var result = new Error()

        Object.defineProperty(result, "type", {
            value: result.type,
            enumerable: true,
            writable: true,
            configurable: true
        })

        var options = extend({}, args, opts)

        extend(result, options)
        result.message = template(message, options)

        return result
    }
}


},{"camelize":43,"string-template":44,"xtend/mutable":56}],46:[function(require,module,exports){
module.exports=require(24)
},{"/Users/seanchas116/Projects/decompose-todomvc/node_modules/decompose/node_modules/vtree/is-thunk.js":24}],47:[function(require,module,exports){
module.exports=require(25)
},{"/Users/seanchas116/Projects/decompose-todomvc/node_modules/decompose/node_modules/vtree/is-vhook.js":25}],48:[function(require,module,exports){
module.exports=require(26)
},{"./version":51,"/Users/seanchas116/Projects/decompose-todomvc/node_modules/decompose/node_modules/vtree/is-vnode.js":26}],49:[function(require,module,exports){
module.exports=require(27)
},{"./version":51,"/Users/seanchas116/Projects/decompose-todomvc/node_modules/decompose/node_modules/vtree/is-vtext.js":27}],50:[function(require,module,exports){
module.exports=require(28)
},{"/Users/seanchas116/Projects/decompose-todomvc/node_modules/decompose/node_modules/vtree/is-widget.js":28}],51:[function(require,module,exports){
module.exports=require(31)
},{"/Users/seanchas116/Projects/decompose-todomvc/node_modules/decompose/node_modules/vtree/version.js":31}],52:[function(require,module,exports){
var version = require("./version")
var isVNode = require("./is-vnode")
var isWidget = require("./is-widget")
var isVHook = require("./is-vhook")

module.exports = VirtualNode

var noProperties = {}
var noChildren = []

function VirtualNode(tagName, properties, children, key, namespace) {
    this.tagName = tagName
    this.properties = properties || noProperties
    this.children = children || noChildren
    this.key = key != null ? String(key) : undefined
    this.namespace = (typeof namespace === "string") ? namespace : null

    var count = (children && children.length) || 0
    var descendants = 0
    var hasWidgets = false

    for (var i = 0; i < count; i++) {
        var child = children[i]
        if (isVNode(child)) {
            descendants += child.count || 0

            if (!hasWidgets && child.hasWidgets) {
                hasWidgets = true
            }
        } else if (!hasWidgets && isWidget(child)) {
            if (typeof child.destroy === "function") {
                hasWidgets = true
            }
        }
    }

    this.count = count + descendants
    this.hasWidgets = hasWidgets
}

VirtualNode.prototype.version = version
VirtualNode.prototype.type = "VirtualNode"

},{"./is-vhook":47,"./is-vnode":48,"./is-widget":50,"./version":51}],53:[function(require,module,exports){
var version = require("./version")

module.exports = VirtualText

function VirtualText(text) {
    this.text = String(text)
}

VirtualText.prototype.version = version
VirtualText.prototype.type = "VirtualText"

},{"./version":51}],54:[function(require,module,exports){
var classIdSplit = /([\.#]?[a-zA-Z0-9_:-]+)/
var notClassId = /^\.|#/

module.exports = parseTag

function parseTag(tag, props) {
    if (!tag) {
        return "div"
    }

    var noId = !("id" in props)

    var tagParts = tag.split(classIdSplit)
    var tagName = null

    if (notClassId.test(tagParts[1])) {
        tagName = "div"
    }

    var classes, part, type, i
    for (i = 0; i < tagParts.length; i++) {
        part = tagParts[i]

        if (!part) {
            continue
        }

        type = part.charAt(0)

        if (!tagName) {
            tagName = part
        } else if (type === ".") {
            classes = classes || []
            classes.push(part.substring(1, part.length))
        } else if (type === "#" && noId) {
            props.id = part.substring(1, part.length)
        }
    }

    if (classes) {
        if (props.className) {
            classes.push(props.className)
        }

        props.className = classes.join(" ")
    }

    return tagName ? tagName.toLowerCase() : "div"
}

},{}],55:[function(require,module,exports){
module.exports = extend

function extend() {
    var target = {}

    for (var i = 0; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (source.hasOwnProperty(key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}],56:[function(require,module,exports){
module.exports = extend

function extend(target) {
    for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (source.hasOwnProperty(key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}],57:[function(require,module,exports){
'use strict';
var EventEmitter, TodoCollection,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

EventEmitter = require('events').EventEmitter;

TodoCollection = (function(_super) {
  __extends(TodoCollection, _super);

  function TodoCollection() {
    this.todos = [];
    this.itemUpdateCallback = (function(_this) {
      return function() {
        return _this.update();
      };
    })(this);
  }

  TodoCollection.prototype.add = function(todo) {
    this.todos.push(todo);
    todo.on('update', this.itemUpdateCallback);
    return this.update();
  };

  TodoCollection.prototype.remove = function(todo) {
    this.todos.splice(this.todos.indexOf(todo), 1);
    todo.removeListener('update', this.itemUpdateCallback);
    return this.update();
  };

  TodoCollection.prototype.setCompletedAll = function(completed) {
    return this.todos.forEach(function(todo) {
      return todo.isCompleted = completed;
    });
  };

  TodoCollection.prototype.update = function() {
    return this.emit('update');
  };

  return TodoCollection;

})(EventEmitter);

module.exports = new TodoCollection();



},{"events":2}],58:[function(require,module,exports){
'use strict';
var Mount, RouteView, TodoAppView, view;

RouteView = require('./views/RouteView');

TodoAppView = require('./views/TodoAppView');

Mount = require('decompose').Mount;

view = new RouteView({
  top: TodoAppView,
  params: {
    filter: ''
  }
});

document.addEventListener('DOMContentLoaded', function() {
  return new Mount(view).mount('#main');
});



},{"./views/RouteView":61,"./views/TodoAppView":62,"decompose":5}],59:[function(require,module,exports){
'use strict';
var EventEmitter, ObservableModel,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

EventEmitter = require('events').EventEmitter;

module.exports = ObservableModel = (function(_super) {
  __extends(ObservableModel, _super);

  function ObservableModel() {
    return ObservableModel.__super__.constructor.apply(this, arguments);
  }

  ObservableModel.attribute = function(name) {
    var privateName;
    privateName = "_" + name;
    return Object.defineProperty(this.prototype, name, {
      get: function() {
        return this[privateName];
      },
      set: function(value) {
        if (this[privateName] !== value) {
          this[privateName] = value;
          return this.emit('update');
        }
      }
    });
  };

  return ObservableModel;

})(EventEmitter);



},{"events":2}],60:[function(require,module,exports){
'use strict';
var ObservableModel, Todo, assign,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

assign = require('xtend/mutable');

ObservableModel = require('./ObservableModel');

module.exports = Todo = (function(_super) {
  __extends(Todo, _super);

  Todo.attribute('isCompleted');

  Todo.attribute('text');

  function Todo(params) {
    assign(this, params);
  }

  return Todo;

})(ObservableModel);



},{"./ObservableModel":59,"xtend/mutable":56}],61:[function(require,module,exports){
var Component, RouteView, TodoAppView,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Component = require('decompose').Component;

TodoAppView = require('./TodoAppView');

module.exports = RouteView = (function(_super) {
  __extends(RouteView, _super);

  function RouteView() {
    return RouteView.__super__.constructor.apply(this, arguments);
  }

  RouteView.prototype.onMount = function() {
    var route;
    route = (function(_this) {
      return function() {
        return _this.assign({
          top: TodoAppView,
          params: {
            filter: location.hash.slice(1)
          }
        });
      };
    })(this);
    window.addEventListener('hashchange', route);
    return route();
  };

  RouteView.prototype.render = function() {
    return this.top.render(this.params);
  };

  return RouteView;

})(Component);



},{"./TodoAppView":62,"decompose":5}],62:[function(require,module,exports){
'use strict';
var Component, Todo, TodoAppView, TodoItemView, d, h, pluralize, todoCollection,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

h = require('virtual-hyperscript');

pluralize = require('pluralize');

Component = require('decompose').Component;

Todo = require('../models/Todo');

todoCollection = require('../collections/todoCollection');

d = require('./directive');

TodoItemView = require('./TodoItemView');

module.exports = TodoAppView = (function(_super) {
  __extends(TodoAppView, _super);

  function TodoAppView() {
    return TodoAppView.__super__.constructor.apply(this, arguments);
  }

  Object.defineProperty(TodoAppView.prototype, 'remaining', {
    get: function() {
      return this.todos.filter(function(t) {
        return !t.isCompleted;
      }).length;
    }
  });

  TodoAppView.prototype.onInit = function() {
    this.allDone = false;
    this.newText = '';
    return this.todos = todoCollection.todos;
  };

  TodoAppView.prototype.onMount = function() {
    this.udpateCallback = (function(_this) {
      return function() {
        _this.todos = todoCollection.todos;
        return _this.update();
      };
    })(this);
    return todoCollection.on('update', this.udpateCallback);
  };

  TodoAppView.prototype.onUnmount = function() {
    return todoCollection.removeListener('update', this.udpateCallback);
  };

  TodoAppView.prototype.onKeyUp = function(event) {
    if (event.keyCode === 13) {
      todoCollection.add(new Todo({
        text: this.newText,
        isCompleted: false
      }));
      return this.assign({
        newText: ''
      });
    }
  };

  TodoAppView.prototype.onToggleAll = function() {
    return todoCollection.setCompletedAll(this.allDone);
  };

  TodoAppView.prototype.filterTodos = function() {
    switch (this.filter) {
      case 'active':
        return this.todos.filter(function(t) {
          return !t.isCompleted;
        });
      case 'completed':
        return this.todos.filter(function(t) {
          return t.isCompleted;
        });
      default:
        return this.todos;
    }
  };

  TodoAppView.prototype.render = function() {
    return h('section#todoapp', [
      h('header#header', [
        h('h1', 'todos'), d({
          value: [this, 'newText']
        }, h('input#new-todo', {
          autofocus: true,
          autocomplete: 'off',
          placeholder: 'What needs to be done?',
          onkeyup: this.onKeyUp.bind(this)
        }))
      ]), h('section#main', [
        d({
          value: [this, 'allDone']
        }, h('input#toggle-all', {
          type: 'checkbox',
          onchange: this.onToggleAll.bind(this)
        })), h('ul#todo-list', this.filterTodos().map(function(todo) {
          return TodoItemView.render({
            todo: todo
          });
        }))
      ]), d({
        visible: this.left
      }, h('footer#footer', [
        h('span#todo-count', [h('strong', "" + this.remaining + " " + (pluralize('item', this.remaining)) + " left")]), h('ul#filters', [
          h('li', [
            d({
              css: {
                selected: this.filter === 'all'
              }
            }, h('a', {
              href: '#all'
            }, 'All'))
          ]), h('li', [
            d({
              css: {
                selected: this.filter === 'active'
              }
            }, h('a', {
              href: '#active'
            }, 'Active'))
          ]), h('li', [
            d({
              css: {
                selected: this.filter === 'completed'
              }
            }, h('a', {
              href: '#completed'
            }, 'Completed'))
          ])
        ])
      ]))
    ]);
  };

  return TodoAppView;

})(Component);



},{"../collections/todoCollection":57,"../models/Todo":60,"./TodoItemView":63,"./directive":64,"decompose":5,"pluralize":33,"virtual-hyperscript":37}],63:[function(require,module,exports){
'use strict';
var Component, TodoItemView, d, h, pluralize, todoCollection,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

h = require('virtual-hyperscript');

pluralize = require('pluralize');

Component = require('decompose').Component;

todoCollection = require('../collections/todoCollection');

d = require('./directive');

module.exports = TodoItemView = (function(_super) {
  __extends(TodoItemView, _super);

  function TodoItemView() {
    return TodoItemView.__super__.constructor.apply(this, arguments);
  }

  TodoItemView.prototype.onInit = function() {
    return this.updateCallback = this.update.bind(this);
  };

  TodoItemView.prototype.assign = function(attrs) {
    TodoItemView.__super__.assign.call(this, attrs);
    return this.update();
  };

  TodoItemView.prototype.onUnmount = function() {
    return this.todo.removeListener('update', this.updateCallback);
  };

  TodoItemView.prototype.remove = function() {
    return todoCollection.remove(this.todo);
  };

  TodoItemView.prototype.edit = function() {
    return this.assign({
      isEditing: true
    });
  };

  TodoItemView.prototype.doneEdit = function() {
    return this.assign({
      isEditing: false
    });
  };

  TodoItemView.prototype.onKeyUp = function(event) {
    switch (event.keyCode) {
      case 27:
      case 13:
        return this.doneEdit();
    }
  };

  TodoItemView.prototype.render = function() {
    return d({
      css: {
        editing: this.isEditing
      }
    }, h('li.todo', [
      h('.view', [
        d({
          value: [this.todo, 'isCompleted']
        }, h('input.toggle', {
          type: 'checkbox'
        })), h('label', {
          ondblclick: this.edit.bind(this)
        }, this.todo.text), h('button.destroy', {
          onclick: this.remove.bind(this)
        })
      ]), d({
        value: [this.todo, 'text']
      }, h('input.edit', {
        type: 'text',
        onblur: this.doneEdit.bind(this),
        onkeyup: this.onKeyUp.bind(this)
      }))
    ]));
  };

  return TodoItemView;

})(Component);



},{"../collections/todoCollection":57,"./directive":64,"decompose":5,"pluralize":33,"virtual-hyperscript":37}],64:[function(require,module,exports){
'use strict';
var applyDirectives, assign, directives, extend;

extend = require('xtend');

assign = require('xtend/mutable');

directives = {
  visible: function(cond, node) {
    if (cond) {
      return node.properties = extend(node.properties, {
        style: {
          display: 'none'
        }
      });
    }
  },
  css: function(classNames, node) {
    var className;
    className = Object.keys(classNames).filter(function(name) {
      return classNames[name];
    }).join(' ');
    return node.properties = extend(node.properties, {
      className: "" + className + " " + node.properties.className
    });
  },
  value: function(_arg, node) {
    var keyName, obj, oldOnchange, props, valueKey;
    obj = _arg[0], keyName = _arg[1];
    valueKey = (function() {
      switch (node.properties.type) {
        case 'checkbox':
          return 'checked';
        default:
          return 'value';
      }
    })();
    props = {};
    oldOnchange = node.properties.onchange;
    props.onchange = function() {
      obj[keyName] = this[valueKey];
      if (oldOnchange != null) {
        return oldOnchange.apply(this, arguments);
      }
    };
    props[valueKey] = obj[keyName];
    return node.properties = extend(node.properties, props);
  }
};

applyDirectives = function(params, node) {
  Object.keys(params).forEach(function(dname) {
    var directive;
    directive = directives[dname];
    return directive(params[dname], node);
  });
  return node;
};

module.exports = applyDirectives;



},{"xtend":55,"xtend/mutable":56}]},{},[58])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1yZXNvbHZlL2VtcHR5LmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2V2ZW50cy9ldmVudHMuanMiLCJub2RlX21vZHVsZXMvZGVjb21wb3NlL2xpYi9jb21wb25lbnQvQ29tcG9uZW50LmpzIiwibm9kZV9tb2R1bGVzL2RlY29tcG9zZS9saWIvY29tcG9uZW50L0RvbUNvbXBvbmVudC5qcyIsIm5vZGVfbW9kdWxlcy9kZWNvbXBvc2UvbGliL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2RlY29tcG9zZS9saWIvbW91bnQvTW91bnQuanMiLCJub2RlX21vZHVsZXMvZGVjb21wb3NlL2xpYi9ub2RlL0NvbXBvbmVudE5vZGUuanMiLCJub2RlX21vZHVsZXMvZGVjb21wb3NlL2xpYi9ub2RlL0RvbUNvbXBvbmVudE5vZGUuanMiLCJub2RlX21vZHVsZXMvZGVjb21wb3NlL2xpYi9ub2RlL2ZpbmRDb21wb25lbnROb2Rlcy5qcyIsIm5vZGVfbW9kdWxlcy9kZWNvbXBvc2Uvbm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL2NyZWF0ZS1lbGVtZW50LmpzIiwibm9kZV9tb2R1bGVzL2RlY29tcG9zZS9ub2RlX21vZHVsZXMvdmlydHVhbC1kb20vZGlmZi5qcyIsIm5vZGVfbW9kdWxlcy9kZWNvbXBvc2Uvbm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL25vZGVfbW9kdWxlcy9pcy1vYmplY3QvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZGVjb21wb3NlL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS9ub2RlX21vZHVsZXMvdmRvbS9hcHBseS1wcm9wZXJ0aWVzLmpzIiwibm9kZV9tb2R1bGVzL2RlY29tcG9zZS9ub2RlX21vZHVsZXMvdmlydHVhbC1kb20vbm9kZV9tb2R1bGVzL3Zkb20vY3JlYXRlLWVsZW1lbnQuanMiLCJub2RlX21vZHVsZXMvZGVjb21wb3NlL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS9ub2RlX21vZHVsZXMvdmRvbS9kb20taW5kZXguanMiLCJub2RlX21vZHVsZXMvZGVjb21wb3NlL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS9ub2RlX21vZHVsZXMvdmRvbS9ub2RlX21vZHVsZXMvZ2xvYmFsL2RvY3VtZW50LmpzIiwibm9kZV9tb2R1bGVzL2RlY29tcG9zZS9ub2RlX21vZHVsZXMvdmlydHVhbC1kb20vbm9kZV9tb2R1bGVzL3Zkb20vcGF0Y2gtb3AuanMiLCJub2RlX21vZHVsZXMvZGVjb21wb3NlL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS9ub2RlX21vZHVsZXMvdmRvbS9wYXRjaC5qcyIsIm5vZGVfbW9kdWxlcy9kZWNvbXBvc2Uvbm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL25vZGVfbW9kdWxlcy92ZG9tL3VwZGF0ZS13aWRnZXQuanMiLCJub2RlX21vZHVsZXMvZGVjb21wb3NlL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS9ub2RlX21vZHVsZXMveC1pcy1hcnJheS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9kZWNvbXBvc2Uvbm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3BhdGNoLmpzIiwibm9kZV9tb2R1bGVzL2RlY29tcG9zZS9ub2RlX21vZHVsZXMvdnRyZWUvZGlmZi5qcyIsIm5vZGVfbW9kdWxlcy9kZWNvbXBvc2Uvbm9kZV9tb2R1bGVzL3Z0cmVlL2hhbmRsZS10aHVuay5qcyIsIm5vZGVfbW9kdWxlcy9kZWNvbXBvc2Uvbm9kZV9tb2R1bGVzL3Z0cmVlL2lzLXRodW5rLmpzIiwibm9kZV9tb2R1bGVzL2RlY29tcG9zZS9ub2RlX21vZHVsZXMvdnRyZWUvaXMtdmhvb2suanMiLCJub2RlX21vZHVsZXMvZGVjb21wb3NlL25vZGVfbW9kdWxlcy92dHJlZS9pcy12bm9kZS5qcyIsIm5vZGVfbW9kdWxlcy9kZWNvbXBvc2Uvbm9kZV9tb2R1bGVzL3Z0cmVlL2lzLXZ0ZXh0LmpzIiwibm9kZV9tb2R1bGVzL2RlY29tcG9zZS9ub2RlX21vZHVsZXMvdnRyZWUvaXMtd2lkZ2V0LmpzIiwibm9kZV9tb2R1bGVzL2RlY29tcG9zZS9ub2RlX21vZHVsZXMvdnRyZWUvdmVyc2lvbi5qcyIsIm5vZGVfbW9kdWxlcy9kZWNvbXBvc2Uvbm9kZV9tb2R1bGVzL3Z0cmVlL3ZwYXRjaC5qcyIsIm5vZGVfbW9kdWxlcy9wbHVyYWxpemUvcGx1cmFsaXplLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtaHlwZXJzY3JpcHQvaG9va3MvZGF0YS1zZXQtaG9vay5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWh5cGVyc2NyaXB0L2hvb2tzL2V2LWhvb2suanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1oeXBlcnNjcmlwdC9ob29rcy9zb2Z0LXNldC1ob29rLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtaHlwZXJzY3JpcHQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1oeXBlcnNjcmlwdC9ub2RlX21vZHVsZXMvZGF0YS1zZXQvY3JlYXRlLWhhc2guanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1oeXBlcnNjcmlwdC9ub2RlX21vZHVsZXMvZGF0YS1zZXQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1oeXBlcnNjcmlwdC9ub2RlX21vZHVsZXMvZGF0YS1zZXQvbm9kZV9tb2R1bGVzL2luZGl2aWR1YWwvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1oeXBlcnNjcmlwdC9ub2RlX21vZHVsZXMvZGF0YS1zZXQvbm9kZV9tb2R1bGVzL3dlYWttYXAtc2hpbS9jcmVhdGUtc3RvcmUuanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1oeXBlcnNjcmlwdC9ub2RlX21vZHVsZXMvZGF0YS1zZXQvbm9kZV9tb2R1bGVzL3dlYWttYXAtc2hpbS9oaWRkZW4tc3RvcmUuanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1oeXBlcnNjcmlwdC9ub2RlX21vZHVsZXMvZXJyb3Ivbm9kZV9tb2R1bGVzL2NhbWVsaXplL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtaHlwZXJzY3JpcHQvbm9kZV9tb2R1bGVzL2Vycm9yL25vZGVfbW9kdWxlcy9zdHJpbmctdGVtcGxhdGUvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1oeXBlcnNjcmlwdC9ub2RlX21vZHVsZXMvZXJyb3IvdHlwZWQuanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1oeXBlcnNjcmlwdC9ub2RlX21vZHVsZXMvdnRyZWUvdm5vZGUuanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1oeXBlcnNjcmlwdC9ub2RlX21vZHVsZXMvdnRyZWUvdnRleHQuanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1oeXBlcnNjcmlwdC9wYXJzZS10YWcuanMiLCJub2RlX21vZHVsZXMveHRlbmQvaW1tdXRhYmxlLmpzIiwibm9kZV9tb2R1bGVzL3h0ZW5kL211dGFibGUuanMiLCIvVXNlcnMvc2VhbmNoYXMxMTYvUHJvamVjdHMvZGVjb21wb3NlLXRvZG9tdmMvc3JjL2NvbGxlY3Rpb25zL3RvZG9Db2xsZWN0aW9uLmNvZmZlZSIsIi9Vc2Vycy9zZWFuY2hhczExNi9Qcm9qZWN0cy9kZWNvbXBvc2UtdG9kb212Yy9zcmMvaW5kZXguY29mZmVlIiwiL1VzZXJzL3NlYW5jaGFzMTE2L1Byb2plY3RzL2RlY29tcG9zZS10b2RvbXZjL3NyYy9tb2RlbHMvT2JzZXJ2YWJsZU1vZGVsLmNvZmZlZSIsIi9Vc2Vycy9zZWFuY2hhczExNi9Qcm9qZWN0cy9kZWNvbXBvc2UtdG9kb212Yy9zcmMvbW9kZWxzL1RvZG8uY29mZmVlIiwiL1VzZXJzL3NlYW5jaGFzMTE2L1Byb2plY3RzL2RlY29tcG9zZS10b2RvbXZjL3NyYy92aWV3cy9Sb3V0ZVZpZXcuY29mZmVlIiwiL1VzZXJzL3NlYW5jaGFzMTE2L1Byb2plY3RzL2RlY29tcG9zZS10b2RvbXZjL3NyYy92aWV3cy9Ub2RvQXBwVmlldy5jb2ZmZWUiLCIvVXNlcnMvc2VhbmNoYXMxMTYvUHJvamVjdHMvZGVjb21wb3NlLXRvZG9tdmMvc3JjL3ZpZXdzL1RvZG9JdGVtVmlldy5jb2ZmZWUiLCIvVXNlcnMvc2VhbmNoYXMxMTYvUHJvamVjdHMvZGVjb21wb3NlLXRvZG9tdmMvc3JjL3ZpZXdzL2RpcmVjdGl2ZS5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQkE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBOztBQ0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcFZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7QUNMQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeGFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9IQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7Ozs7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFDQTtBQUNBO0FBQ0E7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QixFQUYwQjtFQUFBLENBQTVCLENBQUEsQ0FBQTtTQUdBLEtBSmdCO0FBQUEsQ0FyQ2xCLENBQUE7O0FBQUEsTUEyQ00sQ0FBQyxPQUFQLEdBQWlCLGVBM0NqQixDQUFBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsbnVsbCwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIHZhciBtO1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghZW1pdHRlci5fZXZlbnRzIHx8ICFlbWl0dGVyLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gMDtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbihlbWl0dGVyLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IDE7XG4gIGVsc2VcbiAgICByZXQgPSBlbWl0dGVyLl9ldmVudHNbdHlwZV0ubGVuZ3RoO1xuICByZXR1cm4gcmV0O1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwiKGZ1bmN0aW9uKCkge1xuICAndXNlIHN0cmljdCc7XG4gIHZhciBDb21wb25lbnQsIENvbXBvbmVudE5vZGUsIEV2ZW50RW1pdHRlciwgaCxcbiAgICBfX2hhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eSxcbiAgICBfX2V4dGVuZHMgPSBmdW5jdGlvbihjaGlsZCwgcGFyZW50KSB7IGZvciAodmFyIGtleSBpbiBwYXJlbnQpIHsgaWYgKF9faGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfTtcblxuICBoID0gcmVxdWlyZSgndmlydHVhbC1oeXBlcnNjcmlwdCcpO1xuXG4gIEV2ZW50RW1pdHRlciA9IChyZXF1aXJlKCdldmVudHMnKSkuRXZlbnRFbWl0dGVyO1xuXG4gIENvbXBvbmVudE5vZGUgPSByZXF1aXJlKCcuLi9ub2RlL0NvbXBvbmVudE5vZGUnKTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IENvbXBvbmVudCA9IChmdW5jdGlvbihfc3VwZXIpIHtcbiAgICBfX2V4dGVuZHMoQ29tcG9uZW50LCBfc3VwZXIpO1xuXG4gICAgZnVuY3Rpb24gQ29tcG9uZW50KGF0dHJzKSB7XG4gICAgICB0aGlzLmFzc2lnbihhdHRycyk7XG4gICAgICB0aGlzLm9uSW5pdCgpO1xuICAgIH1cblxuICAgIENvbXBvbmVudC5wcm90b3R5cGUuYXNzaWduID0gZnVuY3Rpb24oYXR0cnMpIHtcbiAgICAgIHZhciBrZXksIHZhbHVlLCB3aWxsVXBkYXRlO1xuICAgICAgd2lsbFVwZGF0ZSA9IGZhbHNlO1xuICAgICAgZm9yIChrZXkgaW4gYXR0cnMpIHtcbiAgICAgICAgaWYgKCFfX2hhc1Byb3AuY2FsbChhdHRycywga2V5KSkgY29udGludWU7XG4gICAgICAgIHZhbHVlID0gYXR0cnNba2V5XTtcbiAgICAgICAgaWYgKHRoaXNba2V5XSAhPT0gdmFsdWUpIHtcbiAgICAgICAgICB0aGlzW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICB3aWxsVXBkYXRlID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHdpbGxVcGRhdGUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZW1pdCgndXBkYXRlJyk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIENvbXBvbmVudC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMub25EZXN0cm95KCk7XG4gICAgfTtcblxuICAgIENvbXBvbmVudC5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5lbWl0KCd1cGRhdGUnKTtcbiAgICB9O1xuXG4gICAgQ29tcG9uZW50LnByb3RvdHlwZS5yZW5kZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBoKCdkaXYnKTtcbiAgICB9O1xuXG4gICAgQ29tcG9uZW50LnByb3RvdHlwZS5vbkluaXQgPSBmdW5jdGlvbigpIHt9O1xuXG4gICAgQ29tcG9uZW50LnByb3RvdHlwZS5vbk1vdW50ID0gZnVuY3Rpb24oKSB7fTtcblxuICAgIENvbXBvbmVudC5wcm90b3R5cGUub25Vbm1vdW50ID0gZnVuY3Rpb24oKSB7fTtcblxuICAgIENvbXBvbmVudC5yZW5kZXIgPSBmdW5jdGlvbihhdHRycykge1xuICAgICAgcmV0dXJuIG5ldyBDb21wb25lbnROb2RlKHRoaXMsIGF0dHJzICE9IG51bGwgPyBhdHRycyA6IHt9KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIENvbXBvbmVudDtcblxuICB9KShFdmVudEVtaXR0ZXIpO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiKGZ1bmN0aW9uKCkge1xuICAndXNlIHN0cmljdCc7XG4gIHZhciBDb21wb25lbnQsIERvbUNvbXBvbmVudCwgRG9tQ29tcG9uZW50Tm9kZSxcbiAgICBfX2hhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eSxcbiAgICBfX2V4dGVuZHMgPSBmdW5jdGlvbihjaGlsZCwgcGFyZW50KSB7IGZvciAodmFyIGtleSBpbiBwYXJlbnQpIHsgaWYgKF9faGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfTtcblxuICBDb21wb25lbnQgPSByZXF1aXJlKCcuL0NvbXBvbmVudCcpO1xuXG4gIERvbUNvbXBvbmVudE5vZGUgPSByZXF1aXJlKCcuLi9ub2RlL0RvbUNvbXBvbmVudE5vZGUnKTtcblxuXG4gIC8qXG4gIERvbUNvbXBvbmVudCBwcm92aWRlcyByZXByZXNlbnRhdGlvbiBmb3IgY29tcG9uZW50cyB3aGljaCBob2xkIGFuZCBtYW5hZ2UgYSByZWFsIERPTSBlbGVtZW50LlxuICAgKi9cblxuICBtb2R1bGUuZXhwb3J0cyA9IERvbUNvbXBvbmVudCA9IChmdW5jdGlvbihfc3VwZXIpIHtcbiAgICBfX2V4dGVuZHMoRG9tQ29tcG9uZW50LCBfc3VwZXIpO1xuXG4gICAgRG9tQ29tcG9uZW50LnByb3RvdHlwZS50YWcgPSAnZGl2JztcblxuICAgIGZ1bmN0aW9uIERvbUNvbXBvbmVudChhdHRycykge1xuICAgICAgdGhpcy5lbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0aGlzLnRhZyk7XG4gICAgICBEb21Db21wb25lbnQuX19zdXBlcl9fLmNvbnN0cnVjdG9yLmNhbGwodGhpcywgYXR0cnMpO1xuICAgIH1cblxuICAgIERvbUNvbXBvbmVudC5yZW5kZXIgPSBmdW5jdGlvbihhdHRycykge1xuICAgICAgcmV0dXJuIG5ldyBEb21Db21wb25lbnROb2RlKHRoaXMsIGF0dHJzICE9IG51bGwgPyBhdHRycyA6IHt9KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIERvbUNvbXBvbmVudDtcblxuICB9KShDb21wb25lbnQpO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiKGZ1bmN0aW9uKCkge1xuICAndXNlIHN0cmljdCc7XG4gIG1vZHVsZS5leHBvcnRzID0ge1xuICAgIENvbXBvbmVudDogcmVxdWlyZSgnLi9jb21wb25lbnQvQ29tcG9uZW50JyksXG4gICAgRG9tQ29tcG9uZW50OiByZXF1aXJlKCcuL2NvbXBvbmVudC9Eb21Db21wb25lbnQnKSxcbiAgICBNb3VudDogcmVxdWlyZSgnLi9tb3VudC9Nb3VudCcpXG4gIH07XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIoZnVuY3Rpb24oKSB7XG4gICd1c2Ugc3RyaWN0JztcbiAgdmFyIE1vdW50LCBjcmVhdGVEb20sIGRpZmYsIGZpbmRDb21wb25lbnROb2RlcywgcGF0Y2g7XG5cbiAgZGlmZiA9IHJlcXVpcmUoJ3ZpcnR1YWwtZG9tL2RpZmYnKTtcblxuICBwYXRjaCA9IHJlcXVpcmUoJ3ZpcnR1YWwtZG9tL3BhdGNoJyk7XG5cbiAgY3JlYXRlRG9tID0gcmVxdWlyZSgndmlydHVhbC1kb20vY3JlYXRlLWVsZW1lbnQnKTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IE1vdW50ID0gKGZ1bmN0aW9uKCkge1xuICAgIGZ1bmN0aW9uIE1vdW50KGNvbXBvbmVudCkge1xuICAgICAgdGhpcy5jb21wb25lbnQgPSBjb21wb25lbnQ7XG4gICAgICB0aGlzLnVwZGF0ZUNhbGxiYWNrID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMudXBkYXRlKCk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKTtcbiAgICB9XG5cbiAgICBNb3VudC5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgbmV3VHJlZSwgcGF0Y2hlcztcbiAgICAgIG5ld1RyZWUgPSB0aGlzLmNvbXBvbmVudC5yZW5kZXIoKTtcbiAgICAgIHBhdGNoZXMgPSBkaWZmKHRoaXMudHJlZSwgbmV3VHJlZSk7XG4gICAgICB0aGlzLmRvbUVsZW1lbnQgPSBwYXRjaCh0aGlzLmRvbUVsZW1lbnQsIHBhdGNoZXMpO1xuICAgICAgcmV0dXJuIHRoaXMudHJlZSA9IG5ld1RyZWU7XG4gICAgfTtcblxuICAgIE1vdW50LnByb3RvdHlwZS5tb3VudCA9IGZ1bmN0aW9uKHBsYWNlaG9sZGVyKSB7XG4gICAgICB2YXIgcGFyZW50LCBzZWxlY3RvcjtcbiAgICAgIGlmICh0eXBlb2YgcGxhY2Vob2xkZXIgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHNlbGVjdG9yID0gcGxhY2Vob2xkZXI7XG4gICAgICAgIHBsYWNlaG9sZGVyID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihzZWxlY3Rvcik7XG4gICAgICAgIGlmIChwbGFjZWhvbGRlciA9PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm8gc3VjaCBlbGVtZW50IGZvdW5kOiAnXCIgKyBzZWxlY3RvciArIFwiJ1wiKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5jcmVhdGUoKTtcbiAgICAgIHBhcmVudCA9IHBsYWNlaG9sZGVyLnBhcmVudEVsZW1lbnQ7XG4gICAgICByZXR1cm4gcGFyZW50LnJlcGxhY2VDaGlsZCh0aGlzLmRvbUVsZW1lbnQsIHBsYWNlaG9sZGVyKTtcbiAgICB9O1xuXG4gICAgTW91bnQucHJvdG90eXBlLmNyZWF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy50cmVlID0gdGhpcy5jb21wb25lbnQucmVuZGVyKCk7XG4gICAgICB0aGlzLmRvbUVsZW1lbnQgPSBjcmVhdGVEb20odGhpcy50cmVlKTtcbiAgICAgIHRoaXMuY29tcG9uZW50Lm9uKCd1cGRhdGUnLCB0aGlzLnVwZGF0ZUNhbGxiYWNrKTtcbiAgICAgIHRoaXMuY29tcG9uZW50Lm9uTW91bnQoKTtcbiAgICAgIHJldHVybiB0aGlzLmRvbUVsZW1lbnQ7XG4gICAgfTtcblxuICAgIE1vdW50LnByb3RvdHlwZS51bm1vdW50ID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLmNvbXBvbmVudC5yZW1vdmVMaXN0ZW5lcigndXBkYXRlJywgdGhpcy51cGRhdGVDYWxsYmFjayk7XG4gICAgICBmaW5kQ29tcG9uZW50Tm9kZXModGhpcy50cmVlKS5mb3JFYWNoKGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAgICAgcmV0dXJuIG5vZGUuZGVzdHJveSgpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gdGhpcy5jb21wb25lbnQub25Vbm1vdW50KCk7XG4gICAgfTtcblxuICAgIHJldHVybiBNb3VudDtcblxuICB9KSgpO1xuXG4gIGZpbmRDb21wb25lbnROb2RlcyA9IHJlcXVpcmUoJy4uL25vZGUvZmluZENvbXBvbmVudE5vZGVzJyk7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIoZnVuY3Rpb24oKSB7XG4gICd1c2Ugc3RyaWN0JztcbiAgdmFyIENvbXBvbmVudE5vZGUsIE1vdW50O1xuXG4gIE1vdW50ID0gcmVxdWlyZSgnLi4vbW91bnQvTW91bnQnKTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IENvbXBvbmVudE5vZGUgPSAoZnVuY3Rpb24oKSB7XG4gICAgQ29tcG9uZW50Tm9kZS5wcm90b3R5cGUudHlwZSA9ICdXaWRnZXQnO1xuXG4gICAgQ29tcG9uZW50Tm9kZS5wcm90b3R5cGUud2lkZ2V0VHlwZSA9ICdDb21wb25lbnQnO1xuXG4gICAgZnVuY3Rpb24gQ29tcG9uZW50Tm9kZShrbGFzcywgYXR0cnMpIHtcbiAgICAgIHRoaXMua2xhc3MgPSBrbGFzcztcbiAgICAgIHRoaXMuYXR0cnMgPSBhdHRycztcbiAgICB9XG5cbiAgICBDb21wb25lbnROb2RlLnByb3RvdHlwZS5pbml0ID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLmNvbXBvbmVudCA9IG5ldyB0aGlzLmtsYXNzKCk7XG4gICAgICB0aGlzLmNvbXBvbmVudC5hc3NpZ24odGhpcy5hdHRycyk7XG4gICAgICB0aGlzLm1vdW50ID0gbmV3IE1vdW50KHRoaXMuY29tcG9uZW50KTtcbiAgICAgIHJldHVybiB0aGlzLm1vdW50LmNyZWF0ZSgpO1xuICAgIH07XG5cbiAgICBDb21wb25lbnROb2RlLnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbihvbGQsIGRvbSkge1xuICAgICAgaWYgKG9sZC5rbGFzcyAhPT0gdGhpcy5rbGFzcykge1xuICAgICAgICByZXR1cm4gdGhpcy5pbml0KCk7XG4gICAgICB9XG4gICAgICB0aGlzLmNvbXBvbmVudCA9IG9sZC5jb21wb25lbnQ7XG4gICAgICB0aGlzLm1vdW50ID0gb2xkLm1vdW50O1xuICAgICAgdGhpcy5jb21wb25lbnQuYXNzaWduKHRoaXMuYXR0cnMpO1xuICAgICAgcmV0dXJuIHRoaXMubW91bnQuZG9tO1xuICAgIH07XG5cbiAgICBDb21wb25lbnROb2RlLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5tb3VudC51bm1vdW50KCk7XG4gICAgfTtcblxuICAgIHJldHVybiBDb21wb25lbnROb2RlO1xuXG4gIH0pKCk7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIoZnVuY3Rpb24oKSB7XG4gICd1c2Ugc3RyaWN0JztcbiAgdmFyIERvbUNvbXBvbmVudE5vZGU7XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBEb21Db21wb25lbnROb2RlID0gKGZ1bmN0aW9uKCkge1xuICAgIERvbUNvbXBvbmVudE5vZGUucHJvdG90eXBlLnR5cGUgPSAnV2lkZ2V0JztcblxuICAgIERvbUNvbXBvbmVudE5vZGUucHJvdG90eXBlLndpZGdldFR5cGUgPSAnRG9tQ29tcG9uZW50JztcblxuICAgIGZ1bmN0aW9uIERvbUNvbXBvbmVudE5vZGUoa2xhc3MsIGF0dHJzKSB7XG4gICAgICB0aGlzLmtsYXNzID0ga2xhc3M7XG4gICAgICB0aGlzLmF0dHJzID0gYXR0cnM7XG4gICAgfVxuXG4gICAgRG9tQ29tcG9uZW50Tm9kZS5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5jb21wb25lbnQgPSBuZXcgdGhpcy5rbGFzcyh0aGlzLmF0dHJzKTtcbiAgICAgIHJldHVybiB0aGlzLmNvbXBvbmVudC5lbGVtZW50O1xuICAgIH07XG5cbiAgICBEb21Db21wb25lbnROb2RlLnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbihvbGQsIGRvbSkge1xuICAgICAgaWYgKG9sZC5rbGFzcyAhPT0gdGhpcy5rbGFzcykge1xuICAgICAgICByZXR1cm4gdGhpcy5pbml0KCk7XG4gICAgICB9XG4gICAgICB0aGlzLmNvbXBvbmVudCA9IG9sZC5jb21wb25lbnQ7XG4gICAgICByZXR1cm4gdGhpcy5jb21wb25lbnQuZWxlbWVudDtcbiAgICB9O1xuXG4gICAgRG9tQ29tcG9uZW50Tm9kZS5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKGRvbSkge1xuICAgICAgcmV0dXJuIHRoaXMuY29tcG9uZW50LmRlc3Ryb3koKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIERvbUNvbXBvbmVudE5vZGU7XG5cbiAgfSkoKTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIihmdW5jdGlvbigpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuICB2YXIgY29uY2F0LCBmaW5kQ29tcG9uZW50Tm9kZXMsIGZsYXR0ZW4sIGlzVk5vZGUsIGlzV2lkZ2V0O1xuXG4gIGlzVk5vZGUgPSByZXF1aXJlKCd2dHJlZS9pcy12bm9kZScpO1xuXG4gIGlzV2lkZ2V0ID0gcmVxdWlyZSgndnRyZWUvaXMtd2lkZ2V0Jyk7XG5cbiAgY29uY2F0ID0gQXJyYXkucHJvdG90eXBlLmNvbmNhdDtcblxuICBmbGF0dGVuID0gZnVuY3Rpb24oYXJyYXlzKSB7XG4gICAgcmV0dXJuIGNvbmNhdC5hcHBseShbXSwgYXJyYXlzKTtcbiAgfTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IGZpbmRDb21wb25lbnROb2RlcyA9IGZ1bmN0aW9uKHRyZWUpIHtcbiAgICBzd2l0Y2ggKGZhbHNlKSB7XG4gICAgICBjYXNlICEoaXNWTm9kZSh0cmVlKSAmJiB0cmVlLmNoaWxkcmVuKTpcbiAgICAgICAgcmV0dXJuIGZsYXR0ZW4odHJlZS5jaGlsZHJlbi5tYXAoZmluZENvbXBvbmVudE5vZGVzKSk7XG4gICAgICBjYXNlICEoaXNXaWRnZXQodHJlZSkgJiYgdHJlZS53aWRnZXRUeXBlID09PSAnQ29tcG9uZW50Jyk6XG4gICAgICAgIHJldHVybiBbdHJlZV07XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gW107XG4gICAgfVxuICB9O1xuXG59KS5jYWxsKHRoaXMpO1xuIiwidmFyIGNyZWF0ZUVsZW1lbnQgPSByZXF1aXJlKFwidmRvbS9jcmVhdGUtZWxlbWVudFwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZUVsZW1lbnRcbiIsInZhciBkaWZmID0gcmVxdWlyZShcInZ0cmVlL2RpZmZcIilcblxubW9kdWxlLmV4cG9ydHMgPSBkaWZmXG4iLCJtb2R1bGUuZXhwb3J0cyA9IGlzT2JqZWN0XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KHgpIHtcbiAgICByZXR1cm4gdHlwZW9mIHggPT09IFwib2JqZWN0XCIgJiYgeCAhPT0gbnVsbFxufVxuIiwidmFyIGlzT2JqZWN0ID0gcmVxdWlyZShcImlzLW9iamVjdFwiKVxudmFyIGlzSG9vayA9IHJlcXVpcmUoXCJ2dHJlZS9pcy12aG9va1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGFwcGx5UHJvcGVydGllc1xuXG5mdW5jdGlvbiBhcHBseVByb3BlcnRpZXMobm9kZSwgcHJvcHMsIHByZXZpb3VzKSB7XG4gICAgZm9yICh2YXIgcHJvcE5hbWUgaW4gcHJvcHMpIHtcbiAgICAgICAgdmFyIHByb3BWYWx1ZSA9IHByb3BzW3Byb3BOYW1lXVxuXG4gICAgICAgIGlmIChwcm9wVmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmVtb3ZlUHJvcGVydHkobm9kZSwgcHJvcHMsIHByZXZpb3VzLCBwcm9wTmFtZSk7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNIb29rKHByb3BWYWx1ZSkpIHtcbiAgICAgICAgICAgIHByb3BWYWx1ZS5ob29rKG5vZGUsXG4gICAgICAgICAgICAgICAgcHJvcE5hbWUsXG4gICAgICAgICAgICAgICAgcHJldmlvdXMgPyBwcmV2aW91c1twcm9wTmFtZV0gOiB1bmRlZmluZWQpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoaXNPYmplY3QocHJvcFZhbHVlKSkge1xuICAgICAgICAgICAgICAgIHBhdGNoT2JqZWN0KG5vZGUsIHByb3BzLCBwcmV2aW91cywgcHJvcE5hbWUsIHByb3BWYWx1ZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHByb3BWYWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgbm9kZVtwcm9wTmFtZV0gPSBwcm9wVmFsdWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gcmVtb3ZlUHJvcGVydHkobm9kZSwgcHJvcHMsIHByZXZpb3VzLCBwcm9wTmFtZSkge1xuICAgIGlmIChwcmV2aW91cykge1xuICAgICAgICB2YXIgcHJldmlvdXNWYWx1ZSA9IHByZXZpb3VzW3Byb3BOYW1lXVxuXG4gICAgICAgIGlmICghaXNIb29rKHByZXZpb3VzVmFsdWUpKSB7XG4gICAgICAgICAgICBpZiAocHJvcE5hbWUgPT09IFwiYXR0cmlidXRlc1wiKSB7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgYXR0ck5hbWUgaW4gcHJldmlvdXNWYWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICBub2RlLnJlbW92ZUF0dHJpYnV0ZShhdHRyTmFtZSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHByb3BOYW1lID09PSBcInN0eWxlXCIpIHtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpIGluIHByZXZpb3VzVmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZS5zdHlsZVtpXSA9IFwiXCJcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBwcmV2aW91c1ZhbHVlID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICAgICAgbm9kZVtwcm9wTmFtZV0gPSBcIlwiXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5vZGVbcHJvcE5hbWVdID0gbnVsbFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBwYXRjaE9iamVjdChub2RlLCBwcm9wcywgcHJldmlvdXMsIHByb3BOYW1lLCBwcm9wVmFsdWUpIHtcbiAgICB2YXIgcHJldmlvdXNWYWx1ZSA9IHByZXZpb3VzID8gcHJldmlvdXNbcHJvcE5hbWVdIDogdW5kZWZpbmVkXG5cbiAgICAvLyBTZXQgYXR0cmlidXRlc1xuICAgIGlmIChwcm9wTmFtZSA9PT0gXCJhdHRyaWJ1dGVzXCIpIHtcbiAgICAgICAgZm9yICh2YXIgYXR0ck5hbWUgaW4gcHJvcFZhbHVlKSB7XG4gICAgICAgICAgICB2YXIgYXR0clZhbHVlID0gcHJvcFZhbHVlW2F0dHJOYW1lXVxuXG4gICAgICAgICAgICBpZiAoYXR0clZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBub2RlLnJlbW92ZUF0dHJpYnV0ZShhdHRyTmFtZSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbm9kZS5zZXRBdHRyaWJ1dGUoYXR0ck5hbWUsIGF0dHJWYWx1ZSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGlmKHByZXZpb3VzVmFsdWUgJiYgaXNPYmplY3QocHJldmlvdXNWYWx1ZSkgJiZcbiAgICAgICAgZ2V0UHJvdG90eXBlKHByZXZpb3VzVmFsdWUpICE9PSBnZXRQcm90b3R5cGUocHJvcFZhbHVlKSkge1xuICAgICAgICBub2RlW3Byb3BOYW1lXSA9IHByb3BWYWx1ZVxuICAgICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBpZiAoIWlzT2JqZWN0KG5vZGVbcHJvcE5hbWVdKSkge1xuICAgICAgICBub2RlW3Byb3BOYW1lXSA9IHt9XG4gICAgfVxuXG4gICAgdmFyIHJlcGxhY2VyID0gcHJvcE5hbWUgPT09IFwic3R5bGVcIiA/IFwiXCIgOiB1bmRlZmluZWRcblxuICAgIGZvciAodmFyIGsgaW4gcHJvcFZhbHVlKSB7XG4gICAgICAgIHZhciB2YWx1ZSA9IHByb3BWYWx1ZVtrXVxuICAgICAgICBub2RlW3Byb3BOYW1lXVtrXSA9ICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSA/IHJlcGxhY2VyIDogdmFsdWVcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGdldFByb3RvdHlwZSh2YWx1ZSkge1xuICAgIGlmIChPYmplY3QuZ2V0UHJvdG90eXBlT2YpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5nZXRQcm90b3R5cGVPZih2YWx1ZSlcbiAgICB9IGVsc2UgaWYgKHZhbHVlLl9fcHJvdG9fXykge1xuICAgICAgICByZXR1cm4gdmFsdWUuX19wcm90b19fXG4gICAgfSBlbHNlIGlmICh2YWx1ZS5jb25zdHJ1Y3Rvcikge1xuICAgICAgICByZXR1cm4gdmFsdWUuY29uc3RydWN0b3IucHJvdG90eXBlXG4gICAgfVxufVxuIiwidmFyIGRvY3VtZW50ID0gcmVxdWlyZShcImdsb2JhbC9kb2N1bWVudFwiKVxuXG52YXIgYXBwbHlQcm9wZXJ0aWVzID0gcmVxdWlyZShcIi4vYXBwbHktcHJvcGVydGllc1wiKVxuXG52YXIgaXNWTm9kZSA9IHJlcXVpcmUoXCJ2dHJlZS9pcy12bm9kZVwiKVxudmFyIGlzVlRleHQgPSByZXF1aXJlKFwidnRyZWUvaXMtdnRleHRcIilcbnZhciBpc1dpZGdldCA9IHJlcXVpcmUoXCJ2dHJlZS9pcy13aWRnZXRcIilcbnZhciBoYW5kbGVUaHVuayA9IHJlcXVpcmUoXCJ2dHJlZS9oYW5kbGUtdGh1bmtcIilcblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVFbGVtZW50XG5cbmZ1bmN0aW9uIGNyZWF0ZUVsZW1lbnQodm5vZGUsIG9wdHMpIHtcbiAgICB2YXIgZG9jID0gb3B0cyA/IG9wdHMuZG9jdW1lbnQgfHwgZG9jdW1lbnQgOiBkb2N1bWVudFxuICAgIHZhciB3YXJuID0gb3B0cyA/IG9wdHMud2FybiA6IG51bGxcblxuICAgIHZub2RlID0gaGFuZGxlVGh1bmsodm5vZGUpLmFcblxuICAgIGlmIChpc1dpZGdldCh2bm9kZSkpIHtcbiAgICAgICAgcmV0dXJuIHZub2RlLmluaXQoKVxuICAgIH0gZWxzZSBpZiAoaXNWVGV4dCh2bm9kZSkpIHtcbiAgICAgICAgcmV0dXJuIGRvYy5jcmVhdGVUZXh0Tm9kZSh2bm9kZS50ZXh0KVxuICAgIH0gZWxzZSBpZiAoIWlzVk5vZGUodm5vZGUpKSB7XG4gICAgICAgIGlmICh3YXJuKSB7XG4gICAgICAgICAgICB3YXJuKFwiSXRlbSBpcyBub3QgYSB2YWxpZCB2aXJ0dWFsIGRvbSBub2RlXCIsIHZub2RlKVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsXG4gICAgfVxuXG4gICAgdmFyIG5vZGUgPSAodm5vZGUubmFtZXNwYWNlID09PSBudWxsKSA/XG4gICAgICAgIGRvYy5jcmVhdGVFbGVtZW50KHZub2RlLnRhZ05hbWUpIDpcbiAgICAgICAgZG9jLmNyZWF0ZUVsZW1lbnROUyh2bm9kZS5uYW1lc3BhY2UsIHZub2RlLnRhZ05hbWUpXG5cbiAgICB2YXIgcHJvcHMgPSB2bm9kZS5wcm9wZXJ0aWVzXG4gICAgYXBwbHlQcm9wZXJ0aWVzKG5vZGUsIHByb3BzKVxuXG4gICAgdmFyIGNoaWxkcmVuID0gdm5vZGUuY2hpbGRyZW5cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGNoaWxkTm9kZSA9IGNyZWF0ZUVsZW1lbnQoY2hpbGRyZW5baV0sIG9wdHMpXG4gICAgICAgIGlmIChjaGlsZE5vZGUpIHtcbiAgICAgICAgICAgIG5vZGUuYXBwZW5kQ2hpbGQoY2hpbGROb2RlKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG5vZGVcbn1cbiIsIi8vIE1hcHMgYSB2aXJ0dWFsIERPTSB0cmVlIG9udG8gYSByZWFsIERPTSB0cmVlIGluIGFuIGVmZmljaWVudCBtYW5uZXIuXG4vLyBXZSBkb24ndCB3YW50IHRvIHJlYWQgYWxsIG9mIHRoZSBET00gbm9kZXMgaW4gdGhlIHRyZWUgc28gd2UgdXNlXG4vLyB0aGUgaW4tb3JkZXIgdHJlZSBpbmRleGluZyB0byBlbGltaW5hdGUgcmVjdXJzaW9uIGRvd24gY2VydGFpbiBicmFuY2hlcy5cbi8vIFdlIG9ubHkgcmVjdXJzZSBpbnRvIGEgRE9NIG5vZGUgaWYgd2Uga25vdyB0aGF0IGl0IGNvbnRhaW5zIGEgY2hpbGQgb2Zcbi8vIGludGVyZXN0LlxuXG52YXIgbm9DaGlsZCA9IHt9XG5cbm1vZHVsZS5leHBvcnRzID0gZG9tSW5kZXhcblxuZnVuY3Rpb24gZG9tSW5kZXgocm9vdE5vZGUsIHRyZWUsIGluZGljZXMsIG5vZGVzKSB7XG4gICAgaWYgKCFpbmRpY2VzIHx8IGluZGljZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiB7fVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGluZGljZXMuc29ydChhc2NlbmRpbmcpXG4gICAgICAgIHJldHVybiByZWN1cnNlKHJvb3ROb2RlLCB0cmVlLCBpbmRpY2VzLCBub2RlcywgMClcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlY3Vyc2Uocm9vdE5vZGUsIHRyZWUsIGluZGljZXMsIG5vZGVzLCByb290SW5kZXgpIHtcbiAgICBub2RlcyA9IG5vZGVzIHx8IHt9XG5cblxuICAgIGlmIChyb290Tm9kZSkge1xuICAgICAgICBpZiAoaW5kZXhJblJhbmdlKGluZGljZXMsIHJvb3RJbmRleCwgcm9vdEluZGV4KSkge1xuICAgICAgICAgICAgbm9kZXNbcm9vdEluZGV4XSA9IHJvb3ROb2RlXG4gICAgICAgIH1cblxuICAgICAgICB2YXIgdkNoaWxkcmVuID0gdHJlZS5jaGlsZHJlblxuXG4gICAgICAgIGlmICh2Q2hpbGRyZW4pIHtcblxuICAgICAgICAgICAgdmFyIGNoaWxkTm9kZXMgPSByb290Tm9kZS5jaGlsZE5vZGVzXG5cbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdHJlZS5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHJvb3RJbmRleCArPSAxXG5cbiAgICAgICAgICAgICAgICB2YXIgdkNoaWxkID0gdkNoaWxkcmVuW2ldIHx8IG5vQ2hpbGRcbiAgICAgICAgICAgICAgICB2YXIgbmV4dEluZGV4ID0gcm9vdEluZGV4ICsgKHZDaGlsZC5jb3VudCB8fCAwKVxuXG4gICAgICAgICAgICAgICAgLy8gc2tpcCByZWN1cnNpb24gZG93biB0aGUgdHJlZSBpZiB0aGVyZSBhcmUgbm8gbm9kZXMgZG93biBoZXJlXG4gICAgICAgICAgICAgICAgaWYgKGluZGV4SW5SYW5nZShpbmRpY2VzLCByb290SW5kZXgsIG5leHRJbmRleCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVjdXJzZShjaGlsZE5vZGVzW2ldLCB2Q2hpbGQsIGluZGljZXMsIG5vZGVzLCByb290SW5kZXgpXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcm9vdEluZGV4ID0gbmV4dEluZGV4XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbm9kZXNcbn1cblxuLy8gQmluYXJ5IHNlYXJjaCBmb3IgYW4gaW5kZXggaW4gdGhlIGludGVydmFsIFtsZWZ0LCByaWdodF1cbmZ1bmN0aW9uIGluZGV4SW5SYW5nZShpbmRpY2VzLCBsZWZ0LCByaWdodCkge1xuICAgIGlmIChpbmRpY2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG5cbiAgICB2YXIgbWluSW5kZXggPSAwXG4gICAgdmFyIG1heEluZGV4ID0gaW5kaWNlcy5sZW5ndGggLSAxXG4gICAgdmFyIGN1cnJlbnRJbmRleFxuICAgIHZhciBjdXJyZW50SXRlbVxuXG4gICAgd2hpbGUgKG1pbkluZGV4IDw9IG1heEluZGV4KSB7XG4gICAgICAgIGN1cnJlbnRJbmRleCA9ICgobWF4SW5kZXggKyBtaW5JbmRleCkgLyAyKSA+PiAwXG4gICAgICAgIGN1cnJlbnRJdGVtID0gaW5kaWNlc1tjdXJyZW50SW5kZXhdXG5cbiAgICAgICAgaWYgKG1pbkluZGV4ID09PSBtYXhJbmRleCkge1xuICAgICAgICAgICAgcmV0dXJuIGN1cnJlbnRJdGVtID49IGxlZnQgJiYgY3VycmVudEl0ZW0gPD0gcmlnaHRcbiAgICAgICAgfSBlbHNlIGlmIChjdXJyZW50SXRlbSA8IGxlZnQpIHtcbiAgICAgICAgICAgIG1pbkluZGV4ID0gY3VycmVudEluZGV4ICsgMVxuICAgICAgICB9IGVsc2UgIGlmIChjdXJyZW50SXRlbSA+IHJpZ2h0KSB7XG4gICAgICAgICAgICBtYXhJbmRleCA9IGN1cnJlbnRJbmRleCAtIDFcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIGFzY2VuZGluZyhhLCBiKSB7XG4gICAgcmV0dXJuIGEgPiBiID8gMSA6IC0xXG59XG4iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG52YXIgdG9wTGV2ZWwgPSB0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJyA/IGdsb2JhbCA6XG4gICAgdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cgOiB7fVxudmFyIG1pbkRvYyA9IHJlcXVpcmUoJ21pbi1kb2N1bWVudCcpO1xuXG5pZiAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gZG9jdW1lbnQ7XG59IGVsc2Uge1xuICAgIHZhciBkb2NjeSA9IHRvcExldmVsWydfX0dMT0JBTF9ET0NVTUVOVF9DQUNIRUA0J107XG5cbiAgICBpZiAoIWRvY2N5KSB7XG4gICAgICAgIGRvY2N5ID0gdG9wTGV2ZWxbJ19fR0xPQkFMX0RPQ1VNRU5UX0NBQ0hFQDQnXSA9IG1pbkRvYztcbiAgICB9XG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGRvY2N5O1xufVxuXG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiLCJ2YXIgYXBwbHlQcm9wZXJ0aWVzID0gcmVxdWlyZShcIi4vYXBwbHktcHJvcGVydGllc1wiKVxuXG52YXIgaXNXaWRnZXQgPSByZXF1aXJlKFwidnRyZWUvaXMtd2lkZ2V0XCIpXG52YXIgVlBhdGNoID0gcmVxdWlyZShcInZ0cmVlL3ZwYXRjaFwiKVxuXG52YXIgcmVuZGVyID0gcmVxdWlyZShcIi4vY3JlYXRlLWVsZW1lbnRcIilcbnZhciB1cGRhdGVXaWRnZXQgPSByZXF1aXJlKFwiLi91cGRhdGUtd2lkZ2V0XCIpXG5cbm1vZHVsZS5leHBvcnRzID0gYXBwbHlQYXRjaFxuXG5mdW5jdGlvbiBhcHBseVBhdGNoKHZwYXRjaCwgZG9tTm9kZSwgcmVuZGVyT3B0aW9ucykge1xuICAgIHZhciB0eXBlID0gdnBhdGNoLnR5cGVcbiAgICB2YXIgdk5vZGUgPSB2cGF0Y2gudk5vZGVcbiAgICB2YXIgcGF0Y2ggPSB2cGF0Y2gucGF0Y2hcblxuICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICBjYXNlIFZQYXRjaC5SRU1PVkU6XG4gICAgICAgICAgICByZXR1cm4gcmVtb3ZlTm9kZShkb21Ob2RlLCB2Tm9kZSlcbiAgICAgICAgY2FzZSBWUGF0Y2guSU5TRVJUOlxuICAgICAgICAgICAgcmV0dXJuIGluc2VydE5vZGUoZG9tTm9kZSwgcGF0Y2gsIHJlbmRlck9wdGlvbnMpXG4gICAgICAgIGNhc2UgVlBhdGNoLlZURVhUOlxuICAgICAgICAgICAgcmV0dXJuIHN0cmluZ1BhdGNoKGRvbU5vZGUsIHZOb2RlLCBwYXRjaCwgcmVuZGVyT3B0aW9ucylcbiAgICAgICAgY2FzZSBWUGF0Y2guV0lER0VUOlxuICAgICAgICAgICAgcmV0dXJuIHdpZGdldFBhdGNoKGRvbU5vZGUsIHZOb2RlLCBwYXRjaCwgcmVuZGVyT3B0aW9ucylcbiAgICAgICAgY2FzZSBWUGF0Y2guVk5PREU6XG4gICAgICAgICAgICByZXR1cm4gdk5vZGVQYXRjaChkb21Ob2RlLCB2Tm9kZSwgcGF0Y2gsIHJlbmRlck9wdGlvbnMpXG4gICAgICAgIGNhc2UgVlBhdGNoLk9SREVSOlxuICAgICAgICAgICAgcmVvcmRlckNoaWxkcmVuKGRvbU5vZGUsIHBhdGNoKVxuICAgICAgICAgICAgcmV0dXJuIGRvbU5vZGVcbiAgICAgICAgY2FzZSBWUGF0Y2guUFJPUFM6XG4gICAgICAgICAgICBhcHBseVByb3BlcnRpZXMoZG9tTm9kZSwgcGF0Y2gsIHZOb2RlLnByb3BlcnRpZXMpXG4gICAgICAgICAgICByZXR1cm4gZG9tTm9kZVxuICAgICAgICBjYXNlIFZQYXRjaC5USFVOSzpcbiAgICAgICAgICAgIHJldHVybiByZXBsYWNlUm9vdChkb21Ob2RlLFxuICAgICAgICAgICAgICAgIHJlbmRlck9wdGlvbnMucGF0Y2goZG9tTm9kZSwgcGF0Y2gsIHJlbmRlck9wdGlvbnMpKVxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgcmV0dXJuIGRvbU5vZGVcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlbW92ZU5vZGUoZG9tTm9kZSwgdk5vZGUpIHtcbiAgICB2YXIgcGFyZW50Tm9kZSA9IGRvbU5vZGUucGFyZW50Tm9kZVxuXG4gICAgaWYgKHBhcmVudE5vZGUpIHtcbiAgICAgICAgcGFyZW50Tm9kZS5yZW1vdmVDaGlsZChkb21Ob2RlKVxuICAgIH1cblxuICAgIGRlc3Ryb3lXaWRnZXQoZG9tTm9kZSwgdk5vZGUpO1xuXG4gICAgcmV0dXJuIG51bGxcbn1cblxuZnVuY3Rpb24gaW5zZXJ0Tm9kZShwYXJlbnROb2RlLCB2Tm9kZSwgcmVuZGVyT3B0aW9ucykge1xuICAgIHZhciBuZXdOb2RlID0gcmVuZGVyKHZOb2RlLCByZW5kZXJPcHRpb25zKVxuXG4gICAgaWYgKHBhcmVudE5vZGUpIHtcbiAgICAgICAgcGFyZW50Tm9kZS5hcHBlbmRDaGlsZChuZXdOb2RlKVxuICAgIH1cblxuICAgIHJldHVybiBwYXJlbnROb2RlXG59XG5cbmZ1bmN0aW9uIHN0cmluZ1BhdGNoKGRvbU5vZGUsIGxlZnRWTm9kZSwgdlRleHQsIHJlbmRlck9wdGlvbnMpIHtcbiAgICB2YXIgbmV3Tm9kZVxuXG4gICAgaWYgKGRvbU5vZGUubm9kZVR5cGUgPT09IDMpIHtcbiAgICAgICAgZG9tTm9kZS5yZXBsYWNlRGF0YSgwLCBkb21Ob2RlLmxlbmd0aCwgdlRleHQudGV4dClcbiAgICAgICAgbmV3Tm9kZSA9IGRvbU5vZGVcbiAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgcGFyZW50Tm9kZSA9IGRvbU5vZGUucGFyZW50Tm9kZVxuICAgICAgICBuZXdOb2RlID0gcmVuZGVyKHZUZXh0LCByZW5kZXJPcHRpb25zKVxuXG4gICAgICAgIGlmIChwYXJlbnROb2RlKSB7XG4gICAgICAgICAgICBwYXJlbnROb2RlLnJlcGxhY2VDaGlsZChuZXdOb2RlLCBkb21Ob2RlKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZGVzdHJveVdpZGdldChkb21Ob2RlLCBsZWZ0Vk5vZGUpXG5cbiAgICByZXR1cm4gbmV3Tm9kZVxufVxuXG5mdW5jdGlvbiB3aWRnZXRQYXRjaChkb21Ob2RlLCBsZWZ0Vk5vZGUsIHdpZGdldCwgcmVuZGVyT3B0aW9ucykge1xuICAgIGlmICh1cGRhdGVXaWRnZXQobGVmdFZOb2RlLCB3aWRnZXQpKSB7XG4gICAgICAgIHJldHVybiB3aWRnZXQudXBkYXRlKGxlZnRWTm9kZSwgZG9tTm9kZSkgfHwgZG9tTm9kZVxuICAgIH1cblxuICAgIHZhciBwYXJlbnROb2RlID0gZG9tTm9kZS5wYXJlbnROb2RlXG4gICAgdmFyIG5ld1dpZGdldCA9IHJlbmRlcih3aWRnZXQsIHJlbmRlck9wdGlvbnMpXG5cbiAgICBpZiAocGFyZW50Tm9kZSkge1xuICAgICAgICBwYXJlbnROb2RlLnJlcGxhY2VDaGlsZChuZXdXaWRnZXQsIGRvbU5vZGUpXG4gICAgfVxuXG4gICAgZGVzdHJveVdpZGdldChkb21Ob2RlLCBsZWZ0Vk5vZGUpXG5cbiAgICByZXR1cm4gbmV3V2lkZ2V0XG59XG5cbmZ1bmN0aW9uIHZOb2RlUGF0Y2goZG9tTm9kZSwgbGVmdFZOb2RlLCB2Tm9kZSwgcmVuZGVyT3B0aW9ucykge1xuICAgIHZhciBwYXJlbnROb2RlID0gZG9tTm9kZS5wYXJlbnROb2RlXG4gICAgdmFyIG5ld05vZGUgPSByZW5kZXIodk5vZGUsIHJlbmRlck9wdGlvbnMpXG5cbiAgICBpZiAocGFyZW50Tm9kZSkge1xuICAgICAgICBwYXJlbnROb2RlLnJlcGxhY2VDaGlsZChuZXdOb2RlLCBkb21Ob2RlKVxuICAgIH1cblxuICAgIGRlc3Ryb3lXaWRnZXQoZG9tTm9kZSwgbGVmdFZOb2RlKVxuXG4gICAgcmV0dXJuIG5ld05vZGVcbn1cblxuZnVuY3Rpb24gZGVzdHJveVdpZGdldChkb21Ob2RlLCB3KSB7XG4gICAgaWYgKHR5cGVvZiB3LmRlc3Ryb3kgPT09IFwiZnVuY3Rpb25cIiAmJiBpc1dpZGdldCh3KSkge1xuICAgICAgICB3LmRlc3Ryb3koZG9tTm9kZSlcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlb3JkZXJDaGlsZHJlbihkb21Ob2RlLCBiSW5kZXgpIHtcbiAgICB2YXIgY2hpbGRyZW4gPSBbXVxuICAgIHZhciBjaGlsZE5vZGVzID0gZG9tTm9kZS5jaGlsZE5vZGVzXG4gICAgdmFyIGxlbiA9IGNoaWxkTm9kZXMubGVuZ3RoXG4gICAgdmFyIGlcbiAgICB2YXIgcmV2ZXJzZUluZGV4ID0gYkluZGV4LnJldmVyc2VcblxuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICBjaGlsZHJlbi5wdXNoKGRvbU5vZGUuY2hpbGROb2Rlc1tpXSlcbiAgICB9XG5cbiAgICB2YXIgaW5zZXJ0T2Zmc2V0ID0gMFxuICAgIHZhciBtb3ZlXG4gICAgdmFyIG5vZGVcbiAgICB2YXIgaW5zZXJ0Tm9kZVxuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICBtb3ZlID0gYkluZGV4W2ldXG4gICAgICAgIGlmIChtb3ZlICE9PSB1bmRlZmluZWQgJiYgbW92ZSAhPT0gaSkge1xuICAgICAgICAgICAgLy8gdGhlIGVsZW1lbnQgY3VycmVudGx5IGF0IHRoaXMgaW5kZXggd2lsbCBiZSBtb3ZlZCBsYXRlciBzbyBpbmNyZWFzZSB0aGUgaW5zZXJ0IG9mZnNldFxuICAgICAgICAgICAgaWYgKHJldmVyc2VJbmRleFtpXSA+IGkpIHtcbiAgICAgICAgICAgICAgICBpbnNlcnRPZmZzZXQrK1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBub2RlID0gY2hpbGRyZW5bbW92ZV1cbiAgICAgICAgICAgIGluc2VydE5vZGUgPSBjaGlsZE5vZGVzW2kgKyBpbnNlcnRPZmZzZXRdIHx8IG51bGxcbiAgICAgICAgICAgIGlmIChub2RlICE9PSBpbnNlcnROb2RlKSB7XG4gICAgICAgICAgICAgICAgZG9tTm9kZS5pbnNlcnRCZWZvcmUobm9kZSwgaW5zZXJ0Tm9kZSlcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdGhlIG1vdmVkIGVsZW1lbnQgY2FtZSBmcm9tIHRoZSBmcm9udCBvZiB0aGUgYXJyYXkgc28gcmVkdWNlIHRoZSBpbnNlcnQgb2Zmc2V0XG4gICAgICAgICAgICBpZiAobW92ZSA8IGkpIHtcbiAgICAgICAgICAgICAgICBpbnNlcnRPZmZzZXQtLVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZWxlbWVudCBhdCB0aGlzIGluZGV4IGlzIHNjaGVkdWxlZCB0byBiZSByZW1vdmVkIHNvIGluY3JlYXNlIGluc2VydCBvZmZzZXRcbiAgICAgICAgaWYgKGkgaW4gYkluZGV4LnJlbW92ZXMpIHtcbiAgICAgICAgICAgIGluc2VydE9mZnNldCsrXG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlcGxhY2VSb290KG9sZFJvb3QsIG5ld1Jvb3QpIHtcbiAgICBpZiAob2xkUm9vdCAmJiBuZXdSb290ICYmIG9sZFJvb3QgIT09IG5ld1Jvb3QgJiYgb2xkUm9vdC5wYXJlbnROb2RlKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKG9sZFJvb3QpXG4gICAgICAgIG9sZFJvb3QucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQobmV3Um9vdCwgb2xkUm9vdClcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3Um9vdDtcbn1cbiIsInZhciBkb2N1bWVudCA9IHJlcXVpcmUoXCJnbG9iYWwvZG9jdW1lbnRcIilcbnZhciBpc0FycmF5ID0gcmVxdWlyZShcIngtaXMtYXJyYXlcIilcblxudmFyIGRvbUluZGV4ID0gcmVxdWlyZShcIi4vZG9tLWluZGV4XCIpXG52YXIgcGF0Y2hPcCA9IHJlcXVpcmUoXCIuL3BhdGNoLW9wXCIpXG5tb2R1bGUuZXhwb3J0cyA9IHBhdGNoXG5cbmZ1bmN0aW9uIHBhdGNoKHJvb3ROb2RlLCBwYXRjaGVzKSB7XG4gICAgcmV0dXJuIHBhdGNoUmVjdXJzaXZlKHJvb3ROb2RlLCBwYXRjaGVzKVxufVxuXG5mdW5jdGlvbiBwYXRjaFJlY3Vyc2l2ZShyb290Tm9kZSwgcGF0Y2hlcywgcmVuZGVyT3B0aW9ucykge1xuICAgIHZhciBpbmRpY2VzID0gcGF0Y2hJbmRpY2VzKHBhdGNoZXMpXG5cbiAgICBpZiAoaW5kaWNlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIHJvb3ROb2RlXG4gICAgfVxuXG4gICAgdmFyIGluZGV4ID0gZG9tSW5kZXgocm9vdE5vZGUsIHBhdGNoZXMuYSwgaW5kaWNlcylcbiAgICB2YXIgb3duZXJEb2N1bWVudCA9IHJvb3ROb2RlLm93bmVyRG9jdW1lbnRcblxuICAgIGlmICghcmVuZGVyT3B0aW9ucykge1xuICAgICAgICByZW5kZXJPcHRpb25zID0geyBwYXRjaDogcGF0Y2hSZWN1cnNpdmUgfVxuICAgICAgICBpZiAob3duZXJEb2N1bWVudCAhPT0gZG9jdW1lbnQpIHtcbiAgICAgICAgICAgIHJlbmRlck9wdGlvbnMuZG9jdW1lbnQgPSBvd25lckRvY3VtZW50XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGluZGljZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIG5vZGVJbmRleCA9IGluZGljZXNbaV1cbiAgICAgICAgcm9vdE5vZGUgPSBhcHBseVBhdGNoKHJvb3ROb2RlLFxuICAgICAgICAgICAgaW5kZXhbbm9kZUluZGV4XSxcbiAgICAgICAgICAgIHBhdGNoZXNbbm9kZUluZGV4XSxcbiAgICAgICAgICAgIHJlbmRlck9wdGlvbnMpXG4gICAgfVxuXG4gICAgcmV0dXJuIHJvb3ROb2RlXG59XG5cbmZ1bmN0aW9uIGFwcGx5UGF0Y2gocm9vdE5vZGUsIGRvbU5vZGUsIHBhdGNoTGlzdCwgcmVuZGVyT3B0aW9ucykge1xuICAgIGlmICghZG9tTm9kZSkge1xuICAgICAgICByZXR1cm4gcm9vdE5vZGVcbiAgICB9XG5cbiAgICB2YXIgbmV3Tm9kZVxuXG4gICAgaWYgKGlzQXJyYXkocGF0Y2hMaXN0KSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBhdGNoTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbmV3Tm9kZSA9IHBhdGNoT3AocGF0Y2hMaXN0W2ldLCBkb21Ob2RlLCByZW5kZXJPcHRpb25zKVxuXG4gICAgICAgICAgICBpZiAoZG9tTm9kZSA9PT0gcm9vdE5vZGUpIHtcbiAgICAgICAgICAgICAgICByb290Tm9kZSA9IG5ld05vZGVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld05vZGUgPSBwYXRjaE9wKHBhdGNoTGlzdCwgZG9tTm9kZSwgcmVuZGVyT3B0aW9ucylcblxuICAgICAgICBpZiAoZG9tTm9kZSA9PT0gcm9vdE5vZGUpIHtcbiAgICAgICAgICAgIHJvb3ROb2RlID0gbmV3Tm9kZVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJvb3ROb2RlXG59XG5cbmZ1bmN0aW9uIHBhdGNoSW5kaWNlcyhwYXRjaGVzKSB7XG4gICAgdmFyIGluZGljZXMgPSBbXVxuXG4gICAgZm9yICh2YXIga2V5IGluIHBhdGNoZXMpIHtcbiAgICAgICAgaWYgKGtleSAhPT0gXCJhXCIpIHtcbiAgICAgICAgICAgIGluZGljZXMucHVzaChOdW1iZXIoa2V5KSlcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBpbmRpY2VzXG59XG4iLCJ2YXIgaXNXaWRnZXQgPSByZXF1aXJlKFwidnRyZWUvaXMtd2lkZ2V0XCIpXG5cbm1vZHVsZS5leHBvcnRzID0gdXBkYXRlV2lkZ2V0XG5cbmZ1bmN0aW9uIHVwZGF0ZVdpZGdldChhLCBiKSB7XG4gICAgaWYgKGlzV2lkZ2V0KGEpICYmIGlzV2lkZ2V0KGIpKSB7XG4gICAgICAgIGlmIChcIm5hbWVcIiBpbiBhICYmIFwibmFtZVwiIGluIGIpIHtcbiAgICAgICAgICAgIHJldHVybiBhLmlkID09PSBiLmlkXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gYS5pbml0ID09PSBiLmluaXRcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZVxufVxuIiwidmFyIG5hdGl2ZUlzQXJyYXkgPSBBcnJheS5pc0FycmF5XG52YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nXG5cbm1vZHVsZS5leHBvcnRzID0gbmF0aXZlSXNBcnJheSB8fCBpc0FycmF5XG5cbmZ1bmN0aW9uIGlzQXJyYXkob2JqKSB7XG4gICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwob2JqKSA9PT0gXCJbb2JqZWN0IEFycmF5XVwiXG59XG4iLCJ2YXIgcGF0Y2ggPSByZXF1aXJlKFwidmRvbS9wYXRjaFwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IHBhdGNoXG4iLCJ2YXIgaXNBcnJheSA9IHJlcXVpcmUoXCJ4LWlzLWFycmF5XCIpXG52YXIgaXNPYmplY3QgPSByZXF1aXJlKFwiaXMtb2JqZWN0XCIpXG5cbnZhciBWUGF0Y2ggPSByZXF1aXJlKFwiLi92cGF0Y2hcIilcbnZhciBpc1ZOb2RlID0gcmVxdWlyZShcIi4vaXMtdm5vZGVcIilcbnZhciBpc1ZUZXh0ID0gcmVxdWlyZShcIi4vaXMtdnRleHRcIilcbnZhciBpc1dpZGdldCA9IHJlcXVpcmUoXCIuL2lzLXdpZGdldFwiKVxudmFyIGlzVGh1bmsgPSByZXF1aXJlKFwiLi9pcy10aHVua1wiKVxudmFyIGhhbmRsZVRodW5rID0gcmVxdWlyZShcIi4vaGFuZGxlLXRodW5rXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gZGlmZlxuXG5mdW5jdGlvbiBkaWZmKGEsIGIpIHtcbiAgICB2YXIgcGF0Y2ggPSB7IGE6IGEgfVxuICAgIHdhbGsoYSwgYiwgcGF0Y2gsIDApXG4gICAgcmV0dXJuIHBhdGNoXG59XG5cbmZ1bmN0aW9uIHdhbGsoYSwgYiwgcGF0Y2gsIGluZGV4KSB7XG4gICAgaWYgKGEgPT09IGIpIHtcbiAgICAgICAgaWYgKGlzVGh1bmsoYSkgfHwgaXNUaHVuayhiKSkge1xuICAgICAgICAgICAgdGh1bmtzKGEsIGIsIHBhdGNoLCBpbmRleClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGhvb2tzKGIsIHBhdGNoLCBpbmRleClcbiAgICAgICAgfVxuICAgICAgICByZXR1cm5cbiAgICB9XG5cbiAgICB2YXIgYXBwbHkgPSBwYXRjaFtpbmRleF1cblxuICAgIGlmIChpc1RodW5rKGEpIHx8IGlzVGh1bmsoYikpIHtcbiAgICAgICAgdGh1bmtzKGEsIGIsIHBhdGNoLCBpbmRleClcbiAgICB9IGVsc2UgaWYgKGIgPT0gbnVsbCkge1xuICAgICAgICBwYXRjaFtpbmRleF0gPSBuZXcgVlBhdGNoKFZQYXRjaC5SRU1PVkUsIGEsIGIpXG4gICAgICAgIGRlc3Ryb3lXaWRnZXRzKGEsIHBhdGNoLCBpbmRleClcbiAgICB9IGVsc2UgaWYgKGlzVk5vZGUoYikpIHtcbiAgICAgICAgaWYgKGlzVk5vZGUoYSkpIHtcbiAgICAgICAgICAgIGlmIChhLnRhZ05hbWUgPT09IGIudGFnTmFtZSAmJlxuICAgICAgICAgICAgICAgIGEubmFtZXNwYWNlID09PSBiLm5hbWVzcGFjZSAmJlxuICAgICAgICAgICAgICAgIGEua2V5ID09PSBiLmtleSkge1xuICAgICAgICAgICAgICAgIHZhciBwcm9wc1BhdGNoID0gZGlmZlByb3BzKGEucHJvcGVydGllcywgYi5wcm9wZXJ0aWVzLCBiLmhvb2tzKVxuICAgICAgICAgICAgICAgIGlmIChwcm9wc1BhdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXcgVlBhdGNoKFZQYXRjaC5QUk9QUywgYSwgcHJvcHNQYXRjaCkpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGFwcGx5ID0gZGlmZkNoaWxkcmVuKGEsIGIsIHBhdGNoLCBhcHBseSwgaW5kZXgpXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksIG5ldyBWUGF0Y2goVlBhdGNoLlZOT0RFLCBhLCBiKSlcbiAgICAgICAgICAgICAgICBkZXN0cm95V2lkZ2V0cyhhLCBwYXRjaCwgaW5kZXgpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhcHBseSA9IGFwcGVuZFBhdGNoKGFwcGx5LCBuZXcgVlBhdGNoKFZQYXRjaC5WTk9ERSwgYSwgYikpXG4gICAgICAgICAgICBkZXN0cm95V2lkZ2V0cyhhLCBwYXRjaCwgaW5kZXgpXG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlzVlRleHQoYikpIHtcbiAgICAgICAgaWYgKCFpc1ZUZXh0KGEpKSB7XG4gICAgICAgICAgICBhcHBseSA9IGFwcGVuZFBhdGNoKGFwcGx5LCBuZXcgVlBhdGNoKFZQYXRjaC5WVEVYVCwgYSwgYikpXG4gICAgICAgICAgICBkZXN0cm95V2lkZ2V0cyhhLCBwYXRjaCwgaW5kZXgpXG4gICAgICAgIH0gZWxzZSBpZiAoYS50ZXh0ICE9PSBiLnRleHQpIHtcbiAgICAgICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksIG5ldyBWUGF0Y2goVlBhdGNoLlZURVhULCBhLCBiKSlcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXNXaWRnZXQoYikpIHtcbiAgICAgICAgYXBwbHkgPSBhcHBlbmRQYXRjaChhcHBseSwgbmV3IFZQYXRjaChWUGF0Y2guV0lER0VULCBhLCBiKSlcblxuICAgICAgICBpZiAoIWlzV2lkZ2V0KGEpKSB7XG4gICAgICAgICAgICBkZXN0cm95V2lkZ2V0cyhhLCBwYXRjaCwgaW5kZXgpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoYXBwbHkpIHtcbiAgICAgICAgcGF0Y2hbaW5kZXhdID0gYXBwbHlcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRpZmZQcm9wcyhhLCBiLCBob29rcykge1xuICAgIHZhciBkaWZmXG5cbiAgICBmb3IgKHZhciBhS2V5IGluIGEpIHtcbiAgICAgICAgaWYgKCEoYUtleSBpbiBiKSkge1xuICAgICAgICAgICAgZGlmZiA9IGRpZmYgfHwge31cbiAgICAgICAgICAgIGRpZmZbYUtleV0gPSB1bmRlZmluZWRcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBhVmFsdWUgPSBhW2FLZXldXG4gICAgICAgIHZhciBiVmFsdWUgPSBiW2FLZXldXG5cbiAgICAgICAgaWYgKGhvb2tzICYmIGFLZXkgaW4gaG9va3MpIHtcbiAgICAgICAgICAgIGRpZmYgPSBkaWZmIHx8IHt9XG4gICAgICAgICAgICBkaWZmW2FLZXldID0gYlZhbHVlXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoaXNPYmplY3QoYVZhbHVlKSAmJiBpc09iamVjdChiVmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgaWYgKGdldFByb3RvdHlwZShiVmFsdWUpICE9PSBnZXRQcm90b3R5cGUoYVZhbHVlKSkge1xuICAgICAgICAgICAgICAgICAgICBkaWZmID0gZGlmZiB8fCB7fVxuICAgICAgICAgICAgICAgICAgICBkaWZmW2FLZXldID0gYlZhbHVlXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG9iamVjdERpZmYgPSBkaWZmUHJvcHMoYVZhbHVlLCBiVmFsdWUpXG4gICAgICAgICAgICAgICAgICAgIGlmIChvYmplY3REaWZmKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkaWZmID0gZGlmZiB8fCB7fVxuICAgICAgICAgICAgICAgICAgICAgICAgZGlmZlthS2V5XSA9IG9iamVjdERpZmZcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYVZhbHVlICE9PSBiVmFsdWUpIHtcbiAgICAgICAgICAgICAgICBkaWZmID0gZGlmZiB8fCB7fVxuICAgICAgICAgICAgICAgIGRpZmZbYUtleV0gPSBiVmFsdWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZvciAodmFyIGJLZXkgaW4gYikge1xuICAgICAgICBpZiAoIShiS2V5IGluIGEpKSB7XG4gICAgICAgICAgICBkaWZmID0gZGlmZiB8fCB7fVxuICAgICAgICAgICAgZGlmZltiS2V5XSA9IGJbYktleV1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBkaWZmXG59XG5cbmZ1bmN0aW9uIGdldFByb3RvdHlwZSh2YWx1ZSkge1xuICAgIGlmIChPYmplY3QuZ2V0UHJvdG90eXBlT2YpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5nZXRQcm90b3R5cGVPZih2YWx1ZSlcbiAgICB9IGVsc2UgaWYgKHZhbHVlLl9fcHJvdG9fXykge1xuICAgICAgICByZXR1cm4gdmFsdWUuX19wcm90b19fXG4gICAgfSBlbHNlIGlmICh2YWx1ZS5jb25zdHJ1Y3Rvcikge1xuICAgICAgICByZXR1cm4gdmFsdWUuY29uc3RydWN0b3IucHJvdG90eXBlXG4gICAgfVxufVxuXG5mdW5jdGlvbiBkaWZmQ2hpbGRyZW4oYSwgYiwgcGF0Y2gsIGFwcGx5LCBpbmRleCkge1xuICAgIHZhciBhQ2hpbGRyZW4gPSBhLmNoaWxkcmVuXG4gICAgdmFyIGJDaGlsZHJlbiA9IHJlb3JkZXIoYUNoaWxkcmVuLCBiLmNoaWxkcmVuKVxuXG4gICAgdmFyIGFMZW4gPSBhQ2hpbGRyZW4ubGVuZ3RoXG4gICAgdmFyIGJMZW4gPSBiQ2hpbGRyZW4ubGVuZ3RoXG4gICAgdmFyIGxlbiA9IGFMZW4gPiBiTGVuID8gYUxlbiA6IGJMZW5cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgdmFyIGxlZnROb2RlID0gYUNoaWxkcmVuW2ldXG4gICAgICAgIHZhciByaWdodE5vZGUgPSBiQ2hpbGRyZW5baV1cbiAgICAgICAgaW5kZXggKz0gMVxuXG4gICAgICAgIGlmICghbGVmdE5vZGUpIHtcbiAgICAgICAgICAgIGlmIChyaWdodE5vZGUpIHtcbiAgICAgICAgICAgICAgICAvLyBFeGNlc3Mgbm9kZXMgaW4gYiBuZWVkIHRvIGJlIGFkZGVkXG4gICAgICAgICAgICAgICAgYXBwbHkgPSBhcHBlbmRQYXRjaChhcHBseSxcbiAgICAgICAgICAgICAgICAgICAgbmV3IFZQYXRjaChWUGF0Y2guSU5TRVJULCBudWxsLCByaWdodE5vZGUpKVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgd2FsayhsZWZ0Tm9kZSwgcmlnaHROb2RlLCBwYXRjaCwgaW5kZXgpXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNWTm9kZShsZWZ0Tm9kZSkgJiYgbGVmdE5vZGUuY291bnQpIHtcbiAgICAgICAgICAgIGluZGV4ICs9IGxlZnROb2RlLmNvdW50XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoYkNoaWxkcmVuLm1vdmVzKSB7XG4gICAgICAgIC8vIFJlb3JkZXIgbm9kZXMgbGFzdFxuICAgICAgICBhcHBseSA9IGFwcGVuZFBhdGNoKGFwcGx5LCBuZXcgVlBhdGNoKFZQYXRjaC5PUkRFUiwgYSwgYkNoaWxkcmVuLm1vdmVzKSlcbiAgICB9XG5cbiAgICByZXR1cm4gYXBwbHlcbn1cblxuLy8gUGF0Y2ggcmVjb3JkcyBmb3IgYWxsIGRlc3Ryb3llZCB3aWRnZXRzIG11c3QgYmUgYWRkZWQgYmVjYXVzZSB3ZSBuZWVkXG4vLyBhIERPTSBub2RlIHJlZmVyZW5jZSBmb3IgdGhlIGRlc3Ryb3kgZnVuY3Rpb25cbmZ1bmN0aW9uIGRlc3Ryb3lXaWRnZXRzKHZOb2RlLCBwYXRjaCwgaW5kZXgpIHtcbiAgICBpZiAoaXNXaWRnZXQodk5vZGUpKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygdk5vZGUuZGVzdHJveSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICBwYXRjaFtpbmRleF0gPSBuZXcgVlBhdGNoKFZQYXRjaC5SRU1PVkUsIHZOb2RlLCBudWxsKVxuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChpc1ZOb2RlKHZOb2RlKSAmJiAodk5vZGUuaGFzV2lkZ2V0cyB8fCB2Tm9kZS5oYXNUaHVua3MpKSB7XG4gICAgICAgIHZhciBjaGlsZHJlbiA9IHZOb2RlLmNoaWxkcmVuXG4gICAgICAgIHZhciBsZW4gPSBjaGlsZHJlbi5sZW5ndGhcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgdmFyIGNoaWxkID0gY2hpbGRyZW5baV1cbiAgICAgICAgICAgIGluZGV4ICs9IDFcblxuICAgICAgICAgICAgZGVzdHJveVdpZGdldHMoY2hpbGQsIHBhdGNoLCBpbmRleClcblxuICAgICAgICAgICAgaWYgKGlzVk5vZGUoY2hpbGQpICYmIGNoaWxkLmNvdW50KSB7XG4gICAgICAgICAgICAgICAgaW5kZXggKz0gY2hpbGQuY291bnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXNUaHVuayh2Tm9kZSkpIHtcbiAgICAgICAgdGh1bmtzKHZOb2RlLCBudWxsLCBwYXRjaCwgaW5kZXgpXG4gICAgfVxufVxuXG4vLyBDcmVhdGUgYSBzdWItcGF0Y2ggZm9yIHRodW5rc1xuZnVuY3Rpb24gdGh1bmtzKGEsIGIsIHBhdGNoLCBpbmRleCkge1xuICAgIHZhciBub2RlcyA9IGhhbmRsZVRodW5rKGEsIGIpO1xuICAgIHZhciB0aHVua1BhdGNoID0gZGlmZihub2Rlcy5hLCBub2Rlcy5iKVxuICAgIGlmIChoYXNQYXRjaGVzKHRodW5rUGF0Y2gpKSB7XG4gICAgICAgIHBhdGNoW2luZGV4XSA9IG5ldyBWUGF0Y2goVlBhdGNoLlRIVU5LLCBudWxsLCB0aHVua1BhdGNoKVxuICAgIH1cbn1cblxuZnVuY3Rpb24gaGFzUGF0Y2hlcyhwYXRjaCkge1xuICAgIGZvciAodmFyIGluZGV4IGluIHBhdGNoKSB7XG4gICAgICAgIGlmIChpbmRleCAhPT0gXCJhXCIpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xufVxuXG4vLyBFeGVjdXRlIGhvb2tzIHdoZW4gdHdvIG5vZGVzIGFyZSBpZGVudGljYWxcbmZ1bmN0aW9uIGhvb2tzKHZOb2RlLCBwYXRjaCwgaW5kZXgpIHtcbiAgICBpZiAoaXNWTm9kZSh2Tm9kZSkpIHtcbiAgICAgICAgaWYgKHZOb2RlLmhvb2tzKSB7XG4gICAgICAgICAgICBwYXRjaFtpbmRleF0gPSBuZXcgVlBhdGNoKFZQYXRjaC5QUk9QUywgdk5vZGUuaG9va3MsIHZOb2RlLmhvb2tzKVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHZOb2RlLmRlc2NlbmRhbnRIb29rcykge1xuICAgICAgICAgICAgdmFyIGNoaWxkcmVuID0gdk5vZGUuY2hpbGRyZW5cbiAgICAgICAgICAgIHZhciBsZW4gPSBjaGlsZHJlbi5sZW5ndGhcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgY2hpbGQgPSBjaGlsZHJlbltpXVxuICAgICAgICAgICAgICAgIGluZGV4ICs9IDFcblxuICAgICAgICAgICAgICAgIGhvb2tzKGNoaWxkLCBwYXRjaCwgaW5kZXgpXG5cbiAgICAgICAgICAgICAgICBpZiAoaXNWTm9kZShjaGlsZCkgJiYgY2hpbGQuY291bnQpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXggKz0gY2hpbGQuY291bnRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8vIExpc3QgZGlmZiwgbmFpdmUgbGVmdCB0byByaWdodCByZW9yZGVyaW5nXG5mdW5jdGlvbiByZW9yZGVyKGFDaGlsZHJlbiwgYkNoaWxkcmVuKSB7XG5cbiAgICB2YXIgYktleXMgPSBrZXlJbmRleChiQ2hpbGRyZW4pXG5cbiAgICBpZiAoIWJLZXlzKSB7XG4gICAgICAgIHJldHVybiBiQ2hpbGRyZW5cbiAgICB9XG5cbiAgICB2YXIgYUtleXMgPSBrZXlJbmRleChhQ2hpbGRyZW4pXG5cbiAgICBpZiAoIWFLZXlzKSB7XG4gICAgICAgIHJldHVybiBiQ2hpbGRyZW5cbiAgICB9XG5cbiAgICB2YXIgYk1hdGNoID0ge30sIGFNYXRjaCA9IHt9XG5cbiAgICBmb3IgKHZhciBrZXkgaW4gYktleXMpIHtcbiAgICAgICAgYk1hdGNoW2JLZXlzW2tleV1dID0gYUtleXNba2V5XVxuICAgIH1cblxuICAgIGZvciAodmFyIGtleSBpbiBhS2V5cykge1xuICAgICAgICBhTWF0Y2hbYUtleXNba2V5XV0gPSBiS2V5c1trZXldXG4gICAgfVxuXG4gICAgdmFyIGFMZW4gPSBhQ2hpbGRyZW4ubGVuZ3RoXG4gICAgdmFyIGJMZW4gPSBiQ2hpbGRyZW4ubGVuZ3RoXG4gICAgdmFyIGxlbiA9IGFMZW4gPiBiTGVuID8gYUxlbiA6IGJMZW5cbiAgICB2YXIgc2h1ZmZsZSA9IFtdXG4gICAgdmFyIGZyZWVJbmRleCA9IDBcbiAgICB2YXIgaSA9IDBcbiAgICB2YXIgbW92ZUluZGV4ID0gMFxuICAgIHZhciBtb3ZlcyA9IHt9XG4gICAgdmFyIHJlbW92ZXMgPSBtb3Zlcy5yZW1vdmVzID0ge31cbiAgICB2YXIgcmV2ZXJzZSA9IG1vdmVzLnJldmVyc2UgPSB7fVxuICAgIHZhciBoYXNNb3ZlcyA9IGZhbHNlXG5cbiAgICB3aGlsZSAoZnJlZUluZGV4IDwgbGVuKSB7XG4gICAgICAgIHZhciBtb3ZlID0gYU1hdGNoW2ldXG4gICAgICAgIGlmIChtb3ZlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHNodWZmbGVbaV0gPSBiQ2hpbGRyZW5bbW92ZV1cbiAgICAgICAgICAgIGlmIChtb3ZlICE9PSBtb3ZlSW5kZXgpIHtcbiAgICAgICAgICAgICAgICBtb3Zlc1ttb3ZlXSA9IG1vdmVJbmRleFxuICAgICAgICAgICAgICAgIHJldmVyc2VbbW92ZUluZGV4XSA9IG1vdmVcbiAgICAgICAgICAgICAgICBoYXNNb3ZlcyA9IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG1vdmVJbmRleCsrXG4gICAgICAgIH0gZWxzZSBpZiAoaSBpbiBhTWF0Y2gpIHtcbiAgICAgICAgICAgIHNodWZmbGVbaV0gPSB1bmRlZmluZWRcbiAgICAgICAgICAgIHJlbW92ZXNbaV0gPSBtb3ZlSW5kZXgrK1xuICAgICAgICAgICAgaGFzTW92ZXMgPSB0cnVlXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB3aGlsZSAoYk1hdGNoW2ZyZWVJbmRleF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGZyZWVJbmRleCsrXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChmcmVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgICAgICB2YXIgZnJlZUNoaWxkID0gYkNoaWxkcmVuW2ZyZWVJbmRleF1cbiAgICAgICAgICAgICAgICBpZiAoZnJlZUNoaWxkKSB7XG4gICAgICAgICAgICAgICAgICAgIHNodWZmbGVbaV0gPSBmcmVlQ2hpbGRcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZyZWVJbmRleCAhPT0gbW92ZUluZGV4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBoYXNNb3ZlcyA9IHRydWVcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vdmVzW2ZyZWVJbmRleF0gPSBtb3ZlSW5kZXhcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldmVyc2VbbW92ZUluZGV4XSA9IGZyZWVJbmRleFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIG1vdmVJbmRleCsrXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGZyZWVJbmRleCsrXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaSsrXG4gICAgfVxuXG4gICAgaWYgKGhhc01vdmVzKSB7XG4gICAgICAgIHNodWZmbGUubW92ZXMgPSBtb3Zlc1xuICAgIH1cblxuICAgIHJldHVybiBzaHVmZmxlXG59XG5cbmZ1bmN0aW9uIGtleUluZGV4KGNoaWxkcmVuKSB7XG4gICAgdmFyIGksIGtleXNcblxuICAgIGZvciAoaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgY2hpbGQgPSBjaGlsZHJlbltpXVxuXG4gICAgICAgIGlmIChjaGlsZC5rZXkgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAga2V5cyA9IGtleXMgfHwge31cbiAgICAgICAgICAgIGtleXNbY2hpbGQua2V5XSA9IGlcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBrZXlzXG59XG5cbmZ1bmN0aW9uIGFwcGVuZFBhdGNoKGFwcGx5LCBwYXRjaCkge1xuICAgIGlmIChhcHBseSkge1xuICAgICAgICBpZiAoaXNBcnJheShhcHBseSkpIHtcbiAgICAgICAgICAgIGFwcGx5LnB1c2gocGF0Y2gpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhcHBseSA9IFthcHBseSwgcGF0Y2hdXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYXBwbHlcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gcGF0Y2hcbiAgICB9XG59XG4iLCJ2YXIgaXNWTm9kZSA9IHJlcXVpcmUoXCIuL2lzLXZub2RlXCIpXG52YXIgaXNWVGV4dCA9IHJlcXVpcmUoXCIuL2lzLXZ0ZXh0XCIpXG52YXIgaXNXaWRnZXQgPSByZXF1aXJlKFwiLi9pcy13aWRnZXRcIilcbnZhciBpc1RodW5rID0gcmVxdWlyZShcIi4vaXMtdGh1bmtcIilcblxubW9kdWxlLmV4cG9ydHMgPSBoYW5kbGVUaHVua1xuXG5mdW5jdGlvbiBoYW5kbGVUaHVuayhhLCBiKSB7XG4gICAgdmFyIHJlbmRlcmVkQSA9IGFcbiAgICB2YXIgcmVuZGVyZWRCID0gYlxuXG4gICAgaWYgKGlzVGh1bmsoYikpIHtcbiAgICAgICAgcmVuZGVyZWRCID0gcmVuZGVyVGh1bmsoYiwgYSlcbiAgICB9XG5cbiAgICBpZiAoaXNUaHVuayhhKSkge1xuICAgICAgICByZW5kZXJlZEEgPSByZW5kZXJUaHVuayhhLCBudWxsKVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIGE6IHJlbmRlcmVkQSxcbiAgICAgICAgYjogcmVuZGVyZWRCXG4gICAgfVxufVxuXG5mdW5jdGlvbiByZW5kZXJUaHVuayh0aHVuaywgcHJldmlvdXMpIHtcbiAgICB2YXIgcmVuZGVyZWRUaHVuayA9IHRodW5rLnZub2RlXG5cbiAgICBpZiAoIXJlbmRlcmVkVGh1bmspIHtcbiAgICAgICAgcmVuZGVyZWRUaHVuayA9IHRodW5rLnZub2RlID0gdGh1bmsucmVuZGVyKHByZXZpb3VzKVxuICAgIH1cblxuICAgIGlmICghKGlzVk5vZGUocmVuZGVyZWRUaHVuaykgfHxcbiAgICAgICAgICAgIGlzVlRleHQocmVuZGVyZWRUaHVuaykgfHxcbiAgICAgICAgICAgIGlzV2lkZ2V0KHJlbmRlcmVkVGh1bmspKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJ0aHVuayBkaWQgbm90IHJldHVybiBhIHZhbGlkIG5vZGVcIik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlbmRlcmVkVGh1bmtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gaXNUaHVua1xyXG5cclxuZnVuY3Rpb24gaXNUaHVuayh0KSB7XHJcbiAgICByZXR1cm4gdCAmJiB0LnR5cGUgPT09IFwiVGh1bmtcIlxyXG59XHJcbiIsIm1vZHVsZS5leHBvcnRzID0gaXNIb29rXG5cbmZ1bmN0aW9uIGlzSG9vayhob29rKSB7XG4gICAgcmV0dXJuIGhvb2sgJiYgdHlwZW9mIGhvb2suaG9vayA9PT0gXCJmdW5jdGlvblwiICYmXG4gICAgICAgICFob29rLmhhc093blByb3BlcnR5KFwiaG9va1wiKVxufVxuIiwidmFyIHZlcnNpb24gPSByZXF1aXJlKFwiLi92ZXJzaW9uXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gaXNWaXJ0dWFsTm9kZVxuXG5mdW5jdGlvbiBpc1ZpcnR1YWxOb2RlKHgpIHtcbiAgICByZXR1cm4geCAmJiB4LnR5cGUgPT09IFwiVmlydHVhbE5vZGVcIiAmJiB4LnZlcnNpb24gPT09IHZlcnNpb25cbn1cbiIsInZhciB2ZXJzaW9uID0gcmVxdWlyZShcIi4vdmVyc2lvblwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzVmlydHVhbFRleHRcblxuZnVuY3Rpb24gaXNWaXJ0dWFsVGV4dCh4KSB7XG4gICAgcmV0dXJuIHggJiYgeC50eXBlID09PSBcIlZpcnR1YWxUZXh0XCIgJiYgeC52ZXJzaW9uID09PSB2ZXJzaW9uXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGlzV2lkZ2V0XG5cbmZ1bmN0aW9uIGlzV2lkZ2V0KHcpIHtcbiAgICByZXR1cm4gdyAmJiB3LnR5cGUgPT09IFwiV2lkZ2V0XCJcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gXCIxXCJcbiIsInZhciB2ZXJzaW9uID0gcmVxdWlyZShcIi4vdmVyc2lvblwiKVxuXG5WaXJ0dWFsUGF0Y2guTk9ORSA9IDBcblZpcnR1YWxQYXRjaC5WVEVYVCA9IDFcblZpcnR1YWxQYXRjaC5WTk9ERSA9IDJcblZpcnR1YWxQYXRjaC5XSURHRVQgPSAzXG5WaXJ0dWFsUGF0Y2guUFJPUFMgPSA0XG5WaXJ0dWFsUGF0Y2guT1JERVIgPSA1XG5WaXJ0dWFsUGF0Y2guSU5TRVJUID0gNlxuVmlydHVhbFBhdGNoLlJFTU9WRSA9IDdcblZpcnR1YWxQYXRjaC5USFVOSyA9IDhcblxubW9kdWxlLmV4cG9ydHMgPSBWaXJ0dWFsUGF0Y2hcblxuZnVuY3Rpb24gVmlydHVhbFBhdGNoKHR5cGUsIHZOb2RlLCBwYXRjaCkge1xuICAgIHRoaXMudHlwZSA9IE51bWJlcih0eXBlKVxuICAgIHRoaXMudk5vZGUgPSB2Tm9kZVxuICAgIHRoaXMucGF0Y2ggPSBwYXRjaFxufVxuXG5WaXJ0dWFsUGF0Y2gucHJvdG90eXBlLnZlcnNpb24gPSB2ZXJzaW9uXG5WaXJ0dWFsUGF0Y2gucHJvdG90eXBlLnR5cGUgPSBcIlZpcnR1YWxQYXRjaFwiXG4iLCIoZnVuY3Rpb24gKHJvb3QsIHBsdXJhbGl6ZSkge1xuICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xuICBpZiAodHlwZW9mIHJlcXVpcmUgPT09ICdmdW5jdGlvbicgJiYgdHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnICYmIHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnKSB7XG4gICAgLy8gTm9kZS5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IHBsdXJhbGl6ZSgpO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgIC8vIEFNRCwgcmVnaXN0ZXJzIGFzIGFuIGFub255bW91cyBtb2R1bGUuXG4gICAgZGVmaW5lKGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBwbHVyYWxpemUoKTtcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICAvLyBCcm93c2VyIGdsb2JhbC5cbiAgICByb290LnBsdXJhbGl6ZSA9IHBsdXJhbGl6ZSgpO1xuICB9XG59KSh0aGlzLCBmdW5jdGlvbiAoKSB7XG4gIC8vIFJ1bGUgc3RvcmFnZSAtIHBsdXJhbGl6ZSBhbmQgc2luZ3VsYXJpemUgbmVlZCB0byBiZSBydW4gc2VxdWVudGlhbGx5LFxuICAvLyB3aGlsZSBvdGhlciBydWxlcyBjYW4gYmUgb3B0aW1pemVkIHVzaW5nIGFuIG9iamVjdCBmb3IgaW5zdGFudCBsb29rdXBzLlxuICB2YXIgcGx1cmFsUnVsZXMgICAgICA9IFtdO1xuICB2YXIgc2luZ3VsYXJSdWxlcyAgICA9IFtdO1xuICB2YXIgdW5jb3VudGFibGVzICAgICA9IHt9O1xuICB2YXIgaXJyZWd1bGFyUGx1cmFscyA9IHt9O1xuICB2YXIgaXJyZWd1bGFyU2luZ2xlcyA9IHt9O1xuXG4gIC8qKlxuICAgKiBUaXRsZSBjYXNlIGEgc3RyaW5nLlxuICAgKlxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IHN0clxuICAgKiBAcmV0dXJuIHtzdHJpbmd9XG4gICAqL1xuICBmdW5jdGlvbiB0b1RpdGxlQ2FzZSAoc3RyKSB7XG4gICAgcmV0dXJuIHN0ci5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHN0ci5zdWJzdHIoMSkudG9Mb3dlckNhc2UoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTYW5pdGl6ZSBhIHBsdXJhbGl6YXRpb24gcnVsZSB0byBhIHVzYWJsZSByZWd1bGFyIGV4cHJlc3Npb24uXG4gICAqXG4gICAqIEBwYXJhbSAgeyhSZWdFeHB8c3RyaW5nKX0gcnVsZVxuICAgKiBAcmV0dXJuIHtSZWdFeHB9XG4gICAqL1xuICBmdW5jdGlvbiBzYW5pdGl6ZVJ1bGUgKHJ1bGUpIHtcbiAgICBpZiAodHlwZW9mIHJ1bGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gbmV3IFJlZ0V4cCgnXicgKyBydWxlICsgJyQnLCAnaScpO1xuICAgIH1cblxuICAgIHJldHVybiBydWxlO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhc3MgaW4gYSB3b3JkIHRva2VuIHRvIHByb2R1Y2UgYSBmdW5jdGlvbiB0aGF0IGNhbiByZXBsaWNhdGUgdGhlIGNhc2Ugb25cbiAgICogYW5vdGhlciB3b3JkLlxuICAgKlxuICAgKiBAcGFyYW0gIHtzdHJpbmd9ICAgd29yZFxuICAgKiBAcGFyYW0gIHtzdHJpbmd9ICAgdG9rZW5cbiAgICogQHJldHVybiB7RnVuY3Rpb259XG4gICAqL1xuICBmdW5jdGlvbiByZXN0b3JlQ2FzZSAod29yZCwgdG9rZW4pIHtcbiAgICAvLyBVcHBlciBjYXNlZCB3b3Jkcy4gRS5nLiBcIkhFTExPXCIuXG4gICAgaWYgKHdvcmQgPT09IHdvcmQudG9VcHBlckNhc2UoKSkge1xuICAgICAgcmV0dXJuIHRva2VuLnRvVXBwZXJDYXNlKCk7XG4gICAgfVxuXG4gICAgLy8gVGl0bGUgY2FzZWQgd29yZHMuIEUuZy4gXCJUaXRsZVwiLlxuICAgIGlmICh3b3JkWzBdID09PSB3b3JkWzBdLnRvVXBwZXJDYXNlKCkpIHtcbiAgICAgIHJldHVybiB0b1RpdGxlQ2FzZSh0b2tlbik7XG4gICAgfVxuXG4gICAgLy8gTG93ZXIgY2FzZWQgd29yZHMuIEUuZy4gXCJ0ZXN0XCIuXG4gICAgcmV0dXJuIHRva2VuLnRvTG93ZXJDYXNlKCk7XG4gIH1cblxuICAvKipcbiAgICogSW50ZXJwb2xhdGUgYSByZWdleHAgc3RyaW5nLlxuICAgKlxuICAgKiBAcGFyYW0gIHtbdHlwZV19IHN0ciAgW2Rlc2NyaXB0aW9uXVxuICAgKiBAcGFyYW0gIHtbdHlwZV19IGFyZ3MgW2Rlc2NyaXB0aW9uXVxuICAgKiBAcmV0dXJuIHtbdHlwZV19ICAgICAgW2Rlc2NyaXB0aW9uXVxuICAgKi9cbiAgZnVuY3Rpb24gaW50ZXJwb2xhdGUgKHN0ciwgYXJncykge1xuICAgIHJldHVybiBzdHIucmVwbGFjZSgvXFwkKFxcZHsxLDJ9KS9nLCBmdW5jdGlvbiAobWF0Y2gsIGluZGV4KSB7XG4gICAgICByZXR1cm4gYXJnc1tpbmRleF0gfHwgJyc7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogU2FuaXRpemUgYSB3b3JkIGJ5IHBhc3NpbmcgaW4gdGhlIHdvcmQgYW5kIHNhbml0aXphdGlvbiBydWxlcy5cbiAgICpcbiAgICogQHBhcmFtICB7U3RyaW5nfSAgIHdvcmRcbiAgICogQHBhcmFtICB7QXJyYXl9ICAgIGNvbGxlY3Rpb25cbiAgICogQHJldHVybiB7U3RyaW5nfVxuICAgKi9cbiAgZnVuY3Rpb24gc2FuaXRpemVXb3JkICh3b3JkLCBjb2xsZWN0aW9uKSB7XG4gICAgLy8gRW1wdHkgc3RyaW5nIG9yIGRvZXNuJ3QgbmVlZCBmaXhpbmcuXG4gICAgaWYgKCF3b3JkLmxlbmd0aCB8fCB1bmNvdW50YWJsZXMuaGFzT3duUHJvcGVydHkod29yZCkpIHtcbiAgICAgIHJldHVybiB3b3JkO1xuICAgIH1cblxuICAgIHZhciBsZW4gPSBjb2xsZWN0aW9uLmxlbmd0aDtcblxuICAgIC8vIEl0ZXJhdGUgb3ZlciB0aGUgc2FuaXRpemF0aW9uIHJ1bGVzIGFuZCB1c2UgdGhlIGZpcnN0IG9uZSB0byBtYXRjaC5cbiAgICB3aGlsZSAobGVuLS0pIHtcbiAgICAgIHZhciBydWxlID0gY29sbGVjdGlvbltsZW5dO1xuXG4gICAgICAvLyBJZiB0aGUgcnVsZSBwYXNzZXMsIHJldHVybiB0aGUgcmVwbGFjZW1lbnQuXG4gICAgICBpZiAocnVsZVswXS50ZXN0KHdvcmQpKSB7XG4gICAgICAgIHJldHVybiB3b3JkLnJlcGxhY2UocnVsZVswXSwgZnVuY3Rpb24gKG1hdGNoLCBpbmRleCwgd29yZCkge1xuICAgICAgICAgIHZhciByZXN1bHQgPSBpbnRlcnBvbGF0ZShydWxlWzFdLCBhcmd1bWVudHMpO1xuXG4gICAgICAgICAgaWYgKG1hdGNoID09PSAnJykge1xuICAgICAgICAgICAgcmV0dXJuIHJlc3RvcmVDYXNlKHdvcmRbaW5kZXggLSAxXSwgcmVzdWx0KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gcmVzdG9yZUNhc2UobWF0Y2gsIHJlc3VsdCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB3b3JkO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlcGxhY2UgYSB3b3JkIHdpdGggdGhlIHVwZGF0ZWQgd29yZC5cbiAgICpcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgIHJlcGxhY2VNYXBcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgIGtlZXBNYXBcbiAgICogQHBhcmFtICB7QXJyYXl9ICAgIHJ1bGVzXG4gICAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICAgKi9cbiAgZnVuY3Rpb24gcmVwbGFjZVdvcmQgKHJlcGxhY2VNYXAsIGtlZXBNYXAsIHJ1bGVzKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uICh3b3JkKSB7XG4gICAgICAvLyBHZXQgdGhlIGNvcnJlY3QgdG9rZW4gYW5kIGNhc2UgcmVzdG9yYXRpb24gZnVuY3Rpb25zLlxuICAgICAgdmFyIHRva2VuID0gd29yZC50b0xvd2VyQ2FzZSgpO1xuXG4gICAgICAvLyBDaGVjayBhZ2FpbnN0IHRoZSBrZWVwIG9iamVjdCBtYXAuXG4gICAgICBpZiAoa2VlcE1hcC5oYXNPd25Qcm9wZXJ0eSh0b2tlbikpIHtcbiAgICAgICAgcmV0dXJuIHJlc3RvcmVDYXNlKHdvcmQsIHRva2VuKTtcbiAgICAgIH1cblxuICAgICAgLy8gQ2hlY2sgYWdhaW5zdCB0aGUgcmVwbGFjZW1lbnQgbWFwIGZvciBhIGRpcmVjdCB3b3JkIHJlcGxhY2VtZW50LlxuICAgICAgaWYgKHJlcGxhY2VNYXAuaGFzT3duUHJvcGVydHkodG9rZW4pKSB7XG4gICAgICAgIHJldHVybiByZXN0b3JlQ2FzZSh3b3JkLCByZXBsYWNlTWFwW3Rva2VuXSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFJ1biBhbGwgdGhlIHJ1bGVzIGFnYWluc3QgdGhlIHdvcmQuXG4gICAgICByZXR1cm4gc2FuaXRpemVXb3JkKHdvcmQsIHJ1bGVzKTtcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFBsdXJhbGl6ZSBvciBzaW5ndWxhcml6ZSBhIHdvcmQgYmFzZWQgb24gdGhlIHBhc3NlZCBpbiBjb3VudC5cbiAgICpcbiAgICogQHBhcmFtICB7U3RyaW5nfSAgd29yZFxuICAgKiBAcGFyYW0gIHtOdW1iZXJ9ICBjb3VudFxuICAgKiBAcGFyYW0gIHtCb29sZWFufSBpbmNsdXNpdmVcbiAgICogQHJldHVybiB7U3RyaW5nfVxuICAgKi9cbiAgZnVuY3Rpb24gcGx1cmFsaXplICh3b3JkLCBjb3VudCwgaW5jbHVzaXZlKSB7XG4gICAgdmFyIHBsdXJhbGl6ZWQgPSBjb3VudCA9PT0gMSA/XG4gICAgICBwbHVyYWxpemUuc2luZ3VsYXIod29yZCkgOiBwbHVyYWxpemUucGx1cmFsKHdvcmQpO1xuXG4gICAgcmV0dXJuIChpbmNsdXNpdmUgPyBjb3VudCArICcgJyA6ICcnKSArIHBsdXJhbGl6ZWQ7XG4gIH1cblxuICAvKipcbiAgICogUGx1cmFsaXplIGEgd29yZC5cbiAgICpcbiAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgKi9cbiAgcGx1cmFsaXplLnBsdXJhbCA9IHJlcGxhY2VXb3JkKFxuICAgIGlycmVndWxhclNpbmdsZXMsIGlycmVndWxhclBsdXJhbHMsIHBsdXJhbFJ1bGVzXG4gICk7XG5cbiAgLyoqXG4gICAqIFNpbmd1bGFyaXplIGEgd29yZC5cbiAgICpcbiAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgKi9cbiAgcGx1cmFsaXplLnNpbmd1bGFyID0gcmVwbGFjZVdvcmQoXG4gICAgaXJyZWd1bGFyUGx1cmFscywgaXJyZWd1bGFyU2luZ2xlcywgc2luZ3VsYXJSdWxlc1xuICApO1xuXG4gIC8qKlxuICAgKiBBZGQgYSBwbHVyYWxpemF0aW9uIHJ1bGUgdG8gdGhlIGNvbGxlY3Rpb24uXG4gICAqXG4gICAqIEBwYXJhbSB7KHN0cmluZ3xSZWdFeHApfSBydWxlXG4gICAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICByZXBsYWNlbWVudFxuICAgKi9cbiAgcGx1cmFsaXplLmFkZFBsdXJhbFJ1bGUgPSBmdW5jdGlvbiAocnVsZSwgcmVwbGFjZW1lbnQpIHtcbiAgICBwbHVyYWxSdWxlcy5wdXNoKFtzYW5pdGl6ZVJ1bGUocnVsZSksIHJlcGxhY2VtZW50XSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIEFkZCBhIHNpbmd1bGFyaXphdGlvbiBydWxlIHRvIHRoZSBjb2xsZWN0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0geyhzdHJpbmd8UmVnRXhwKX0gcnVsZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgcmVwbGFjZW1lbnRcbiAgICovXG4gIHBsdXJhbGl6ZS5hZGRTaW5ndWxhclJ1bGUgPSBmdW5jdGlvbiAocnVsZSwgcmVwbGFjZW1lbnQpIHtcbiAgICBzaW5ndWxhclJ1bGVzLnB1c2goW3Nhbml0aXplUnVsZShydWxlKSwgcmVwbGFjZW1lbnRdKTtcbiAgfTtcblxuICAvKipcbiAgICogQWRkIGFuIHVuY291bnRhYmxlIHdvcmQgcnVsZS5cbiAgICpcbiAgICogQHBhcmFtIHsoc3RyaW5nfFJlZ0V4cCl9IHdvcmRcbiAgICovXG4gIHBsdXJhbGl6ZS5hZGRVbmNvdW50YWJsZVJ1bGUgPSBmdW5jdGlvbiAod29yZCkge1xuICAgIGlmICh0eXBlb2Ygd29yZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiB1bmNvdW50YWJsZXNbd29yZC50b0xvd2VyQ2FzZSgpXSA9IHRydWU7XG4gICAgfVxuXG4gICAgLy8gU2V0IHNpbmd1bGFyIGFuZCBwbHVyYWwgcmVmZXJlbmNlcyBmb3IgdGhlIHdvcmQuXG4gICAgcGx1cmFsaXplLmFkZFBsdXJhbFJ1bGUod29yZCwgJyQwJyk7XG4gICAgcGx1cmFsaXplLmFkZFNpbmd1bGFyUnVsZSh3b3JkLCAnJDAnKTtcbiAgfTtcblxuICAvKipcbiAgICogQWRkIGFuIGlycmVndWxhciB3b3JkIGRlZmluaXRpb24uXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBzaW5nbGVcbiAgICogQHBhcmFtIHtTdHJpbmd9IHBsdXJhbFxuICAgKi9cbiAgcGx1cmFsaXplLmFkZElycmVndWxhclJ1bGUgPSBmdW5jdGlvbiAoc2luZ2xlLCBwbHVyYWwpIHtcbiAgICBwbHVyYWwgPSBwbHVyYWwudG9Mb3dlckNhc2UoKTtcbiAgICBzaW5nbGUgPSBzaW5nbGUudG9Mb3dlckNhc2UoKTtcblxuICAgIGlycmVndWxhclNpbmdsZXNbc2luZ2xlXSA9IHBsdXJhbDtcbiAgICBpcnJlZ3VsYXJQbHVyYWxzW3BsdXJhbF0gPSBzaW5nbGU7XG4gIH07XG5cbiAgLyoqXG4gICAqIElycmVndWxhciBydWxlcy5cbiAgICovXG4gIFtcbiAgICAvLyBQcm9ub3Vucy5cbiAgICBbJ0knLCAgICAgICAgJ3dlJ10sXG4gICAgWydtZScsICAgICAgICd1cyddLFxuICAgIFsnaGUnLCAgICAgICAndGhleSddLFxuICAgIFsnc2hlJywgICAgICAndGhleSddLFxuICAgIFsndGhlbScsICAgICAndGhlbSddLFxuICAgIFsnbXlzZWxmJywgICAnb3Vyc2VsdmVzJ10sXG4gICAgWyd5b3Vyc2VsZicsICd5b3Vyc2VsdmVzJ10sXG4gICAgWydpdHNlbGYnLCAgICd0aGVtc2VsdmVzJ10sXG4gICAgWydoZXJzZWxmJywgICd0aGVtc2VsdmVzJ10sXG4gICAgWydoaW1zZWxmJywgICd0aGVtc2VsdmVzJ10sXG4gICAgWyd0aGVtc2VsZicsICd0aGVtc2VsdmVzJ10sXG4gICAgWyd0aGlzJywgICAgICd0aGVzZSddLFxuICAgIFsndGhhdCcsICAgICAndGhvc2UnXSxcbiAgICAvLyBXb3JkcyBlbmRpbmcgaW4gd2l0aCBhIGNvbnNvbmFudCBhbmQgYG9gLlxuICAgIFsndm9sY2FubycsICd2b2xjYW5vZXMnXSxcbiAgICBbJ3Rvcm5hZG8nLCAndG9ybmFkb2VzJ10sXG4gICAgWyd0b3JwZWRvJywgJ3RvcnBlZG9lcyddLFxuICAgIC8vIEVuZHMgd2l0aCBgdXNgLlxuICAgIFsnZ2VudXMnLCAgJ2dlbmVyYSddLFxuICAgIFsndmlzY3VzJywgJ3Zpc2NlcmEnXSxcbiAgICAvLyBFbmRzIHdpdGggYG1hYC5cbiAgICBbJ3N0aWdtYScsICAgJ3N0aWdtYXRhJ10sXG4gICAgWydzdG9tYScsICAgICdzdG9tYXRhJ10sXG4gICAgWydkb2dtYScsICAgICdkb2dtYXRhJ10sXG4gICAgWydsZW1tYScsICAgICdsZW1tYXRhJ10sXG4gICAgWydzY2hlbWEnLCAgICdzY2hlbWF0YSddLFxuICAgIFsnYW5hdGhlbWEnLCAnYW5hdGhlbWF0YSddLFxuICAgIC8vIE90aGVyIGlycmVndWxhciBydWxlcy5cbiAgICBbJ294JywgICAgICAnb3hlbiddLFxuICAgIFsnYXhlJywgICAgICdheGVzJ10sXG4gICAgWydkaWUnLCAgICAgJ2RpY2UnXSxcbiAgICBbJ3llcycsICAgICAneWVzZXMnXSxcbiAgICBbJ2Zvb3QnLCAgICAnZmVldCddLFxuICAgIFsnZWF2ZScsICAgICdlYXZlcyddLFxuICAgIFsnZ29vc2UnLCAgICdnZWVzZSddLFxuICAgIFsndG9vdGgnLCAgICd0ZWV0aCddLFxuICAgIFsncXVpeicsICAgICdxdWl6emVzJ10sXG4gICAgWydodW1hbicsICAgJ2h1bWFucyddLFxuICAgIFsncHJvb2YnLCAgICdwcm9vZnMnXSxcbiAgICBbJ2NhcnZlJywgICAnY2FydmVzJ10sXG4gICAgWyd2YWx2ZScsICAgJ3ZhbHZlcyddLFxuICAgIFsndGhpZWYnLCAgICd0aGlldmVzJ10sXG4gICAgWydnZW5pZScsICAgJ2dlbmllcyddLFxuICAgIFsnZ3Jvb3ZlJywgICdncm9vdmVzJ10sXG4gICAgWydwaWNrYXhlJywgJ3BpY2theGVzJ10sXG4gICAgWyd3aGlza2V5JywgJ3doaXNraWVzJ11cbiAgXS5mb3JFYWNoKGZ1bmN0aW9uIChydWxlKSB7XG4gICAgcmV0dXJuIHBsdXJhbGl6ZS5hZGRJcnJlZ3VsYXJSdWxlKHJ1bGVbMF0sIHJ1bGVbMV0pO1xuICB9KTtcblxuICAvKipcbiAgICogUGx1cmFsaXphdGlvbiBydWxlcy5cbiAgICovXG4gIFtcbiAgICBbL3M/JC9pLCAncyddLFxuICAgIFsvKFteYWVpb3VdZXNlKSQvaSwgJyQxJ10sXG4gICAgWy8oYXh8dGVzdClpcyQvaSwgJyQxZXMnXSxcbiAgICBbLyhhbGlhc3xbXmFvdV11c3x0bGFzfGdhc3xyaXMpJC9pLCAnJDFlcyddLFxuICAgIFsvKGVbbW5ddSlzPyQvaSwgJyQxcyddLFxuICAgIFsvKFtebF1pYXN8W2FlaW91XWxhc3xbZW1qenJdYXN8W2l1XWFtKSQvaSwgJyQxJ10sXG4gICAgWy8oYWx1bW58c3lsbGFifG9jdG9wfHZpcnxyYWRpfG51Y2xlfGZ1bmd8Y2FjdHxzdGltdWx8dGVybWlufGJhY2lsbHxmb2N8dXRlcnxsb2N8c3RyYXQpKD86dXN8aSkkL2ksICckMWknXSxcbiAgICBbLyhhbHVtbnxhbGd8dmVydGVicikoPzphfGFlKSQvaSwgJyQxYWUnXSxcbiAgICBbLyhzZXJhcGh8Y2hlcnViKSg/OmltKT8kL2ksICckMWltJ10sXG4gICAgWy8oaGVyfGF0fGdyKW8kL2ksICckMW9lcyddLFxuICAgIFsvKGFnZW5kfGFkZGVuZHxtaWxsZW5uaXxkYXR8ZXh0cmVtfGJhY3Rlcml8ZGVzaWRlcmF0fHN0cmF0fGNhbmRlbGFicnxlcnJhdHxvdnxzeW1wb3NpfGN1cnJpY3VsfGF1dG9tYXR8cXVvcikoPzphfHVtKSQvaSwgJyQxYSddLFxuICAgIFsvKGFwaGVsaXxoeXBlcmJhdHxwZXJpaGVsaXxhc3luZGV0fG5vdW1lbnxwaGVub21lbnxjcml0ZXJpfG9yZ2FufHByb2xlZ29tZW58XFx3K2hlZHIpKD86YXxvbikkL2ksICckMWEnXSxcbiAgICBbL3NpcyQvaSwgJ3NlcyddLFxuICAgIFsvKD86KGkpZmV8KGFyfGx8ZWF8ZW98b2F8aG9vKWYpJC9pLCAnJDEkMnZlcyddLFxuICAgIFsvKFteYWVpb3V5XXxxdSl5JC9pLCAnJDFpZXMnXSxcbiAgICBbLyhbXmNoXVtpZW9dW2xuXSlleSQvaSwgJyQxaWVzJ10sXG4gICAgWy8oeHxjaHxzc3xzaHx6eikkL2ksICckMWVzJ10sXG4gICAgWy8obWF0cnxjb2R8bXVyfHNpbHx2ZXJ0fGluZHxhcHBlbmQpKD86aXh8ZXgpJC9pLCAnJDFpY2VzJ10sXG4gICAgWy8obXxsKSg/OmljZXxvdXNlKSQvaSwgJyQxaWNlJ10sXG4gICAgWy8ocGUpKD86cnNvbnxvcGxlKSQvaSwgJyQxb3BsZSddLFxuICAgIFsvKGNoaWxkKSg/OnJlbik/JC9pLCAnJDFyZW4nXSxcbiAgICBbL2VhdXgkL2ksICckMCddLFxuICAgIFsvbVthZV1uJC9pLCAnbWVuJ11cbiAgXS5mb3JFYWNoKGZ1bmN0aW9uIChydWxlKSB7XG4gICAgcmV0dXJuIHBsdXJhbGl6ZS5hZGRQbHVyYWxSdWxlKHJ1bGVbMF0sIHJ1bGVbMV0pO1xuICB9KTtcblxuICAvKipcbiAgICogU2luZ3VsYXJpemF0aW9uIHJ1bGVzLlxuICAgKi9cbiAgW1xuICAgIFsvcyQvaSwgJyddLFxuICAgIFsvKHNzKSQvaSwgJyQxJ10sXG4gICAgWy8oKGEpbmFseXwoYilhfChkKWlhZ25vfChwKWFyZW50aGV8KHApcm9nbm98KHMpeW5vcHwodCloZSkoPzpzaXN8c2VzKSQvaSwgJyQxc2lzJ10sXG4gICAgWy8oXmFuYWx5KSg/OnNpc3xzZXMpJC9pLCAnJDFzaXMnXSxcbiAgICBbLyhbXmFlZmxvcl0pdmVzJC9pLCAnJDFmZSddLFxuICAgIFsvKGhpdmV8dGl2ZXxkcj9pdmUpcyQvaSwgJyQxJ10sXG4gICAgWy8oYXJ8KD86d298W2FlXSlsfFtlb11bYW9dKXZlcyQvaSwgJyQxZiddLFxuICAgIFsvKFteYWVpb3V5XXxxdSlpZXMkL2ksICckMXknXSxcbiAgICBbLyheW3BsXXx6b21ifF4oPzpuZWNrKT90fFthZW9dW2x0XXxjdXQpaWVzJC9pLCAnJDFpZSddLFxuICAgIFsvKFteY11bZW9yXW58c21pbClpZXMkL2ksICckMWV5J10sXG4gICAgWy8obXxsKWljZSQvaSwgJyQxb3VzZSddLFxuICAgIFsvKHNlcmFwaHxjaGVydWIpaW0kL2ksICckMSddLFxuICAgIFsvKHh8Y2h8c3N8c2h8enp8dHRvfGdvfGNob3xhbGlhc3xbXmFvdV11c3x0bGFzfGdhc3woPzpoZXJ8YXR8Z3Ipb3xyaXMpKD86ZXMpPyQvaSwgJyQxJ10sXG4gICAgWy8oZVttbl11KXM/JC9pLCAnJDEnXSxcbiAgICBbLyhtb3ZpZXx0d2VsdmUpcyQvaSwgJyQxJ10sXG4gICAgWy8oY3Jpc3x0ZXN0fGRpYWdub3MpKD86aXN8ZXMpJC9pLCAnJDFpcyddLFxuICAgIFsvKGFsdW1ufHN5bGxhYnxvY3RvcHx2aXJ8cmFkaXxudWNsZXxmdW5nfGNhY3R8c3RpbXVsfHRlcm1pbnxiYWNpbGx8Zm9jfHV0ZXJ8bG9jfHN0cmF0KSg/OnVzfGkpJC9pLCAnJDF1cyddLFxuICAgIFsvKGFnZW5kfGFkZGVuZHxtaWxsZW5uaXxkYXR8ZXh0cmVtfGJhY3Rlcml8ZGVzaWRlcmF0fHN0cmF0fGNhbmRlbGFicnxlcnJhdHxvdnxzeW1wb3NpfGN1cnJpY3VsfGF1dG9tYXR8cXVvcilhJC9pLCAnJDF1bSddLFxuICAgIFsvKGFwaGVsaXxoeXBlcmJhdHxwZXJpaGVsaXxhc3luZGV0fG5vdW1lbnxwaGVub21lbnxjcml0ZXJpfG9yZ2FufHByb2xlZ29tZW58XFx3K2hlZHIpYSQvaSwgJyQxb24nXSxcbiAgICBbLyhhbHVtbnxhbGd8dmVydGVicilhZSQvaSwgJyQxYSddLFxuICAgIFsvKGNvZHxtdXJ8c2lsfHZlcnR8aW5kKWljZXMkL2ksICckMWV4J10sXG4gICAgWy8obWF0cnxhcHBlbmQpaWNlcyQvaSwgJyQxaXgnXSxcbiAgICBbLyhwZSkocnNvbnxvcGxlKSQvaSwgJyQxcnNvbiddLFxuICAgIFsvKGNoaWxkKXJlbiQvaSwgJyQxJ10sXG4gICAgWy8oZWF1KXg/JC9pLCAnJDEnXSxcbiAgICBbL21lbiQvaSwgJ21hbiddXG4gIF0uZm9yRWFjaChmdW5jdGlvbiAocnVsZSkge1xuICAgIHJldHVybiBwbHVyYWxpemUuYWRkU2luZ3VsYXJSdWxlKHJ1bGVbMF0sIHJ1bGVbMV0pO1xuICB9KTtcblxuICAvKipcbiAgICogVW5jb3VudGFibGUgcnVsZXMuXG4gICAqL1xuICBbXG4gICAgLy8gU2luZ3VsYXIgd29yZHMgd2l0aCBubyBwbHVyYWxzLlxuICAgICdhZHZpY2UnLFxuICAgICdhZ2VuZGEnLFxuICAgICdiaXNvbicsXG4gICAgJ2JyZWFtJyxcbiAgICAnYnVmZmFsbycsXG4gICAgJ2NhcnAnLFxuICAgICdjaGFzc2lzJyxcbiAgICAnY29kJyxcbiAgICAnY29vcGVyYXRpb24nLFxuICAgICdjb3JwcycsXG4gICAgJ2RpZ2VzdGlvbicsXG4gICAgJ2RlYnJpcycsXG4gICAgJ2RpYWJldGVzJyxcbiAgICAnZW5lcmd5JyxcbiAgICAnZXF1aXBtZW50JyxcbiAgICAnZWxrJyxcbiAgICAnZXhjcmV0aW9uJyxcbiAgICAnZXhwZXJ0aXNlJyxcbiAgICAnZmxvdW5kZXInLFxuICAgICdnYWxsb3dzJyxcbiAgICAnZ3JhZmZpdGknLFxuICAgICdoZWFkcXVhcnRlcnMnLFxuICAgICdoZWFsdGgnLFxuICAgICdoZXJwZXMnLFxuICAgICdoaWdoamlua3MnLFxuICAgICdob21ld29yaycsXG4gICAgJ2luZm9ybWF0aW9uJyxcbiAgICAnamVhbnMnLFxuICAgICdqdXN0aWNlJyxcbiAgICAna3Vkb3MnLFxuICAgICdsYWJvdXInLFxuICAgICdtYWNoaW5lcnknLFxuICAgICdtYWNrZXJlbCcsXG4gICAgJ21lZGlhJyxcbiAgICAnbWV3cycsXG4gICAgJ21vb3NlJyxcbiAgICAnbmV3cycsXG4gICAgJ3Bpa2UnLFxuICAgICdwbGFua3RvbicsXG4gICAgJ3BsaWVycycsXG4gICAgJ3BvbGx1dGlvbicsXG4gICAgJ3ByZW1pc2VzJyxcbiAgICAncmFpbicsXG4gICAgJ3JpY2UnLFxuICAgICdzYWxtb24nLFxuICAgICdzY2lzc29ycycsXG4gICAgJ3NlcmllcycsXG4gICAgJ3Nld2FnZScsXG4gICAgJ3NoYW1ibGVzJyxcbiAgICAnc2hyaW1wJyxcbiAgICAnc3BlY2llcycsXG4gICAgJ3N0YWZmJyxcbiAgICAnc3dpbmUnLFxuICAgICd0cm91dCcsXG4gICAgJ3R1bmEnLFxuICAgICd3aGl0aW5nJyxcbiAgICAnd2lsZGViZWVzdCcsXG4gICAgJ3dpbGRsaWZlJyxcbiAgICAvLyBSZWdleGVzLlxuICAgIC9wb3gkL2ksIC8vIFwiY2hpY2twb3hcIiwgXCJzbWFsbHBveFwiXG4gICAgL29pcyQvaSxcbiAgICAvZGVlciQvaSwgLy8gXCJkZWVyXCIsIFwicmVpbmRlZXJcIlxuICAgIC9maXNoJC9pLCAvLyBcImZpc2hcIiwgXCJibG93ZmlzaFwiLCBcImFuZ2VsZmlzaFwiXG4gICAgL3NoZWVwJC9pLFxuICAgIC9tZWFzbGVzJC9pLFxuICAgIC9bXmFlaW91XWVzZSQvaSAvLyBcImNoaW5lc2VcIiwgXCJqYXBhbmVzZVwiXG4gIF0uZm9yRWFjaChwbHVyYWxpemUuYWRkVW5jb3VudGFibGVSdWxlKTtcblxuICByZXR1cm4gcGx1cmFsaXplO1xufSk7XG4iLCJ2YXIgRGF0YVNldCA9IHJlcXVpcmUoXCJkYXRhLXNldFwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IERhdGFTZXRIb29rO1xuXG5mdW5jdGlvbiBEYXRhU2V0SG9vayh2YWx1ZSkge1xuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBEYXRhU2V0SG9vaykpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBEYXRhU2V0SG9vayh2YWx1ZSk7XG4gICAgfVxuXG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xufVxuXG5EYXRhU2V0SG9vay5wcm90b3R5cGUuaG9vayA9IGZ1bmN0aW9uIChub2RlLCBwcm9wZXJ0eU5hbWUpIHtcbiAgICB2YXIgZHMgPSBEYXRhU2V0KG5vZGUpXG4gICAgdmFyIHByb3BOYW1lID0gcHJvcGVydHlOYW1lLnN1YnN0cig1KVxuXG4gICAgZHNbcHJvcE5hbWVdID0gdGhpcy52YWx1ZTtcbn07XG4iLCJ2YXIgRGF0YVNldCA9IHJlcXVpcmUoXCJkYXRhLXNldFwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IERhdGFTZXRIb29rO1xuXG5mdW5jdGlvbiBEYXRhU2V0SG9vayh2YWx1ZSkge1xuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBEYXRhU2V0SG9vaykpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBEYXRhU2V0SG9vayh2YWx1ZSk7XG4gICAgfVxuXG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xufVxuXG5EYXRhU2V0SG9vay5wcm90b3R5cGUuaG9vayA9IGZ1bmN0aW9uIChub2RlLCBwcm9wZXJ0eU5hbWUpIHtcbiAgICB2YXIgZHMgPSBEYXRhU2V0KG5vZGUpXG4gICAgdmFyIHByb3BOYW1lID0gcHJvcGVydHlOYW1lLnN1YnN0cigzKVxuXG4gICAgZHNbcHJvcE5hbWVdID0gdGhpcy52YWx1ZTtcbn07XG5cbkRhdGFTZXRIb29rLnByb3RvdHlwZS51bmhvb2sgPSBmdW5jdGlvbihub2RlLCBwcm9wZXJ0eU5hbWUpIHtcbiAgICB2YXIgZHMgPSBEYXRhU2V0KG5vZGUpO1xuICAgIHZhciBwcm9wTmFtZSA9IHByb3BlcnR5TmFtZS5zdWJzdHIoMyk7XG5cbiAgICBkc1twcm9wTmFtZV0gPSB1bmRlZmluZWQ7XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IFNvZnRTZXRIb29rO1xuXG5mdW5jdGlvbiBTb2Z0U2V0SG9vayh2YWx1ZSkge1xuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBTb2Z0U2V0SG9vaykpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBTb2Z0U2V0SG9vayh2YWx1ZSk7XG4gICAgfVxuXG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xufVxuXG5Tb2Z0U2V0SG9vay5wcm90b3R5cGUuaG9vayA9IGZ1bmN0aW9uIChub2RlLCBwcm9wZXJ0eU5hbWUpIHtcbiAgICBpZiAobm9kZVtwcm9wZXJ0eU5hbWVdICE9PSB0aGlzLnZhbHVlKSB7XG4gICAgICAgIG5vZGVbcHJvcGVydHlOYW1lXSA9IHRoaXMudmFsdWU7XG4gICAgfVxufTtcbiIsInZhciBUeXBlZEVycm9yID0gcmVxdWlyZShcImVycm9yL3R5cGVkXCIpXG5cbnZhciBWTm9kZSA9IHJlcXVpcmUoXCJ2dHJlZS92bm9kZS5qc1wiKVxudmFyIFZUZXh0ID0gcmVxdWlyZShcInZ0cmVlL3Z0ZXh0LmpzXCIpXG52YXIgaXNWTm9kZSA9IHJlcXVpcmUoXCJ2dHJlZS9pcy12bm9kZVwiKVxudmFyIGlzVlRleHQgPSByZXF1aXJlKFwidnRyZWUvaXMtdnRleHRcIilcbnZhciBpc1dpZGdldCA9IHJlcXVpcmUoXCJ2dHJlZS9pcy13aWRnZXRcIilcbnZhciBpc0hvb2sgPSByZXF1aXJlKFwidnRyZWUvaXMtdmhvb2tcIilcbnZhciBpc1ZUaHVuayA9IHJlcXVpcmUoXCJ2dHJlZS9pcy10aHVua1wiKVxuXG52YXIgcGFyc2VUYWcgPSByZXF1aXJlKFwiLi9wYXJzZS10YWcuanNcIilcbnZhciBzb2Z0U2V0SG9vayA9IHJlcXVpcmUoXCIuL2hvb2tzL3NvZnQtc2V0LWhvb2suanNcIilcbnZhciBkYXRhU2V0SG9vayA9IHJlcXVpcmUoXCIuL2hvb2tzL2RhdGEtc2V0LWhvb2suanNcIilcbnZhciBldkhvb2sgPSByZXF1aXJlKFwiLi9ob29rcy9ldi1ob29rLmpzXCIpXG5cbnZhciBVbmV4cGVjdGVkVmlydHVhbEVsZW1lbnQgPSBUeXBlZEVycm9yKHtcbiAgICB0eXBlOiBcInZpcnR1YWwtaHlwZXJzY3JpcHQudW5leHBlY3RlZC52aXJ0dWFsLWVsZW1lbnRcIixcbiAgICBtZXNzYWdlOiBcIlVuZXhwZWN0ZWQgdmlydHVhbCBjaGlsZCBwYXNzZWQgdG8gaCgpLlxcblwiICtcbiAgICAgICAgXCJFeHBlY3RlZCBhIFZOb2RlIC8gVnRodW5rIC8gVldpZGdldCAvIHN0cmluZyBidXQ6XFxuXCIgK1xuICAgICAgICBcImdvdCBhIHtmb3JlaWduT2JqZWN0U3RyfS5cXG5cIiArXG4gICAgICAgIFwiVGhlIHBhcmVudCB2bm9kZSBpcyB7cGFyZW50Vm5vZGVTdHJ9LlxcblwiICtcbiAgICAgICAgXCJTdWdnZXN0ZWQgZml4OiBjaGFuZ2UgeW91ciBgaCguLi4sIFsgLi4uIF0pYCBjYWxsc2l0ZS5cIixcbiAgICBmb3JlaWduT2JqZWN0U3RyOiBudWxsLFxuICAgIHBhcmVudFZub2RlU3RyOiBudWxsLFxuICAgIGZvcmVpZ25PYmplY3Q6IG51bGwsXG4gICAgcGFyZW50Vm5vZGU6IG51bGxcbn0pXG5cbm1vZHVsZS5leHBvcnRzID0gaFxuXG5mdW5jdGlvbiBoKHRhZ05hbWUsIHByb3BlcnRpZXMsIGNoaWxkcmVuKSB7XG4gICAgdmFyIGNoaWxkTm9kZXMgPSBbXVxuICAgIHZhciB0YWcsIHByb3BzLCBrZXksIG5hbWVzcGFjZVxuXG4gICAgaWYgKCFjaGlsZHJlbiAmJiBpc0NoaWxkcmVuKHByb3BlcnRpZXMpKSB7XG4gICAgICAgIGNoaWxkcmVuID0gcHJvcGVydGllc1xuICAgICAgICBwcm9wcyA9IHt9XG4gICAgfVxuXG4gICAgcHJvcHMgPSBwcm9wcyB8fCBwcm9wZXJ0aWVzIHx8IHt9XG4gICAgdGFnID0gcGFyc2VUYWcodGFnTmFtZSwgcHJvcHMpXG5cbiAgICAvLyBzdXBwb3J0IGtleXNcbiAgICBpZiAoXCJrZXlcIiBpbiBwcm9wcykge1xuICAgICAgICBrZXkgPSBwcm9wcy5rZXlcbiAgICAgICAgcHJvcHMua2V5ID0gdW5kZWZpbmVkXG4gICAgfVxuXG4gICAgLy8gc3VwcG9ydCBuYW1lc3BhY2VcbiAgICBpZiAoXCJuYW1lc3BhY2VcIiBpbiBwcm9wcykge1xuICAgICAgICBuYW1lc3BhY2UgPSBwcm9wcy5uYW1lc3BhY2VcbiAgICAgICAgcHJvcHMubmFtZXNwYWNlID0gdW5kZWZpbmVkXG4gICAgfVxuXG4gICAgLy8gZml4IGN1cnNvciBidWdcbiAgICBpZiAodGFnID09PSBcImlucHV0XCIgJiZcbiAgICAgICAgXCJ2YWx1ZVwiIGluIHByb3BzICYmXG4gICAgICAgIHByb3BzLnZhbHVlICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgIWlzSG9vayhwcm9wcy52YWx1ZSlcbiAgICApIHtcbiAgICAgICAgcHJvcHMudmFsdWUgPSBzb2Z0U2V0SG9vayhwcm9wcy52YWx1ZSlcbiAgICB9XG5cbiAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHByb3BzKVxuICAgIHZhciBwcm9wTmFtZSwgdmFsdWVcbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IGtleXMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgcHJvcE5hbWUgPSBrZXlzW2pdXG4gICAgICAgIHZhbHVlID0gcHJvcHNbcHJvcE5hbWVdXG4gICAgICAgIGlmIChpc0hvb2sodmFsdWUpKSB7XG4gICAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gYWRkIGRhdGEtZm9vIHN1cHBvcnRcbiAgICAgICAgaWYgKHByb3BOYW1lLnN1YnN0cigwLCA1KSA9PT0gXCJkYXRhLVwiKSB7XG4gICAgICAgICAgICBwcm9wc1twcm9wTmFtZV0gPSBkYXRhU2V0SG9vayh2YWx1ZSlcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFkZCBldi1mb28gc3VwcG9ydFxuICAgICAgICBpZiAocHJvcE5hbWUuc3Vic3RyKDAsIDMpID09PSBcImV2LVwiKSB7XG4gICAgICAgICAgICBwcm9wc1twcm9wTmFtZV0gPSBldkhvb2sodmFsdWUpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoY2hpbGRyZW4gIT09IHVuZGVmaW5lZCAmJiBjaGlsZHJlbiAhPT0gbnVsbCkge1xuICAgICAgICBhZGRDaGlsZChjaGlsZHJlbiwgY2hpbGROb2RlcywgdGFnLCBwcm9wcylcbiAgICB9XG5cblxuICAgIHZhciBub2RlID0gbmV3IFZOb2RlKHRhZywgcHJvcHMsIGNoaWxkTm9kZXMsIGtleSwgbmFtZXNwYWNlKVxuXG4gICAgcmV0dXJuIG5vZGVcbn1cblxuZnVuY3Rpb24gYWRkQ2hpbGQoYywgY2hpbGROb2RlcywgdGFnLCBwcm9wcykge1xuICAgIGlmICh0eXBlb2YgYyA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICBjaGlsZE5vZGVzLnB1c2gobmV3IFZUZXh0KGMpKVxuICAgIH0gZWxzZSBpZiAoaXNDaGlsZChjKSkge1xuICAgICAgICBjaGlsZE5vZGVzLnB1c2goYylcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoYykpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhZGRDaGlsZChjW2ldLCBjaGlsZE5vZGVzLCB0YWcsIHByb3BzKVxuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChjID09PSBudWxsIHx8IGMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm5cbiAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBVbmV4cGVjdGVkVmlydHVhbEVsZW1lbnQoe1xuICAgICAgICAgICAgZm9yZWlnbk9iamVjdFN0cjogSlNPTi5zdHJpbmdpZnkoYyksXG4gICAgICAgICAgICBmb3JlaWduT2JqZWN0OiBjLFxuICAgICAgICAgICAgcGFyZW50Vm5vZGVTdHI6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICB0YWdOYW1lOiB0YWcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczogcHJvcHNcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgcGFyZW50Vm5vZGU6IHtcbiAgICAgICAgICAgICAgICB0YWdOYW1lOiB0YWcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczogcHJvcHNcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGlzQ2hpbGQoeCkge1xuICAgIHJldHVybiBpc1ZOb2RlKHgpIHx8IGlzVlRleHQoeCkgfHwgaXNXaWRnZXQoeCkgfHwgaXNWVGh1bmsoeClcbn1cblxuZnVuY3Rpb24gaXNDaGlsZHJlbih4KSB7XG4gICAgcmV0dXJuIHR5cGVvZiB4ID09PSBcInN0cmluZ1wiIHx8IEFycmF5LmlzQXJyYXkoeCkgfHwgaXNDaGlsZCh4KVxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVIYXNoXG5cbmZ1bmN0aW9uIGNyZWF0ZUhhc2goZWxlbSkge1xuICAgIHZhciBhdHRyaWJ1dGVzID0gZWxlbS5hdHRyaWJ1dGVzXG4gICAgdmFyIGhhc2ggPSB7fVxuXG4gICAgaWYgKGF0dHJpYnV0ZXMgPT09IG51bGwgfHwgYXR0cmlidXRlcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiBoYXNoXG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhdHRyaWJ1dGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBhdHRyID0gYXR0cmlidXRlc1tpXVxuXG4gICAgICAgIGlmIChhdHRyLm5hbWUuc3Vic3RyKDAsNSkgIT09IFwiZGF0YS1cIikge1xuICAgICAgICAgICAgY29udGludWVcbiAgICAgICAgfVxuXG4gICAgICAgIGhhc2hbYXR0ci5uYW1lLnN1YnN0cig1KV0gPSBhdHRyLnZhbHVlXG4gICAgfVxuXG4gICAgcmV0dXJuIGhhc2hcbn1cbiIsInZhciBjcmVhdGVTdG9yZSA9IHJlcXVpcmUoXCJ3ZWFrbWFwLXNoaW0vY3JlYXRlLXN0b3JlXCIpXG52YXIgSW5kaXZpZHVhbCA9IHJlcXVpcmUoXCJpbmRpdmlkdWFsXCIpXG5cbnZhciBjcmVhdGVIYXNoID0gcmVxdWlyZShcIi4vY3JlYXRlLWhhc2guanNcIilcblxudmFyIGhhc2hTdG9yZSA9IEluZGl2aWR1YWwoXCJfX0RBVEFfU0VUX1dFQUtNQVBAM1wiLCBjcmVhdGVTdG9yZSgpKVxuXG5tb2R1bGUuZXhwb3J0cyA9IERhdGFTZXRcblxuZnVuY3Rpb24gRGF0YVNldChlbGVtKSB7XG4gICAgdmFyIHN0b3JlID0gaGFzaFN0b3JlKGVsZW0pXG5cbiAgICBpZiAoIXN0b3JlLmhhc2gpIHtcbiAgICAgICAgc3RvcmUuaGFzaCA9IGNyZWF0ZUhhc2goZWxlbSlcbiAgICB9XG5cbiAgICByZXR1cm4gc3RvcmUuaGFzaFxufVxuIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xudmFyIHJvb3QgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyA/XG4gICAgd2luZG93IDogdHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcgP1xuICAgIGdsb2JhbCA6IHt9O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEluZGl2aWR1YWxcblxuZnVuY3Rpb24gSW5kaXZpZHVhbChrZXksIHZhbHVlKSB7XG4gICAgaWYgKHJvb3Rba2V5XSkge1xuICAgICAgICByZXR1cm4gcm9vdFtrZXldXG4gICAgfVxuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHJvb3QsIGtleSwge1xuICAgICAgICB2YWx1ZTogdmFsdWVcbiAgICAgICAgLCBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KVxuXG4gICAgcmV0dXJuIHZhbHVlXG59XG5cbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KSIsInZhciBoaWRkZW5TdG9yZSA9IHJlcXVpcmUoJy4vaGlkZGVuLXN0b3JlLmpzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlU3RvcmU7XG5cbmZ1bmN0aW9uIGNyZWF0ZVN0b3JlKCkge1xuICAgIHZhciBrZXkgPSB7fTtcblxuICAgIHJldHVybiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygb2JqICE9PSAnb2JqZWN0JyB8fCBvYmogPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignV2Vha21hcC1zaGltOiBLZXkgbXVzdCBiZSBvYmplY3QnKVxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHN0b3JlID0gb2JqLnZhbHVlT2Yoa2V5KTtcbiAgICAgICAgcmV0dXJuIHN0b3JlICYmIHN0b3JlLmlkZW50aXR5ID09PSBrZXkgP1xuICAgICAgICAgICAgc3RvcmUgOiBoaWRkZW5TdG9yZShvYmosIGtleSk7XG4gICAgfTtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gaGlkZGVuU3RvcmU7XG5cbmZ1bmN0aW9uIGhpZGRlblN0b3JlKG9iaiwga2V5KSB7XG4gICAgdmFyIHN0b3JlID0geyBpZGVudGl0eToga2V5IH07XG4gICAgdmFyIHZhbHVlT2YgPSBvYmoudmFsdWVPZjtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIFwidmFsdWVPZlwiLCB7XG4gICAgICAgIHZhbHVlOiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIHJldHVybiB2YWx1ZSAhPT0ga2V5ID9cbiAgICAgICAgICAgICAgICB2YWx1ZU9mLmFwcGx5KHRoaXMsIGFyZ3VtZW50cykgOiBzdG9yZTtcbiAgICAgICAgfSxcbiAgICAgICAgd3JpdGFibGU6IHRydWVcbiAgICB9KTtcblxuICAgIHJldHVybiBzdG9yZTtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgaWYgKHR5cGVvZiBvYmogPT09ICdzdHJpbmcnKSByZXR1cm4gY2FtZWxDYXNlKG9iaik7XG4gICAgcmV0dXJuIHdhbGsob2JqKTtcbn07XG5cbmZ1bmN0aW9uIHdhbGsgKG9iaikge1xuICAgIGlmICghb2JqIHx8IHR5cGVvZiBvYmogIT09ICdvYmplY3QnKSByZXR1cm4gb2JqO1xuICAgIGlmIChpc0RhdGUob2JqKSB8fCBpc1JlZ2V4KG9iaikpIHJldHVybiBvYmo7XG4gICAgaWYgKGlzQXJyYXkob2JqKSkgcmV0dXJuIG1hcChvYmosIHdhbGspO1xuICAgIHJldHVybiByZWR1Y2Uob2JqZWN0S2V5cyhvYmopLCBmdW5jdGlvbiAoYWNjLCBrZXkpIHtcbiAgICAgICAgdmFyIGNhbWVsID0gY2FtZWxDYXNlKGtleSk7XG4gICAgICAgIGFjY1tjYW1lbF0gPSB3YWxrKG9ialtrZXldKTtcbiAgICAgICAgcmV0dXJuIGFjYztcbiAgICB9LCB7fSk7XG59XG5cbmZ1bmN0aW9uIGNhbWVsQ2FzZShzdHIpIHtcbiAgICByZXR1cm4gc3RyLnJlcGxhY2UoL1tfLi1dKFxcd3wkKS9nLCBmdW5jdGlvbiAoXyx4KSB7XG4gICAgICAgIHJldHVybiB4LnRvVXBwZXJDYXNlKCk7XG4gICAgfSk7XG59XG5cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAob2JqKSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopID09PSAnW29iamVjdCBBcnJheV0nO1xufTtcblxudmFyIGlzRGF0ZSA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikgPT09ICdbb2JqZWN0IERhdGVdJztcbn07XG5cbnZhciBpc1JlZ2V4ID0gZnVuY3Rpb24gKG9iaikge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSA9PT0gJ1tvYmplY3QgUmVnRXhwXSc7XG59O1xuXG52YXIgaGFzID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcbnZhciBvYmplY3RLZXlzID0gT2JqZWN0LmtleXMgfHwgZnVuY3Rpb24gKG9iaikge1xuICAgIHZhciBrZXlzID0gW107XG4gICAgZm9yICh2YXIga2V5IGluIG9iaikge1xuICAgICAgICBpZiAoaGFzLmNhbGwob2JqLCBrZXkpKSBrZXlzLnB1c2goa2V5KTtcbiAgICB9XG4gICAgcmV0dXJuIGtleXM7XG59O1xuXG5mdW5jdGlvbiBtYXAgKHhzLCBmKSB7XG4gICAgaWYgKHhzLm1hcCkgcmV0dXJuIHhzLm1hcChmKTtcbiAgICB2YXIgcmVzID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB4cy5sZW5ndGg7IGkrKykge1xuICAgICAgICByZXMucHVzaChmKHhzW2ldLCBpKSk7XG4gICAgfVxuICAgIHJldHVybiByZXM7XG59XG5cbmZ1bmN0aW9uIHJlZHVjZSAoeHMsIGYsIGFjYykge1xuICAgIGlmICh4cy5yZWR1Y2UpIHJldHVybiB4cy5yZWR1Y2UoZiwgYWNjKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHhzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGFjYyA9IGYoYWNjLCB4c1tpXSwgaSk7XG4gICAgfVxuICAgIHJldHVybiBhY2M7XG59XG4iLCJ2YXIgbmFyZ3MgPSAvXFx7KFswLTlhLXpBLVpdKylcXH0vZ1xudmFyIHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlXG5cbm1vZHVsZS5leHBvcnRzID0gdGVtcGxhdGVcblxuZnVuY3Rpb24gdGVtcGxhdGUoc3RyaW5nKSB7XG4gICAgdmFyIGFyZ3NcblxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAyICYmIHR5cGVvZiBhcmd1bWVudHNbMV0gPT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgYXJncyA9IGFyZ3VtZW50c1sxXVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSlcbiAgICB9XG5cbiAgICBpZiAoIWFyZ3MgfHwgIWFyZ3MuaGFzT3duUHJvcGVydHkpIHtcbiAgICAgICAgYXJncyA9IHt9XG4gICAgfVxuXG4gICAgcmV0dXJuIHN0cmluZy5yZXBsYWNlKG5hcmdzLCBmdW5jdGlvbiByZXBsYWNlQXJnKG1hdGNoLCBpLCBpbmRleCkge1xuICAgICAgICB2YXIgcmVzdWx0XG5cbiAgICAgICAgaWYgKHN0cmluZ1tpbmRleCAtIDFdID09PSBcIntcIiAmJlxuICAgICAgICAgICAgc3RyaW5nW2luZGV4ICsgbWF0Y2gubGVuZ3RoXSA9PT0gXCJ9XCIpIHtcbiAgICAgICAgICAgIHJldHVybiBpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQgPSBhcmdzLmhhc093blByb3BlcnR5KGkpID8gYXJnc1tpXSA6IG51bGxcbiAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IG51bGwgfHwgcmVzdWx0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gXCJcIlxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0XG4gICAgICAgIH1cbiAgICB9KVxufVxuIiwidmFyIGNhbWVsaXplID0gcmVxdWlyZShcImNhbWVsaXplXCIpXG52YXIgdGVtcGxhdGUgPSByZXF1aXJlKFwic3RyaW5nLXRlbXBsYXRlXCIpXG52YXIgZXh0ZW5kID0gcmVxdWlyZShcInh0ZW5kL211dGFibGVcIilcblxubW9kdWxlLmV4cG9ydHMgPSBUeXBlZEVycm9yXG5cbmZ1bmN0aW9uIFR5cGVkRXJyb3IoYXJncykge1xuICAgIGlmICghYXJncykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJhcmdzIGlzIHJlcXVpcmVkXCIpO1xuICAgIH1cbiAgICBpZiAoIWFyZ3MudHlwZSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJhcmdzLnR5cGUgaXMgcmVxdWlyZWRcIik7XG4gICAgfVxuICAgIGlmICghYXJncy5tZXNzYWdlKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImFyZ3MubWVzc2FnZSBpcyByZXF1aXJlZFwiKTtcbiAgICB9XG5cbiAgICB2YXIgbWVzc2FnZSA9IGFyZ3MubWVzc2FnZVxuXG4gICAgaWYgKGFyZ3MudHlwZSAmJiAhYXJncy5uYW1lKSB7XG4gICAgICAgIHZhciBlcnJvck5hbWUgPSBjYW1lbGl6ZShhcmdzLnR5cGUpICsgXCJFcnJvclwiXG4gICAgICAgIGFyZ3MubmFtZSA9IGVycm9yTmFtZVswXS50b1VwcGVyQ2FzZSgpICsgZXJyb3JOYW1lLnN1YnN0cigxKVxuICAgIH1cblxuICAgIGNyZWF0ZUVycm9yLnR5cGUgPSBhcmdzLnR5cGU7XG4gICAgY3JlYXRlRXJyb3IuX25hbWUgPSBhcmdzLm5hbWU7XG5cbiAgICByZXR1cm4gY3JlYXRlRXJyb3I7XG5cbiAgICBmdW5jdGlvbiBjcmVhdGVFcnJvcihvcHRzKSB7XG4gICAgICAgIHZhciByZXN1bHQgPSBuZXcgRXJyb3IoKVxuXG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShyZXN1bHQsIFwidHlwZVwiLCB7XG4gICAgICAgICAgICB2YWx1ZTogcmVzdWx0LnR5cGUsXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgICAgfSlcblxuICAgICAgICB2YXIgb3B0aW9ucyA9IGV4dGVuZCh7fSwgYXJncywgb3B0cylcblxuICAgICAgICBleHRlbmQocmVzdWx0LCBvcHRpb25zKVxuICAgICAgICByZXN1bHQubWVzc2FnZSA9IHRlbXBsYXRlKG1lc3NhZ2UsIG9wdGlvbnMpXG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdFxuICAgIH1cbn1cblxuIiwidmFyIHZlcnNpb24gPSByZXF1aXJlKFwiLi92ZXJzaW9uXCIpXG52YXIgaXNWTm9kZSA9IHJlcXVpcmUoXCIuL2lzLXZub2RlXCIpXG52YXIgaXNXaWRnZXQgPSByZXF1aXJlKFwiLi9pcy13aWRnZXRcIilcbnZhciBpc1ZIb29rID0gcmVxdWlyZShcIi4vaXMtdmhvb2tcIilcblxubW9kdWxlLmV4cG9ydHMgPSBWaXJ0dWFsTm9kZVxuXG52YXIgbm9Qcm9wZXJ0aWVzID0ge31cbnZhciBub0NoaWxkcmVuID0gW11cblxuZnVuY3Rpb24gVmlydHVhbE5vZGUodGFnTmFtZSwgcHJvcGVydGllcywgY2hpbGRyZW4sIGtleSwgbmFtZXNwYWNlKSB7XG4gICAgdGhpcy50YWdOYW1lID0gdGFnTmFtZVxuICAgIHRoaXMucHJvcGVydGllcyA9IHByb3BlcnRpZXMgfHwgbm9Qcm9wZXJ0aWVzXG4gICAgdGhpcy5jaGlsZHJlbiA9IGNoaWxkcmVuIHx8IG5vQ2hpbGRyZW5cbiAgICB0aGlzLmtleSA9IGtleSAhPSBudWxsID8gU3RyaW5nKGtleSkgOiB1bmRlZmluZWRcbiAgICB0aGlzLm5hbWVzcGFjZSA9ICh0eXBlb2YgbmFtZXNwYWNlID09PSBcInN0cmluZ1wiKSA/IG5hbWVzcGFjZSA6IG51bGxcblxuICAgIHZhciBjb3VudCA9IChjaGlsZHJlbiAmJiBjaGlsZHJlbi5sZW5ndGgpIHx8IDBcbiAgICB2YXIgZGVzY2VuZGFudHMgPSAwXG4gICAgdmFyIGhhc1dpZGdldHMgPSBmYWxzZVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICAgIHZhciBjaGlsZCA9IGNoaWxkcmVuW2ldXG4gICAgICAgIGlmIChpc1ZOb2RlKGNoaWxkKSkge1xuICAgICAgICAgICAgZGVzY2VuZGFudHMgKz0gY2hpbGQuY291bnQgfHwgMFxuXG4gICAgICAgICAgICBpZiAoIWhhc1dpZGdldHMgJiYgY2hpbGQuaGFzV2lkZ2V0cykge1xuICAgICAgICAgICAgICAgIGhhc1dpZGdldHMgPSB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoIWhhc1dpZGdldHMgJiYgaXNXaWRnZXQoY2hpbGQpKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGNoaWxkLmRlc3Ryb3kgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgIGhhc1dpZGdldHMgPSB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmNvdW50ID0gY291bnQgKyBkZXNjZW5kYW50c1xuICAgIHRoaXMuaGFzV2lkZ2V0cyA9IGhhc1dpZGdldHNcbn1cblxuVmlydHVhbE5vZGUucHJvdG90eXBlLnZlcnNpb24gPSB2ZXJzaW9uXG5WaXJ0dWFsTm9kZS5wcm90b3R5cGUudHlwZSA9IFwiVmlydHVhbE5vZGVcIlxuIiwidmFyIHZlcnNpb24gPSByZXF1aXJlKFwiLi92ZXJzaW9uXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gVmlydHVhbFRleHRcblxuZnVuY3Rpb24gVmlydHVhbFRleHQodGV4dCkge1xuICAgIHRoaXMudGV4dCA9IFN0cmluZyh0ZXh0KVxufVxuXG5WaXJ0dWFsVGV4dC5wcm90b3R5cGUudmVyc2lvbiA9IHZlcnNpb25cblZpcnR1YWxUZXh0LnByb3RvdHlwZS50eXBlID0gXCJWaXJ0dWFsVGV4dFwiXG4iLCJ2YXIgY2xhc3NJZFNwbGl0ID0gLyhbXFwuI10/W2EtekEtWjAtOV86LV0rKS9cbnZhciBub3RDbGFzc0lkID0gL15cXC58Iy9cblxubW9kdWxlLmV4cG9ydHMgPSBwYXJzZVRhZ1xuXG5mdW5jdGlvbiBwYXJzZVRhZyh0YWcsIHByb3BzKSB7XG4gICAgaWYgKCF0YWcpIHtcbiAgICAgICAgcmV0dXJuIFwiZGl2XCJcbiAgICB9XG5cbiAgICB2YXIgbm9JZCA9ICEoXCJpZFwiIGluIHByb3BzKVxuXG4gICAgdmFyIHRhZ1BhcnRzID0gdGFnLnNwbGl0KGNsYXNzSWRTcGxpdClcbiAgICB2YXIgdGFnTmFtZSA9IG51bGxcblxuICAgIGlmIChub3RDbGFzc0lkLnRlc3QodGFnUGFydHNbMV0pKSB7XG4gICAgICAgIHRhZ05hbWUgPSBcImRpdlwiXG4gICAgfVxuXG4gICAgdmFyIGNsYXNzZXMsIHBhcnQsIHR5cGUsIGlcbiAgICBmb3IgKGkgPSAwOyBpIDwgdGFnUGFydHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcGFydCA9IHRhZ1BhcnRzW2ldXG5cbiAgICAgICAgaWYgKCFwYXJ0KSB7XG4gICAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9XG5cbiAgICAgICAgdHlwZSA9IHBhcnQuY2hhckF0KDApXG5cbiAgICAgICAgaWYgKCF0YWdOYW1lKSB7XG4gICAgICAgICAgICB0YWdOYW1lID0gcGFydFxuICAgICAgICB9IGVsc2UgaWYgKHR5cGUgPT09IFwiLlwiKSB7XG4gICAgICAgICAgICBjbGFzc2VzID0gY2xhc3NlcyB8fCBbXVxuICAgICAgICAgICAgY2xhc3Nlcy5wdXNoKHBhcnQuc3Vic3RyaW5nKDEsIHBhcnQubGVuZ3RoKSlcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlID09PSBcIiNcIiAmJiBub0lkKSB7XG4gICAgICAgICAgICBwcm9wcy5pZCA9IHBhcnQuc3Vic3RyaW5nKDEsIHBhcnQubGVuZ3RoKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGNsYXNzZXMpIHtcbiAgICAgICAgaWYgKHByb3BzLmNsYXNzTmFtZSkge1xuICAgICAgICAgICAgY2xhc3Nlcy5wdXNoKHByb3BzLmNsYXNzTmFtZSlcbiAgICAgICAgfVxuXG4gICAgICAgIHByb3BzLmNsYXNzTmFtZSA9IGNsYXNzZXMuam9pbihcIiBcIilcbiAgICB9XG5cbiAgICByZXR1cm4gdGFnTmFtZSA/IHRhZ05hbWUudG9Mb3dlckNhc2UoKSA6IFwiZGl2XCJcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gZXh0ZW5kXG5cbmZ1bmN0aW9uIGV4dGVuZCgpIHtcbiAgICB2YXIgdGFyZ2V0ID0ge31cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBzb3VyY2UgPSBhcmd1bWVudHNbaV1cblxuICAgICAgICBmb3IgKHZhciBrZXkgaW4gc291cmNlKSB7XG4gICAgICAgICAgICBpZiAoc291cmNlLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRba2V5XSA9IHNvdXJjZVtrZXldXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGFyZ2V0XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGV4dGVuZFxuXG5mdW5jdGlvbiBleHRlbmQodGFyZ2V0KSB7XG4gICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHNvdXJjZSA9IGFyZ3VtZW50c1tpXVxuXG4gICAgICAgIGZvciAodmFyIGtleSBpbiBzb3VyY2UpIHtcbiAgICAgICAgICAgIGlmIChzb3VyY2UuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgIHRhcmdldFtrZXldID0gc291cmNlW2tleV1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0YXJnZXRcbn1cbiIsIid1c2Ugc3RyaWN0J1xuXG57RXZlbnRFbWl0dGVyfSA9IHJlcXVpcmUgJ2V2ZW50cydcblxuY2xhc3MgVG9kb0NvbGxlY3Rpb24gZXh0ZW5kcyBFdmVudEVtaXR0ZXJcblxuICBjb25zdHJ1Y3RvcjogLT5cbiAgICBAdG9kb3MgPSBbXVxuICAgIEBpdGVtVXBkYXRlQ2FsbGJhY2sgPSA9PlxuICAgICAgQHVwZGF0ZSgpXG5cbiAgYWRkOiAodG9kbykgLT5cbiAgICBAdG9kb3MucHVzaCB0b2RvXG4gICAgdG9kby5vbiAndXBkYXRlJywgQGl0ZW1VcGRhdGVDYWxsYmFja1xuICAgIEB1cGRhdGUoKVxuXG4gIHJlbW92ZTogKHRvZG8pIC0+XG4gICAgQHRvZG9zLnNwbGljZSBAdG9kb3MuaW5kZXhPZih0b2RvKSwgMVxuICAgIHRvZG8ucmVtb3ZlTGlzdGVuZXIgJ3VwZGF0ZScsIEBpdGVtVXBkYXRlQ2FsbGJhY2tcbiAgICBAdXBkYXRlKClcblxuICBzZXRDb21wbGV0ZWRBbGw6IChjb21wbGV0ZWQpIC0+XG4gICAgQHRvZG9zLmZvckVhY2ggKHRvZG8pIC0+XG4gICAgICB0b2RvLmlzQ29tcGxldGVkID0gY29tcGxldGVkXG5cbiAgdXBkYXRlOiAtPlxuICAgIEBlbWl0ICd1cGRhdGUnXG5cbm1vZHVsZS5leHBvcnRzID0gbmV3IFRvZG9Db2xsZWN0aW9uKClcbiIsIid1c2Ugc3RyaWN0J1xuXG5Sb3V0ZVZpZXcgPSByZXF1aXJlICcuL3ZpZXdzL1JvdXRlVmlldydcblRvZG9BcHBWaWV3ID0gcmVxdWlyZSAnLi92aWV3cy9Ub2RvQXBwVmlldydcbntNb3VudH0gPSByZXF1aXJlICdkZWNvbXBvc2UnXG5cbnZpZXcgPSBuZXcgUm91dGVWaWV3XG4gIHRvcDogVG9kb0FwcFZpZXdcbiAgcGFyYW1zOlxuICAgIGZpbHRlcjogJydcblxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciAnRE9NQ29udGVudExvYWRlZCcsIC0+XG4gIG5ldyBNb3VudCh2aWV3KS5tb3VudCgnI21haW4nKVxuIiwiJ3VzZSBzdHJpY3QnXG5cbntFdmVudEVtaXR0ZXJ9ID0gcmVxdWlyZSAnZXZlbnRzJ1xuXG5tb2R1bGUuZXhwb3J0cyA9XG5jbGFzcyBPYnNlcnZhYmxlTW9kZWwgZXh0ZW5kcyBFdmVudEVtaXR0ZXJcblxuICBAYXR0cmlidXRlOiAobmFtZSkgLT5cbiAgICBwcml2YXRlTmFtZSA9IFwiXyN7bmFtZX1cIlxuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5IEBwcm90b3R5cGUsIG5hbWUsXG4gICAgICBnZXQ6IC0+IEBbcHJpdmF0ZU5hbWVdXG4gICAgICBzZXQ6ICh2YWx1ZSkgLT5cbiAgICAgICAgaWYgQFtwcml2YXRlTmFtZV0gIT0gdmFsdWVcbiAgICAgICAgICBAW3ByaXZhdGVOYW1lXSA9IHZhbHVlXG4gICAgICAgICAgQGVtaXQgJ3VwZGF0ZSdcbiIsIid1c2Ugc3RyaWN0J1xuXG5hc3NpZ24gPSByZXF1aXJlICd4dGVuZC9tdXRhYmxlJ1xuT2JzZXJ2YWJsZU1vZGVsID0gcmVxdWlyZSAnLi9PYnNlcnZhYmxlTW9kZWwnXG5cbm1vZHVsZS5leHBvcnRzID1cbmNsYXNzIFRvZG8gZXh0ZW5kcyBPYnNlcnZhYmxlTW9kZWxcblxuICBAYXR0cmlidXRlICdpc0NvbXBsZXRlZCdcbiAgQGF0dHJpYnV0ZSAndGV4dCdcblxuICBjb25zdHJ1Y3RvcjogKHBhcmFtcykgLT5cbiAgICBhc3NpZ24gdGhpcywgcGFyYW1zXG4iLCJ7Q29tcG9uZW50fSA9IHJlcXVpcmUgJ2RlY29tcG9zZSdcblRvZG9BcHBWaWV3ID0gcmVxdWlyZSAnLi9Ub2RvQXBwVmlldydcblxubW9kdWxlLmV4cG9ydHMgPVxuY2xhc3MgUm91dGVWaWV3IGV4dGVuZHMgQ29tcG9uZW50XG5cbiAgb25Nb3VudDogLT5cblxuICAgIHJvdXRlID0gPT5cbiAgICAgIEBhc3NpZ25cbiAgICAgICAgdG9wOiBUb2RvQXBwVmlld1xuICAgICAgICBwYXJhbXM6XG4gICAgICAgICAgZmlsdGVyOiBsb2NhdGlvbi5oYXNoLnNsaWNlKDEpXG5cbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciAnaGFzaGNoYW5nZScsIHJvdXRlXG4gICAgcm91dGUoKVxuXG4gIHJlbmRlcjogLT5cbiAgICBAdG9wLnJlbmRlcihAcGFyYW1zKVxuIiwiJ3VzZSBzdHJpY3QnXG5cbmggPSByZXF1aXJlICd2aXJ0dWFsLWh5cGVyc2NyaXB0J1xucGx1cmFsaXplID0gcmVxdWlyZSAncGx1cmFsaXplJ1xue0NvbXBvbmVudH0gPSByZXF1aXJlICdkZWNvbXBvc2UnXG5cblRvZG8gPSByZXF1aXJlICcuLi9tb2RlbHMvVG9kbydcbnRvZG9Db2xsZWN0aW9uID0gcmVxdWlyZSAnLi4vY29sbGVjdGlvbnMvdG9kb0NvbGxlY3Rpb24nXG5cbmQgPSByZXF1aXJlICcuL2RpcmVjdGl2ZSdcblRvZG9JdGVtVmlldyA9IHJlcXVpcmUgJy4vVG9kb0l0ZW1WaWV3J1xuXG5tb2R1bGUuZXhwb3J0cyA9XG5jbGFzcyBUb2RvQXBwVmlldyBleHRlbmRzIENvbXBvbmVudFxuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSB0aGlzLnByb3RvdHlwZSwgJ3JlbWFpbmluZycsXG4gICAgZ2V0OiAtPiBAdG9kb3MuZmlsdGVyKCh0KSAtPiAhdC5pc0NvbXBsZXRlZCkubGVuZ3RoXG5cbiAgb25Jbml0OiAtPlxuICAgIEBhbGxEb25lID0gZmFsc2VcbiAgICBAbmV3VGV4dCA9ICcnXG4gICAgQHRvZG9zID0gdG9kb0NvbGxlY3Rpb24udG9kb3NcblxuICBvbk1vdW50OiAtPlxuICAgIEB1ZHBhdGVDYWxsYmFjayA9ID0+XG4gICAgICBAdG9kb3MgPSB0b2RvQ29sbGVjdGlvbi50b2Rvc1xuICAgICAgQHVwZGF0ZSgpXG5cbiAgICB0b2RvQ29sbGVjdGlvbi5vbiAndXBkYXRlJywgQHVkcGF0ZUNhbGxiYWNrXG5cbiAgb25Vbm1vdW50OiAtPlxuICAgIHRvZG9Db2xsZWN0aW9uLnJlbW92ZUxpc3RlbmVyICd1cGRhdGUnLCBAdWRwYXRlQ2FsbGJhY2tcblxuICBvbktleVVwOiAoZXZlbnQpIC0+XG4gICAgaWYgZXZlbnQua2V5Q29kZSA9PSAxM1xuICAgICAgdG9kb0NvbGxlY3Rpb24uYWRkIG5ldyBUb2RvKHRleHQ6IEBuZXdUZXh0LCBpc0NvbXBsZXRlZDogZmFsc2UpXG4gICAgICBAYXNzaWduIG5ld1RleHQ6ICcnXG5cbiAgb25Ub2dnbGVBbGw6IC0+XG4gICAgdG9kb0NvbGxlY3Rpb24uc2V0Q29tcGxldGVkQWxsKEBhbGxEb25lKVxuXG4gIGZpbHRlclRvZG9zOiAtPlxuICAgIHN3aXRjaCBAZmlsdGVyXG4gICAgICB3aGVuICdhY3RpdmUnXG4gICAgICAgIEB0b2Rvcy5maWx0ZXIgKHQpIC0+ICF0LmlzQ29tcGxldGVkXG4gICAgICB3aGVuICdjb21wbGV0ZWQnXG4gICAgICAgIEB0b2Rvcy5maWx0ZXIgKHQpIC0+IHQuaXNDb21wbGV0ZWRcbiAgICAgIGVsc2VcbiAgICAgICAgQHRvZG9zXG5cbiAgcmVuZGVyOiAtPlxuICAgIGggJ3NlY3Rpb24jdG9kb2FwcCcsIFtcbiAgICAgIGggJ2hlYWRlciNoZWFkZXInLCBbXG4gICAgICAgIGggJ2gxJywgJ3RvZG9zJ1xuICAgICAgICBkIHZhbHVlOiBbdGhpcywgJ25ld1RleHQnXSxcbiAgICAgICAgICBoICdpbnB1dCNuZXctdG9kbycsXG4gICAgICAgICAgICBhdXRvZm9jdXM6IHRydWVcbiAgICAgICAgICAgIGF1dG9jb21wbGV0ZTogJ29mZidcbiAgICAgICAgICAgIHBsYWNlaG9sZGVyOiAnV2hhdCBuZWVkcyB0byBiZSBkb25lPydcbiAgICAgICAgICAgIG9ua2V5dXA6IEBvbktleVVwLmJpbmQodGhpcylcbiAgICAgIF1cbiAgICAgIGggJ3NlY3Rpb24jbWFpbicsIFtcbiAgICAgICAgZCB2YWx1ZTogW3RoaXMsICdhbGxEb25lJ10sXG4gICAgICAgICAgaCAnaW5wdXQjdG9nZ2xlLWFsbCcsIHR5cGU6ICdjaGVja2JveCcsIG9uY2hhbmdlOiBAb25Ub2dnbGVBbGwuYmluZCh0aGlzKVxuICAgICAgICBoICd1bCN0b2RvLWxpc3QnLCBAZmlsdGVyVG9kb3MoKS5tYXAgKHRvZG8pIC0+XG4gICAgICAgICAgVG9kb0l0ZW1WaWV3LnJlbmRlciB7dG9kb31cbiAgICAgIF1cbiAgICAgIGQgdmlzaWJsZTogQGxlZnQsXG4gICAgICAgIGggJ2Zvb3RlciNmb290ZXInLCBbXG4gICAgICAgICAgaCAnc3BhbiN0b2RvLWNvdW50JywgW1xuICAgICAgICAgICAgaCAnc3Ryb25nJywgXCIje0ByZW1haW5pbmd9ICN7cGx1cmFsaXplKCdpdGVtJywgQHJlbWFpbmluZyl9IGxlZnRcIlxuICAgICAgICAgIF1cbiAgICAgICAgICBoICd1bCNmaWx0ZXJzJywgW1xuICAgICAgICAgICAgaCAnbGknLCBbIGQgY3NzOiB7c2VsZWN0ZWQ6IEBmaWx0ZXIgPT0gJ2FsbCd9LCBoICdhJywgaHJlZjogJyNhbGwnLCAnQWxsJyBdXG4gICAgICAgICAgICBoICdsaScsIFsgZCBjc3M6IHtzZWxlY3RlZDogQGZpbHRlciA9PSAnYWN0aXZlJ30sIGggJ2EnLCBocmVmOiAnI2FjdGl2ZScsICdBY3RpdmUnIF1cbiAgICAgICAgICAgIGggJ2xpJywgWyBkIGNzczoge3NlbGVjdGVkOiBAZmlsdGVyID09ICdjb21wbGV0ZWQnfSwgaCAnYScsIGhyZWY6ICcjY29tcGxldGVkJywgJ0NvbXBsZXRlZCcgXVxuICAgICAgICAgIF1cbiAgICAgICAgXVxuICAgIF1cbiIsIid1c2Ugc3RyaWN0J1xuXG5oID0gcmVxdWlyZSAndmlydHVhbC1oeXBlcnNjcmlwdCdcbnBsdXJhbGl6ZSA9IHJlcXVpcmUgJ3BsdXJhbGl6ZSdcbntDb21wb25lbnR9ID0gcmVxdWlyZSAnZGVjb21wb3NlJ1xuXG50b2RvQ29sbGVjdGlvbiA9IHJlcXVpcmUgJy4uL2NvbGxlY3Rpb25zL3RvZG9Db2xsZWN0aW9uJ1xuZCA9IHJlcXVpcmUgJy4vZGlyZWN0aXZlJ1xuXG5tb2R1bGUuZXhwb3J0cyA9XG5jbGFzcyBUb2RvSXRlbVZpZXcgZXh0ZW5kcyBDb21wb25lbnRcblxuICBvbkluaXQ6IC0+XG4gICAgQHVwZGF0ZUNhbGxiYWNrID0gQHVwZGF0ZS5iaW5kKHRoaXMpXG5cbiAgYXNzaWduOiAoYXR0cnMpIC0+XG4gICAgc3VwZXIoYXR0cnMpXG4gICAgQHVwZGF0ZSgpXG5cbiAgb25Vbm1vdW50OiAtPlxuICAgIEB0b2RvLnJlbW92ZUxpc3RlbmVyICd1cGRhdGUnLCBAdXBkYXRlQ2FsbGJhY2tcblxuICByZW1vdmU6IC0+XG4gICAgdG9kb0NvbGxlY3Rpb24ucmVtb3ZlKEB0b2RvKVxuXG4gIGVkaXQ6IC0+XG4gICAgQGFzc2lnbiBpc0VkaXRpbmc6IHRydWVcblxuICBkb25lRWRpdDogLT5cbiAgICBAYXNzaWduIGlzRWRpdGluZzogZmFsc2VcblxuICBvbktleVVwOiAoZXZlbnQpIC0+XG4gICAgc3dpdGNoIGV2ZW50LmtleUNvZGVcbiAgICAgIHdoZW4gMjcsIDEzXG4gICAgICAgIEBkb25lRWRpdCgpXG5cbiAgcmVuZGVyOiAtPlxuICAgIGQgY3NzOiB7ZWRpdGluZzogQGlzRWRpdGluZ30sIGggJ2xpLnRvZG8nLCBbXG4gICAgICBoICcudmlldycsIFtcbiAgICAgICAgZCB2YWx1ZTogW0B0b2RvLCAnaXNDb21wbGV0ZWQnXSxcbiAgICAgICAgICBoICdpbnB1dC50b2dnbGUnLCB0eXBlOiAnY2hlY2tib3gnXG4gICAgICAgIGggJ2xhYmVsJywgb25kYmxjbGljazogQGVkaXQuYmluZCh0aGlzKSwgQHRvZG8udGV4dFxuICAgICAgICBoICdidXR0b24uZGVzdHJveScsIG9uY2xpY2s6IEByZW1vdmUuYmluZCh0aGlzKVxuICAgICAgXVxuICAgICAgZCB2YWx1ZTogW0B0b2RvLCAndGV4dCddLFxuICAgICAgICBoICdpbnB1dC5lZGl0JywgdHlwZTogJ3RleHQnLCBvbmJsdXI6IEBkb25lRWRpdC5iaW5kKHRoaXMpLCBvbmtleXVwOiBAb25LZXlVcC5iaW5kKHRoaXMpXG4gICAgXVxuIiwiJ3VzZSBzdHJpY3QnXG5leHRlbmQgPSByZXF1aXJlICd4dGVuZCdcbmFzc2lnbiA9IHJlcXVpcmUgJ3h0ZW5kL211dGFibGUnXG5cbmRpcmVjdGl2ZXMgPVxuXG4gIHZpc2libGU6IChjb25kLCBub2RlKSAtPlxuICAgIGlmIGNvbmRcbiAgICAgIG5vZGUucHJvcGVydGllcyA9IGV4dGVuZCBub2RlLnByb3BlcnRpZXMsXG4gICAgICAgIHN0eWxlOlxuICAgICAgICAgIGRpc3BsYXk6ICdub25lJ1xuXG4gIGNzczogKGNsYXNzTmFtZXMsIG5vZGUpIC0+XG4gICAgY2xhc3NOYW1lID0gT2JqZWN0LmtleXMoY2xhc3NOYW1lcylcbiAgICAgIC5maWx0ZXIgKG5hbWUpIC0+IGNsYXNzTmFtZXNbbmFtZV1cbiAgICAgIC5qb2luKCcgJylcbiAgICBub2RlLnByb3BlcnRpZXMgPSBleHRlbmQgbm9kZS5wcm9wZXJ0aWVzLFxuICAgICAgY2xhc3NOYW1lOiBcIiN7Y2xhc3NOYW1lfSAje25vZGUucHJvcGVydGllcy5jbGFzc05hbWV9XCJcblxuICB2YWx1ZTogKFtvYmosIGtleU5hbWVdLCBub2RlKSAtPlxuICAgIHZhbHVlS2V5ID0gc3dpdGNoIG5vZGUucHJvcGVydGllcy50eXBlXG4gICAgICB3aGVuICdjaGVja2JveCdcbiAgICAgICAgJ2NoZWNrZWQnXG4gICAgICBlbHNlXG4gICAgICAgICd2YWx1ZSdcblxuICAgIHByb3BzID0ge31cblxuICAgIG9sZE9uY2hhbmdlID0gbm9kZS5wcm9wZXJ0aWVzLm9uY2hhbmdlXG4gICAgcHJvcHMub25jaGFuZ2UgPSAtPlxuICAgICAgb2JqW2tleU5hbWVdID0gdGhpc1t2YWx1ZUtleV1cbiAgICAgIG9sZE9uY2hhbmdlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cykgaWYgb2xkT25jaGFuZ2U/XG5cbiAgICBwcm9wc1t2YWx1ZUtleV0gPSBvYmpba2V5TmFtZV1cblxuICAgIG5vZGUucHJvcGVydGllcyA9IGV4dGVuZCBub2RlLnByb3BlcnRpZXMsIHByb3BzXG5cbmFwcGx5RGlyZWN0aXZlcyA9IChwYXJhbXMsIG5vZGUpIC0+XG4gIE9iamVjdC5rZXlzKHBhcmFtcykuZm9yRWFjaCAoZG5hbWUpIC0+XG4gICAgZGlyZWN0aXZlID0gZGlyZWN0aXZlc1tkbmFtZV1cbiAgICBkaXJlY3RpdmUocGFyYW1zW2RuYW1lXSwgbm9kZSlcbiAgbm9kZVxuXG5tb2R1bGUuZXhwb3J0cyA9IGFwcGx5RGlyZWN0aXZlc1xuIl19
