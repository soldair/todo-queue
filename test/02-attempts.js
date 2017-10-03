var attempts = require('../lib/attempts')

var test = require('tape')

test('can do one attempt', function (t) {
  var called = 0
  var action = function (cb) {
    called++
    setImmediate(cb)
  }

  attempts(5, action, function (err) {
    t.ok(!err, 'no error ' + err)
    t.equals(called, 1, 'should have called once!')
    t.end()
  })
})

test('can do 3 attempts', function (t) {
  var time = Date.now()
  var called = 0
  var action = function (arg, cb) {
    t.equals(arg, time, 'attempts should fathfully pass back arguments each call')
    if (++called !== 5) return cb(new Error('oh no'))
    setImmediate(cb)
  }

  attempts(5, action, time, function (err) {
    t.ok(!err, 'no error ' + err)
    t.equals(called, 5, 'should have called 5 times')
    t.end()
  })
})
