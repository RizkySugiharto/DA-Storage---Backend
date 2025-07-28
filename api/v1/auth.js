const utils = require('../../utils')
const { Conflict, Unauthorized, BadRequest, Forbidden } = require('http-errors')
const crypto = require('crypto')
const { HttpStatusCode } = require('axios')

module.exports = function (fastify, opts, done) {
    fastify.post('/login', async (req, reply) => {
        utils.checkReqBodyAvailability(req, 'email', 'password')

        const ERR_INVALID_ACCOUNT = Unauthorized('Email or password is invalid')
        const conn = await fastify.mysql.getConnection();
        let result

        try {
            result = (await conn.query(
                'SELECT id, email, password, role FROM accounts WHERE email = ?',
                [req.body.email]
            ))[0]
            conn.release()
    
            if (result.length < 1) {
                throw ERR_INVALID_ACCOUNT
            }
        } catch (error) {
            conn.release()
            throw error
        }

        const account = result[0]
        const isPasswordValid = crypto.timingSafeEqual(
            Buffer.from(utils.hashPassword(req.body.password)),
            Buffer.from(account.password)
        )

        if (!isPasswordValid) {
            throw ERR_INVALID_ACCOUNT
        }

        return reply.code(HttpStatusCode.Ok).send({
            token: utils.generateJwtToken(fastify, account)
        })
    })

    fastify.get('/me', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        const conn = await fastify.mysql.getConnection();
        let result

        try {
            result = (await conn.query(
                'SELECT id, avatar_url, email, name, role FROM accounts WHERE id = ?',
                [req.jwtDecoded.id]
            ))[0]
            conn.release()
    
            if (result.length < 1) {
                throw Forbidden('Account is not exists')
            }
        } catch (error) {
            conn.release()
            throw error
        }

        const account = result[0]

        return reply.code(HttpStatusCode.Ok).send({
            id: account.id,
            avatar_url: utils.combineAvatarUrlWithHost(req, account.avatar_url),
            email: account.email,
            name: account.name,
            role: account.role
        })
    })

    fastify.put('/me', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        utils.checkReqBodyAvailability(req, 'email', 'name')

        let fieldsName = ['email = ?', 'name = ?'];
        let fieldsValue = [req.body.email, req.body.name];

        if (req.body.avatar_file && req.body.avatar_file.filename) {
            const avatarFilename = await utils.saveAvatarFile(req.body.avatar_file)
            fieldsName.push('avatar_url = ?')
            fieldsValue.push(avatarFilename)
        }

        await fastify.mysql.query(
            `UPDATE accounts SET ${fieldsName.join(', ')} WHERE id = ?`,
            [...fieldsValue, req.jwtDecoded.id]
        )

        const result = (await fastify.mysql.query(
            'SELECT id, avatar_url, email, name, role FROM accounts WHERE id = ?',
            [req.jwtDecoded.id]
        ))[0]
        const account = result[0]

        return reply.code(HttpStatusCode.Ok).send({
            id: account.id,
            avatar_url: utils.combineAvatarUrlWithHost(req, account.avatar_url),
            email: account.email,
            name: account.name,
            role: account.role
        })
    })

    done()
}