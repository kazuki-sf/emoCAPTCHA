import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
})

export async function POST(req: NextRequest) {
  try {
    const { imageDataUrl, challenge } = await req.json()
    if (!imageDataUrl || !challenge?.id || !challenge?.label) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const prompt = `You are a strict facial expression evaluator. Given a selfie image and a target instruction, score how well the expression MATCHES the TARGET EMOJI.

Return a JSON object with:
- match_score: a real number in [0,1] (3 decimals ok) where 1.0 means "clearly matches target" and 0.0 means "clearly NOT the target". Example: if target is "Smile" but the face looks angry, match_score must be low (<= 0.30).
- reasons: an array (1–3 items) of very short bullet points describing visible cues, e.g., ["brows raised", "mouth open"]. Keep each item succinct.

Do not include any other fields. Be conservative; avoid false positives. Target emoji: ${challenge.emoji} (${challenge.label}).`

    const model = process.env.OPENAI_VISION_MODEL || 'gpt-5-mini'
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Score the match for target emoji ${challenge.emoji} (${challenge.label}).`,
            },
            {
              type: 'image_url',
              image_url: { url: imageDataUrl } as unknown as { url: string },
            },
          ],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'emo_captcha_score',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              match_score: { type: 'number' },
              reasons: {
                type: 'array',
                items: { type: 'string' },
                minItems: 1,
                maxItems: 3,
              },
            },
            required: ['match_score', 'reasons'],
          },
          strict: true,
        },
      },
    })

    const raw = response.choices?.[0]?.message?.content ?? '{}'
    let parsed: {
      match_score?: number
      confidence?: number
      matched?: boolean
      reason?: string
      reasons?: string[]
    } = {}
    try {
      parsed = JSON.parse(raw) as {
        match_score?: number
        confidence?: number
        matched?: boolean
        reason?: string
        reasons?: string[]
      }
    } catch {
      parsed = {}
    }
    // Prefer match_score; fallback to any legacy confidence field
    let confidenceRaw = Math.max(
      0,
      Math.min(1, Number(parsed.match_score ?? parsed.confidence ?? 0))
    )
    // If the rounded-to-2 value lands exactly on a 0.05 grid (e.g., 0.85),
    // add a small deterministic offset so the displayed 2-decimal value varies off the grid.
    const twoDec = Math.round(confidenceRaw * 100) / 100
    const onGrid005 = Math.abs(twoDec * 20 - Math.round(twoDec * 20)) < 1e-6
    if (onGrid005) {
      const basis = `${raw}-${challenge.label}`
      let acc = 0
      for (let i = 0; i < basis.length; i++)
        acc = (acc * 31 + basis.charCodeAt(i)) >>> 0
      // jitter in [-0.012, 0.012]
      const jitter = ((acc % 25) - 12) / 1000
      let adjusted = Math.min(1, Math.max(0, confidenceRaw + jitter))
      const twoDec2 = Math.round(adjusted * 100) / 100
      // If still on grid after jitter, nudge by +/- 0.01
      if (Math.abs(twoDec2 * 20 - Math.round(twoDec2 * 20)) < 1e-6) {
        adjusted = Math.min(
          1,
          Math.max(0, adjusted + (jitter >= 0 ? 0.01 : -0.01))
        )
      }
      confidenceRaw = adjusted
    }
    const confidence = Math.round(confidenceRaw * 100) / 100 // 2 decimals
    const matched = confidence >= 0.6 // define pass threshold by score
    let reasons: string[] | undefined
    if (Array.isArray(parsed.reasons)) {
      reasons = parsed.reasons
        .filter((x) => typeof x === 'string' && x.trim().length > 0)
        .slice(0, 3)
    } else if (
      typeof parsed.reason === 'string' &&
      parsed.reason.trim().length > 0
    ) {
      reasons = parsed.reason
        .split(/[\n;•\-\u2022]+|\.\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .slice(0, 3)
    }
    // Debug log (server): show model output without logging the image
    console.log('[OpenAI score]', {
      challenge,
      raw,
      parsed,
      matched,
      confidence,
      reasons,
      model,
    })
    return NextResponse.json({ matched, confidence, reasons, model })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to score image'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
