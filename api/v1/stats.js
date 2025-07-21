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
        'last week': 'created_at >= DATE_SUB(CURDATE(), INTERVAL 1 WEEK)',
        'last month': 'created_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)',
        'last year': 'created_at >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)',
        'last 3 years': 'created_at >= DATE_SUB(CURDATE(), INTERVAL 3 YEAR)',
    }[value] ?? 'created_at >= DATE_SUB(CURDATE(), INTERVAL 1 WEEK)'
}

function convertToValidData(dateRange, data, noneData) {
    const num = {
        'last week': 7,
        'last month': 31,
        'last year': 12,
        'last 3 years': 36,
    }[dateRange]
    const newData = new Array(num).fill(null)

    for (let i = 0; i < num; i++) {
        newData[i] = {
            index: i + 1,
            ...noneData
        }
    }

    for (let i = 0; i < data.length; i++) {
        newData[data[i].index - 1] = data[i]
    }

    return newData
}

module.exports = function (fastify, opts, done) {
    fastify.get('/today-sales', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        let result = (await fastify.mysql.query(
            `SELECT SUM(total_cost) AS total_sales, COUNT(*) AS total_transactions
            FROM transactions WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
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
        const whereExpression = getWhereExpressionByDateRange(dateRange)
        const groupByExpression = getGroupByExpressionByDateRange(dateRange)
        const result = (await fastify.mysql.query(
            `SELECT
                ${groupByExpression} AS \`index\`,
                total_cost AS sales FROM transactions
            WHERE type = 'sale' AND ${whereExpression}
            GROUP BY ${groupByExpression}`
        ))[0]
            
        result.forEach((item) => {
            item.sales = parseFloat(item.sales) ?? 0
        })
        
        return reply.code(HttpStatusCode.Ok).send(convertToValidData(dateRange, result, {
            sales: 0
        }))
    })

    fastify.get('/transactions', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        const dateRange = getValidDateRange(req.query.date_range)
        const whereExpression = getWhereExpressionByDateRange(dateRange)
        const groupByExpression = getGroupByExpressionByDateRange(dateRange)
        const result = (await fastify.mysql.query(
            `SELECT
                ${groupByExpression} AS \`index\`,
                SUM(CASE WHEN type = "purchase" THEN 1 ELSE 0 END) AS purchase,
                SUM(CASE WHEN type = "sale" THEN 1 ELSE 0 END) AS sale,
                SUM(CASE WHEN type = "return" THEN 1 ELSE 0 END) AS \`return\`
            FROM transactions
            WHERE ${whereExpression}
            GROUP BY ${groupByExpression}`
        ))[0]

        result.forEach((item) => {
            item.purchase = parseInt(item.purchase) ?? 0
            item.sale = parseInt(item.sale) ?? 0
            item.return = parseInt(item.return) ?? 0
        })
        
        return reply.code(HttpStatusCode.Ok).send(convertToValidData(dateRange, result, {
            purchase: 0,
            sale: 0,
            return: 0,
        }))
    })

    fastify.get('/most-used-product-stock', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        const dateRange = getValidDateRange(req.query.date_range)
        const whereExpression = getWhereExpressionByDateRange(dateRange)
        const groupByExpression = getGroupByExpressionByDateRange(dateRange)

        const mostUsageTransactionItems = (await fastify.mysql.query(
            `SELECT COUNT(*) AS _usage, product_id, unit_name FROM transaction_items
                WHERE ${whereExpression}
                ORDER BY _usage DESC
            `
        ))[0][0]

        const stockLogs = (await fastify.mysql.query(
            `SELECT
                ${groupByExpression} AS \`index\`,
                init_stock AS stock FROM stock_logs
            WHERE ${whereExpression} AND product_id = ?
            GROUP BY ${groupByExpression}
            `,
            [mostUsageTransactionItems.product_id]
        ))[0]

        return reply.code(HttpStatusCode.Ok).send({
            product: {
                id: mostUsageTransactionItems.product_id ?? 0,
                name: mostUsageTransactionItems.unit_name ?? '',
                total_transactions: mostUsageTransactionItems._usage,
            },
            stock_logs: convertToValidData(dateRange, stockLogs, {stock: 0})
        })
    })

    done()
}