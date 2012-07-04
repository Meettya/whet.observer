// Generated by CoffeeScript 1.3.3

/*
Test suite for node AND browser in one file
So, we are need some data from global
Its so wrong, but its OK for test
*/


(function() {
  var Observer, lib_path,
    __slice = [].slice;

  lib_path = (typeof GLOBAL !== "undefined" && GLOBAL !== null ? GLOBAL.lib_path : void 0) || '';

  Observer = require("" + lib_path + "whet.observer");

  describe('Observer:', function() {
    var async_obj, callback_simple, callback_simple_obj, callback_with_args, callback_with_error, huge_logic, observer_obj, result_simple, result_with_args;
    observer_obj = result_simple = result_with_args = null;
    callback_simple = function() {
      return result_simple = true;
    };
    callback_simple_obj = {
      topics: 'callback_simple',
      callback: callback_simple,
      context: {}
    };
    callback_with_args = function(topic, a, b) {
      return result_with_args = a + b;
    };
    callback_with_error = function() {
      throw new Error('callback stop');
    };
    huge_logic = {
      internal_var: 0,
      test_function: function(topic, a, b) {
        switch (topic) {
          case 'one':
            return this.internal_var += a + b;
          case 'two':
            return this.internal_var += 10 * (a + b);
          case 'three':
            return this.internal_var += 400;
          default:
            return this.internal_var += 44;
        }
      }
    };
    async_obj = {
      internal_var: 0,
      calc_func: function(n) {
        return this.internal_var = n * n;
      },
      run_function: function(topic, cb, arg) {
        var _this = this;
        return setTimeout((function() {
          return cb(_this.calc_func(arg));
        }), 0);
      }
    };
    beforeEach(function() {
      observer_obj = new Observer;
      /*
          Clean up global vars before each test
      */

      result_simple = false;
      result_with_args = false;
      return huge_logic.internal_var = 0;
    });
    describe('#subscribe()', function() {
      it('should register callback and return handle', function() {
        var handle;
        handle = observer_obj.subscribe('callback_simple', callback_simple);
        return handle.should.be.deep.equal(callback_simple_obj);
      });
      return it('should keep callback unfired on register', function() {
        observer_obj.subscribe('callback_simple', callback_simple);
        return result_simple.should.not.be["true"];
      });
    });
    describe('#publish()', function() {
      it('should return Error on non-string topic args', function() {
        observer_obj.subscribe('callback_simple', callback_simple);
        return (function() {
          return observer_obj.publish(true);
        }).should.to["throw"](/^Error on call \|publish\| used non-string topics/);
      });
      it('should fired up event with void call', function() {
        observer_obj.subscribe('callback_simple', callback_simple);
        observer_obj.publish('callback_simple');
        console.log(result_simple);
        return result_simple.should.be["true"];
      });
      it('should fired up event with args call', function() {
        observer_obj.subscribe('callback_with_args', callback_with_args);
        observer_obj.publish('callback_with_args', 5, 7);
        return result_with_args.should.be.equal(12);
      });
      it('should fired up some different events on one channel', function() {
        observer_obj.subscribe('callback_channel', callback_simple);
        observer_obj.subscribe('callback_channel', callback_with_args);
        observer_obj.publish('callback_channel', 10, 32);
        return result_simple.should.be["true"] && result_with_args.should.be.equal(42);
      });
      it('should not fired up events on different channel call', function() {
        observer_obj.subscribe('callback_channel', callback_simple);
        observer_obj.publish('unknown_callback_channel', 10, 20);
        return result_simple.should.not.be["true"] && result_with_args.should.be.not.equal(30);
      });
      it('should not stop all on some broken events callback', function() {
        var tmp, _ref;
        observer_obj.subscribe('callback_channel', callback_with_error);
        observer_obj.subscribe('callback_channel', callback_simple);
        /*
              This hack needed to supress error logger from Observer,
              we are dont need log at this time
        */

        _ref = [console.error, function() {}], tmp = _ref[0], console.error = _ref[1];
        observer_obj.publish('callback_channel');
        console.error = tmp;
        return result_simple.should.be["true"];
      });
      it('should fired up one subscriber on some different chanel', function() {
        observer_obj.subscribe('one two three four', huge_logic.test_function, huge_logic);
        observer_obj.publish('one two four', 2, 6);
        return huge_logic.internal_var.should.be.equal(132);
      });
      return it('should work with async function', function(done) {
        var temp_var;
        temp_var = null;
        observer_obj.subscribe('async', async_obj.run_function, async_obj);
        observer_obj.publish('async', (function() {
          async_obj.internal_var.should.be.equal(4) && temp_var.should.be.equal(0);
          return done();
        }), 2);
        return temp_var = async_obj.internal_var;
      });
    });
    describe('#publishAsync()', function() {
      it('should fired up event with void call', function(done) {
        var void_cb;
        void_cb = function() {
          callback_simple();
          result_simple.should.be["true"];
          return done();
        };
        observer_obj.subscribe('callback_simple', void_cb);
        return observer_obj.publishAsync('callback_simple');
      });
      it('should fired up event with args call', function(done) {
        var args_cb;
        args_cb = function() {
          var args;
          args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
          callback_with_args.apply(this, args);
          result_with_args.should.be.equal(12);
          return done();
        };
        observer_obj.subscribe('callback_with_args', args_cb);
        return observer_obj.publishAsync('callback_with_args', 5, 7);
      });
      return it('should fired up some different events on one channel', function(done) {
        var args_obj, void_obj, watchdog;
        void_obj = {
          result: false,
          run: function(topic) {
            this.result = true;
            return watchdog.step('void');
          }
        };
        args_obj = {
          result: 0,
          run: function(topic, a, b) {
            this.result = a + b;
            return watchdog.step('args');
          }
        };
        watchdog = {
          counter: 2,
          step: function(name) {
            if ((this.counter -= 1) === 0) {
              void_obj.result.should.be["true"] && args_obj.result.should.be.equal(42);
              return done();
            }
          }
        };
        observer_obj.subscribe('callback_channel', args_obj.run, args_obj);
        observer_obj.subscribe('callback_channel', void_obj.run, void_obj);
        return observer_obj.publishAsync('callback_channel', 10, 32);
      });
    });
    return describe('#unsubscribe()', function() {
      it('should unsubscribe one named function', function() {
        observer_obj.subscribe('callback_channel', callback_simple);
        observer_obj.unsubscribe('callback_channel', callback_simple);
        observer_obj.publish('callback_channel');
        return result_simple.should.not.be["true"];
      });
      it('should unsubscribe one named function ONLY and keep others', function() {
        observer_obj.subscribe('callback_channel', callback_simple);
        observer_obj.subscribe('callback_channel', callback_with_args);
        observer_obj.unsubscribe('callback_channel', callback_simple);
        observer_obj.publish('callback_channel', 22, 43);
        return result_simple.should.not.be["true"] && result_with_args.should.be.equal(65);
      });
      it('may not unsubscribe unnamed (un-referenced) function', function() {
        var tmp;
        tmp = false;
        observer_obj.subscribe('callback_channel', callback_simple);
        observer_obj.subscribe('callback_channel', function() {
          return tmp = true;
        });
        observer_obj.unsubscribe('callback_channel', function() {
          return tmp = true;
        });
        observer_obj.publish('callback_channel');
        return result_simple.should.be["true"] && tmp.should.be["true"];
      });
      it('should unsubscribe unnamed (un-referenced) function when handle used', function() {
        var handle, tmp;
        tmp = false;
        observer_obj.subscribe('callback_channel', callback_simple);
        handle = observer_obj.subscribe('callback_channel', function() {
          return tmp = true;
        });
        observer_obj.unsubscribe(handle);
        observer_obj.publish('callback_channel');
        return result_simple.should.be["true"] && tmp.should.be["false"];
      });
      it('should silent and working on after un-existents function unsubscribe', function() {
        observer_obj.subscribe('callback_channel', callback_simple);
        observer_obj.unsubscribe('callback_channel', callback_with_args);
        observer_obj.publish('callback_channel');
        return result_simple.should.be["true"];
      });
      it('should unsubscribe all binded event on some different chanel if callback undefined', function() {
        observer_obj.subscribe('one two three four', huge_logic.test_function, huge_logic);
        observer_obj.unsubscribe('one two four');
        observer_obj.publish('one two three four', 2, 6);
        return huge_logic.internal_var.should.be.equal(400);
      });
      it('should unsubscribe some binded event on some different chanel if callback exists', function() {
        observer_obj.subscribe('one two three four', huge_logic.test_function, huge_logic);
        observer_obj.unsubscribe('one two three', huge_logic.test_function, huge_logic);
        observer_obj.publish('one two three four', 2, 6);
        return huge_logic.internal_var.should.be.equal(44);
      });
      it('should unsubscribe subscriptions ONLY if context matched', function() {
        observer_obj.subscribe('one two three four', huge_logic.test_function, huge_logic);
        observer_obj.unsubscribe('one two three', huge_logic.test_function, {});
        observer_obj.publish('one two', 2, 6);
        return huge_logic.internal_var.should.be.equal(88);
      });
      it('should prevent unsubscribe while publishing ', function() {
        var handle, tmp, _ref;
        handle = observer_obj.subscribe('callback_channel', callback_simple);
        observer_obj._publishing_inc();
        observer_obj.unsubscribe(handle);
        /*
              This hack needed to supress error logger from Observer,
              we are dont need log at this time
        */

        _ref = [console.log, function() {}], tmp = _ref[0], console.log = _ref[1];
        observer_obj.publish('callback_channel', 'test');
        console.log = tmp;
        return result_simple.should.be["true"];
      });
      return it('should resume unsubscribing after publishing ', function() {
        var handle, tmp, _ref;
        handle = observer_obj.subscribe('callback_channel', callback_simple);
        observer_obj._publishing_inc();
        observer_obj.unsubscribe(handle);
        /*
              This hack needed to supress error logger from Observer,
              we are dont need log at this time
        */

        _ref = [console.log, function() {}], tmp = _ref[0], console.log = _ref[1];
        observer_obj._publishing_dec();
        observer_obj.publish('callback_channel', 'test');
        console.log = tmp;
        result_simple = false;
        observer_obj.publish('callback_channel', 'test');
        return result_simple.should.not.be["true"];
      });
    });
  });

}).call(this);
