const dotenv = require('dotenv')
const fs = require('fs');
const ENV_DIR = './'

function loadEnvConfig() {
    dotenv.config({
        path: ENV_DIR + '.env',
        override: false
    })
}

function loadFirebaseCredentials() {
    const base64 = process.env.FIREBASE_CREDENTIALS_BASE64
    const filePath = "./tmp/firebase-key.json"

    if (base64 && !fs.existsSync(filePath)) {
        const json = Buffer.from(base64, "base64").toString("utf-8")

        fs.mkdirSync('./tmp', { recursive: true })
        fs.writeFileSync(filePath, json)
        
        process.env.GOOGLE_APPLICATION_CREDENTIALS = filePath
    }
}

module.exports = {
    loadEnvConfig,
    loadFirebaseCredentials
}