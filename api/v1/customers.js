const { HttpStatusCode } = require('axios')
const utils = require('../../utils')
const { NotFound } = require('http-errors')

module.exports = function (fastify, opts, done) {
    fastify.get('/', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        let customers = []
        const searchQuery = req.query.search ? `%${req.query.search}%` : null
        let whereExpression = 'WHERE 1 = 1'

        if (searchQuery) {
            whereExpression += ` AND name LIKE ?`
        }

        if (
            ['id', 'name', 'email', 'phone_number'].includes(req.query.sort_by)
            && ['asc', 'desc'].includes(req.query.sort_order)
        ) {
            customers = (await fastify.mysql.query(
                `SELECT * FROM customers ${whereExpression} ORDER BY ${req.query.sort_by} ${req.query.sort_order}`,
                searchQuery ? [searchQuery] : []
            ))[0]
        } else {
            customers = (await fastify.mysql.query(
                `SELECT * FROM customers ${whereExpression}`,
                searchQuery ? [searchQuery] : []
            ))[0]
        }
        
        return reply.code(HttpStatusCode.Ok).send(customers)
    })

    fastify.get('/:id', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        const result = (await fastify.mysql.query(
            'SELECT * FROM customers WHERE id = ?',
            [req.params.id]
        ))[0]

        if (result.length < 1) {
            throw NotFound(`Customer with id ${req.params.id} is not exists`)
        }

        const customer = result[0]

        return reply.code(HttpStatusCode.Ok).send(customer)
    })

    fastify.post('/', {
        preHandler: [fastify.authenticate, fastify.onlyAdministrator]
    }, async (req, reply) => {
        utils.checkReqBodyAvailability(req,
            'name',
            'email',
            'phone_number'
        )

        const conn = await fastify.mysql.getConnection()
        
        await conn.query(
            `INSERT INTO customers (name, email, phone_number)
            VALUES (?, ?, ?)`,
            [req.body.name, req.body.email, req.body.phone_number]
        )
        const customer = (await conn.query(
            'SELECT * FROM customers WHERE id = LAST_INSERT_ID()'
        ))[0][0]

        conn.release()

        return reply.code(HttpStatusCode.Created).send(customer)
    })

    fastify.put('/:id', {
        preHandler: [fastify.authenticate, fastify.onlyAdministrator]
    }, async (req, reply) => {
        utils.checkReqBodyAvailability(req,
            'name',
            'email',
            'phone_number'
        )

        await fastify.mysql.query(
            'UPDATE customers SET name = ?, email = ?, phone_number = ? WHERE id = ?',
            [req.body.name, req.body.email, req.body.phone_number, req.params.id]
        )
        
        const customer = (await fastify.mysql.query(
            'SELECT * FROM customers WHERE id = ?',
            [req.params.id]
        ))[0][0]

        return reply.code(HttpStatusCode.Ok).send(customer)
    })

    fastify.delete('/:id', {
        preHandler: [fastify.authenticate, fastify.onlyAdministrator]
    }, async (req, reply) => {
        await fastify.mysql.query(
            'DELETE FROM customers WHERE id = ?',
            [req.params.id]
        )

        return reply.code(HttpStatusCode.ResetContent).send()
    })

    done()
}