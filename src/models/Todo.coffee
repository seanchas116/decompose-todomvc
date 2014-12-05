'use strict'

assign = require 'xtend/mutable'
ObservableModel = require './ObservableModel'

module.exports =
class Todo extends ObservableModel

  @attribute 'isCompleted'
  @attribute 'text'

  constructor: (params) ->
    assign this, params
