const { HttpStatusCode } = require('axios')
const utils = require('../../utils')
const { NotFound, Forbidden, UnprocessableEntity } = require('http-errors')

module.exports = function (fastify, opts, done) {
    fastify.get('/', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        const searchQuery = req.query.search ? `%${req.query.search}%` : null
        let categories = []
        let whereExpression = 'WHERE 1=1'

        if (searchQuery) {
            whereExpression += ` AND name LIKE ?`
        }

        if (
            ['id', 'name', 'description'].includes(req.query.sort_by)
            && ['asc', 'desc'].includes(req.query.sort_order)
        ) {
            categories = (await fastify.mysql.query(
                `SELECT * FROM categories ${whereExpression} ORDER BY ${req.query.sort_by} ${req.query.sort_order}`,
                searchQuery ? [searchQuery] : []
            ))[0]
        } else {
            categories = (await fastify.mysql.query(
                `SELECT * FROM categories ${whereExpression}`,
                searchQuery ? [searchQuery] : []
            ))[0]
        }
        
        return reply.code(HttpStatusCode.Ok).send(categories)
    })

    fastify.get('/:id', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        const result = (await fastify.mysql.query(
            'SELECT * FROM categories WHERE id = ?',
            [req.params.id]
        ))[0]

        if (result.length < 1) {
            throw NotFound(`Category with id ${req.params.id} is not exists`)
        }

        const category = result[0]

        return reply.code(HttpStatusCode.Ok).send(category)
    })

    fastify.post('/', {
        preHandler: [fastify.authenticate, fastify.onlyAdministrator]
    }, async (req, reply) => {
        utils.checkReqBodyAvailability(req,
            'name',
            'description'
        )

        const conn = await fastify.mysql.getConnection()
        try {
            await conn.query(
                `INSERT INTO categories (name, description)
                VALUES (?, ?)`,
                [req.body.name, req.body.description]
            )
            const category = (await conn.query(
                'SELECT * FROM categories WHERE id = LAST_INSERT_ID()'
            ))[0][0]

            conn.release()
    
            return reply.code(HttpStatusCode.Created).send(category)
            
        } catch (error) {
            conn.release()
            throw error
        }    
    })

    fastify.put('/:id', {
        preHandler: [fastify.authenticate, fastify.onlyAdministrator]
    }, async (req, reply) => {
        utils.checkReqBodyAvailability(req,
            'name',
            'description'
        )

        const conn = await fastify.mysql.getConnection()
        try {
            await conn.query(
                'UPDATE categories SET name = ?, description = ? WHERE id = ?',
                [req.body.name, req.body.description, req.params.id]
            )
            
            const category = (await conn.query(
                'SELECT * FROM categories WHERE id = ?',
                [req.params.id]
            ))[0][0]

            conn.release()
    
            return reply.code(HttpStatusCode.Ok).send(category)
            
        } catch (error) {
            conn.release()
            throw error
        }
    })

    fastify.delete('/:id', {
        preHandler: [fastify.authenticate, fastify.onlyAdministrator]
    }, async (req, reply) => {
        await fastify.mysql.query(
            'DELETE FROM categories WHERE id = ?',
            [req.params.id]
        )

        return reply.code(HttpStatusCode.ResetContent).send()
    })

    done()
}