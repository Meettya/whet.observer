#!/usr/bin/env coffee

###
Its #subscribeGuarded() method live example
###

Observer = require "../src/whet.observer"

observer_obj = new Observer verbose : 'silent'

context_object = 
  name : 'Context Object'

  callback : (topic, data) -> throw Error "Die at #{topic}"

  watchdog : (err, options) -> 
    console.log "Error in | #{@name} |"
    console.log "Error string: | #{err} |"
    console.log "Error detail", options
    null

handle = observer_obj.subscribeGuarded 'foo', context_object.callback, context_object.watchdog, context_object

observer_obj.publish 'foo', 'some data'