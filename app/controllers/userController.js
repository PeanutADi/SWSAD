const Joi = require('joi'),
    uuid = require('uuid/v4'),
    Router = require('koa-router'),
    passport = require('koa-passport'),
    db = require('../helpers/db'),
    { check, isSelfOp } = require('../helpers/auth'),
    { queryPerson } = require('../helpers/userHelper'),
    { queryBalance, createWallet } = require('../helpers/walletHelper'),
    date = require("silly-datetime")

// Simple user schema, more info: https://github.com/hapijs/joi
const userRegSchema = Joi.object().keys({
    username: Joi.string().alphanum().min(3).max(30).trim().required(),
    password: Joi.string().regex(/^[a-zA-Z0-9]{3,30}$/).required(),
    email: Joi.string().email({ minDomainSegments: 2, }).required(),
    phone: Joi.string().regex(/^[0-9]{11}$/).required(),
    nickname: Joi.string().min(2).max(20).trim().required()
});

//DB init
const personDB = db.get('Person')
const orderDB = db.get('Order')

const userRouter = new Router({ prefix: '/users' });
userRouter
    .get('/', check, list)
    .get('/self', check, getSelf)
    .get('/checkname/:name', nameCanU)
    .get('/info/:id', check, getInfo)
    .get('/logout', logoutUser)
    .get('/delete/:id', check, isSelfOp, removeUser)
    .post('/reg', registerUser)
    .post('/update', check, isSelfOp, updateUser)
    .post('/login', loginUser)
    .post('/rating', check,rateUser)
    .get('/sign',check,signUser)




//Passport
passport.serializeUser(function (user, done) {
    done(null, user._id.toString())
})

passport.deserializeUser(async function (id, done) {
    personDB.find({ _id: id }, done);
})

const LocalStrategy = require('passport-local').Strategy
passport.use(new LocalStrategy(async function (username, password, done) {
    user = await personDB.find({ username: username, password: password }).then((doc) => { return doc })
    if (user.length === 1) {
        done(null, user[0])
    }
    else {
        done(null, false)
    }
}))



/**
 * @example curl -XGET "http://localhost:8081/users/self"
 */
async function getSelf(ctx, next) {
    ctx.body = await personDB
        .findOne({ uid: ctx.state.user[0].uid },'-password')
        .then((doc) => { return doc })
    ctx.body.balance = await queryBalance(ctx.state.user[0].uid)
    await next()
}


/**
 *
 * @example curl -XGET "localhost:8081/users/check/:name"
 */
async function nameCanU(ctx, next) {
    ctx.body = await personDB.find({ username: ctx.params.name }).then((doc) => {
        if (doc.length > 0) {
            return false
        }
        else {
            return true
        }
    })
    ctx.status = 200;
    await next()
}


/**
* @example curl -XGET "http://localhost:8081/users"
*/
async function list(ctx, next) {
    ctx.body = await personDB.find().then((docs) => { return docs })
    await next();
}


/**
 * @example
 * curl -XPOST "http://localhost:8081/users/reg" -d '{"name":"New record 1"}' -H 'Content-Type: application/json'
 */
async function registerUser(ctx, next) {
    res = await personDB.find({ username: ctx.request.body.username }).then((doc) => {
        if (doc.length > 0) {
            return false
        }
        else {
            return true
        }
    })
    let passData = await Joi.validate(ctx.request.body, userRegSchema);
    passData.uid = uuid()
    passData.credit = 100
    passData.number = 0
    passData.signTime = '1970-01-01'
    passData.signNumber = 0
    console.log(passData)
    if (res) {
        ctx.body = await personDB.insert(passData).then((doc) => { return true })
        await createWallet(passData.uid, false)
        ctx.status = 201;
    }
    else {
        ctx.body = false
        ctx.status = 400
    }
    await next();
}

