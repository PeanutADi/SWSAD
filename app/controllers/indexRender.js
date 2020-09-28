const Router = require('koa-router')
const indexRouter = new Router();
indexRouter
    .get('/', renderIndex)
    .get('/test', renderTest)
    .get('/success', renderSuccess)
    .get('/failure', renderFailure)
async function renderIndex(ctx, next) {
    let title = ctx.isAuthenticated()
    let username = 'Not login'
    if (title)
        username = ctx.state.user[0].username
    await ctx.render('index', {
        username,
        title
    })
}
async function renderTest(ctx, next) {
    let username = ctx.state.user[0].username
    //console.log(ctx.state.user);

    await ctx.render('test', {
        username
    })

}

async function renderSuccess(ctx, next) {
    await ctx.render('success')
}

async function renderFailure(ctx, next) {
    await ctx.render('failure')
}

module.exports = indexRouter