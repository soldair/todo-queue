
module.exports = function (expired, timeout) {
  var timer

  set()

  function set () {
    timer = setTimeout(function () {
      expired(new Error('timout of ' + timeout + ' expired'))
    }, timeout)
  }

  return {
    clear: function () {
      clearTimeout(timer)
    },
    activity: function () {
      clearTimeout(timer)
      set()
    }
  }
}
