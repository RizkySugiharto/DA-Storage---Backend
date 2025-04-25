const { HttpStatusCode } = require('axios')
const utils = require('../../utils')
const { NotFound, UnprocessableEntity, BadRequest } = require('http-errors')

module.exports = function (fastify, opts, done) {
    fastify.get('/', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        const filterDateRange = [1, 3, 6, 12, 24, 36].includes(parseInt(req.query.filter_date_range)) ? req.query.filter_date_range : 3
        const filterType = ['purchase', 'sale', 'return'].includes(req.query.filter_type) ? req.query.filter_type : 'all'
        let transactions = []
        let filterExpression = 'WHERE '

        filterExpression += `created_at >= DATE_SUB(CURDATE(), INTERVAL ${filterDateRange} MONTH) `
        filterExpression += filterType != 'all'
            ? `AND type = '${filterType}'`
            : ''
        
        if (req.query.recent == 'true') {
            transactions = (await fastify.mysql.query(
                `SELECT id, created_at, total_cost, type FROM transactions WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 24 HOUR)`,
            ))[0]
        } else if (
            ['id', 'type', 'total_cost', 'created_at'].includes(req.query.sort_by)
            && ['asc', 'desc'].includes(req.query.sort_order)
        ) {
            transactions = (await fastify.mysql.query(
                `SELECT id, created_at, total_cost, type FROM transactions ${filterExpression} ORDER BY ${req.query.sort_by} ${req.query.sort_order}`,
            ))[0]
        } else {
            transactions = (await fastify.mysql.query(
                `SELECT id, created_at, total_cost, type FROM transactions ${filterExpression}`,
            ))[0]
        }

        transactions.forEach((item) => {
            item.total_cost = parseFloat(item.total_cost)
        })
        
        return reply.code(HttpStatusCode.Ok).send(transactions)
    })

    fastify.get('/:id', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        let result, customer, supplier

        result = (await fastify.mysql.query(
            'SELECT id, account_id, supplier_id, customer_id, type, created_at, total_cost FROM transactions WHERE id = ?',
            [req.params.id]
        ))[0]
        if (result.length < 1) {
            return NotFound(`Transactions with id ${req.params.id} does not exists`)
        }
        const transaction = result[0]

        const account = (await fastify.mysql.query(
            'SELECT id, name, email, role FROM accounts WHERE id = ?',
            [transaction.account_id]
        ))[0][0]

        
        const transaction_items = (await fastify.mysql.query(
            'SELECT product_id, unit_name, unit_price, quantity FROM transaction_items WHERE transaction_id = ?',
            [req.params.id]
        ))[0]
        const stock_logs = (await fastify.mysql.query(
            'SELECT product_id, init_stock, change_type, quantity FROM stock_logs WHERE transaction_id = ?',
            [req.params.id]
        ))[0]
        
        if (stock_logs[0].change_type == 'out') {
            customer = (await fastify.mysql.query(
                'SELECT * FROM customers WHERE id = ?',
                [transaction.customer_id]
            ))[0][0]
        } else if (stock_logs[0].change_type == 'in') {
            supplier = (await fastify.mysql.query(
                'SELECT * FROM suppliers WHERE id = ?',
                [transaction.supplier_id]
            ))[0][0]
        }

        transaction_items.forEach((item) => {
            item.unit_price = parseFloat(item.unit_price)
        })

        const transaction_details = {
            details: {
                id: transaction.id,
                type: transaction.type,
                created_at: transaction.created_at
            },
            account: account ?? {},
            customer: customer ?? {},
            supplier: supplier ?? {},
            items: transaction_items,
            stock_logs: stock_logs,
            total_cost: parseFloat(transaction.total_cost)
        }

        return reply.code(HttpStatusCode.Ok).send(transaction_details)
    })

    fastify.post('/', {
        preHandler: [fastify.authenticate, fastify.onlyAdministrator]
    }, async (req, reply) => {
        utils.checkReqBodyAvailability(req,
            'type',
            'stock_change_type',
            'items',
            'total_cost'
        )

        if (req.body.items.length < 1) {
            return BadRequest('At least one item is required in the transaction')
        }

        const conn = await fastify.mysql.getConnection()
        const dateNow = new Date(Date.now())

        switch (req.body.type) {
            case 'purchase':
                if (!req.body.supplier_id) {
                    return BadRequest('supplier_id is required for [purchase] transactions')
                } else if (req.body.stock_change_type != 'in') {
                    return UnprocessableEntity('Invalid stock_change_type field. Please use [in]')
                }

                if ((await conn.query(
                    'SELECT EXISTS(SELECT 1 FROM suppliers WHERE id = ?) AS supplier_exists',
                    [req.body.supplier_id]
                ))[0][0].supplier_exists == 0) {
                    return NotFound(`Supplier with id ${req.body.supplier_id} does not exists`)
                }

                break;
            case 'sale':
                if (!req.body.customer_id) {
                    return BadRequest('customer_id is required for [sale] transactions')
                } else if (req.body.stock_change_type != 'out') {
                    return UnprocessableEntity('Invalid stock_change_type field. Please use [out]')
                }

                if ((await conn.query(
                    'SELECT EXISTS(SELECT 1 FROM customers WHERE id = ?) AS customer_exists',
                    [req.body.customer_id]
                ))[0][0].customer_exists == 0) {
                    return NotFound(`Customer with id ${req.body.customer_id} does not exists`)
                }

                break;
            case 'return':
                if (!(req.body.supplier_id && req.body.customer_id)) {
                    return BadRequest('supplier_id or customer_id is required for [return] transactions')
                }

                result = (await conn.query(
                    `SELECT EXISTS(SELECT 1 FROM suppliers WHERE id = ?) AS supplier_exists,
                            EXISTS(SELECT 1 FROM customers WHERE id = ?) AS customer_exists`,
                    [req.body.supplier_id ?? 0, req.body.customer_id ?? 0]
                ))[0][0]
                if (result.supplier_exists == 0) {
                    return NotFound(`Supplier with id ${req.body.supplier_id} does not exist`)
                }
                if (result.customer_exists == 0) {
                    return NotFound(`Customer with id ${req.body.customer_id} does not exist`)
                }

                break;
            default:
                return UnprocessableEntity(`transaction with type [${req.body.type}] is'nt supported, please use either [purchase], [sale], and [return]`)
        }

        await conn.query(
            `INSERT INTO transactions (account_id, supplier_id, customer_id, type, total_cost, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [req.jwtDecoded.id, req.body.supplier_id, req.body.customer_id, req.body.type, req.body.total_cost, dateNow]
        )

        const transaction_id = (await conn.query('SELECT LAST_INSERT_ID() AS transaction_id'))[0][0].transaction_id

        for (const item of req.body.items) {
            await conn.query(
                `INSERT INTO transaction_items (transaction_id, product_id, unit_name, unit_price, quantity, created_at)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [transaction_id, item.product_id, item.unit_name, item.unit_price, item.quantity, dateNow]
            )
            await conn.query(
                `INSERT INTO stock_logs (transaction_id, product_id, init_stock, change_type, quantity, created_at)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [transaction_id, item.product_id, item.stock, req.body.stock_change_type, item.quantity, dateNow]
            )

            if (req.body.stock_change_type == 'out') {
                await conn.query(
                    'UPDATE products SET stock = stock - ? WHERE id = ?',
                    [item.quantity, item.product_id]
                )
            } else if (req.body.stock_change_type == 'in') {
                await conn.query(
                    'UPDATE products SET stock = stock + ? WHERE id = ?',
                    [item.quantity, item.product_id]
                )
            } else {
                return UnprocessableEntity('Invalid stock_change_type field. Please use one of them: [in, out]')
            }
        }

        conn.release()

        return reply.code(HttpStatusCode.ResetContent).send()
    })

    fastify.delete('/:id', {
        preHandler: [fastify.authenticate, fastify.onlyAdministrator]
    }, async (req, reply) => {
        await fastify.mysql.query(
            `UPDATE transactions SET deleted_at = ?, deleted_by = ? WHERE id = ?`,
            [new Date(Date.now()), req.jwtDecoded.id, req.params.id]
        )

        return reply.code(HttpStatusCode.NoContent).send()
    })

    done()
}