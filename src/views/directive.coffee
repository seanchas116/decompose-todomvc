'use strict'
extend = require 'xtend'
assign = require 'xtend/mutable'

directives =

  visible: (cond, node) ->
    if cond
      node.properties = extend node.properties,
        style:
          display: 'none'

  css: (classNames, node) ->
    className = Object.keys(classNames)
      .filter (name) -> classNames[name]
      .join(' ')
    node.properties = extend node.properties,
      className: "#{className} #{node.properties.className}"

  value: ([obj, keyName], node) ->
    valueKey = switch node.properties.type
      when 'checkbox'
        'checked'
      else
        'value'

    props = {}

    oldOnchange = node.properties.onchange
    props.onchange = ->
      obj[keyName] = this[valueKey]
      oldOnchange.apply(this, arguments) if oldOnchange?

    props[valueKey] = obj[keyName]

    node.properties = extend node.properties, props

applyDirectives = (params, node) ->
  Object.keys(params).forEach (dname) ->
    directive = directives[dname]
    directive(params[dname], node)
  node

module.exports = applyDirectives
