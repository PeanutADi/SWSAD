const db = require('../helpers/db')
const taskDB = db.get('Task')
const { countOrder } = require('./orderHelper'),
    { getNow, isEarly } = require('./date')
async function finishTask(tid) {
    noticeNotFinish(tid)
    resBalance = queryBalance(ctx.params.id)
    await transferFunc(ctx.params.id, ctx.state.user[0].uid, resBalance)
    removeStatus = await removeWallet(ctx.params.id)
    await taskDB.remove({ tid: ctx.params.id, uid: ctx.state.user[0].uid })
    ctx.status = 204
    await next()
}


async function testReq(tid, time) {
    taskObj = await taskDB.findOne({ tid: tid }).then((doc) => { return doc })
    tot = await countOrder(tid)
    if (taskObj !== null) {
        if (
            isEarly(time, taskObj.expireTime)
            && taskObj.participantNum > tot) {
            return taskObj.salary
        }
    }
    return -1
}

module.exports = { testReq, finishTask }