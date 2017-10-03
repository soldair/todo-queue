
module.exports = {
  tmpstr
}

function tmpstr () {
  return 'tmp' + Date.now().toString(36) + '' + Math.floor(Math.random() * 1000).toString(36)
}
