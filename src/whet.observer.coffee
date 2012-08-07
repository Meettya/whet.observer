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
  ###
  Verbose levels constants
  ###
  DEBUG   = 3
  WARNING = 2
  ERROR   = 1
  SILENT  = 0
  
  ###
  constructor( [ options ] )
    options :
      verbose : ['debug'|'warning'|'error'|'silent'] # verbose levels placed by decrementing
  ###
  constructor: (options={}) -> 
    @_subscriptions_       = {}
    @_publishing_counter_  = 0
    @_unsubscribe_queue_   = []
    @_tasks_counter_       = 0
    @_tasks_dictionary_    = {}
    @_observer_verbose_level_ = @_parseVerboseLevel options?.verbose
  
  ###
  subscribe( topics, callback[, context] )
   - topics (String): 1 or more topic names, separated by a space, to subscribe to
   - callback (Function): function to be called when the given topic(s) is published to
   - context (Object): an object to call the function on
  returns: { "topics": topics, "callback": callback, "watchdog": watchdog, "context": context } or throw exception on invalid arguments
  ### 
  subscribe: (topics, callback, context = {}) ->
    @subscribeGuarded topics, callback, undefined, context

  ###
  subscribeGuarded( topics, callback, watchdog [, context] )
   - topics (String): 1 or more topic names, separated by a space, to subscribe to
   - callback (Function): function to be called when the given topic(s) is published to
   - watchdog (Function): function to be called when callback under publishing topic rise exception
   - context (Object): an object to call the function on
  returns: { "topics": topics, "callback": callback, "watchdog": watchdog, "context": context } or throw exception on invalid arguments
  ### 
  subscribeGuarded: (topics, callback, watchdog, context = {}) ->

    # Make sure that each argument is valid
    unless _.isString(topics) or _.isFunction(callback) or ( not watchdog? or _.isFunction watchdog )
      throw @_subscribeErrorMessage topics, callback, watchdog, context

    task_number = @_getNextTaskNumber()
    @_tasks_dictionary_[task_number] = [callback, context, watchdog]

    for topic in @_topicsToArraySplitter topics
      @_subscriptions_[topic] or= []
      @_subscriptions_[topic].push task_number
      
    { topics: topics, callback: callback, watchdog: watchdog, context: context }

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
    
    ###
    IMPORTANT! Yes, we are remove subscriptions ONLY, 
    and keep tasks_dictionary untouched because its not necessary.
    Dictionary compacted, calculations of links to dictionary from subscriptions
    may be nightmare - its like pointers in C, exceptionally funny in async mode. 
    So, who get f*ck about this? Not me!!!
    ###
    # Do unsubscribe on all topics
    for topic in @_topicsToArraySplitter topics
      
      if _.isFunction(callback)
        for task_number,idx in @_subscriptions_[topic] when task = @_tasks_dictionary_[task_number]
          if _.isEqual [task[0], task[1]], [callback, context]
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
  publishSync( topics[, data] )
  alias to #publish()
  ###
  publishSync: (topics, data...) ->
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
  Self-incapsulated task auto-incremented counter
  ###
  _getNextTaskNumber: ->
    @_tasks_counter_ += 1

  ###
  Verbose level args parser
  ###
  _parseVerboseLevel: (level) ->
    # default level is ERROR
    unless level?
      return ERROR

    unless _.isString level
      throw @_parseVerboseLevelError level

    switch level.toUpperCase()
      when "DEBUG"    then DEBUG
      when "SILENT"   then SILENT
      when "ERROR"    then ERROR
      when "WARNING"  then WARNING
      else 
        throw Error "unknown verbose level |#{level}|"

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
      for task_number in @_subscriptions_[topic]
        @_publishingInc()
        _publish.call @, topic, @_tasks_dictionary_[task_number], data

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
      if @_observer_verbose_level_ >= DEBUG
        console?.log 'still publishing'
      return 
    # Go through the queue and run unsubscribe again
    while task = @_unsubscribe_queue_.shift?()
      if @_observer_verbose_level_ >= DEBUG
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
      # try to wakeup watchdog
      if task[2]?
        err_obj = 
          topic     : topic
          callback  : task[0]
          object    : task[1]
          data      : data

        task[2].call task[1], err, err_obj
      # or just put message to log
      if @_observer_verbose_level_ >= ERROR
        console?.error """
                      Error on call callback we got exception:
                        topic     = |#{topic}|
                        callback  = |#{task[0]}|
                        watchdog  = |#{task[2]}|
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
  _subscribeErrorMessage: (topics, callback, watchdog, context) ->
    {
      name : "TypeError"
      message : """
                Error! on call |subscribe| used non-string topics OR/AND callback isn`t function OR/AND watchdog defined but isn`t function:
                  topics    = |#{topics}|
                  callback  = |#{callback}|
                  watchdog  = |#{watchdog}|
                  context   = |#{context}|
                """
    }

  _parseVerboseLevelError: (level) ->
    {
      name : "TypeError"
      message : "Error on parsing verbose level - not a String |#{level}|"
    }

    