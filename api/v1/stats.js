const { HttpStatusCode } = require('axios')
const utils = require('../../utils')
const { NotFound } = require('http-errors')

function getValidDateRange(value) {
    return [
        'last week',
        'last month',
        'last year',
        'last 3 years',
    ].includes(value) ? value : 'last week'
}

function getGroupByExpressionByDateRange(value) {
    return {
        'last week': 'DAY(created_at)',
        'last month': 'DAY(created_at)',
        'last year': 'MONTH(created_at)',
        'last 3 years': 'MONTH(created_at)',
    }[value] ?? 'DAY(created_at)'
}

function getWhereExpressionByDateRange(value) {
    return {
        'last week': 'WEEK(created_at) = WEEK(NOW()) - 0',
        'last month': 'MONTH(created_at) = MONTH(NOW()) - 1',
        'last year': 'YEAR(created_at) = YEAR(NOW()) - 1',
        'last 3 years': 'WEEK(created_at) = WEEK(NOW()) - 3',
    }[value] ?? 'BY DAY(created_at)'
}

module.exports = function (fastify, opts, done) {
    fastify.get('/today-sales', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        let result = (await fastify.mysql.query(
            `SELECT SUM(total_cost) AS total_sales, COUNT(*) AS total_transactions
            FROM transactions WHERE DAY(created_at) = DAY(NOW())
            `
        ))[0][0]

        result.total_sales = parseFloat(result.total_sales ?? 0)

        return reply.code(200).send(result)
    })

    fastify.get('/summary', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        const dateRange = getValidDateRange(req.query.date_range)
        const whereExpression = getWhereExpressionByDateRange(dateRange)
        let result = (await fastify.mysql.query(
            `SELECT (
                SELECT COUNT(DISTINCT product_id)
                FROM stock_logs
                WHERE init_stock >= 1 AND init_stock < 10 AND ${whereExpression}
            ) AS low_stock_items,
            (
                SELECT COUNT(DISTINCT product_id)
                FROM transaction_items
                WHERE ${whereExpression}
            ) AS total_items,
            (
                SELECT COUNT(*)
                FROM transactions
                WHERE ${whereExpression}
            ) AS total_transactions
            `
        ))[0][0]

        return reply.code(200).send(result)
    })

    fastify.get('/stock-levels', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        let result = (await fastify.mysql.query(
            `SELECT (
                SELECT COUNT(stock)
                FROM products
                WHERE stock <= 0
            ) AS _empty,
            (
                SELECT COUNT(stock)
                FROM products
                WHERE stock >= 1 AND stock < 10
            ) AS low,
            (
                SELECT COUNT(stock)
                FROM products
                WHERE stock >= 10
            ) AS normal
            `
        ))[0][0]
        
        return reply.code(HttpStatusCode.Ok).send({
            empty: result._empty,
            low: result.low,
            normal: result.normal,
            total: result._empty + result.low + result.normal,
        })
    })

    fastify.get('/total-sales', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        const dateRange = getValidDateRange(req.query.date_range)
        const result = (await fastify.mysql.query(
            `SELECT total_cost AS sales FROM transactions
            WHERE type = 'sale' AND ${getWhereExpressionByDateRange(dateRange)}
            GROUP BY ${getGroupByExpressionByDateRange(dateRange)}`
        ))[0]
            
        result.forEach((item, index) => {
            item.index = index
            item.sales = parseFloat(item.sales) || 0
        })
        
        return reply.code(HttpStatusCode.Ok).send(result)
    })

    fastify.get('/transactions', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        const dateRange = getValidDateRange(req.query.date_range)
        const whereExpression = getWhereExpressionByDateRange(dateRange)
        const groupByExpression = getGroupByExpressionByDateRange(dateRange)
        const result = (await fastify.mysql.query(
            `SELECT (
                SELECT COUNT(*) FROM transactions
                WHERE ${whereExpression} AND type = 'purchase'
                GROUP BY ${groupByExpression}
            ) AS purchase, (
                SELECT COUNT(*) FROM transactions
                WHERE ${whereExpression} AND type = 'sale'
                GROUP BY ${groupByExpression}
            ) AS sale, (
                SELECT COUNT(*) FROM transactions
                WHERE ${whereExpression} AND type = 'return'
                GROUP BY ${groupByExpression}
            ) AS _return`
        ))[0]

        result.forEach((item) => {
            item.index = index
            item.purchase = item.purchase ?? 0
            item.sale = item.sale ?? 0
            item.return = item._return ?? 0
            delete item._return
        })
        
        return reply.code(HttpStatusCode.Ok).send(result)
    })

    fastify.get('/most-used-product-stock', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        const dateRange = getValidDateRange(req.query.date_range)
        const whereExpression = getWhereExpressionByDateRange(dateRange)
        const groupByExpression = getGroupByExpressionByDateRange(dateRange)
        let result

        result = (await fastify.mysql.query(
            `SELECT COUNT(*) AS _usage, product_id FROM transaction_items
                WHERE ${whereExpression}
                ORDER BY _usage DESC
            `
        ))[0]
        const mostUsageProductId = result[0].product_id

        result = (await fastify.mysql.query(
            `SELECT init_stock AS stock FROM stock_logs
                WHERE ${whereExpression} AND product_id = ?
                GROUP BY ${groupByExpression}
            `,
            [mostUsageProductId]
        ))[0]

        result.forEach((item, index) => {
            item.index = index
        })
        
        return reply.code(HttpStatusCode.Ok).send(result)
    })

    done()
}