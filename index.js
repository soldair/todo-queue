var redis = require('redis')
var attempts = require('./lib/attempts')
var idleTimer = require('./lib/idle-timer')
var json = require('./lib/json')
var once = require('once')
var lock = require('./lib/lock')
var ts = require('monotonic-timestamp')
var range = require('./lib/range')

var EE = require('events').EventEmitter

module.exports = function (opts, workfn) {
  opts = opts || {}
  if (typeof opts === 'string') opts = {prefix: opts}

  opts.attempts = opts.attempts === undefined ? 5 : opts.attempts
  var numAttempts = opts.retry || 3
  var timeout = opts.timeout || 0
  var prefix = opts.prefix || opts.name
  var client = redis.createClient(opts.redis)

  // assume we will connect.
  var connected = true
  client.on('connect', function () {
    connected = true
    queue.emit('metric', {name: 'redis-connected'})
  }).on('end', function () {
    // if there is an error connected etc end will be emitted.
    // reconnecting will beemitted and if sucessful connect will be emitted again
    connected = false
    queue.emit('metric', {name: 'redis-disconnected'})
  }).on('error', function (_err) {
    // without the retry_strategy redis option errors are emitted any time redis goes away
    // but the client will still try to reconnect and process buffered commands.
    queue.emit('log', 'redis error ' + _err)
    queue.emit('metric', {name: 'redis-error'})
    // i make a huge scary assumption here that of there is an error on this object the redis client will eventually fix it.
  })

  var processing = false
  var ended = false

  var max = opts.max || 10
  var activeKeys = {}
  var active = 0

  var locks = {}

  var queue = new EE()
  queue.add = function (name, data, delay, cb) {
    if (typeof delay === 'function') {
      cb = delay
      delay = 0
    }
    lock(locks, name, function (unlock) {
      var multi = client.multi([
        ['zadd', prefix + ':set', (ts() + (delay || 0)) * 10000, name],
        ['hset', prefix + ':data', name, JSON.stringify({name: name, data: data})]
      ])
      multi.exec(function (err) {
        unlock()
        assignWork()
        if (cb) cb(err)
      })
    })
  }

  queue.end = function () {
    ended = true
    clearTimeout(queue.timer)
    queue.timer = null
    if (!active && !processing && client) client.quit()
    client = false
    queue.client = false
  }

  // returns the number of queued locks for a name.
  //
  // this is used to determine if the key has a pending
  // modification while you are processing an item
  //
  // lets say you upload files from this queue. and the files get frequent modifications.
  // if queue.locks(name) >= 2 when you are done working on an item the file on disk may
  // not be the version you uploaded anymore.
  //
  queue.locks = function (name) {
    return (locks[name] || []).length
  }

  queue.has = function (name, cb) {
    client.hget(prefix + ':data', name, function (err, data) {
      cb(err, !!data)
    })
  }

  queue.start = function () {
    ended = false
    if (!client) {
      client = redis.createClient(opts.redis)
      queue.client = client
    }

    // because we now support writing data to a future timestamp for later processing
    // changes in time need to trigger work assignment.
    clearTimeout(queue.timer)
    queue.timer = setInterval(assignWork, 1000)

    assignWork()
  }

  queue.countFailures = function (cb) {
    queue.client.hlen(prefix + ':failed', cb)
  }

  queue.getFailures = function (cb) {
    queue.client.hgetall(prefix + ':failed', function (err, all) {
      if (err) return cb(err)
      var res = []
      Object.keys(all || {}).forEach(function (k) {
        var o = json(all[k])
        o._key = k
        if (o) res.push(o)
      })
      cb(null, res)
    })
  }

  queue.removeFailure = function (key, cb) {
    queue.client.hdel(prefix + ':failed', key, cb)
  }

  // use provided backoff function or default to minutes * attempts * 2
  queue.backoff = opts.backoff || function (job) {
    return (1000 * 60 * job._attempts) * 2
  }

  queue.client = client

  // if we are write only we dont start
  if (!opts.writeOnly || opts.start !== false) {
    queue.start()
  }

  return queue

  function assignWork () {
    if (opts.writeOnly) return

    var toAssign = max - active

    if (!connected) {
      return
    }
    if (processing) return
    processing = true

    getJobs(toAssign, function (err, jobs) {
      processing = false
      if (err) {
        // if i cant get jobs from redis
        return setTimeout(function () {
          assignWork()
        }, 1000)
      }

      var start = Date.now()

      if (!jobs.length) {
        queue.emit('idle')
      }

      active += jobs.length
      jobs.forEach(function (job) {
        activeKeys[job.name] = 1
        var timer
        var next = once(function () {
          if (timer) timer.clear()

          queue.emit('metric', {name: 'job', value: Date.now() - start})

          --active
          delete activeKeys[job.name]

          if (ended && !active) {
            client.quit()
            client = false
            return
          }

          assignWork()
        })

        // invalid json
        if (!job) return next()

        lock(locks, job.name, function (unlock) {
          var timer
          attempts(numAttempts, function (done) {
            if (timer) timer.clear()
            if (opts.timeout) {
              timer = idleTimer(() => {
                done(new Error('timeout. no callback after ' + opts.timeout + ' ms'))
              }, timeout)
            }
            workfn(job, function (err, data, skip) {
              done(err, data, skip)
            })
          }, function (err, _, skip) {
            if (timer) timer.clear()
            var multi = client.multi()
            var failObj

            if (err && !skip && opts.attempts && (!job._attempts || job._attempts <= opts.attempts)) {
              job._attempts = (job._attempts || 0) + 1
              // add item back in with backoff _attempts+minutes backoff
              // 2,4,6,8,10 minutes. it'll take 40 minutes to give up on an item.
              var delay = queue.backoff(job)

              multi.zadd(prefix + ':set', (ts() + delay) * 10000, job.name)
              // update data to have attempts
              multi.hset(prefix + ':data', job.name, JSON.stringify(job))
              queue.emit('metric', {name: 'job-retry'})
            } else if (err) {
              // failed too many times.
              failObj = {job: job, time: Date.now(), error: err, _key: ts() + ':' + job.name}
              queue.emit('metric', {name: 'job-failed'})
              multi.hset(prefix + ':failed', failObj._key, JSON.stringify(failObj))
              // remove from queue.
              multi.hdel(prefix + ':data', job.name)
              multi.zrem(prefix + ':set', job.name)
            } else {
              multi.hdel(prefix + ':data', job.name)
              multi.zrem(prefix + ':set', job.name)
            }

            multi.exec(function (err) {
              if (err) queue.emit('metric', {name: 'redis-command-error'})
              if (failObj) queue.emit('fail', failObj)
              // if we get an error here we may continue to try and process this same set of jobs forever.
              unlock()
              next(err)
            })
          })
        })
      })
    })
  }

  function getJobs (num, cb) {
    // always load all older jobs. ignore jobs that are active.

    range(client, prefix + ':set', 0, max, function (err, data) {
      if (err) return cb(err)

      var keys = []
      data.forEach(function (o) {
        // in the case of a duplicate timestamp as a score we may
        if (activeKeys[o.id]) return
        keys.push(o.id)
      })

      if (!data.length) {
        return cb(null, [])
      }

      client.hmget(prefix + ':data', keys, function (err, jobs) {
        if (err) return cb(err)

        jobs.forEach(function (job, i) {
          if (!job) return
          if (job) job = json(job)
          jobs[i] = job
        })

        // filter nulls
        jobs = jobs.filter((job) => job)

        var todo = jobs.length
        if (!todo) {
          // should only hit this if the lists are corrupted. items are in the set but not in the map.
          // if the data entries are deleted we can't ignore the matching items in the set.
          // otherwise we'll get an error state where we wont contiue processing anything ever again.
          client.zrem(prefix + ':set', keys, function (err) {
            if (err) queue.emit('log', 'error cleaning queue zset. data still corrupted. ' + err)
            // if err, and in this state we are up a creek
            cb(null, [])
          })
          return
        }

        cb(null, jobs)
      })
    })
  }
}
