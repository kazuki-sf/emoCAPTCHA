export type ScoreRequestBody = {
  imageDataUrl: string
  challenge: { id: string; emoji: string; label: string }
}

export type ScoreResponse = {
  matched: boolean
  confidence: number
  reasons?: string[]
  model?: string
}

export type ErrorResponse = { error: string }
