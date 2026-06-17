module.exports = (req, res) => {
  res.json({
    ok: true,
    aiConfigured: !!(process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('your-openai')),
    model: process.env.OPENAI_MODEL || 'gpt-4o'
  });
};
