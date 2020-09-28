const { transferFunc } = require('../helpers/walletHelper'),
  { testReq } = require('../helpers/taskHelper'),
  uuid = require('uuid/v4'),
  db = require('../helpers/db'),
  { getNow } = require('../helpers/date')

const msgDB = db.get('Massage')

/**
 * @param {string} uid
 */
async function queryMsgList(id) {
  return await msgDB.find({ uid: id }).then((docs) => { return docs })
}

/**
 * @param {string} msg receiver uid
 * @param {string} msg sender uid
 */
async function createMsg(id, id2, type, msg, tile = "您有新的消息") {
  return await msgDB.insert({ uid: id, sender: id2, mid: uuid(), type: type, msg: msg, title: tile, date: getNow() }).then((doc) => { return true })
}

module.exports = { queryMsgList, createMsg }
