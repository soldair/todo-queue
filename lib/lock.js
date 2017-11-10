var once = require('once')

module.exports = lock

function lock (locks, name, action) {
  if (!action) throw new Error('action fn required')
  if (locks[name]) {
    console.log('LOCK: queue ', name)
    return locks[name].push(action)
  }
  locks[name] = [action]

  console.log('LOCK: new ', name)
  go()

  function go () {
    var action = locks[name][0]
    if (!action) {
      console.log('LOCK: done ', name)
      delete locks[name]
      return
    }
    action(once(function () {
      locks[name].shift()
      console.log('LOCK: dequeue ', name)
      go()
    }))
  }
}
