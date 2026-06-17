module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o';

  if (!apiKey || apiKey.includes('your-openai')) {
    return res.status(500).json({ error: 'OpenAI API key not configured in Vercel environment variables' });
  }

  const { systemPrompt, userPrompt } = req.body || {};
  if (!userPrompt) {
    return res.status(400).json({ error: 'userPrompt is required' });
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
          { role: 'system', content: systemPrompt || '' },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || 'OpenAI request failed'
      });
    }

    res.json({ content: data.choices[0].message.content.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