async function signUser(ctx, next){
  let res = await personDB.findOne({uid:ctx.state.user[0].uid}).then((doc)=>{return doc})

  let today = date.format(new Date(), 'YYYY-MM-DD').toString()
  let x = today.charAt(9)
  let y = today.charAt(8)
  let now = y*10 + x*1
  let lastday = res.signTime
  //console.log(lastday)
  //console.log(lastday)
  let xx = lastday.charAt(9)
  let yy = lastday.charAt(8)
  let last = yy*10 + xx*1
  if(now - last === 1){
    console.log('past:'+last)
    console.log('now'+now)
    let user = await personDB.findOneAndUpdate({uid:ctx.state.user[0].uid},{$set:{signTime:today,signNumber:res.signNumber+1}}).then((doc)=>{return doc})
    console.log('sign:'+res.uid)
    ctx.status = 200
    ctx.body = {signNumber:user.signNumber}
  }
  else if(now - last === 0) {
    console.log('fail sign past:'+last)
    console.log(now)
    let min = now - last
    console.log(min)
    ctx.status = 200
    ctx.body = {signNumber:-1}
  }
  else {
    console.log('past:'+last)
    console.log('now'+now)
    let user = await personDB.findOneAndUpdate({uid:ctx.state.user[0].uid},{$set:{signTime:date.format(new Date(), 'YYYY-MM-DD'),signNumber:1}}).then((doc)=>{return doc})
    ctx.status = 200
    ctx.body = {signNumber:user.signNumber}
  }
  await next()
}


/**
 * @example curl -XPOST "http://localhost:8081/users/login" -d '{"username":"test","password":"123"}' -H 'Content-Type: application/json'
 */
async function loginUser(ctx, next) {
    return passport.authenticate('local', (err, user, info, status) => {
        if (user) {
            console.log('success')
            console.log(user)

            ctx.login(user)
            ctx.body = { status: 'success' }
            ctx.status = 200
        } else {
            console.log('false at login')
            console.log(user)
            console.log(err)
            console.log(info)
            console.log(status)
            ctx.status = 400
            ctx.body = { status: 'error' }
        }
    })(ctx)
}


/**
 * @example curl -XGET "http://localhost:8081/users/logout"
 */
async function logoutUser(ctx, next) {
    ctx.logout()
    await next()
}


/**
 * @example curl -XPOST "http://localhost:8081/users/update" -d '{"name":"New record 3"}' -H 'Content-Type: application/json'
 */
async function updateUser(ctx, next) {
    // let body = await Joi.validate(ctx.request.body, userSchema, {allowUnknown: true});

    ctx.body = await updateUserFunc(ctx.request.body)
    ctx.status = 201
    await next();
}

async function getInfo(ctx, next) {
    ctx.body = await queryPerson(ctx.params.id)
    ctx.status = 201
    await next()
}



/**
 * @example curl -XGET "http://localhost:8081/users/delete/:id"
 */
async function removeUser(ctx, next) {
    await personDB.remove({ uid: ctx.params.id });
    ctx.status = 204;
    await next();
}

async function updateUserFunc(user) {
    return await personDB.findOneAndUpdate(
        { uid: user.uid },
        { $set: user }).then((upd) => { return true });
}

/**
 * @example
 * curl -XPOST "http://localhost:8081/users/rating" -d '{"uid":"...","rate":"80",oid:"..."}' -H 'Content-Type: application/json'
 */
async function rateUser(ctx, next) {
    let tempOrder = await orderDB.findOne({oid:ctx.request.body.oid}).then((docs)=>{return docs})
    console.log(tempOrder)
    if(tempOrder.comment === "已评价"){
      ctx.body = {comment:"已评价"}
      ctx.status = 400
    }
    else{
      let temp = await personDB.findOne(
          { uid: ctx.request.body.uid }).then((docs) => { return docs });

      console.log(temp+"temp")

      await orderDB.findOneAndUpdate(
        {oid:ctx.request.body.oid},
        {$set:{comment:"已评价"}}
      ).then((doc)=>{return doc})

      ctx.body = await personDB.findOneAndUpdate(
          { uid: ctx.request.body.uid },
          { $set: { number: temp.number += 1, credit: (temp.credit * (temp.number + 1) + ctx.request.body.rate) / (temp.number + 2) } }).then((docs) => { return docs })
      ctx.status = 201
    }
    await next()
}

module.exports = { userRouter, updateUserFunc }
