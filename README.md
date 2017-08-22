# todo-queue
queue work todo in redis and handle it in the same process. keep work safe from process restarts/crashes


```
var todoQueue = require('todo-queue')

var queue = todoQueue({
  prefix:"foo",
  start:true,
},function(work,done){

})

```
