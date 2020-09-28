const { transferFunc } = require('../helpers/walletHelper'),
    // {testReq}=require('../helpers/taskHelper'),
    db = require('../helpers/db'),
    { getNow } = require('../helpers/date')

const orderDB = db.get('Order')
//todo
async function noticeNotFinish(tid) {
    await orderDB.find({ tid: tid }, { status: 'taskFin' }, { multi: true })

}

//todo
async function payByTask(tid, type, amount, uid = '') {
    uidList = await orderDB.find({ tid: tid, status: type }).then((doc) => { return doc })
    for (let index = 0; index < uidList.length; index++) {
        const element = uidList[index];
        await transferFunc(tid, element.uid, amount)
    }
}

async function countOrder(tid, uid = '') {
    if (uid !== '')
        return await orderDB.count({ tid: tid, uid: uid })
    else
        return await orderDB.count({ tid: tid })
}

async function setOrderFinish(oid){
  await orderDB.findOneAndUpdate({oid:oid},{$set:{status:"已失效"}})
}

// async function createOrderByTask(tid,uid){
//   passData.tid=tid
//   passData.uid=uid
//   passdata.createTime=getNow()
//   let makeStatus=await testReq(passdata.tid,passdata.createTime)
//   if(makeStatus!==-1)
//   {
//       passdata.oid=uuid()
//       passdata.uid=ctx.state.user[0].uid
//       passdata.status='open'
//       passdata.price=makeStatus
//       await orderDB.insert(passdata)
//       return true
//   }
//   else{
//       return false
//   }
// }

module.exports = {
    countOrder, payByTask, noticeNotFinish, setOrderFinish
    // ,createOrderByTask
}
