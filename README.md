# todo-queue
queue work to do in redis, and handle it in the same process. 
keep work safe from process restarts/crashes


```
var todoQueue = require('todo-queue')

var queue = todoQueue({
  prefix:"foo",
  start:true,
},function(job,done){
  //job.name
  //job.data

  // do the job here

  done()
})

queue.add('name',{a:1})

```
