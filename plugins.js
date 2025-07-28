const { Unauthorized, Forbidden } = require('http-errors')
const utils = require('./utils')
const firebaseAdmin = require('firebase-admin');

async function loadPlugins(fastify) {
    await fastify.register(require('@fastify/rate-limit'), {
        max: Number(process.env.ALLOWED_REQUEST_PER_MINUTE),
        timeWindow: 60 * 1000,
        hook: 'preHandler',
        keyGenerator: (req) => (
            req.headers[process.env.JWT_HEADER_NAME] ||
            req.headers['x-client-ip'] ||
            req.headers['user-agent']
        )
    })

    await fastify.register(require('@fastify/mysql'), {
        host: process.env.MYSQL_HOST,
        port: Number(process.env.MYSQL_PORT),
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        multipleStatements: true,
        promise: true
    })

    fastify.register(require('@fastify/jwt'), {
        secret: process.env.JWT_SECRET_KEY
    })
    fastify.decorate('authenticate', async (req, reply) => {
        const ERR_NOT_LOGGED_IN = Unauthorized("You still haven't login yet.")
        const token = req.headers[process.env.JWT_HEADER_NAME.toLowerCase()]
        if (!token) {
            throw ERR_NOT_LOGGED_IN
        }

        const decoded = fastify.jwt.decode(token)
        req.jwtDecoded = decoded
    })
    fastify.decorate('onlyAdministrator', async (req, reply) => {
        if (!utils.isAdministrator(req.jwtDecoded.role)) {
            throw Forbidden("You don't have permissions to access the endpoint")
        }
    })
    fastify.decorate('notificationManager', {
        notifyLowStock: (productName) => {
            firebaseAdmin.messaging().sendEachForMulticast({
                notification: {
                    title: 'Stock Warning',
                    body: `Product ${productName} has stock less than 10`
                },
                topic: 'notifications-lowstock',    
            })
        },
        notifyEmptyStock: (productName) => {
            firebaseAdmin.messaging().sendEachForMulticast({
                notification: {
                    title: 'Stock Warning',
                    body: `Product ${productName} has no stock`
                },
                topic: 'notifications-emptystock',    
            })
        }
    })

    fastify.register(require('@fastify/formbody'))
    fastify.register(require('@fastify/multipart'), {
        attachFieldsToBody: true,
    })
    fastify.addHook('preValidation', async (req, reply) => {
        if (!req.isMultipart()) {
            return
        }

        const newBody = Object.fromEntries(
            Object.keys(req.body).map((key) => {
                if (req.body[key].type == 'field') {
                    return [key, req.body[key].value]
                }
                return [key, req.body[key]]
            })
        )
        
        req.body = newBody
    })

    fastify.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
        try {
            var json = JSON.parse(body)
            done(null, json)
        } catch (error) {
            error.statusCode = 400
            done(error, undefined)
        }
    })
    fastify.register(require('@fastify/compress'))
}

module.exports = {
    loadPlugins
}