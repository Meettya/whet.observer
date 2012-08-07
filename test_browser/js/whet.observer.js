
(function(/*! Stitch !*/) {
  if (!this.require) {
    var modules = {}, cache = {}, require = function(name, root) {
      var path = expand(root, name), module = cache[path], fn;
      if (module) {
        return module.exports;
      } else if (fn = modules[path] || modules[path = expand(path, './index')]) {
        module = {id: path, exports: {}};
        try {
          cache[path] = module;
          fn(module.exports, function(name) {
            return require(name, dirname(path));
          }, module);
          return module.exports;
        } catch (err) {
          delete cache[path];
          throw err;
        }
      } else {
        throw 'module \'' + name + '\' not found';
      }
    }, expand = function(root, name) {
      var results = [], parts, part;
      if (/^\.\.?(\/|$)/.test(name)) {
        parts = [root, name].join('/').split('/');
      } else {
        parts = name.split('/');
      }
      for (var i = 0, length = parts.length; i < length; i++) {
        part = parts[i];
        if (part == '..') {
          results.pop();
        } else if (part != '.' && part != '') {
          results.push(part);
        }
      }
      return results.join('/');
    }, dirname = function(path) {
      return path.split('/').slice(0, -1).join('/');
    };
    this.require = function(name) {
      return require(name, '');
    }
    this.require.define = function(bundle) {
      for (var key in bundle)
        modules[key] = bundle[key];
    };
  }
  return this.require.define;
}).call(this)({"whet.observer": function(exports, require, module) {
/*
 * whet.observer v0.4.1
 * A standalone Observer that actually works on node.js, adapted from Publish/Subscribe plugin for jQuery
 * https://github.com/Meettya/whet.observer
 *
 * Thanks to Joe Zim http://www.joezimjs.com for original Publish/Subscribe plugin for jQuery
 * http://www.joezimjs.com/projects/publish-subscribe-jquery-plugin/
 *
 * Copyright 2012, Dmitrii Karpich
 * Released under the MIT License
*/


(function() {
  var Observer, _, _ref,
    __slice = [].slice;

  _ = (_ref = this._) != null ? _ref : require('underscore');

  module.exports = Observer = (function() {
    /*
      Verbose levels constants
    */

    var DEBUG, ERROR, SILENT, WARNING;

    DEBUG = 3;

    WARNING = 2;

    ERROR = 1;

    SILENT = 0;

    /*
      constructor( [ options ] )
        options :
          verbose : ['debug'|'warning'|'error'|'silent'] # verbose levels placed by decrementing
    */


    function Observer(options) {
      if (options == null) {
        options = {};
      }
      this._subscriptions_ = {};
      this._publishing_counter_ = 0;
      this._unsubscribe_queue_ = [];
      this._tasks_counter_ = 0;
      this._tasks_dictionary_ = {};
      this._observer_verbose_level_ = this._parseVerboseLevel(options != null ? options.verbose : void 0);
    }

    /*
      subscribe( topics, callback[, context] )
       - topics (String): 1 or more topic names, separated by a space, to subscribe to
       - callback (Function): function to be called when the given topic(s) is published to
       - context (Object): an object to call the function on
      returns: { "topics": topics, "callback": callback, "watchdog": watchdog, "context": context } or throw exception on invalid arguments
    */


    Observer.prototype.subscribe = function(topics, callback, context) {
      if (context == null) {
        context = {};
      }
      return this.subscribeGuarded(topics, callback, void 0, context);
    };

    /*
      subscribeGuarded( topics, callback, watchdog [, context] )
       - topics (String): 1 or more topic names, separated by a space, to subscribe to
       - callback (Function): function to be called when the given topic(s) is published to
       - watchdog (Function): function to be called when callback under publishing topic rise exception
       - context (Object): an object to call the function on
      returns: { "topics": topics, "callback": callback, "watchdog": watchdog, "context": context } or throw exception on invalid arguments
    */


    Observer.prototype.subscribeGuarded = function(topics, callback, watchdog, context) {
      var task_number, topic, _base, _i, _len, _ref1;
      if (context == null) {
        context = {};
      }
      if (!(_.isString(topics) || _.isFunction(callback) || (!(watchdog != null) || _.isFunction(watchdog)))) {
        throw this._subscribeErrorMessage(topics, callback, watchdog, context);
      }
      task_number = this._getNextTaskNumber();
      this._tasks_dictionary_[task_number] = [callback, context, watchdog];
      _ref1 = this._topicsToArraySplitter(topics);
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        topic = _ref1[_i];
        (_base = this._subscriptions_)[topic] || (_base[topic] = []);
        this._subscriptions_[topic].push(task_number);
      }
      return {
        topics: topics,
        callback: callback,
        watchdog: watchdog,
        context: context
      };
    };

    /*
      unsubscribe( topics[, callback[, context]] )
      - topics (String): 1 or more topic names, separated by a space, to unsubscribe from
      - callback (Function): function to be removed from the topic's subscription list. If none is supplied, all functions are removed from given topic(s)
      - context (Object): object that was used as the context in the #subscribe() call.
    */


    Observer.prototype.unsubscribe = function(topics, callback, context) {
      var idx, task, task_number, topic, _i, _j, _len, _len1, _ref1, _ref2, _ref3;
      if (topics.topics) {
        _ref1 = this._unsubscribeHandlerParser(topics, callback, context), topics = _ref1[0], callback = _ref1[1], context = _ref1[2];
      }
      context || (context = {});
      if (!_.isString(topics)) {
        throw this._unsubscribeErrorMessage(topics, callback, context);
      }
      if (this._isPublishing()) {
        this._unsubscribe_queue_.push([topics, callback, context]);
        return this;
      }
      /*
          IMPORTANT! Yes, we are remove subscriptions ONLY, 
          and keep tasks_dictionary untouched because its not necessary.
          Dictionary compacted, calculations of links to dictionary from subscriptions
          may be nightmare - its like pointers in C, exceptionally funny in async mode. 
          So, who get f*ck about this? Not me!!!
      */

      _ref2 = this._topicsToArraySplitter(topics);
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        topic = _ref2[_i];
        if (_.isFunction(callback)) {
          _ref3 = this._subscriptions_[topic];
          for (idx = _j = 0, _len1 = _ref3.length; _j < _len1; idx = ++_j) {
            task_number = _ref3[idx];
            if (task = this._tasks_dictionary_[task_number]) {
              if (_.isEqual([task[0], task[1]], [callback, context])) {
                this._subscriptions_[topic].splice(idx, 1);
              }
            }
          }
        } else {
          delete this._subscriptions_[topic];
        }
      }
      return this;
    };

    /*
      publish( topics[, data] )
      - topics (String): the subscription topic(s) to publish to
      - data: any data (in any format) you wish to give to the subscribers
    */


    Observer.prototype.publish = function() {
      var data, topics;
      topics = arguments[0], data = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      return this._publisher('sync', topics, data);
    };

    /*
      publishSync( topics[, data] )
      alias to #publish()
    */


    Observer.prototype.publishSync = function() {
      var data, topics;
      topics = arguments[0], data = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      return this._publisher('sync', topics, data);
    };

    /*
      publishAsync( topics[, data] )
      - topics (String): the subscription topic(s) to publish to
      - data: any data (in any format) you wish to give to the subscribers
      Add tasks to queue for asynchronous executions
    */


    Observer.prototype.publishAsync = function() {
      var data, topics;
      topics = arguments[0], data = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      return this._publisher('async', topics, data);
    };

    /*
      !!!! Internal methods from now !!!!
    */


    /*
      Self-incapsulate @_publishing_counter_ properties to internal methods
    */


    Observer.prototype._isPublishing = function() {
      return !!this._publishing_counter_;
    };

    Observer.prototype._publishingInc = function() {
      this._publishing_counter_ += 1;
      return null;
    };

    Observer.prototype._publishingDec = function() {
      if (!this._isPublishing) {
        throw Error("Error on decrement publishing counter\n  @_publishing_counter_ is |" + this._publishing_counter_ + "|");
      }
      this._publishing_counter_ -= 1;
      return null;
    };

    /*
      Self-incapsulated task auto-incremented counter
    */


    Observer.prototype._getNextTaskNumber = function() {
      return this._tasks_counter_ += 1;
    };

    /*
      Verbose level args parser
    */


    Observer.prototype._parseVerboseLevel = function(level) {
      if (level == null) {
        return ERROR;
      }
      if (!_.isString(level)) {
        throw this._parseVerboseLevelError(level);
      }
      switch (level.toUpperCase()) {
        case "DEBUG":
          return DEBUG;
        case "SILENT":
          return SILENT;
        case "ERROR":
          return ERROR;
        case "WARNING":
          return WARNING;
        default:
          throw Error("unknown verbose level |" + level + "|");
      }
    };

    /*
      Internal method for different events types definitions
      returns: [publish, unsubscribe] or throw exception on invalid arguments
    */


    Observer.prototype._publisherEngine = function(type) {
      var engine_dictionary, selected_engine, self;
      self = this;
      engine_dictionary = {
        sync: {
          publish: self._publishFiring,
          unsubscribe: self._unsubscribeResume
        },
        async: {
          publish: function(topic, task, data) {
            return setTimeout((function() {
              return self._publishFiring(topic, task, data);
            }), 0);
          },
          unsubscribe: function() {
            return setTimeout((function() {
              return self._unsubscribeResume();
            }), 0);
          }
        }
      };
      selected_engine = engine_dictionary[type];
      if (selected_engine == null) {
        throw TypeError("Error undefined publisher engine type |" + type + "|");
      }
      return [selected_engine.publish, selected_engine.unsubscribe];
    };

    /*
      Internal publisher itself
    */


    Observer.prototype._publisher = function(type, topics, data) {
      var task_number, topic, _i, _j, _len, _len1, _publish, _ref1, _ref2, _ref3, _unsubscribe;
      if (!_.isString(topics)) {
        throw this._publishErrorMessage(topics, data);
      }
      _ref1 = this._publisherEngine(type), _publish = _ref1[0], _unsubscribe = _ref1[1];
      _ref2 = this._topicsToArraySplitter(topics, false);
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        topic = _ref2[_i];
        if (this._subscriptions_[topic]) {
          _ref3 = this._subscriptions_[topic];
          for (_j = 0, _len1 = _ref3.length; _j < _len1; _j++) {
            task_number = _ref3[_j];
            this._publishingInc();
            _publish.call(this, topic, this._tasks_dictionary_[task_number], data);
          }
        }
      }
      _unsubscribe.call(this);
      return this;
    };

    /*
      Internal method for splitting topics string to array.
      May skip duplicate (it used for un/subscription )
    */


    Observer.prototype._topicsToArraySplitter = function(topics, skip_duplicate) {
      var topic, used_topics, _i, _len, _ref1, _results;
      if (skip_duplicate == null) {
        skip_duplicate = true;
      }
      used_topics = {};
      _ref1 = topics.split(' ');
      _results = [];
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        topic = _ref1[_i];
        if (!(topic !== '')) {
          continue;
        }
        if (skip_duplicate && used_topics[topic]) {
          continue;
        }
        used_topics[topic] = true;
        _results.push(topic);
      }
      return _results;
    };

    /*
      Internal method for unsubscribe args modificator if method called with handler
    */


    Observer.prototype._unsubscribeHandlerParser = function(topics, callback, context) {
      callback || (callback = topics.callback);
      context || (context = topics.context);
      topics = topics.topics;
      return [topics, callback, context];
    };

    /*
      Internal method for unsubscribe continious
    */


    Observer.prototype._unsubscribeResume = function() {
      var task, _base;
      if (this._isPublishing()) {
        if (this._observer_verbose_level_ >= DEBUG) {
          if (typeof console !== "undefined" && console !== null) {
            console.log('still publishing');
          }
        }
        return;
      }
      while (task = typeof (_base = this._unsubscribe_queue_).shift === "function" ? _base.shift() : void 0) {
        if (this._observer_verbose_level_ >= DEBUG) {
          if (typeof console !== "undefined" && console !== null) {
            console.log("retry unsubscribe " + task);
          }
        }
        this.unsubscribe.apply(this, task);
      }
      return null;
    };

    /*
      Internal method for publish firing
    */


    Observer.prototype._publishFiring = function(topic, task, data) {
      var _ref1;
      try {
        task[0].apply(task[1], [topic].concat(data));
      } catch (err) {
        if ((_ref1 = task[2]) != null) {
          _ref1.call(task[1], err, {
            topic: topic,
            callback: task[0],
            object: task[1],
            data: data
          });
        }
        if (this._observer_verbose_level_ >= ERROR) {
          if (typeof console !== "undefined" && console !== null) {
            console.error("Error on call callback we got exception:\n  topic     = |" + topic + "|\n  callback  = |" + task[0] + "|\n  watchdog  = |" + task[2] + "|\n  object    = |" + task[1] + "|\n  data      = |" + (data != null ? data.join(', ') : void 0) + "|\n  error     = |" + err + "|");
          }
        }
      } finally {
        this._publishingDec();
      }
      return null;
    };

    /*
      Internal method for publish error message constructor
    */


    Observer.prototype._publishErrorMessage = function(topics, data) {
      return {
        name: "TypeError",
        message: "Error on call |publish| used non-string topics:\n  topics  = |" + topics + "|\n  data    = |" + (data != null ? data.join(', ') : void 0) + "|"
      };
    };

    /*
      Internal method for unsubscribe error message constructor
    */


    Observer.prototype._unsubscribeErrorMessage = function(topics, callback, context) {
      return {
        name: "TypeError",
        message: "Error on call |unsubscribe| used non-string topics:\n  topics    = |" + topics + "|\n  callback  = |" + callback + "|\n  context   = |" + context + "|"
      };
    };

    /*
      Internal method for subscribe error message constructor
    */


    Observer.prototype._subscribeErrorMessage = function(topics, callback, watchdog, context) {
      return {
        name: "TypeError",
        message: "Error! on call |subscribe| used non-string topics OR/AND callback isn`t function OR/AND watchdog defined but isn`t function:\n  topics    = |" + topics + "|\n  callback  = |" + callback + "|\n  watchdog  = |" + watchdog + "|\n  context   = |" + context + "|"
      };
    };

    Observer.prototype._parseVerboseLevelError = function(level) {
      return {
        name: "TypeError",
        message: "Error on parsing verbose level - not a String |" + level + "|"
      };
    };

    return Observer;

  })();

}).call(this);
}});
