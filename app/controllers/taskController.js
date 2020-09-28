const Joi = require('joi'),
  uuid = require('uuid/v4'),
  Router = require('koa-router'),
  passport = require('koa-passport'),
  db = require('../helpers/db'),
  { check, isSelfOp } = require('../helpers/auth'),
  { getNow, isEarly } = require('../helpers/date'),
  { countOrder, payByTask, noticeNotFinish, setOrderFinish } = require('../helpers/orderHelper'),
  { updateUserFunc } = require('./userController'),
  { createWallet, transferFunc, queryBalance } = require('../helpers/walletHelper'),
  { queryPerson } = require('../helpers/userHelper'),
  { queryMsgList, createMsg } = require('../helpers/msgHelper')


// Task schema
const taskRegSchema = Joi.object().keys({
  title: Joi.string().min(4).max(60).trim().required(),
  type: Joi.string().required(),
  salary: Joi.number().integer().min(1).required(),
  description: Joi.string(),
  beginTime: Joi.date().required(),
  expireTime: Joi.date().required(),
  participantNum: Joi.number().integer().min(1).required(),
  tags: Joi.string(),
  position: Joi.string()
})

const taskQuerySchema = Joi.object().keys({
  title: Joi.string().min(1).max(60).trim(),
  type: Joi.string(),
  salary: Joi.number().integer().min(1),
  description: Joi.string(),
  beginTime: Joi.date(),
  expireTime: Joi.date(),
  participantNum: Joi.number().integer().min(1),
  status: Joi.string(),
  tags: Joi.string(),
  uid: Joi.string()
})

const taskDB = db.get('Task')
const userDB = db.get('Person')
const orderDB = db.get('Order')

const taskRouter = new Router({ prefix: '/task' })
taskRouter
  .post('/create', check, createTask)
  .post('/participate', check, selectParticipator)
  .post('/query', check, queryTaskByOneElement)
  .post('/change', check, changeStatus)
  .get('/get/:id', check, getTaskbyID)
  .get('/getCreate', check, getCreateTask)
  .get('/getjoin', check, getJoinTask)
  .get('/all', getAllTask)
  .get('/number/:id', check, getFinishNum)
  .get('/finish/:id', check, setTaskFinish)
  .get('/ongoing/:id', check, setOnGoing)
  .get('/start/:id', check, setTaskStart)
  .get('/participator/:id', check, getParticipator)


async function getParticipator(ctx, next) {
  res = await orderDB.find({ tid: ctx.params.id, status: { $in: ['进行中', '已完成', '已评价'] } }).then((docs) => { return docs })
  //ctx.body = await userDB.find({uid:res.uid}).then((docs)=>{return docs})
  ctx.body = res
  console.log(ctx.body)
  ctx.status = 201
  await next()
}

/**
 * @example curl -XGET "http://localhost:8081/task/finish/:id"
 */
async function setTaskFinish(ctx, next) {
  res = await taskDB.findOneAndUpdate({ tid: ctx.params.id }, { $set: { status: "已结束" } }).then((doc) => { return doc })
  res.status = "已结束"
  ctx.body = res.status
  let orders = await orderDB.find({ tid: res.tid }).then((doc) => { return doc })
  for (let j of orders) {
    await orderDB.findOneAndUpdate({ oid: j.oid, status: { $in: ['进行中', '候补中'] } }, { $set: { status: "已失效" } }).then((doc) => { return doc })
  }
  let amount = await queryBalance(res.tid)
  transferFunc(res.tid,res.uid,amount)

  ctx.status = 201
  console.log(res)
  await next()
}

/**
 * @example curl -XGET "http://localhost:8081/task/ongoing/:id"
 */
async function setOnGoing(ctx, next) {
  res = await taskDB.findOneAndUpdate({ tid: ctx.params.id }, { $set: { status: "进行中" } }).then((doc) => { return doc })
  res.status = "进行中"
  ctx.body = res.status
  let orders = await orderDB.find({ tid: res.tid }).then((doc) => { return doc })
  for (let j of orders) {
    await orderDB.findOneAndUpdate({ oid: j.oid, status: "候补中" }, { $set: { status: "已失效" } }).then((doc) => { return doc })
  }
  ctx.status = 201
  console.log(res)
  await next()
}

/**
 * @example curl -XGET "http://localhost:8081/task/start/:id"
 */
async function setTaskStart(ctx, next) {
  res = await taskDB.findOneAndUpdate({ tid: ctx.params.id }, { $set: { status: "未开始" } }).then((doc) => { return doc })
  res.status = "未开始"
  ctx.body = res.status
  ctx.status = 201
  console.log(res)
  await next()
}

/**
 * @example curl -XPOST "http://localhost:8081/task/create" -d '{"title":"test task","type":"Questionaire","salary":"20","description":"task for test","beginTime":"8-20-2019","expireTime":"8-22-2019","participantNum":"1","tags":"Testing"}' -H 'Content-Type: application/json'
 * tid uid(organizer) type status createtime starttime endtime description location participantNum eachSalary tags
 */
