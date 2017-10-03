module.exports = lock

var locks = {}
function lock(name,action){
  if(!action) throw new Error('action fn required')
  if(locks[name]) return locks[name].push(action)
  locks[name] = [action]

  var called = false
  go()

  function go(){
    var action = locks[name][0]
    if(!action) {
      delete locks[name]
      return;
    }
    action(function(){
      if(called) return;
      called = true
      locks[name].shift()

      go()
    })
  }
}
