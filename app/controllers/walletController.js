const Joi = require('joi'),
    uuid = require('uuid/v4'),
    Router = require('koa-router'),
    passport = require('koa-passport'),
    db = require('../helpers/db'),
    { getNow } = require('../helpers/date'),
    { check, isSelfOp } = require('../helpers/auth'),
    {
        removeWallet,
        transferFunc,
        transfer,
        doTransactions,
        createWallet,
        queryBalance
    } = require('../helpers/walletHelper')


const walletDB = db.get('Wallet')
const transDB = db.get('transactions')

const walletRouter = new Router({ prefix: '/wallet' })
walletRouter
    .get('/balance', check, getBalance)
    .get('/create', check, createWalletWeb)
    .get('/deposit/:num', check, depositWallet)      //temp API
    .get('/transaction', check, getTransactions)
    .post('/transaction', check, makeTransactions)
    .post('/update', check, updateTransactions) //discussing


/**
 * @example curl -XGET "http://localhost:8081/wallet/balance"
 */
async function getBalance(ctx, next) {
    ctx.body = await queryBalance(ctx.state.user[0].uid)
    ctx.status = 201
    await next()
}

/**
 * @example curl -XGET "http://localhost:8081/wallet/create"
 */
async function createWalletWeb(ctx, next) {
    ctx.body = await createWallet(ctx.state.user[0].uid, false)
    ctx.status = 201
    await next()
}


/**
 * @example curl -XGET "http://localhost:8081/wallet/deposit/:amount"
 */
async function depositWallet(ctx, next) {
    num = ctx.params.num
    wallet = await walletDB.findOne({ uid: ctx.state.user[0].uid })
        .then((doc) => { return doc })
    balance = wallet.balance
    fin = parseInt(balance) + parseInt(num)
    ctx.body = await walletDB
        .findOneAndUpdate({ uid: ctx.state.user[0].uid }, { $set: { balance: String(fin) } })
        .then((doc) => { if (doc.length !== 0) return true; else return false })
    ctx.status = 201
    await next()
}

/**
 * @example curl -XGET "http://localhost:8081/wallet/transaction"
 * date amount receiver(uid) sender(uid) status o(rder)id 
 */
async function getTransactions(ctx, next) {
    let receive_trans = await transDB
        .find({ receiver: ctx.state.user[0].uid })
        .then((doc) => { if (doc.length !== 0) return doc; else return [] })
    let send_trans = await transDB
        .find({ sender: ctx.state.user[0].uid })
        .then((doc) => { if (doc.length !== 0) return doc; else return [] })

    receive_trans.push(...send_trans)
    ctx.body = receive_trans
    ctx.status = 201
    await next()
}

/**
 * @example curl -XPOST "http://localhost:8081/wallet/transaction"
 * date amount receiver sender status o(rder)id 
 */
async function makeTransactions(ctx, next) {
    console.log(ctx.request.body)
    isTrans = doTransactions(ctx.request.body)
    if (isTrans) {
        ctx.body = { status: 'success' }
        ctx.status = 201
    }
    else {
        ctx.body = { status: 'error' }
        ctx.status = 400
    }
    await next()
}



/**
 * @example curl -XPOST "http://localhost:8081/wallet/update"
 * date amount receiver sender status o(rder)id 
 */
async function updateTransactions(ctx, next) {
    ctx.body = await transDB
        .insert({
            date: getNow(),
            amount: ctx.request.body.amount,
            receiver: ctx.request.body.rec,
            sender: ctx.request.body.sender,
            status: 0,
            oid: uuid()
        })
        .then((doc) => { if (doc.length !== 0) return doc.transaction; else return [] })
    ctx.status = 201
    await next()
}



module.exports = walletRouter