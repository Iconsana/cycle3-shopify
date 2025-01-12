import express from 'express';

const app = express();
const port = process.env.PORT || 8080;

// Most basic health check possible
app.get('/', (_, res) => {
  res.status(200).send('OK');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
