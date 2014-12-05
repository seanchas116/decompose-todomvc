'use strict'

RouteView = require './views/RouteView'
TodoAppView = require './views/TodoAppView'
{Mount} = require 'decompose'

view = new RouteView
  top: TodoAppView
  params:
    filter: ''

document.addEventListener 'DOMContentLoaded', ->
  new Mount(view).mount('#main')