async function createTask(ctx, next) {
  let passData = await Joi.validate(ctx.request.body, taskRegSchema)
  passData.uid = ctx.state.user[0].uid
  passData.tid = uuid()
  passData.status = "未开始"
  passData.totalCost = passData.salary * passData.participantNum
  passData.createTime = getNow()
  passData.currentParticipator = 0
  passData.candidate = 0
  passData.finishNumber = String(Math.floor(Math.random() * 9999))
  console.log(passData)
  await createWallet(passData.tid, true)

  //TODO: need to handle failure
  chargeStatus = await transferFunc(ctx.state.user[0].uid, passData.tid, passData.totalCost)
  console.log('-------Create task----------')

  console.log(chargeStatus)
  if (chargeStatus) {
    ctx.body = await taskDB.insert(passData).then((doc) => { return doc.tid })
    await createMsg(ctx.state.user[0].uid, ctx.state.user[0].uid, '-', "你成功发布了" + passData.title + "任务", "发布任务成功")
    ctx.status = 201
  }
  else {
    ctx.body = { status: "No enough money" }
    ctx.status = 400
  }

  await next()
}

/**
* @example curl -XGET "http://localhost:8081/task/all"
*/
async function getAllTask(ctx, next) {
  ctx.body = await taskDB.find().then((docs) => { return docs })
  ctx.status = 201
  await next()
}

/**
* @example curl -XGET "http://localhost:8081/task/number/:id"
* @param id:tid
*/
async function getFinishNum(ctx, next) {
  res = await taskDB.findOne({ tid: ctx.params.id }).then((doc) => { return doc })
  ctx.body = res.finishNumber
  await createMsg(ctx.state.user[0].uid, ctx.state.user[0].uid, res.type, "任务" + res.title + "的完成码是：" + res.finishNumber, "任务完成码")
  ctx.status = 201
  await next()
}

/**
 * @example curl -XPOST "http://localhost:8081/task/participate" -d '{"tid":"...","uid":"..."}' -H 'Content-Type: application/json'
 * @param tid: taskid
 * @param uid: selected user
 */
async function selectParticipator(ctx, next) {
  taskObj = await taskDB.findOne({ tid: ctx.params.tid }).then((doc) => { return doc })
  userObj = await userDB.findOne({ uid: ctx.params.uid }).then((doc) => { return doc })
  if (taskObj.currentParticipator < taskObj.participantNum) {
    taskObj.currentParticipator = taskObj.currentParticipator + 1
    let judge = createOrderByTask(taskObj.tid, userObj.uid)
  }
  else {
    ctx.body = false
  }
  if (judge) {
    await createMsg(ctx.state.user[0].uid, ctx.params.uid, taskObj.type, "你发布的" + taskObj.title + "任务有了新的参与者" + userObj.nickname, "有新的参与者")
  }
  ctx.body = judge
  ctx.status = 201
  await next()
}

/**
 * @example curl -XGET "http://localhost:8081/task/id"
 */
async function getTaskbyID(ctx, next) {
  res = await taskDB.findOne({ tid: ctx.params.id }).then((doc) => { return doc })
  if (res !== null) {
    if (res.uid === ctx.state.user[0].uid)
      res.isOrganizer = true
    else
      res.isOrganizer = false
    // usr=await queryPerson(res.uid)
    ctx.body = res
    ctx.body.userinfo = await queryPerson(res.uid).then((doc) => { return doc })
    console.log(ctx.body)
    ctx.status = 201
  }
  else {
    ctx.body = { status: 'error' }
    ctx.status = 400
  }
  await next()
}

/**
 * @example curl -XPOST "http://localhost:8081/task/query"  -d '{"title":"test task"}' -H 'Content-Type: application/json'
 */
async function queryTaskByOneElement(ctx, next) {
  let passData = await Joi.validate(ctx.request.body, taskQuerySchema)
  if (passData.title != null) {
    ctx.body = await taskDB.find({ title: passData.title }).then((doc) => { return doc })
  }
  else if (passData.type != null) {
    ctx.body = await taskDB.find({ type: passData.type }).then((doc) => { return doc })
  }
  else if (passData.salary != null) {
    ctx.body = await taskDB.find({ salary: passData.salary }).then((doc) => { return doc })
  }
  else if (passData.description != null) {
    ctx.body = await taskDB.find({ description: passData.description }).then((doc) => { return doc })
  }
  else if (passData.beginTime != null) {
    ctx.body = await taskDB.find({ beginTime: passData.beginTime }).then((doc) => { return doc })
  }
  else if (passData.expireTime != null) {
    ctx.body = await taskDB.find({ expireTime: passData.expireTime }).then((doc) => { return doc })
  }
  else if (passData.participantNum != null) {
    ctx.body = await taskDB.find({ participantNum: passData.participantNum }).then((doc) => { return doc })
  }
  else if (passData.tags != null) {
    ctx.body = await taskDB.find({ tags: passData.tags }).then((doc) => { return doc })
  }
  else if (passData.uid != null) {
    ctx.body = await taskDB.find({ uid: passData.uid }).then((doc) => { return doc })
  }
  else if (passData.status != null) {
    ctx.body = await taskDB.find({ status: passData.status }).then((doc) => { return doc })
  }
  else {
    ctx.body = null
  }
  console.log(passData)
  ctx.status = 201
  await next()
}

async function changeStatus(ctx, next) {
  res = await orderDB.findOneAndUpdate({ tid: ctx.request.tid }, { status: ctx.request.status }).then((doc) => { return doc })
  if (res) {
    ctx.body = { status: 'success' }
    ctx.status = 200
  }
  else {
    ctx.body = { status: 'failed' }
    ctx.status = 400
  }
  await next()
}


async function getCreateTask(ctx, next) {
  res = await taskDB.find({ uid: ctx.state.user[0].uid }).then((doc) => { return doc })
  ctx.body = res
  ctx.status = 200
  await next()
}

async function getJoinTask(ctx, next) {

}
module.exports = taskRouter
