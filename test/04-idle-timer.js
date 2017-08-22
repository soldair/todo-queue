var idle = require('../lib/idle-timer')
var test = require('tape')

test('can timeout', function (t) {
  idle(function (err) {
    t.ok(err)
    t.end()
  }, 2)
})

test('can clear', function (t) {
  var timer = idle(function (e) {
    t.fail('should not call because the timer was cleared.')
  }, 2)

  timer.clear()
  setTimeout(function () {
    t.end()
  }, 10)
})

test('can reset on activity', function (t) {
  var start = Date.now()
  var timer = idle(function (e) {
    var elapsed = Date.now() - start
    t.ok(elapsed >= 7, 'should have been greater than 8 ms because extending timeout due to activity once. ' + elapsed + 'ms')
    t.end()
  }, 5)

  setTimeout(function () {
    timer.activity()
  }, 3)
})
