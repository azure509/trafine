const express = require('express');
const app = express();
const port = 8080;

app.get('/', (req, res) => {
  res.send('Hello from Trafine API');
});

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
