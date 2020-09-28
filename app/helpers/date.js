const date = require("silly-datetime")

function getNow() {
    return date.format(new Date(), 'YYYY-MM-DD HH:mm:ss')
}
function isEarly(time1, time2) {
    t1 = new Date(time1)
    t2 = new Date(time2)
    return t1.getTime() < t2.getTime()
}
module.exports = { getNow, isEarly }