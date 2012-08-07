#!/usr/bin/env coffee

###
Its #subscribeGuarded() method live example
###

Observer = require "../src/whet.observer"

observer_obj = new Observer verbose : 'silent'

callback = (topic, data) -> throw Error "Die at #{topic}"

watchdog = (err, options) -> 
  console.log "Error string: | #{err} |"
  console.log "Error detail", options
  null

handle = observer_obj.subscribeGuarded 'foo', callback, watchdog

observer_obj.publish 'foo', 'some data'