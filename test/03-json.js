var test = require('tape')
var json = require('../lib/json')

test("json parse",function(t){
  var o = json('{"a":1}')
  t.ok(o,'should return object')
  t.equals(o.a,1,'should returned parsed object')
  t.end()
})

test("json parse error",function(t){
  var o = json('nope')
  t.equals(o,undefined,'should return undefined')
  t.end()
})
