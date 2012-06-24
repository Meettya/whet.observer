
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
 * whet.observer v0.2.7
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
      this._subscriptions = {};
      this._publishing = false;
      this._unsubscribe_queue = [];
    }

    /*
      subscribe( topics, callback[, context] )
       - topics (String): 1 or more topic names, separated by a space, to subscribe to
       - callback (Function): function to be called when the given topic(s) is published to
       - context (Object): an object to call the function on
      returns: { "topics": topics, "callback": callback } or throw exception on invalid arguments
    */


    Observer.prototype.subscribe = function(topics, callback, context) {
      var topic, usedTopics, _base, _i, _len, _ref1;
      if (context == null) {
        context = {};
      }
      usedTopics = {};
      if (!(_.isString(topics) || _.isFunction(callback))) {
        throw new TypeError(this._subscribe_error_message(topics, callback, context));
      }
      _ref1 = topics.split(" ");
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        topic = _ref1[_i];
        if (!(topic !== '' || !usedTopics[topic])) {
          continue;
        }
        usedTopics[topic] = true;
        (_base = this._subscriptions)[topic] || (_base[topic] = []);
        this._subscriptions[topic].push([callback, context]);
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
      var idx, task, topic, usedTopics, _i, _j, _len, _len1, _ref1, _ref2, _ref3;
      usedTopics = {};
      if (topics.topics) {
        _ref1 = this._unsubscribe_handler_parser(topics, callback, context), topics = _ref1[0], callback = _ref1[1], context = _ref1[2];
      }
      context || (context = {});
      if (!_.isString(topics)) {
        throw new TypeError(this._unsubscribe_error_message(topics, callback, context));
      }
      if (this._publishing) {
        this._unsubscribe_queue.push([topics, callback, context]);
        return this;
      }
      _ref2 = topics.split(" ");
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        topic = _ref2[_i];
        if (!(topic !== '' || !usedTopics[topic])) {
          continue;
        }
        usedTopics[topic] = true;
        if (_.isFunction(callback)) {
          _ref3 = this._subscriptions[topic];
          for (idx = _j = 0, _len1 = _ref3.length; _j < _len1; idx = ++_j) {
            task = _ref3[idx];
            if (_.isEqual(task, [callback, context])) {
              this._subscriptions[topic].splice(idx, 1);
            }
          }
        } else {
          delete this._subscriptions[topic];
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
      var data, task, topic, topics, _i, _j, _len, _len1, _ref1, _ref2;
      topics = arguments[0], data = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      this._publishing = true;
      if (!_.isString(topics)) {
        throw new TypeError(this._publish_error_message(topics, data));
      }
      _ref1 = topics.split(" ");
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        topic = _ref1[_i];
        if (topic !== '' && this._subscriptions[topic]) {
          _ref2 = this._subscriptions[topic];
          for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
            task = _ref2[_j];
            this._publish_firing(topic, task, data);
          }
        }
      }
      this._publishing = false;
      this._unsubscribe_resume();
      return this;
    };

    /*
      !!!! Internal methods from now !!!!
    */


    /*
      Internal method for unsubscribe args modificator if method called with handler
    */


    Observer.prototype._unsubscribe_handler_parser = function(topics, callback, context) {
      callback || (callback = topics.callback);
      context || (context = topics.context);
      topics = topics.topics;
      return [topics, callback, context];
    };

    /*
      Internal method for unsubscribe continious
    */


    Observer.prototype._unsubscribe_resume = function() {
      var task, _base;
      if (this._publishing) {
        return;
      }
      while (task = typeof (_base = this._unsubscribe_queue).shift === "function" ? _base.shift() : void 0) {
        console.log("retry unsubscribe " + task);
        this.unsubscribe.apply(this, task);
      }
    };

    /*
      Internal method for publish firing
    */


    Observer.prototype._publish_firing = function(topic, task, data) {
      try {
        task[0].apply(task[1], [topic].concat(data));
      } catch (err_msg) {
        console.error("Error on call callback we got exception:\n  topic     = |" + topic + "|\n  callback  = |" + task[0] + "|\n  data      = |" + (data != null ? data.join(', ') : void 0) + "|\n  error     = |" + err_msg + "|");
      }
    };

    /*
      Internal method for publish error message constructor
    */


    Observer.prototype._publish_error_message = function(topics, data) {
      return "Error on call |publish| used non-string topics:\n  topics  = |" + topics + "|\n  data    = |" + (data != null ? data.join(', ') : void 0) + "|";
    };

    /*
      Internal method for unsubscribe error message constructor
    */


    Observer.prototype._unsubscribe_error_message = function(topics, callback, context) {
      return "Error on call |unsubscribe| used non-string topics:\n  topics    = |" + topics + "|\n  callback  = |" + callback + "|\n  context   = |" + context + "|";
    };

    /*
      Internal method for subscribe error message constructor
    */


    Observer.prototype._subscribe_error_message = function(topics, callback, context) {
      return "Error! on call |subscribe| used non-string topics OR/AND callback isn`t funcrion:\n  topics    = |" + topics + "|\n  callback  = |" + callback + "|\n  context   = |" + context + "|";
    };

    return Observer;

  })();

}).call(this);
}});