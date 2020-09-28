const url = 'localhost:27017/data'
const monk = require('monk')
const db = monk(url)
db.then(() => { console.log('Linked to DB'); })

module.exports = db