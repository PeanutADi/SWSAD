const Joi = require('joi'),
  uuid = require('uuid/v4'),
  Router = require('koa-router'),
  passport = require('koa-passport'),
  db = require('../helpers/db'),
  { check, isSelfOp } = require('../helpers/auth'),
  { getNow, isEarly } = require('../helpers/date'),
  { createMsg } = require('../helpers/msgHelper'),
  { testReq } = require('../helpers/taskHelper'),
  { creaditChange } = require('../helpers/userHelper'),
  {
    removeWallet,
    transferFunc,
    transfer,
    doTransactions,
    createWallet,
    queryBalance
  } = require('../helpers/walletHelper')


const orderDB = db.get('Order')
const taskDB = db.get('Task')
const userDB = db.get('Person')

const orderRouter = new Router({ prefix: '/order' })
orderRouter
  .get('/bytask/:id', check, getAllOrderOfTask)
  .get('/all', check, getAllOrder)
  .post('/create', check, createOrder)
  .get('/close/:id', check, cancelSelfOrder)
  .get('/get/:id', check, getOrderbyID)
  .get('/turnbegin/:id', check, setOnGoing)
  .post('/accomplish', check, orderAccomplish)
  .post('/comment', check, commentOrder)
  .get('/waitinglist/:id', check, listWaiting)
  .get('/test', getAll)
  .get('/turnpending/:id', check, setOrderPending)


// Task schema
const orderSchema = Joi.object().keys({
  tid: Joi.string().trim().required(),
  status: Joi.string().trim()
})

const orderCommentSchema = Joi.object().keys({
  oid: Joi.string().trim().required(),
  comment: Joi.string().trim().required(),
  credit: Joi.number().required()
})

async function testNumberReq(tid, time) {
  taskObj = await taskDB.findOne({ tid: tid }).then((doc) => { return doc })
  if (taskObj !== null) {
    if (
      isEarly(time, taskObj.expireTime)) {
      return taskObj.salary
    }
  }
  return -1
}

/**
 * @example curl -XPOST "http://localhost:8081/order/create" -d '{uid:"xxx",tid:"xxx",}' -H 'Content-Type: application/json'
 * oid tid status uid createTime message price
 */
async function createOrder(ctx, next) {
  let passdata = await Joi.validate(ctx.request.body, orderSchema)
  let task = await taskDB.findOne({ tid: passdata.tid }).then((doc) => { return doc })
  let orderExist = await orderDB.find({ tid: passdata.tid, uid: ctx.state.user[0].uid }).then((doc) => {
    if (doc.length === 0) return true; else return false;
  })
  if (task.status === "已结束" || task.status === "进行中") {
    ctx.body = { status: 'failure: task status error' }
  }
  else if (orderExist === false) {
    ctx.status = 400
    ctx.body = { status: 'failure:already exist order of same user' }
  }
  else if (ctx.state.user[0].uid === task.uid) {
    ctx.body = { status: "creator can not create order" }
  }
  else {
    passdata.createTime = getNow()
    let makeStatus = await testNumberReq(passdata.tid, passdata.createTime)         //test time legal,true return salary
    if (makeStatus !== -1) {
      let owner = await userDB.findOne({ uid: ctx.state.user[0].uid }).then((doc) => { return doc })
      passdata.oid = uuid()
      passdata.uid = ctx.state.user[0].uid
      passdata.price = makeStatus
      passdata.comment = "未评价"
      if (task.currentParticipator < task.participantNum) {
        await taskDB.findOneAndUpdate({ tid: passdata.tid }, { $set: { currentParticipator: task.currentParticipator + 1 } })
        passdata.status = '进行中'
        await createMsg(task.uid, ctx.state.user[0].uid, task.type, "您的任务" + task.title + "有新的参与者" + owner.nickname)
        await createMsg(ctx.state.user[0].uid, task.uid, task.type, "您已成功登记为" + task.title + "任务的参与人员。")
        ctx.body = { status: '进行中' }
        ctx.status = 200
      }
      // waiting for choose
      else {
        await taskDB.findOneAndUpdate({ tid: passdata.tid }, { $set: { candidate: task.candidate + 1 } })
        passdata.status = '候补中'
        await createMsg(task.uid, ctx.state.user[0].uid, task.type, "您的任务" + task.title + "有新的报名者" + owner.nickname + "，请移步至“任务中心”查看任务报名详情。")
        await createMsg(ctx.state.user[0].uid, task.uid, task.type, "您已成功报名" + task.title + "任务，现在登记您为报名者。")
        ctx.body = { status: '候补中' }
        ctx.status = 200
      }
    }
    else {
      ctx.body = { status: 'fail time check' }
      ctx.status = 400
    }
    await orderDB.insert(passdata)
  }
  await next()
}



