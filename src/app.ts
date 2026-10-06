import express, { type Express, type Request, type Response } from 'express';
import './mqtt.ts';

const app: Express = express();

app.get('/', (req: Request, res: Response) => {
  res.send('Hello, Ferrari');
});

console.log("online");

app.listen(3000);