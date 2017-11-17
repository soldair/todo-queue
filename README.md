# todo-queue
queue work to do in redis, and handle it in the same process. 
keep work safe from process restarts/crashes


## example

```
var todoQueue = require('todo-queue')

var queue = todoQueue({
  prefix:"foo",
  start:true,
},function(job,done){
  //job.name
  //job.data

  console.log(job)

  // all done.
  done()
})

queue.add('name',{a:1})

```


## API


- `queue = todoQueue(options,doJobFunction)`
  - `options`
    - redis
      - default undefined. this causes redis to connet to localhost.
      - a valid redis.createClient options object. see  https://www.npmjs.com/package/redis#rediscreateclient

    - prefix||name
      - this is the namespace of your queue.
      - this queue uses 3 keys in redis to do its work.
        - `prefix + ':data'` hash with the job objects. keyed by name.
        - `prefix + ':set'` a sorted list of jobs. sorted by time inserted
        - `prefix + ':failed'` a hash of jobs that have failed along with an error property keyed by `timstamp:jobname`

    - timeout
      - default 0
      - the maximum time in ms a `doJobFunction` can run without calling `done`
      - this timer is disabled by default

    - retry
      - default `3`
      - how many times a job should be retried immediately on failure

    - attempts
      - default `5`
      - how many times a failed job should be reinserted into the queue with a time delay from `backoff`

    - backoff
      - function (job)
      - return number of ms to wait before trying again.
      - defaults to `one minute * attempts * 2`
      - this means time delays are 2,4,6,8,10 totalling 40 minutes before a job moves from data to failed.

    - start
      - default `true`
      - if this instance should immediately start consuming the queue

  - `doJobFunction(job,done)`
    - job
      - is an object with name and data properties 
      - `{name: job name, data: the data you passed into add}`

    - done(err, data, skip)
      - fire this callback when you are done with the job
      - if you callback with `err` the job will be retried depending on your settings for `attempts` and `retries`
      - if you callback with skip set to true and this job has errored it will not be retried or attempted again.

  - return
    - an event emitter `queue`

- `queue.add(name,data[,delay],cb)`
  - add a new job to the queue. 
  - optional time delay

- `queue.has(name,cb)`
  - if this queue has an entry for this name

- `queue.start()`
  - start a stopped queue
  - this is needed if `options.start` is not truthy or you called `queue.end` and want to continue

- `queue.stop()`
  - gracefully stop processing the queue.

- `queue.locks(name)`
  - when an item is being added to the queue and when an item is being processed we take out a `lock` on the name.
  - this means calls to queue.add("name") will wait for any current processing of "name" to finish 
  - we expose the number of locks because if events of the same name share a common resource like a file on disk it probably matters.

- `queue.backoff(job)`
  - when a job fails 
  - the default backoff function 

- `queue.countFailures(cb)`
  - the number of items in the failed hash

- `queue.getFailures(cb)`
  - get all failures
  - failures stick around in this redis hash forever.
  - periodically you should clean this out and handle or log these errors

- `queue.removeFailure(key,cb)`
  - remove an item form the failed hash for this queue.

- `queue.on(EVENT)`
  - the queue is an event emitter and emits some useful metrics.

  - `queue.on('metric',metric object)` 
    - is called with one argument a metric object with a name and an optional numeric value.
    - `{name:name,value:value}`
    - if you use numbat-emitter style/process.emit('metric') you can pass these over after prefixing the name in a way that fits your convention.
    - "metric"
      - `{name: 'job', value: ms}` 
        - time it took to process the job
      - `{name: 'job-retry'}`
        - when a job is being queued for time delay retry.
      - `{name: 'job-failed'}`
        - we have given up on this job
      - `{name: 'redis-connected'}`
        - redis connected
      - `{name: 'redis-disconnected'}`
        - redis disconnected
      - `{name: 'redis-error'}`
        - redis has sent a recoverable error. this is followed up by a connection attempt. 
      - `{name: 'redis-command-error'}`
        - redis gave an error when trying to update update/finish a job in the queue.
  - `queue.on("idle")`
    - this event is triggered when the queue has been drained.

  - `queue.on("fail",failed job)`
    - an job has just been marked as failed.

  - `queue.on("log",log string)`
    - some debug logs.

