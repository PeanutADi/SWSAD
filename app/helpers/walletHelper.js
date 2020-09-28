const db = require('../helpers/db'),
    { getNow } = require('../helpers/date'),
    uuid = require('uuid/v4')
const walletDB = db.get('Wallet')
const transDB = db.get('transactions')

/**
 * 
 * @param {*} id int
 */
async function queryBalance(id) {
    return await walletDB.findOne({ uid: id }).then((doc) => { console.log(doc); return doc.balance })
}

/**
 * make real transfer
 * @param {string} sender 
 * @param {string} receiver 
 * @param {number} amount 
 * @returns boolean
 */
async function transfer(sender, receiver, amountstr) {
    amount = parseInt(amountstr)
    senderres = await walletDB.findOne({ uid: sender })
        .then((doc) => {
            num = parseInt(doc.balance)
            if (num >= amount)
                return num - amount
            return -1
        })
    console.log('sender res' + senderres);

    recres = await walletDB.findOne({ uid: receiver })
        .then((doc) => {
            num = parseInt(doc.balance)
            return num + amount
        })
    console.log('receiver res' + recres);
    if (senderres >= 0) {
        console.log('write amount info')
        res = await walletDB.findOneAndUpdate({ uid: sender }, { $set: { balance: senderres } })
            .then((upd) => { return true })
        res = await walletDB.findOneAndUpdate({ uid: receiver }, { $set: { balance: recres } })
            .then((upd) => { return true })
        return res
    }

    return false
}

/**
 * 
 * @param {string} id 
 * @param {boolean} isTask 
 */
async function createWallet(id, isT) {
    return await walletDB
        .insert({ uid: id, balance: '0', wid: uuid(), isTask: isT })
        .then((doc) => { return true })
}


/**
 * 
 * @param {*} info {sender,rec,amount}
 */
async function doTransactions(info) {
    isTransfer = await transfer(
        info.sender,
        info.receiver,
        info.amount)
    if (isTransfer) {
        console.log('write log')
        await transDB
            .insert({
                date: getNow(),
                amount: info.amount,
                receiver: info.receiver,
                sender: info.sender,
                status: 0,
                oid: uuid()
            })
        return true
    }
    else
        return false
}

/**
 * 
 * @param senderId string
 * @param recid string
 * @param {int} amount int
 * @returns boolean
 */
async function transferFunc(senderid, recid, amount) {
    res = await doTransactions({ sender: senderid, receiver: recid, amount: amount })
    console.log('---do trans---')
    console.log(res)
    return res
    // if(res.length===0)
    //     return false
    // else
    //     return true
}

/**
 * 
 * @param {*} id uuid
 */
async function removeWallet(id) {
    if (queryBalance(id) > 0)
        return false
    else {
        await walletDB.remove({ uid: id })
        return true
    }

}

module.exports = {
    removeWallet,
    transferFunc,
    transfer,
    doTransactions,
    createWallet,
    queryBalance
}