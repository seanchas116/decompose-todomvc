'use strict'

h = require 'virtual-hyperscript'
pluralize = require 'pluralize'
{Component} = require 'decompose'

Todo = require '../models/Todo'
todoCollection = require '../collections/todoCollection'

d = require './directive'
TodoItemView = require './TodoItemView'

module.exports =
class TodoAppView extends Component

  Object.defineProperty this.prototype, 'remaining',
    get: -> @todos.filter((t) -> !t.isCompleted).length

  onInit: ->
    @allDone = false
    @newText = ''
    @todos = todoCollection.todos

  onMount: ->
    @udpateCallback = =>
      @todos = todoCollection.todos
      @update()

    todoCollection.on 'update', @udpateCallback

  onUnmount: ->
    todoCollection.removeListener 'update', @udpateCallback

  onKeyDown: (event) ->
    if event.keyCode == 13
      todoCollection.add new Todo(text: event.target.value, isCompleted: false)
      event.target.value = ''

  onToggleAll: ->
    todoCollection.setCompletedAll(@allDone)

  filterTodos: ->
    switch @filter
      when 'active'
        @todos.filter (t) -> !t.isCompleted
      when 'completed'
        @todos.filter (t) -> t.isCompleted
      else
        @todos

  render: ->
    h 'section#todoapp', [
      h 'header#header', [
        h 'h1', 'todos'
        h 'input#new-todo',
          autofocus: true
          autocomplete: 'off'
          placeholder: 'What needs to be done?'
          onkeydown: @onKeyDown.bind(this)
      ]
      h 'section#main', [
        d value: [this, 'allDone'],
          h 'input#toggle-all', type: 'checkbox', onchange: @onToggleAll.bind(this)
        h 'ul#todo-list', @filterTodos().map (todo) ->
          TodoItemView.render {todo}
      ]
      d visible: @left,
        h 'footer#footer', [
          h 'span#todo-count', [
            h 'strong', "#{@remaining} #{pluralize('item', @remaining)} left"
          ]
          h 'ul#filters', [
            h 'li', [ d css: {selected: @filter == 'all'}, h 'a', href: '#all', 'All' ]
            h 'li', [ d css: {selected: @filter == 'active'}, h 'a', href: '#active', 'Active' ]
            h 'li', [ d css: {selected: @filter == 'completed'}, h 'a', href: '#completed', 'Completed' ]
          ]
        ]
    ]