async function getOrderbyID(ctx, next) {
  res = await orderDB.findOne({ oid: ctx.params.id }).then((doc) => { return doc })
  if (res.uid === ctx.state.user[0].uid) {
    ctx.body = res
    ctx.status = 200
    console.log('get order success :83')
  }
  else {
    ctx.body = { status: 'fail' }
    ctx = status = 400
    console.log('get order fail :88')
  }
  await next()
}


/**
* @example curl -XGET "http://localhost:8081/order/all"
*/
async function getAllOrder(ctx, next) {
  ctx.body = await orderDB.find({ uid: ctx.state.user[0].uid }).then((docs) => { return docs })
  await next();
}

async function getAllOrderOfTask(ctx, next) {
  ctx.body = await orderDB.find({ tid: ctx.params.id }).then((docs) => { return docs })
  await next();
}

async function getAll(ctx, next) {
  ctx.body = await orderDB.find({}).then((docs) => { return docs })
  await next();
}


/**
* @example curl -XGET "http://localhost:8081/order/cancel/:id"
* Todo : Money operations.
*/
async function cancelSelfOrder(ctx, next) {
  let orderRes = await orderDB.findOne({ oid: ctx.params.id, uid: ctx.state.user[0].uid }).then((doc) => { return doc })
  if (orderRes.status === '进行中') {
    taskRes = await taskDB.findOne({ tid: orderRes.tid }).then((doc) => { return doc })
    now = getNow()
    await orderDB.findOneAndUpdate({ oid: orderRes.oid }, { $set: { status: '已关闭' } })
    await taskDB.findOneAndUpdate(
       { tid: orderRes.tid },
       { $set: {
       currentParticipator: taskRes.currentParticipator - 1
       } })
    if (isEarly(now, taskRes.beginTime)) {
      createMsg(taskRes.uid, ctx.state.user[0].uid, taskRes.type, '有人退出了project')
    }
    else if (isEarly(taskRes.expireTime, now)) {
      createMsg(taskRes.uid, ctx.state.user[0].uid, taskRes.type, '有人退出了project,并被扣分')
      creaditChange(ctx.state.user[0].uid, 1)  //decrease credit
    }
    ctx.status = 200;
    ctx.body = { status: 'success' }
  }
  else if (orderRes.status === '候补中') {
    taskRes = await taskDB.findOne({ tid: orderRes.tid }).then((doc) => { return doc })
    await orderDB.findOneAndUpdate({ oid: orderRes.oid }, { $set: { status: '已关闭' } }).then((doc)=>{return doc})
    await taskDB.findOneAndUpdate({ tid: orderRes.tid} , {$set: { candidate: taskRes.candidate - 1}}).then((doc)=>{return doc})

    ctx.status = 200;
    ctx.body = { status: 'success' }
  }
  else {
    ctx.status = 400;
    ctx.body = { status: 'fail' }
  }
  await next();
}


/**
 * @example curl -XGET "http://localhost:8081/task/pending/:id"
 */
async function setOrderPending(ctx, next) {
  let orderObj = await orderDB.findOne({ oid: ctx.params.id }).then((doc) => { return doc })
  let taskObj = await taskDB.findOne({ tid: orderObj.tid }).then((doc) => { return doc })
  if (taskObj.status === "已结束") {
    ctx.body = { status: 'failure' }
    await next()
  }
  else if (orderObj.status === '候补中') {
    ctx.body = { status: 'failure' }
    await next()
  }
  else {
    let task = await taskDB.findOneAndUpdate({ tid: orderObj.tid }, { $set: { currentParticipator: taskObj.currentParticipator - 1, candidate: taskObj.candidate + 1 } }).then((doc) => { return doc })
    res = await orderDB.findOneAndUpdate({ oid: ctx.params.id }, { $set: { status: "候补中" } }).then((doc) => { return doc })
    await createMsg(res.uid, taskObj.uid, taskObj.type, "您报名的" + taskObj.title + "任务已将您转为候补，请等待转正后再完成任务。")
    res.status = "候补中"
    ctx.body = res.status
    ctx.status = 201
    console.log(res)
    await next()
  }
}

