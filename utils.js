const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { UnprocessableEntity, BadRequest } = require('http-errors')

function isDevMode() {
    return process.env.NODE_ENV === 'development'
}

function isEmailValid(email) {
    const regex = new RegExp(/^.+([@][a-z]+.[a-z]+)$/)
    return regex.test(email)
}

function isRoleValid(role) {
    return ['admin', 'staff'].includes(role)
}

function isPhoneNumberValid(value) {
    const regex = new RegExp(/^[+]\d{1,3} \d+$/)
    return regex.test(value)
}

function hashPassword(password) {
    const hmac = crypto.createHmac('sha256', password)
    return hmac.digest('hex')
}

function isAdmin(accountRole) {
    return accountRole == 'admin'
}

function generateJwtToken(fastify, account) {
    const payload = {
        id: account.id,
        role: account.role
    }
    const token = fastify.jwt.sign(payload)

    return token
}

async function saveAvatarFile(field) {
    const filenameSplitted = field.filename.split('.')
    const avatarFilename = `${Date.now()}.${filenameSplitted[filenameSplitted.length - 1]}`;
    const avatarPath = path.join(__dirname, 'avatars', avatarFilename)

    if (!fs.existsSync(path.join(__dirname, 'avatars'))) {
        fs.mkdirSync(path.join(__dirname, 'avatars'))
    }
    fs.writeFile(avatarPath, await field.toBuffer(), function(){});

    return avatarFilename
}

function checkReqBodyAvailability(req, ...keys) {
    const ERR_INVALID_ROLE = UnprocessableEntity('role field is not valid, please use either "admin" or "staff"')
    const ERR_INVALID_EMAIL = UnprocessableEntity('email filed is not valid')
    const ERR_INVALID_PHONE_NUMBER = UnprocessableEntity('phone_number field is not valid, use format [+aaa x..n]. For example: +39 0123456789')
    const ERR_INVALID_INPUT_FIELDS = BadRequest('Input fields\' structure does not correctly formed')
    
    for (const key of keys) {
        if (!(req.body?.[key])) {
            throw ERR_INVALID_INPUT_FIELDS
        }
        if (
            key == 'email'
            && !isEmailValid(req.body?.[key])
        ) {
            throw ERR_INVALID_EMAIL
        }
        if (
            key == 'role'
            && !isRoleValid(req.body?.[key])
        ) {
            throw ERR_INVALID_ROLE
        }
        if (
            key == 'phone_number'
            && !isPhoneNumberValid(req.body?.[key])
        ) {
            throw ERR_INVALID_PHONE_NUMBER
        }
    }
    return true
}

function combineAvatarUrlWithHost(req, filename) {
    const host = `${req.protocol}://${req.hostname}`;
    return `${host}/avatars/${filename ?? 'default.png'}`;
}

function convertFilterTextToArray(filter) {
    return filter.split(',').map(item => item.trim());
}

module.exports = {
    isDevMode,
    isEmailValid,
    isRoleValid,
    isAdministrator: isAdmin,
    hashPassword,
    generateJwtToken,
    checkReqBodyAvailability,
    saveAvatarFile,
    combineAvatarUrlWithHost,
    convertFilterTextToArray
}