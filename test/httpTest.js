const app = require('../app')
const request = require('supertest')(app)
require('should');
request
    .get('/')
    .expect(200)
    .end((err, res) => {
        if (err) throw err;
    })
/*
request
    .post('/api/authenticate')
    .send({name:'test',password:'password'})
    .expect(200)
    .then(response =>{
        response.body.success.should.equal(true)
        request
            .get('/api/users')
            .send({token:response.body.token})
            .expect(200)
            .end((err, res) => {
                if (err) throw err;
            })
    })
request
    .post('/api/authenticate')
    .send({name:'test',password:'password1'})
    .expect(200)
    .then(response =>{
        response.body.success.should.equal(false)
        response.body.message.should.equal("Authentication failed. Wrong password.")
    })
request
    .post('/api/authenticate')
    .expect(200)
    .then(response =>{
        response.body.success.should.equal(false)
        response.body.message.should.equal("Authentication failed. User not found.")
    })

request
    .get('/api/users')
    .expect(403)
    .end((err, res) => {
        if (err) throw err;
    })
*/
