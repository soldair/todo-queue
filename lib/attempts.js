
module.exports = attempts

function attempts (num, fn, ...args) {
  num = Math.abs(num) || 1

  var cb = args[args.length - 1]
  args[args.length - 1] = function (err, data, skip) {
    if (err && --num && !skip) {
      return run()
    }

    cb(err, data, skip)
  }

  run()

  function run () {
    fn.apply(null, args)
  }
}
