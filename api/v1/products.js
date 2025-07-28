const { HttpStatusCode } = require('axios')
const utils = require('../../utils')
const { NotFound } = require('http-errors')

async function checkCategoryExists(conn, category_id) {
    const isCategoryExists = (await conn.query(
        'SELECT EXISTS(SELECT 1 FROM categories WHERE id = ?) AS isExists', 
        [category_id]
    ))[0][0].isExists

    if (isCategoryExists == 0) {
        return NotFound(`Category with id ${category_id} does not exist`)
    }
}

module.exports = function (fastify, opts, done) {
    fastify.get('/', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        let products = []
        const searchQuery = req.query.search ? `%${req.query.search}%` : null
        let whereExpression = 'WHERE 1 = 1'
        let crrntFilterExpr = ' AND ('
        let crrntFilterArr = []
        let isFilterFirst = true
        const getFilterOperator = () => isFilterFirst ? '' : 'OR'
        const isCrrntFilterActive = () => crrntFilterArr.length > 0;

        if (searchQuery) {
            whereExpression += ` AND products.id LIKE ? OR products.name LIKE ? OR categories.name LIKE ?`
        }
        
        crrntFilterArr = utils.convertFilterTextToArray(req.query.filter_stock_level)
        if (isCrrntFilterActive()) {
            crrntFilterExpr = ' AND ('
            isFilterFirst = true
            if (crrntFilterArr.includes('empty')) {
                crrntFilterExpr += `${getFilterOperator()} stock = 0 `
                isFilterFirst = false
            }
            if (crrntFilterArr.includes('low')) {
                crrntFilterExpr += `${getFilterOperator()} stock < 10 `
                isFilterFirst = false
            }
            if (crrntFilterArr.includes('normal')) {
                crrntFilterExpr += `${getFilterOperator()} stock >= 10 `
                isFilterFirst = false
            }
            isFilterFirst = false
            crrntFilterExpr += ')'
            crrntFilterArr = []
            whereExpression += crrntFilterExpr
        }

        crrntFilterArr = utils.convertFilterTextToArray(req.query.filter_category_id)
        if (isCrrntFilterActive()) {
            crrntFilterExpr = ' AND ('
            isFilterFirst = true
            crrntFilterExpr += `${getFilterOperator()} category_id IN (${crrntFilterArr.map((item) => parseInt(item)).join(',')}) `
            isFilterFirst = false
            crrntFilterExpr += ')'
            crrntFilterArr = []
            whereExpression += crrntFilterExpr
        }

        crrntFilterArr = utils.convertFilterTextToArray(req.query.filter_updated_date)
        if (isCrrntFilterActive()) {
            crrntFilterExpr = ' AND ('
            isFilterFirst = true
            if (crrntFilterArr.includes('today')) {
                crrntFilterExpr += `${getFilterOperator()} updated_at = CURDATE() `
                isFilterFirst = false
            } else if (crrntFilterArr.includes('1 week')) {
                crrntFilterExpr += `${getFilterOperator()} updated_at >= DATE_SUB(CURDATE(), INTERVAL 1 WEEK) `
                isFilterFirst = false
            } else if (crrntFilterArr.includes('1 month')) {
                crrntFilterExpr += `${getFilterOperator()} updated_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) `
                isFilterFirst = false
            } else if (crrntFilterArr.includes('3 months')) {
                crrntFilterExpr += `${getFilterOperator()} updated_at >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH) `
                isFilterFirst = false
            } else if (crrntFilterArr.includes('6 months')) {
                crrntFilterExpr += `${getFilterOperator()} updated_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) `
                isFilterFirst = false
            } else if (crrntFilterArr.includes('1 year')) {
                crrntFilterExpr += `${getFilterOperator()} updated_at >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR) `
                isFilterFirst = false
            } else if (crrntFilterArr.includes('2 years')) {
                crrntFilterExpr += `${getFilterOperator()} updated_at >= DATE_SUB(CURDATE(), INTERVAL 2 YEAR) `
                isFilterFirst = false
            } else if (crrntFilterArr.includes('3 years')) {
                crrntFilterExpr += `${getFilterOperator()} updated_at >= DATE_SUB(CURDATE(), INTERVAL 3 YEAR) `
                isFilterFirst = false
            }
            isFilterFirst = false
            crrntFilterExpr += ')'
            crrntFilterArr = []
            whereExpression += crrntFilterExpr
        }

        if (
            ['id', 'name', 'price', 'stock', 'updated_at'].includes(req.query.sort_by)
            && ['asc', 'desc'].includes(req.query.sort_order)
        ) {
            if (req.query.sort_by == 'id') {
                req.query.sort_by = 'products.id'
            } else if (req.query.sort_by == 'name') {
                req.query.sort_by = 'products.name'
            }

            products = (await fastify.mysql.query(
                `SELECT products.id AS id, category_id, categories.name AS category_name, products.name AS name, price, stock, updated_at FROM products JOIN categories ON products.category_id = categories.id ${whereExpression} ORDER BY ${req.query.sort_by} ${req.query.sort_order}`,
                searchQuery ? [searchQuery, searchQuery, searchQuery] : []
            ))[0]
        } else {
            products = (await fastify.mysql.query(
                `SELECT products.id AS id, category_id, categories.name AS category_name, products.name AS name, price, stock, updated_at FROM products JOIN categories ON products.category_id = categories.id ${whereExpression}`,
                searchQuery ? [searchQuery, searchQuery, searchQuery] : []
            ))[0]
        }

        products.forEach((item) => {
            item.category = {
                id: item.category_id,
                name: item.category_name,
            }
            delete item.category_id;
            delete item.category_name;
            item.price = parseFloat(item.price)
        })
        
        return reply.code(HttpStatusCode.Ok).send(products)
    })

    fastify.get('/:id', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        const result = (await fastify.mysql.query(
            'SELECT products.id AS id, category_id, categories.name AS category_name, products.name AS name, price, stock, updated_at FROM products JOIN categories ON products.category_id = categories.id WHERE products.id = ?',
            [req.params.id]
        ))[0]

        if (result.length < 1) {
            throw NotFound(`Product with id ${req.params.id} does not exists`)
        }

        const product = result[0]
        product.price = parseFloat(product.price)
        product.category = {
            id: product.category_id,
            name: product.category_name,
        }
        delete product.category_id;
        delete product.category_name;

        return reply.code(HttpStatusCode.Ok).send(product)
    })

    fastify.post('/', {
        preHandler: [fastify.authenticate, fastify.onlyAdministrator]
    }, async (req, reply) => {
        utils.checkReqBodyAvailability(req,
            'name',
            'category_id',
            'price',
            'stock',
        )

        const conn = await fastify.mysql.getConnection()
        
        if (error = await checkCategoryExists(conn, req.body.category_id)) {
            return error
        }

        await conn.query(
            `INSERT INTO products (name, category_id, price, stock, updated_at)
            VALUES (?, ?, ?, ?, ?)`,
            [req.body.name, req.body.category_id, req.body.price, req.body.stock, new Date(Date.now())]
        )
        const product = (await conn.query(
            'SELECT * FROM products WHERE id = LAST_INSERT_ID()'
        ))[0][0]

        conn.release()

        product.price = parseFloat(product.price)
        product.category = {
            id: product.category_id,
            name: product.category_name,
        }
        delete product.category_id;
        delete product.category_name;

        return reply.code(HttpStatusCode.Created).send(product)
    })

    fastify.put('/:id', {
        preHandler: [fastify.authenticate, fastify.onlyAdministrator]
    }, async (req, reply) => {
        utils.checkReqBodyAvailability(req,
            'name',
            'category_id',
            'price',
            'stock',
        )

        if (error = await checkCategoryExists(fastify.mysql, req.body.category_id)) {
            return error
        }

        await fastify.mysql.query(
            'UPDATE products SET name = ?, category_id = ?, price = ?, stock = ?, updated_at = ? WHERE id = ?',
            [req.body.name, req.body.category_id, req.body.price, req.body.stock, new Date(Date.now()), req.params.id]
        )

        const product = (await fastify.mysql.query(
            'SELECT * FROM products WHERE id = ?',
            [req.params.id]
        ))[0][0]

        product.price = parseFloat(product.price)
        product.category = {
            id: product.category_id,
            name: product.category_name,
        }
        delete product.category_id;
        delete product.category_name;

        if (product.stock < 10) {
            fastify.notificationManager.notifyEmptyStock(product.name)
        } else if (product.stock < 10) {
            fastify.notificationManager.notifyLowStock(product.name)
        }

        return reply.code(HttpStatusCode.Ok).send(product)
    })

    fastify.delete('/:id', {
        preHandler: [fastify.authenticate, fastify.onlyAdministrator]
    }, async (req, reply) => {
        await fastify.mysql.query(
            'DELETE FROM products WHERE id = ?',
            [req.params.id]
        )

        return reply.code(HttpStatusCode.ResetContent).send()
    })

    done()
}