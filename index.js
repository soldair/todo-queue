var redis = require('redis')
var attempts = require('./lib/attempts')
var idleTimer = require('./lib/idle-timer')
var json = require('./lib/json')
var once = require('once')

module.exports = function(opts,workfn){
  opts = opts||{}
  if(typeof opts === 'string') opts = {prefix:opts}
 

  var numAttempts = opts.attempts||3
  var timeout = opts.timeout||0
  var prefix = opts.prefix

  var client = redis.createClient(opts.redis)
  var processing = false
  var ended = false

  var queue = {
    add:function(name,data,cb){
      var multi = client.multi([
        ['zadd',prefix+':set',Date.now(),name],
        ['hset',prefix+':data',name,JSON.stringify({name:name,data:data})],
      ])
      multi.exec(function(err){
        
        boop()
        cb(err)
      });
    },
    end:function(){
      ended = true
      if(!processing) client.quit()
      client = false
    },
    start:function(){

      if(!client) client = redis.createClient(opts.redis)
      boop()

    },
    //testing helper. fires as the next batch starts
    batchbacks:[],
    batchCallback:function(cb){
      if(!processing) return setImmediate(cb)
      this.batchbacks.push(cb)
    },
    client:client
  }
  

  if(opts.start !== false) {
    boop()
  }

  return queue

  function boop(){
    if(processing) return;
    processing = true

    if(ended) return client.quit();
    // flush actions waiting for batch to complete
    while(queue.batchbacks.length) queue.batchbacks.shift()()

    client.zrange(prefix+':set',0,10,function(err,data){
      if(!data.length) {
        processing = false
        return;
      }


      client.hmget(prefix+':data',data,function(err,jobs){
        //filter nulls
        jobs = jobs.filter((job)=>job)
        var todo = jobs.length
        if(!todo) {
          // should only hit this if the lists are corrupted. items are in the set but not in the map.
          // if the data entries are deleted we can't ignore the matching items in the set.
          // otherwise we'll get an error state where we wont contiue processing anything ever again.
          client.zrem(prefix+':set',data,function(err){
            // if err, and in this state we are up a creek
            processing = false
            boop()
          })
          return;
        }

        jobs.forEach(function(job){
          job = json(job)
          var timer;

          var next = once(function(err){
            if(timer) timer.clear()
            if(!--todo) {
              processing = false;
              boop()
            }           
          })

          if(opts.timeout) timer = idleTimer(()=>next(new Error('timeout. no callback after '+opts.timeout+' ms')),opts.timeout)

          attempts(numAttempts,function(done){
            if(!job) return done(err)
            if(timer) timer.activity()
            workfn(job,done)
          },function(err){
            if(timer) timer.activity()
            var multi = client.multi()
            if(err){
              multi.zadd(prefix+':error',Date.now(),job.name)
              multi.zrem(prefix+':set',job.name)
            } else {
              multi.hdel(prefix+':data',job.name)
              multi.zrem(prefix+':set',job.name)
            }

            multi.exec(function(rerr){
              // handle redi error :'(
              // if we get an error here we may continue to try and process this same set of jobs forever.
              next()
            });
          });
        });

      })
    })
  }

}


