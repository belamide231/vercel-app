const express = require('express');
const cors = require('cors');
const { json, urlencoded } = require('body-parser');

const app = express();
app.use(cors());
app.use(json());
app.use(urlencoded({ extended: true }));

app.get('/', (_, res) => res.status(200).send(`<h1>THIS IS NOW DEPLOYED</h1>`));

app.post('/test', (_, res) => res.status(200).json({ "data": "🍕" }));

module.exports = app;