const http = require('http'),
    https=require('https'),
    fs=require('fs')
    Koa = require('koa'),
    config = require('config'),
    err = require('./helpers/error'),
    views=require('koa-views'),
    session = require('koa-session'),
    bodyParser = require('koa-bodyparser'),
    passport = require('koa-passport'),
    CSRF = require('koa-csrf'),
    koaBody = require('koa-body'),
    { default: enforceHttps }=require('koa-sslify');

const router  = require('./routes');

app = new Koa();
require('koa-ctx-cache-control')(app)
app.use(koaBody({ multipart: true }));
app.keys=['hihihi']
let options={
    key:fs.readFileSync('./crt/server.key'),
    cert:fs.readFileSync('./crt/server.pem')
}
app.use(err);
app.use(enforceHttps({port:443}))
app.use(views('app/views/',{extension:'ejs'}))
app.use(session({}, app));
app.use(bodyParser())
// app.use(new CSRF({
//     invalidSessionSecretMessage: 'Invalid session secret',
//     invalidSessionSecretStatusCode: 403,
//     invalidTokenMessage: 'Invalid CSRF token',
//     invalidTokenStatusCode: 403
//   }))
app.use(passport.initialize())
app.use(passport.session())
app.use(router());

const httpserver = http.createServer(
    app.callback()).listen(config.httpserver.port, function () {
        console.log(
            '%s listening at port %d', 
            config.app.name, config.httpserver.port);
});

const server = https.createServer(options,
    app.callback()).listen(config.server.port, function () {
        console.log(
            '%s listening at port %d', 
            config.app.name, config.server.port);
});

module.exports = {
    closeServer() {
        server.close();
    }
};