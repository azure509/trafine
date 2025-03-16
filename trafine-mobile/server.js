const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello from Trafine Mobile Service');
});

app.listen(port, () => {
  console.log(`Mobile service listening on port ${port}`);
});
