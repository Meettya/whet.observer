
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
 * whet.observer v0.3.7
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

    function Observer() {
      this._subscriptions_ = {};
      this._publishing_counter_ = 0;
      this._unsubscribe_queue_ = [];
    }

    /*
      subscribe( topics, callback[, context] )
       - topics (String): 1 or more topic names, separated by a space, to subscribe to
       - callback (Function): function to be called when the given topic(s) is published to
       - context (Object): an object to call the function on
      returns: { "topics": topics, "callback": callback } or throw exception on invalid arguments
    */


    Observer.prototype.subscribe = function(topics, callback, context) {
      var topic, _base, _i, _len, _ref1;
      if (context == null) {
        context = {};
      }
      if (!(_.isString(topics) || _.isFunction(callback))) {
        throw this._subscribeErrorMessage(topics, callback, context);
      }
      _ref1 = this._topicsToArraySplitter(topics);
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        topic = _ref1[_i];
        (_base = this._subscriptions_)[topic] || (_base[topic] = []);
        this._subscriptions_[topic].push([callback, context]);
      }
      return {
        topics: topics,
        callback: callback,
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
      var idx, task, topic, _i, _j, _len, _len1, _ref1, _ref2, _ref3;
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
      _ref2 = this._topicsToArraySplitter(topics);
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        topic = _ref2[_i];
        if (_.isFunction(callback)) {
          _ref3 = this._subscriptions_[topic];
          for (idx = _j = 0, _len1 = _ref3.length; _j < _len1; idx = ++_j) {
            task = _ref3[idx];
            if (_.isEqual(task, [callback, context])) {
              this._subscriptions_[topic].splice(idx, 1);
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
      var task, topic, _i, _j, _len, _len1, _publish, _ref1, _ref2, _ref3, _unsubscribe;
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
            task = _ref3[_j];
            this._publishingInc();
            _publish.call(this, topic, task, data);
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
        if (typeof console !== "undefined" && console !== null) {
          console.log('still publishing');
        }
        return;
      }
      while (task = typeof (_base = this._unsubscribe_queue_).shift === "function" ? _base.shift() : void 0) {
        if (typeof console !== "undefined" && console !== null) {
          console.log("retry unsubscribe " + task);
        }
        this.unsubscribe.apply(this, task);
      }
      return null;
    };

    /*
      Internal method for publish firing
    */


    Observer.prototype._publishFiring = function(topic, task, data) {
      try {
        task[0].apply(task[1], [topic].concat(data));
      } catch (err) {
        if (typeof console !== "undefined" && console !== null) {
          console.error("Error on call callback we got exception:\n  topic     = |" + topic + "|\n  callback  = |" + task[0] + "|\n  object    = |" + task[1] + "|\n  data      = |" + (data != null ? data.join(', ') : void 0) + "|\n  error     = |" + err + "|");
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


    Observer.prototype._subscribeErrorMessage = function(topics, callback, context) {
      return {
        name: "TypeError",
        message: "Error! on call |subscribe| used non-string topics OR/AND callback isn`t function:\n  topics    = |" + topics + "|\n  callback  = |" + callback + "|\n  context   = |" + context + "|"
      };
    };

    return Observer;

  })();

}).call(this);
}});
