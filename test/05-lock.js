var lock = require('../lib/lock')
var test = require('tape')

test('can', function (t) {
  var locks = {}
  var count = 0
  lock(locks, 'foo', function (unlock) {
    count++
    unlock()
  })

  lock(locks, 'foo', function (unlock) {
    count++
    t.equals(count, 2, 'should be 2 because lockmakes these happen in order')
    unlock()
    t.end()
  })
})
