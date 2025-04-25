const { HttpStatusCode } = require('axios')
const utils = require('../../utils')
const { NotFound } = require('http-errors')

module.exports = function (fastify, opts, done) {
    fastify.get('/', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        const searchQuery = req.query.search ? `%${req.query.search}%` : null
        let suppliers = []
        let whereExpression = 'WHERE 1=1'

        if (searchQuery) {
            whereExpression += ` AND name LIKE ?`
        }

        if (
            ['id', 'name', 'email', 'phone_number'].includes(req.query.sort_by)
            && ['asc', 'desc'].includes(req.query.sort_order)
        ) {
            suppliers = (await fastify.mysql.query(
                `SELECT * FROM suppliers ${whereExpression} ORDER BY ${req.query.sort_by} ${req.query.sort_order}`,
                searchQuery ? [searchQuery] : []
            ))[0]
        } else {
            suppliers = (await fastify.mysql.query(
                `SELECT * FROM suppliers ${whereExpression}`,
                searchQuery ? [searchQuery] : []
            ))[0]
        }
        
        return reply.code(HttpStatusCode.Ok).send(suppliers)
    })

    fastify.get('/:id', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        const result = (await fastify.mysql.query(
            'SELECT * FROM suppliers WHERE id = ?',
            [req.params.id]
        ))[0]

        if (result.length < 1) {
            throw NotFound(`Supplier with id ${req.params.id} is not exists`)
        }

        const supplier = result[0]

        return reply.code(HttpStatusCode.Ok).send(supplier)
    })

    fastify.post('/', {
        preHandler: [fastify.authenticate, fastify.onlyAdministrator]
    }, async (req, reply) => {
        utils.checkReqBodyAvailability(req,
            'name',
        )

        const conn = await fastify.mysql.getConnection()
        
        await conn.query(
            `INSERT INTO suppliers (name, email, phone_number)
            VALUES (?, ?, ?)`,
            [req.body.name, req.body.email, req.body.phone_number]
        )
        const supplier = (await conn.query(
            'SELECT * FROM suppliers WHERE id = LAST_INSERT_ID()'
        ))[0][0]

        conn.release()

        return reply.code(HttpStatusCode.Created).send(supplier)
    })

    fastify.put('/:id', {
        preHandler: [fastify.authenticate, fastify.onlyAdministrator]
    }, async (req, reply) => {
        utils.checkReqBodyAvailability(req,
            'name',
        )

        await fastify.mysql.query(
            'UPDATE suppliers SET name = ?, email = ?, phone_number = ? WHERE id = ?',
            [req.body.name, req.body.email ?? '', req.body.phone_number ?? '', req.params.id]
        )
        
        const supplier = (await fastify.mysql.query(
            'SELECT * FROM suppliers WHERE id = ?',
            [req.params.id]
        ))[0][0]

        return reply.code(HttpStatusCode.Ok).send(supplier)
    })

    fastify.delete('/:id', {
        preHandler: [fastify.authenticate, fastify.onlyAdministrator]
    }, async (req, reply) => {
        await fastify.mysql.query(
            'DELETE FROM suppliers WHERE id = ?',
            [req.params.id]
        )

        return reply.code(HttpStatusCode.ResetContent).send()
    })

    done()
}