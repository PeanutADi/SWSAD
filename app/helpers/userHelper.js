const db = require('../helpers/db')
const personDB = db.get('Person')

async function queryPerson(uid) {
    let fin = new Object()
    res = await personDB.find({ uid: uid }).then((doc) => { return doc })
    return res
}
async function creaditChange(uid,opt) {
    person=await queryPerson(uid)
    if(opt===1)
    {
        await personDB.findOneAndUpdate({uid:uid},{$set:{creadit:person.creadit-5}})
    }
    else
    {
        await personDB.findOneAndUpdate({uid:uid},{$set:{creadit:person.creadit+5}})
    }
}
module.exports = { queryPerson, creaditChange }