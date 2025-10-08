import express from 'express'

const app = express()

app.use(express.json())

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
    console.log('Headers:', req.headers)
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('Body:', req.body)
    }
    res.send()
    next()
})

console.log('Request logger running on port 4001')
app.listen(4001)