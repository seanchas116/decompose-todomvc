{Component} = require 'decompose'
TodoAppView = require './TodoAppView'

module.exports =
class RouteView extends Component

  onMount: ->

    route = =>
      @assign
        top: TodoAppView
        params:
          filter: location.hash.slice(1)

    window.addEventListener 'hashchange', route
    route()

  render: ->
    @top.render(@params)
