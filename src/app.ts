import express from "express";

export const app = express();

app.use(express.json());

app.get("/health", (_, res) => {
  res.send("ok");
});