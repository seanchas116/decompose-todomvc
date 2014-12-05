'use strict'

{EventEmitter} = require 'events'

module.exports =
class ObservableModel extends EventEmitter

  @attribute: (name) ->
    privateName = "_#{name}"

    Object.defineProperty @prototype, name,
      get: -> @[privateName]
      set: (value) ->
        if @[privateName] != value
          @[privateName] = value
          @emit 'update'
