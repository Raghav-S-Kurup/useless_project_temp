require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;

app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const SYSTEM_PROMPT = `You are the head judge at a whimsical but rigorous cat loaf competition. A "cat loaf" is a cat sitting with its paws tucked underneath its body, tail wrapped in close, in a compact bread-loaf shape.

Look at the submitted photo and evaluate it against these five factors. A PERFECT loaf has: no visible paws (all tucked under), a fully furled/wrapped tail (not sticking out straight), a head held up (not drooping), a head facing forward/straight (not turned to the side), and a calm, content, "perfect loaf" facial expression.

If the image does not contain a cat at all, or the cat is clearly not in a loaf-adjacent pose, still do your best to score it honestly and low, and note that in your notes.

Respond with ONLY a raw JSON object, no markdown fences, no preamble, matching exactly this shape:
{
  "score": <integer 1-10, 10 being a flawless loaf>,
  "verdict": "<one punchy, comical sentence summarizing the loaf, in the voice of a dramatic but affectionate judge>",
  "criteria": {
    "paws": {"pass": <bool, true if paws are well hidden>, "note": "<short comical note, under 12 words>"},
    "tail": {"pass": <bool, true if tail is furled/wrapped not unfurled>, "note": "<short comical note, under 12 words>"},
    "head_droop": {"pass": <bool, true if head is held up not drooping>, "note": "<short comical note, under 12 words>"},
    "head_straight": {"pass": <bool, true if head faces forward not to the side>, "note": "<short comical note, under 12 words>"},
    "expression": {"pass": <bool, true if expression is serene/content>, "note": "<short comical note, under 12 words>"}
  }
}`;

app.post('/api/rate-loaf', async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY. Set it in your .env file.' });
    }

    const { image, mediaType } = req.body || {};
    if (!image || !mediaType) {
      return res.status(400).json({ error: 'Missing image data.' });
    }
    if (!mediaType.startsWith('image/')) {
      return res.status(400).json({ error: 'File is not an image.' });
    }

    const geminiResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': API_KEY
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [
            {
              role: 'user',
              parts: [
                { text: 'Judge this cat loaf.' },
                { inline_data: { mime_type: mediaType, data: image } }
              ]
            }
          ],
          generationConfig: {
            response_mime_type: 'application/json'
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errText);
      return res.status(502).json({ error: 'The loaf judge is unavailable right now. Try again shortly.' });
    }

    const data = await geminiResponse.json();
    const messageText =
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;
    if (!messageText) {
      return res.status(502).json({ error: 'The judge had nothing to say.' });
    }

    const clean = messageText
      .trim()
      .replace(/^```json/i, '')
      .replace(/^```/, '')
      .replace(/```$/, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      console.error('Failed to parse model output:', messageText);
      return res.status(502).json({ error: "Couldn't parse the judge's verdict." });
    }

    return res.json(parsed);
  } catch (err) {
    console.error('Unexpected server error:', err);
    return res.status(500).json({ error: 'Something went wrong judging the loaf.' });
  }
});

app.listen(PORT, () => {
  console.log(`Loaf-o-Meter running at http://localhost:${PORT}`);
});