/**
 * @example curl -XGET "http://localhost:8081/task/ongoing/:id"
 */
async function setOnGoing(ctx, next) {
  let orderObj = await orderDB.findOne({ oid: ctx.params.id }).then((doc) => { return doc })
  let taskObj = await taskDB.findOne({ tid: orderObj.tid }).then((doc) => { return doc })
  if (taskObj.status === "已结束") {
    ctx.body = { status: 'Task finished' }
  }
  else if (taskObj.currentParticipator >= taskObj.participantNum) {
    ctx.body = { status: 'Max participator' }
  }
  else if (orderObj.status !== '候补中') {
    ctx.body = { status: 'order status is not pending' }
  }
  else {
    let task = await taskDB.findOneAndUpdate({ tid: orderObj.tid }, { $set: { currentParticipator: taskObj.currentParticipator + 1 , candidate: taskObj.candidate - 1 } }).then((doc) => { return doc })
    res = await orderDB.findOneAndUpdate({ oid: ctx.params.id }, { $set: { status: "进行中" } }).then((doc) => { return doc })
    await createMsg(res.uid, taskObj.uid, taskObj.type, "您报名的" + taskObj.title + "任务的候补资格已被转正，请抓紧时机去完成任务吧！")
    res.status = "success"
    ctx.body = { status: 'success' }
    ctx.status = 201
    console.log(res)
  }
  await next()
}


/**
 * @example curl -XPOST "http://localhost:8081/order/accomplish" -d '{oid:"xxx",finishNumber:"xxx",}' -H 'Content-Type: application/json'
 */
async function orderAccomplish(ctx, next) {
  let order = await orderDB.findOne({ oid: ctx.request.body.oid }).then((doc) => { return doc })
  let task = await taskDB.findOne({ tid: order.tid }).then((doc) => { return doc })
  if (ctx.request.body.finishNumber.toString() == task.finishNumber && order.status === '进行中') {
    await transferFunc(order.tid, order.uid, order.price)
    res = orderDB.findOneAndUpdate({ oid: ctx.request.body.oid }, { $set: { status: "已完成" } }).then((doc) => { return doc })
    ctx.body = { status: "success" }
    ctx.status = 200
    createMsg(task.uid, order.uid, task.type, '您的' + task.title + '有一人完成任务了')
  }
  else {
    console.log(order)
    ctx.body = { status: "fail" }
    ctx.status = 400
  }
  await next()
}

async function commentOrder(ctx, next) {
  let passdata = await Joi.validate(ctx.request.body, orderCommentSchema)
  let order = await orderDB.findOne({ oid: passdata.oid }).then((doc) => { return doc })
  let task = await taskDB.findOne({ tid: order.tid }).then((doc) => { return doc })
  if (order.uid === ctx.state.user[0].uid) {      //comment doer comment
    order.status = '已评价'
    // await userDB.findOneAndUpdate({ uid: task.uid }, { $set: { credit: passdata.credit } })
    order.selfcomment = passdata.comment
    await orderDB.findOneAndUpdate({ oid: order.oid }, order)
    ctx.body = { status: 'success' }
    ctx.status = 200
  }
  else if (ctx.state.user[0].uid === task.uid) {
    order.status = '已评价'
    // await userDB.findOneAndUpdate({ uid: order.uid }, { $set: { credit: passdata.credit } })
    order.hostercomment = passdata.comment
    await orderDB.findOneAndUpdate({ oid: order.oid }, order)
    ctx.body = { status: 'success' }
    ctx.status = 200
  } else {
    ctx.body = { status: 'fail' }
    ctx.status = 400
  }
  await next()
}

async function listWaiting(ctx, next) {
  res = await orderDB.find({ tid: ctx.params.id, status: '候补中' }).then((doc) => { return doc })
  ctx.body = res
  ctx.status = 200
  await next()
}

module.exports = orderRouter
