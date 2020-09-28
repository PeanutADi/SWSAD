const uuid = require('uuid/v4'),
  Router = require('koa-router'),
  db = require('../helpers/db'),
  { check, isSelfOp } = require('../helpers/auth'),
  { queryMsgList, createMsg } = require('../helpers/msgHelper')

const msgRouter = new Router({ prefix: '/msg' })
msgRouter
  .get('/list', createMsgList)
  .post('/commemt', createComment)
//.post('/create',       createMsge)

const msgDB = db.get('Message')

async function createMsgList(ctx, next) {
  ctx.body = await queryMsgList(ctx.state.user[0].uid)
  ctx.status = 201
  await next()
}

/**
 * @example curl -XPOST "http://localhost:8081/msg/comment" -d '{"uid":"...","msg":"test"}' -H 'Content-Type: application/json'
 * @param uid: msg receiver
 */
async function createComment(ctx, next) {
  ctx.body = await createMsg(ctx.request.body.uid, ctx.state.user[0].uid, "评论", ctx.request.body.msg, "有新的评论")
  ctx.status = 201
  await next()
}

/**
 * @example curl -XPOST "http://localhost:8081/msg/create" -d '{"uid":"...","type":"comment","msg":"test","title":"评论"}' -H 'Content-Type: application/json'
 * @param uid: msg receiver
 */
async function createMsge(ctx, next) {
  ctx.body = await createMsg(ctx.request.body.uid, ctx.state.user[0].uid, ctx.request.body.type, ctx.request.body.msg, ctx.request.body.title)
  ctx.status = 201
  await next()
}

/**
 * @example curl -XPOST "http://localhost:8081/msg/enroll" -d '{"uid":"...""msg":"test"}' -H 'Content-Type: application/json'
 * @param uid: msg receiver
 */
async function enrollMsg(ctx, next) {
  ctx.body = await createMsg(ctx.request.body.uid, ctx.state.user[0].uid, "enrollment", ctx.request.body.msg, "有新的报名者")
  ctx.status = 201
  await next()
}

module.exports = msgRouter
