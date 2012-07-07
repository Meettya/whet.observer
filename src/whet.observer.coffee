###
 * whet.observer v0.3.7
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
    @_subscriptions_       = {}
    @_publishing_counter_  = 0
    @_unsubscribe_queue_   = []
  
  ###
  subscribe( topics, callback[, context] )
   - topics (String): 1 or more topic names, separated by a space, to subscribe to
   - callback (Function): function to be called when the given topic(s) is published to
   - context (Object): an object to call the function on
  returns: { "topics": topics, "callback": callback } or throw exception on invalid arguments
  ### 
  subscribe: (topics, callback, context = {}) ->

    # Make sure that each argument is valid
    unless _.isString(topics) or _.isFunction(callback)
      throw @_subscribeErrorMessage topics, callback, context

    for topic in @_topicsToArraySplitter topics
      @_subscriptions_[topic] or= []
      @_subscriptions_[topic].push [callback, context]     
      
    { topics: topics, callback: callback, context:context }
  
  ###
  unsubscribe( topics[, callback[, context]] )
  - topics (String): 1 or more topic names, separated by a space, to unsubscribe from
  - callback (Function): function to be removed from the topic's subscription list. If none is supplied, all functions are removed from given topic(s)
  - context (Object): object that was used as the context in the #subscribe() call.
  ###
  unsubscribe: (topics, callback, context) ->
 
    # If the handler was used we are need to parse args
    if topics.topics
      [topics, callback, context] = @_unsubscribeHandlerParser topics, callback, context
      
    context or= {}
 
    # if somthing go wrong
    unless _.isString(topics)
      throw @_unsubscribeErrorMessage topics, callback, context
    
    # If someone is trying to unsubscribe while we're publishing, put it off until publishing is done
    if @_isPublishing()
      @_unsubscribe_queue_.push [topics, callback, context]
      return this
    
    # Do unsubscribe on all topics
    for topic in @_topicsToArraySplitter topics
      
      if _.isFunction(callback)
        for task,idx in @_subscriptions_[topic] when _.isEqual task, [callback, context]
          @_subscriptions_[topic].splice idx, 1
      else
        # If no callback is given, then remove all subscriptions to this topic
        delete @_subscriptions_[topic]
         
    this

  ###
  publish( topics[, data] )
  - topics (String): the subscription topic(s) to publish to
  - data: any data (in any format) you wish to give to the subscribers
  ###
  publish: (topics, data...) ->
    @_publisher 'sync', topics, data

  ###
  publishAsync( topics[, data] )
  - topics (String): the subscription topic(s) to publish to
  - data: any data (in any format) you wish to give to the subscribers
  Add tasks to queue for asynchronous executions
  ###
  publishAsync: (topics, data...) ->
    @_publisher 'async', topics, data



  ###
  !!!! Internal methods from now !!!!
  ###

  ###
  Self-incapsulate @_publishing_counter_ properties to internal methods
  ###
  _isPublishing: ->
    !!@_publishing_counter_

  _publishingInc: ->
    @_publishing_counter_ += 1
    null

  _publishingDec: ->
    unless @_isPublishing
      throw Error """
                    Error on decrement publishing counter
                      @_publishing_counter_ is |#{@_publishing_counter_}|
                  """  
    @_publishing_counter_ -= 1
    null

  ###
  Internal method for different events types definitions
  returns: [publish, unsubscribe] or throw exception on invalid arguments
  ###
  _publisherEngine: (type) ->
    # we are need to have reference to global object
    self = @

    engine_dictionary = 
      sync :
        publish : self._publishFiring
        unsubscribe : self._unsubscribeResume
      async :
        publish : (topic, task, data) -> setTimeout ( -> self._publishFiring topic, task, data ), 0
        unsubscribe : -> setTimeout ( -> self._unsubscribeResume() ), 0

    selected_engine = engine_dictionary[type]
    unless selected_engine?
      throw TypeError """
                      Error undefined publisher engine type |#{type}|
                      """  

    [selected_engine.publish, selected_engine.unsubscribe]

  ###
  Internal publisher itself
  ###
  _publisher: (type, topics, data) ->

    # if somthing go wrong
    unless _.isString(topics)
      throw @_publishErrorMessage topics, data
    
    # get our engins
    [_publish, _unsubscribe] = @_publisherEngine type

    for topic in @_topicsToArraySplitter(topics, false) when @_subscriptions_[topic]
      for task in @_subscriptions_[topic]
        @_publishingInc()
        _publish.call @, topic, task, data

    _unsubscribe.call @

    this


  ###
  Internal method for splitting topics string to array.
  May skip duplicate (it used for un/subscription )
  ###
  _topicsToArraySplitter: (topics, skip_duplicate = true) ->
    used_topics = {}

    for topic in topics.split(' ') when topic isnt ''
      continue if skip_duplicate and used_topics[topic]
      used_topics[topic] = true
      topic

  ###
  Internal method for unsubscribe args modificator if method called with handler
  ###
  _unsubscribeHandlerParser: (topics, callback, context) ->
    callback  or= topics.callback
    context   or= topics.context
    topics    = topics.topics
    [topics, callback, context]
  
  ###
  Internal method for unsubscribe continious
  ###  
  _unsubscribeResume: ->
    if @_isPublishing()
      console?.log 'still publishing'
      return 
    # Go through the queue and run unsubscribe again
    while task = @_unsubscribe_queue_.shift?()
      console?.log "retry unsubscribe #{task}"
      @unsubscribe.apply @, task
    
    null

  ###
  Internal method for publish firing
  ###
  _publishFiring: (topic, task, data) ->
    try 
      task[0].apply task[1], [topic].concat data
    catch err
      console?.error """
                    Error on call callback we got exception:
                      topic     = |#{topic}|
                      callback  = |#{task[0]}|
                      object    = |#{task[1]}|
                      data      = |#{data?.join ', '}|
                      error     = |#{err}|
                    """   
    finally
      @_publishingDec()

    null

  ###
  Internal method for publish error message constructor
  ###
  _publishErrorMessage: (topics, data) ->
    { 
      name : "TypeError"
      message : """
                Error on call |publish| used non-string topics:
                  topics  = |#{topics}|
                  data    = |#{data?.join ', '}|
                """
    }

  ###
  Internal method for unsubscribe error message constructor
  ###
  _unsubscribeErrorMessage: (topics, callback, context) ->
    {
      name : "TypeError"
      message : """
                Error on call |unsubscribe| used non-string topics:
                  topics    = |#{topics}|
                  callback  = |#{callback}|
                  context   = |#{context}|
                """
    }
    
  ###
  Internal method for subscribe error message constructor
  ###
  _subscribeErrorMessage: (topics, callback, context) ->
    {
      name : "TypeError"
      message : """
                Error! on call |subscribe| used non-string topics OR/AND callback isn`t function:
                  topics    = |#{topics}|
                  callback  = |#{callback}|
                  context   = |#{context}|
                """
    }
    