require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '4mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    aiConfigured: !!(process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('your-openai')),
    model: process.env.OPENAI_MODEL || 'gpt-4o'
  });
});

app.post('/api/review', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o';

  if (!apiKey || apiKey.includes('your-openai')) {
    return res.status(500).json({ error: 'OpenAI API key not configured in .env' });
  }

  const { systemPrompt, userPrompt } = req.body || {};
  if (!userPrompt || !String(userPrompt).trim()) {
    return res.status(400).json({ error: 'userPrompt is required' });
  }
  if (!systemPrompt || !String(systemPrompt).trim()) {
    return res.status(400).json({ error: 'systemPrompt is required' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: String(systemPrompt) },
          { role: 'user', content: String(userPrompt) }
        ],
        temperature: 0.2
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || 'OpenAI request failed'
      });
    }

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return res.status(502).json({ error: 'OpenAI returned an empty response' });
    }

    res.json({
      content,
      model: data.model || model,
      usage: data.usage || null
    });
  } catch (err) {
    const msg = err.cause?.message || err.message || 'Unexpected server error';
    res.status(500).json({ error: msg });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use(express.static(path.join(__dirname)));

const server = app.listen(PORT, () => {
  console.log(`Fiction editor running at http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Open http://localhost:${PORT} in your browser, or stop the other process first.`);
    process.exit(1);
  }
  throw err;
});
