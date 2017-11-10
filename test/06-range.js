var test = require('tape')
var range = require('../lib/range')
var redis = require('redis')

test('can load range', function (t) {
  var client = redis.createClient()
  client.del('borp')
  var cursor = client.multi()
  cursor.del('borp')
  for (var i = 0; i < 20; ++i) cursor.zadd('borp', i, i + ' key')
  cursor.exec(function () {
    range(client, 'borp', 0, 10, function (err, data, seq) {
      t.ok(!err, 'should not have error ' + err)
      console.log(data)

      t.equals(data.length, 10, 'should have 10 items')
      t.equals(data[0].seq, '0', 'first should be 0')
      t.equals(data[data.length - 1].seq, '9', 'last should be 9')
      t.equals(data[data.length - 1].id, '9 key', 'last should have correct data')
      client.end(true)
      t.end()
    })
  })
})
