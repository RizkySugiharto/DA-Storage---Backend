const { HttpStatusCode } = require('axios')
const utils = require('../../utils')
const { NotFound, Forbidden, UnprocessableEntity } = require('http-errors')

module.exports = function (fastify, opts, done) {
    fastify.get('/', {
        preHandler: [fastify.authenticate, fastify.onlyAdministrator]
    }, async (req, reply) => {
        const conn = await fastify.mysql.getConnection()
        const searchQuery = req.query.search ? `%${req.query.search}%` : null
        let searchExpression = ''
        let sortExpression = 'ORDER BY name ASC'
        let sqlQueryParams = []
        let accounts = {}

        if (searchQuery) {
            searchExpression += `AND name LIKE ?`
            sqlQueryParams.push(searchQuery)
        }

        if (
            ['id', 'name', 'email', 'role'].includes(req.query.sort_by)
            && ['asc', 'desc'].includes(req.query.sort_order)
        ) {
            sortExpression = `ORDER BY ${req.query.sort_by} ${req.query.sort_order}`;
        }
        
        try {
            if (req.query.role && utils.isRoleValid(req.query.role)) {
                sqlQueryParams = [req.query.role, ...sqlQueryParams]
                accounts = (await conn.query(
                    `SELECT id, avatar_url, name, email, role FROM accounts WHERE role = ? ${searchExpression} ${sortExpression}`,
                    sqlQueryParams
                ))[0]
            } else {
                accounts = (await conn.query(
                    `SELECT id, avatar_url, name, email, role FROM accounts WHERE 1=1 ${searchExpression} ${sortExpression}`,
                    sqlQueryParams
                ))[0]
            }
        } catch (error) {
            throw error
        } finally {
            conn.release()
        }
        
        accounts.forEach((account) => {
            account.avatar_url = utils.combineAvatarUrlWithHost(req, account.avatar_url)
        })

        return reply.code(HttpStatusCode.Ok).send(accounts)
    })

    fastify.get('/:accountId', {
        preHandler: [fastify.authenticate, fastify.onlyAdministrator]
    }, async (req, reply) => {
        const result = (await fastify.mysql.query(
            'SELECT id, avatar_url, name, email, role FROM accounts WHERE id = ?',
            [req.params.accountId]
        ))[0]

        if (result.length < 1) {
            throw NotFound(`Account with id ${req.params.accountId} is not exists`)
        }

        const account = result[0]
        account.avatar_url = utils.combineAvatarUrlWithHost(req, account.avatar_url)

        return reply.code(HttpStatusCode.Ok).send(account)
    })

    fastify.post('/', {
        preHandler: [fastify.authenticate, fastify.onlyAdministrator]
    }, async (req, reply) => {
        utils.checkReqBodyAvailability(req,
            'name',
            'email',
            'role',
            'password'
        )

        const avatarPublicId = req.body.avatar_file ? await utils.saveAvatarFile(req.body.avatar_file) : null
        const conn = await fastify.mysql.getConnection()
        
        await conn.query(
            `INSERT INTO accounts (avatar_url, name, email, role, password)
            VALUES (?, ?, ?, ?, ?)`,
            [avatarPublicId, req.body.name, req.body.email, req.body.role, utils.hashPassword(req.body.password)]
        )
        const account = (await conn.query(
            'SELECT id, avatar_url, name, email, role FROM accounts WHERE id = LAST_INSERT_ID()'
        ))[0][0]

        conn.release()
        account.avatar_url = utils.combineAvatarUrlWithHost(req, avatarPublicId)

        return reply.code(HttpStatusCode.Created).send(account)
    })

    fastify.put('/:accountId', {
        preHandler: [fastify.authenticate, fastify.onlyAdministrator]
    }, async (req, reply) => {
        utils.checkReqBodyAvailability(req,
            'email',
            'name',
            'role'
        )

        await fastify.mysql.query(
            'UPDATE accounts SET email = ?, name = ?, role = ? WHERE id = ?',
            [req.body.email, req.body.name, req.body.role, req.params.accountId]
        )
        
        if (req.body.password) {
            await fastify.mysql.query(
                'UPDATE accounts SET password = ? WHERE id = ?',
                [utils.hashPassword(req.body.password), req.params.accountId]
            )
        }
        
        if (req.body.avatar_file?.filename) {
            const avatarPublicId = await utils.saveAvatarFile(req.body.avatar_file)
            await fastify.mysql.query(
                'UPDATE accounts SET avatar_url = ? WHERE id = ?',
                [avatarPublicId, req.params.accountId]
            )
        }

        const account = (await fastify.mysql.query(
            'SELECT id, avatar_url, name, email, role FROM accounts WHERE id = ?',
            [req.params.accountId]
        ))[0][0]
        account.avatar_url = utils.combineAvatarUrlWithHost(req, account.avatar_url)

        return reply.code(HttpStatusCode.Ok).send(account)
    })

    fastify.delete('/:accountId', {
        preHandler: [fastify.authenticate, fastify.onlyAdministrator]
    }, async (req, reply) => {
        await fastify.mysql.query(
            'DELETE FROM accounts WHERE id = ?',
            [req.params.accountId]
        )

        return reply.code(HttpStatusCode.ResetContent).send()
    })

    done()
}