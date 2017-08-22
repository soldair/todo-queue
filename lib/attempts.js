
module.exports = attempts

function attempts (num, fn, ...args) {
  num = Math.abs(num)

  var cb = args[args.length - 1]
  args[args.length - 1] = function (err, data) {
    if (err && --num) {
      return run()
    }

    cb(err, data)
  }

  run()

  function run () {
    fn.apply(null, args)
  }
}
