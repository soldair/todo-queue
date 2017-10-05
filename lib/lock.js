var once = require('once')

module.exports = lock

function lock (locks, name, action) {
  if (!action) throw new Error('action fn required')
  if (locks[name]) return locks[name].push(action)
  locks[name] = [action]

  go()

  function go () {
    var action = locks[name][0]
    if (!action) {
      delete locks[name]
      return
    }
    action(once(function () {
      locks[name].shift()
      go()
    }))
  }
}
