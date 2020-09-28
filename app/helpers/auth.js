//Auth
function check(ctx, next) {
    if (ctx.isAuthenticated()) {
        return next()
    } else {
        console.log('failed check')
        ctx.body = { status: 'session fail' }
        // return next()
    }
}

//Check whether is it oneself
function isSelfOp(ctx, next) {
    console.log(ctx.method);
    if (ctx.method == 'GET') {
        // if (ctx.state.user[0].uid === ctx.params.id) {
        //     return next()
        // }
        // else {
        //     console.log('failed self at get')
        //     ctx.redirect('/')
        // }
        return next()
    }
    else {
        if (ctx.request.body.uid === ctx.state.user[0].uid) {
            return next()
        }
        else {
            console.log('failed self at post')
            ctx.redirect('/')
        }
    }

}

module.exports = {
    check,
    isSelfOp
}