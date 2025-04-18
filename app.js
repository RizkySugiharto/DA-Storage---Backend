const { BadRequest, InternalServerError } = require('http-errors')
const { isDevMode } = require('./utils')
const config = require('./config')
const logger = require('./logger')
const plugins = require('./plugins')
const fs = require('fs')
const schedule = require('node-schedule')

async function main() {
    // Load environtment configuration
    config.loadConfig()
    
    // Initialize the app
    const fastify = require('fastify')({
        logger: logger
    })

    // Register all plugins
    await plugins.loadPlugins(fastify)
    
    // Register all routes
    const API_VERSION = `v${process.env.API_VERSION}`
    for (const file of fs.readdirSync(`${__dirname}/api/${API_VERSION}/`).filter(file => file.endsWith('.js'))) {
        const routeName = file.replace('.js', '')
        fastify.register(require(`./api/${API_VERSION}/${routeName}`), { prefix: `/${API_VERSION}/${routeName}` })
    }
    fastify.get('/avatars/:filename', async (req, reply) => {
        const { filename } = req.params
        const filePath = `${__dirname}/avatars/${filename}`
        
        if (fs.existsSync(filePath)) {
            return reply.send(fs.createReadStream(filePath))
        } else {
            return reply.send(fs.createReadStream(`${__dirname}/avatars/default.png`))
        }
    })
    fastify.get('/', async (req, reply) => {
        return "Hello, World"
    })

    // Setup Error Handler
    fastify.setErrorHandler((error, request, reply) => {
        const statusCode = error.statusCode || 500
        return isDevMode() ?
            reply.code(statusCode).send(error) :
            reply.code(statusCode).send({
                400: BadRequest('Something went wrong with the request'),
                500: InternalServerError('Something went wrong with the server')
            }[statusCode] || error)
        })
        
    // Start the app
    fastify.listen({ port: process.env.PORT, host: '0.0.0.0' }, (err, address) => {
        if (err) {
            fastify.log.error(err)
            process.exit(1)
        }
    
        fastify.log.info(`Environment: ${process.env.NODE_ENV}`)
        fastify.log.info(`App listening on: ${address}`)
        fastify.log.info(`API Url: ${address}/${API_VERSION}`)

        // Check mysql connection and load the schema.sql
        const SCHEMA_FILE = './db/schema.sql'
        fs.readFile(SCHEMA_FILE, async (err, data) => {
            try {
                if (err) throw err
    
                const conn = await fastify.mysql.getConnection()
                fastify.log.info('Successfully connected to database')
    
                await conn.query(data.toString('utf8'))
                conn.release()
                fastify.log.info(`Successfully run the "${SCHEMA_FILE}" on database`)
            } catch (error) {
                fastify.log.error(error)   
            }
        })
    })

    // Start scheluded task for clearing avatar images which is no need
    schedule.scheduleJob('0 0 0 1 * *', async () => {
        const avatarsDirPath = `${__dirname}/avatars`
        const neededAvatars = new Set(
            (await fastify.mysql.query(
                `SELECT DISTINCT avatar_url FROM accounts WHERE avatar_url != NULL`
            ))[0].map((item) => item.avatar_url)
        )

        if (!fs.existsSync(avatarsDirPath)) {
            fs.mkdir(avatarsDirPath)
            fastify.log.info('avatars directory does not exists. Creating dir....')
            return
        }

        fs.readdir(avatarsDirPath, (err, files) => {
            if (err) {
                fastify.log.error(err)
                return
            }

            files.forEach((file) => {
                const filePath = `${avatarsDirPath}/${file}`
                if (neededAvatars.has(file)
                    || ['default.png', 'default.jpg', 'default.jpeg'].includes(file)
                ) {
                    return
                }

                fs.unlink(filePath, (err) => {
                    if (err) {
                        fastify.log.error(`Failed to delete ${filePath}: ${err}`)
                    } else {
                        fastify.log.info(`Deleted unused avatar image: ${file}`)
                    }
                })
            })  
        })
    })

}

main()