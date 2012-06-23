###
 * whet.observer v0.2.5
 * A standalone Observer that actually works on node.js, adapted from Publish/Subscribe plugin for jQuery
 * https://github.com/Meettya/whet.observer
 *
 * Thanks to Joe Zim http://www.joezimjs.com for original Publish/Subscribe plugin for jQuery
 * http://www.joezimjs.com/projects/publish-subscribe-jquery-plugin/
 *
 * Copyright 2012, Dmitrii Karpich
 * Released under the MIT License
###

# resolve require from [window] or by require() 
_ = @_ ? require 'underscore'

module.exports = class Observer  
  
  constructor: -> 
    @_subscriptions = {}
    @_publishing    = false
    @_unsubscribe_queue = []
  
  ###
  subscribe( topics, callback[, context] )
   - topics (String): 1 or more topic names, separated by a space, to subscribe to
   - callback (Function): function to be called when the given topic(s) is published to
   - context (Object): an object to call the function on
  returns: { "topics": topics, "callback": callback } or throw exception on invalid arguments
  ###	
  subscribe: (topics, callback, context = {}) ->
    usedTopics = {}

    # Make sure that each argument is valid
    unless _.isString(topics) or _.isFunction(callback)
      throw new TypeError @_subscribe_error_message topics, callback, context
    
    for topic in topics.split(" ") when topic isnt '' or not usedTopics[topic]
      usedTopics[topic] = true
      @_subscriptions[topic] or= []
      @_subscriptions[topic].push [callback, context]
      
    { topics: topics, callback: callback, context:context }
  
  ###
  unsubscribe( topics[, callback[, context]] )
  - topics (String): 1 or more topic names, separated by a space, to unsubscribe from
  - callback (Function): function to be removed from the topic's subscription list. If none is supplied, all functions are removed from given topic(s)
  - context (Object): object that was used as the context in the #subscribe() call.
  ###
  unsubscribe: (topics, callback, context) ->
    usedTopics = {}
 
  	# If the handler was used we are need to parse args
    if topics.topics
      [topics, callback, context] = @_unsubscribe_handler_parser topics, callback, context
      
    context or= {}
 
    # if somthing go wrong
    unless _.isString(topics)
      throw new TypeError @_unsubscribe_error_message topics, callback, context
    
    # If someone is trying to unsubscribe while we're publishing, put it off until publishing is done
    if @_publishing
      @_unsubscribe_queue.push [topics, callback, context]
      return this
    
    # Do unsubscribe on all topics
    for topic in topics.split(" ") when topic isnt '' or not usedTopics[topic]
      usedTopics[topic] = true
      
      if _.isFunction(callback)
        for task,idx in @_subscriptions[topic] when _.isEqual task, [callback, context]
          @_subscriptions[topic].splice idx, 1
      else
        # If no callback is given, then remove all subscriptions to this topic
        delete @_subscriptions[topic]
         
    this

  ###
  publish( topics[, data] )
  - topics (String): the subscription topic(s) to publish to
  - data: any data (in any format) you wish to give to the subscribers
  ###
  publish: (topics, data...) ->
    # Let the plugin know we're publishing so that we don't do any unsubscribes until we're done
    @_publishing = true
		
    # if somthing go wrong
    unless _.isString(topics)
      throw new TypeError @_publish_error_message topics, data
        
    for topic in topics.split(" ") when topic isnt '' and @_subscriptions[topic]
      for task in @_subscriptions[topic]
        @_publish_firing topic, task, data
        
    @_publishing = false
    @_unsubscribe_resume()
    this
 
  ###
  !!!! Internal methods from now !!!!
  ###
 
  ###
  Internal method for unsubscribe args modificator if method called with handler
  ###
  _unsubscribe_handler_parser: (topics, callback, context) ->
    callback  or= topics.callback
    context   or= topics.context
    topics    = topics.topics
    [topics, callback, context]
  
  ###
  Internal method for unsubscribe continious
  ###  
  _unsubscribe_resume: ->
    return if @_publishing
    # Go through the queue and run unsubscribe again
    while task = @_unsubscribe_queue.shift?()
      console.log "retry unsubscribe #{task}"
      @unsubscribe.apply this, task
    return

  ###
  Internal method for publish firing
  ###
  _publish_firing: (topic, task, data) ->
    try 
      task[0].apply task[1], [topic].concat data
    catch err_msg
      console.error """
                    Error on call callback we got exception:
                      topic     = |#{topic}|
                      callback  = |#{task[0]}|
                      data      = |#{data?.join ', '}|
                      error     = |#{err_msg}|
                    """   
    return
    
  ###
  Internal method for publish error message constructor
  ###
  _publish_error_message: (topics, data) ->
    """
    Error on call |publish| used non-string topics:
      topics  = |#{topics}|
      data    = |#{data?.join ', '}|
    """

  ###
  Internal method for unsubscribe error message constructor
  ###
  _unsubscribe_error_message: (topics, callback, context) ->
    """
    Error on call |unsubscribe| used non-string topics:
      topics    = |#{topics}|
      callback  = |#{callback}|
      context   = |#{context}|
    """
  ###
  Internal method for subscribe error message constructor
  ###
  _subscribe_error_message: (topics, callback, context) ->    
    """
    Error! on call |subscribe| used non-string topics OR/AND callback isn`t funcrion:
      topics    = |#{topics}|
      callback  = |#{callback}|
      context   = |#{context}|
    """