Observer = require '../lib/whet.observer'

describe 'Observer:', ->
	
	observer_obj = result_simple = result_with_args = null

	callback_simple = ->
		result_simple = true
	
	callback_simple_obj = 
	  topics: 'callback_simple'
	  callback: callback_simple
	  context: {}

	callback_with_args = (topic, a, b) ->
		result_with_args = a + b

	callback_with_error = ->
		throw new Error 'callback stop'
	
	huge_logic = 
	  internal_var : 0
	  test_function : (topic, a, b) ->
	    switch topic
        when 'one' then @internal_var += a + b
        when 'two' then @internal_var += 10 * ( a + b )
        when 'three' then @internal_var += 400
        else @internal_var += 44
	
	beforeEach ->
		observer_obj = new Observer
		###
		Clean up global vars before each test
		###
		result_simple = false
		result_with_args = false
		huge_logic.internal_var = 0
	
	describe '#subscribe()', ->
		
		it 'should register callback and return handle', ->
			handle = observer_obj.subscribe('callback_simple', callback_simple)
			handle.should.be.deep.equal callback_simple_obj
			
		it 'should keep callback unfired on register', ->
			observer_obj.subscribe('callback_simple', callback_simple)
			result_simple.should.not.be.true
	
	describe '#publish()', ->

		it 'should return Error on non-string topic args', ->
			observer_obj.subscribe('callback_simple', callback_simple)
			( -> observer_obj.publish(true) ).should.to.throw /^Error on call \|publish\| used non-string topics/

		it 'should fired up event with void call', ->
			observer_obj.subscribe('callback_simple', callback_simple)
			observer_obj.publish('callback_simple')
			result_simple.should.be.true

		it 'should fired up event with args call', ->
			observer_obj.subscribe('callback_with_args', callback_with_args)
			observer_obj.publish('callback_with_args', 5, 7)
			result_with_args.should.be.equal 12

		it 'should fired up some different events on one channel', ->
			observer_obj.subscribe('callback_channel', callback_simple)
			observer_obj.subscribe('callback_channel', callback_with_args)
			observer_obj.publish('callback_channel', 10, 32)
			result_simple.should.be.true and result_with_args.should.be.equal 42
			
		it 'should not fired up events on different channel call', ->
			observer_obj.subscribe('callback_channel', callback_simple)
			observer_obj.publish('unknown_callback_channel', 10, 20)
			result_simple.should.not.be.true and result_with_args.should.be.not.equal 30
			
		it 'should not stop all on some broken events callback', ->
			observer_obj.subscribe('callback_channel', callback_with_error)
			observer_obj.subscribe('callback_channel', callback_simple)
			
			###
			This hack needed to supress error logger from Observer,
			we are dont need log at this time
			###
			[tmp, console.error] = [console.error, ->]
			observer_obj.publish('callback_channel')
			# restore as normal to correct mocha behaviour
			console.error = tmp
			
			result_simple.should.be.true
		
		it 'should fired up one subscriber on some different chanel', ->
		  observer_obj.subscribe('one two three four', huge_logic.test_function, huge_logic)
		  observer_obj.publish('one two four', 2, 6)
		  huge_logic.internal_var.should.be.equal 132
		
	describe '#unsubscribe()', ->
		
		it 'should unsubscribe one named function', ->
			observer_obj.subscribe('callback_channel', callback_simple)
			observer_obj.unsubscribe('callback_channel', callback_simple)
			observer_obj.publish('callback_channel')		
			result_simple.should.not.be.true

		it 'should unsubscribe one named function ONLY and keep others', ->
			observer_obj.subscribe('callback_channel', callback_simple)
			observer_obj.subscribe('callback_channel', callback_with_args)
			observer_obj.unsubscribe('callback_channel', callback_simple)
			observer_obj.publish('callback_channel', 22, 43 )
			result_simple.should.not.be.true and result_with_args.should.be.equal 65
			
		it 'may not unsubscribe unnamed (un-referenced) function', ->
			tmp = false

			observer_obj.subscribe('callback_channel', callback_simple)
			observer_obj.subscribe('callback_channel', -> tmp = true)
			observer_obj.unsubscribe('callback_channel', -> tmp = true)
			observer_obj.publish('callback_channel')
			result_simple.should.be.true and tmp.should.be.true

		it 'should unsubscribe unnamed (un-referenced) function when handle used', ->
			tmp = false

			observer_obj.subscribe('callback_channel', callback_simple)
			handle = observer_obj.subscribe('callback_channel', -> tmp = true)
			observer_obj.unsubscribe(handle)
			observer_obj.publish('callback_channel')
			result_simple.should.be.true and tmp.should.be.false
		
		it 'should silent and working on after un-existents function unsubscribe', ->
			observer_obj.subscribe('callback_channel', callback_simple)
			observer_obj.unsubscribe('callback_channel', callback_with_args)
			observer_obj.publish('callback_channel')
			result_simple.should.be.true
			
		it 'should unsubscribe all binded event on some different chanel if callback undefined', ->
		  observer_obj.subscribe('one two three four', huge_logic.test_function, huge_logic)
		  observer_obj.unsubscribe('one two four')
		  observer_obj.publish('one two three four', 2, 6)
		  huge_logic.internal_var.should.be.equal 400
		  
		it 'should unsubscribe some binded event on some different chanel if callback exists', ->
		  observer_obj.subscribe('one two three four', huge_logic.test_function, huge_logic)
		  observer_obj.unsubscribe('one two three', huge_logic.test_function, huge_logic)
		  observer_obj.publish('one two three four', 2, 6)
		  huge_logic.internal_var.should.be.equal 44
		
		it 'should unsubscribe subscriptions ONLY if context matched', ->
		  observer_obj.subscribe('one two three four', huge_logic.test_function, huge_logic)
		  observer_obj.unsubscribe('one two three', huge_logic.test_function, {})
		  observer_obj.publish('one two', 2, 6)
		  huge_logic.internal_var.should.be.equal 88
		
		it 'should prevent unsubscribe while publishing ', ->
      handle = observer_obj.subscribe('callback_channel', callback_simple)
      # its internal thing, but we are must use it to simulate situation
      observer_obj._publishing = true
      observer_obj.unsubscribe(handle)
      ###
      This hack needed to supress error logger from Observer,
      we are dont need log at this time
      ###
      [tmp, console.log] = [console.log, ->]
      observer_obj.publish('callback_channel', 'test') # must fired up event
      # restore as normal to correct mocha behaviour
      console.log = tmp
      result_simple.should.be.true

		it 'should resume unsubscribing after publishing ', ->
      handle = observer_obj.subscribe('callback_channel', callback_simple)
      # its internal thing, but we are must use it to simulate situation
      observer_obj._publishing = true
      observer_obj.unsubscribe(handle)
      ###
      This hack needed to supress error logger from Observer,
      we are dont need log at this time
      ###
      [tmp, console.log] = [console.log, ->]
      observer_obj.publish('callback_channel', 'test') # must fired up event
      # restore as normal to correct mocha behaviour
      console.log = tmp
      # yes, we are force re-init variable
      result_simple = false
      # and another one time!
      observer_obj.publish('callback_channel', 'test')
      result_simple.should.not.be.true		  
