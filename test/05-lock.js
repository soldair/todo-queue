var lock = require('../lib/lock')
var test = require('tape')

test("can",function(t){
  var count = 0
  lock('foo',function(unlock){
    count++
    unlock()
  })

  lock('foo',function(unlock){
    count++
    t.equals(count,2,'should be 2 because lockmakes these happen in order')
    unlock()
    t.end()
  })
})
