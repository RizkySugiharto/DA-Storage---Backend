const { BadRequest, InternalServerError } = require('http-errors')
const utils = require('./utils')
const config = require('./config')
const logger = require('./logger')
const plugins = require('./plugins')
const fs = require('fs')
const schedule = require('node-schedule')
const cloudinary = require('cloudinary').v2;

async function main() {
    // Load configurations
    config.loadEnvConfig()
    config.loadFirebaseCredentials()
    
    // Initialize the app
    const fastify = require('fastify')({
        logger: logger
    })

    // Register all plugins
    await plugins.loadPlugins(fastify)

    // Setup Cloudinary
    cloudinary.config({
        secure: true,
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    })
    fastify.log.info('Setup cloudinary has been finished')
    
    // Register all routes
    const API_VERSION = `v${process.env.API_VERSION}`
    for (const file of fs.readdirSync(`${__dirname}/api/${API_VERSION}/`).filter(file => file.endsWith('.js'))) {
        const routeName = file.replace('.js', '')
        fastify.register(require(`./api/${API_VERSION}/${routeName}`), { prefix: `/${API_VERSION}/${routeName}` })
    }
    fastify.get('/avatars/:publicId', async (req, reply) => {
        if (req.params.publicId.includes('default')) {   
            return reply.send(fs.createReadStream(`${__dirname}/avatars/default.png`))
        }
        
        try {
            const result = await cloudinary.api.resource(req.params.publicId)
            const buffer = await utils.getBufferFromUrl(result.secure_url)
            
            reply.header('Content-Type', `${result.resource_type}/${result.format}`)
            return reply.send(buffer)
        } catch (error) {
            fastify.log.error(error)
            return reply.send(fs.createReadStream(`${__dirname}/avatars/default.png`))
        }
    })
    fastify.get('/', async (req, reply) => {
        return "Hello, World"
    })

    // Setup Error Handler
    fastify.setErrorHandler((error, request, reply) => {
        const statusCode = error.statusCode || 500
        return utils.isDevMode() ?
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