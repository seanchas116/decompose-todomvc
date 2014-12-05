'use strict'

h = require 'virtual-hyperscript'
pluralize = require 'pluralize'
{Component} = require 'decompose'

todoCollection = require '../collections/todoCollection'
d = require './directive'

module.exports =
class TodoItemView extends Component

  onInit: ->
    @updateCallback = @update.bind(this)

  assign: (attrs) ->
    super(attrs)
    @update()

  onUnmount: ->
    @todo.removeListener 'update', @updateCallback

  remove: ->
    todoCollection.remove(@todo)

  edit: ->
    @assign isEditing: true

  doneEdit: ->
    @assign isEditing: false

  onKeyUp: (event) ->
    switch event.keyCode
      when 27, 13
        @doneEdit()

  render: ->
    d css: {editing: @isEditing}, h 'li.todo', [
      h '.view', [
        d value: [@todo, 'isCompleted'],
          h 'input.toggle', type: 'checkbox'
        h 'label', ondblclick: @edit.bind(this), @todo.text
        h 'button.destroy', onclick: @remove.bind(this)
      ]
      d value: [@todo, 'text'],
        h 'input.edit', type: 'text', onblur: @doneEdit.bind(this), onkeyup: @onKeyUp.bind(this)
    ]
