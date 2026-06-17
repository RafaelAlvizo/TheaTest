module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o';

  if (!apiKey || apiKey.includes('your-openai')) {
    return res.status(500).json({ error: 'OpenAI API key not configured. Add OPENAI_API_KEY in Vercel environment variables.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const { systemPrompt, userPrompt } = body;
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
    res.status(500).json({ error: err.message || 'Unexpected server error' });
  }
};
