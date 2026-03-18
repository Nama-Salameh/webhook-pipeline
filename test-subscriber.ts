import express from "express";
const app = express();
app.use(express.json());

app.post("/test-webhook", (req, res) => {
  console.log("Received event:", req.body);
  res.json({ received: true });
});

app.listen(4000, () => console.log("Subscriber listening on http://localhost:4000/test-webhook"));