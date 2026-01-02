export default async function handler(req, res) {
  const hfUrl = "https://iammayur2004-ai_health_assistant.hf.space/predict";

  const response = await fetch(hfUrl, {
    method: req.method,
    headers: {
      "Content-Type": "application/json",
    },
    body: req.method === "POST" ? JSON.stringify(req.body) : undefined,
  });

  const data = await response.json();
  res.status(response.status).json(data);
}

export const config = {
  api: {
    bodyParser: true,
  },
};