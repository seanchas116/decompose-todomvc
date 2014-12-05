'use strict'

{EventEmitter} = require 'events'

class TodoCollection extends EventEmitter

  constructor: ->
    @todos = []
    @itemUpdateCallback = =>
      @update()

  add: (todo) ->
    @todos.push todo
    todo.on 'update', @itemUpdateCallback
    @update()

  remove: (todo) ->
    @todos.splice @todos.indexOf(todo), 1
    todo.removeListener 'update', @itemUpdateCallback
    @update()

  setCompletedAll: (completed) ->
    @todos.forEach (todo) ->
      todo.isCompleted = completed

  update: ->
    @emit 'update'

module.exports = new TodoCollection()
