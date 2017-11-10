// stream a range of data out of redis.
// no data > than the current time to support time-delay retries etc

module.exports = function fetch (redis, key, sequence, limit, cb) {
  if (!limit) return setImmediate(() => cb(new Error('limit required')))

  redis.zrangebyscore(key, '(' + (sequence || '-inf'), Date.now() * 10000, 'LIMIT', 0, limit, 'WITHSCORES', function (err, data) {
    if (err) return cb(err)

    var key = 0
    var objs = []

    data.forEach(function (v, i) {
      if (!(1 & i)) key = v
      else objs.push({seq: v, id: key})
    })

    cb(null, objs)
  })
}
