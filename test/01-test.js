var test = require('tape')
var todoQueue = require('../')
var tmpstr = require('./util').tmpstr

test("can queue and process item",function(t){

  var qname = tmpstr()

  var datamap = qname+':data'
  var workset = qname+':set'

  t.plan(11)

  var called = 0
  var queue = todoQueue(qname,function workfn(data,cb){
    t.equals(data.name,'blorp','should have name')
    t.equals(data.data.data,1,'should have correct data')

    client = queue.client

    client.hget(datamap,'blorp',function(err,data){
      t.ok(++called <= 1,'should only have to do one attempt!')

      t.ok(!err)
      t.ok(data,'should have data')
      t.equals(JSON.parse(data).name,'blorp','should be named blorp. shoudl be where i expectr it in the queue')
      client.zrange(workset,0,1,function(err,keys){
        t.equals(keys[0],'blorp','should have one key. blorp')
        cb()
      }) 
    })
    
  })


  queue.add('blorp',{data:1},function(err){
    t.ok(!err,'do not have error adding blorp')

    queue.once('idle',function(){
      var client = queue.client
    
      client.hget(datamap,'blorp',function(err,data){
        t.ok(!err)
        t.ok(!data,'should not have data')
        client.zrange(workset,0,1,function(err,keys){
          t.equals(keys.length,0,'should have 0 keys.')

          queue.end()
        }) 
      })  
    })
  })

})




