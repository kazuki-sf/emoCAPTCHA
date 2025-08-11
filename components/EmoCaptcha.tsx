'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { Button } from '@/components/ui/button'
import { Shuffle, Camera, RefreshCcw, CheckCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { FilesetResolver, FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision'
import { EMOJI_CHALLENGES, EmojiId, THRESHOLDS } from '@/constants/emojis'
import { evaluateChallenge as evaluateChallengeLib } from '@/lib/evaluate'

type Challenge = {
  id: EmojiId
  emoji: string
  label: string
}

const CHALLENGES: Challenge[] = EMOJI_CHALLENGES as Challenge[]

type Props = {
  onVerified?: () => void
  className?: string
}

export default function EmoCaptcha({ onVerified, className }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const landmarkerImageRef = useRef<FaceLandmarker | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [verified, setVerified] = useState(false)
  // Use deterministic initial value to avoid hydration mismatch.
  const [activeChallenge, setActiveChallenge] = useState<Challenge>(
    CHALLENGES[0]
  )

  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [showResultModal, setShowResultModal] = useState(false)
  const [engine, setEngine] = useState<'mediapipe' | 'openai'>('openai')
  const [lastConfidence, setLastConfidence] = useState<number | null>(null)
  const [lastReasons, setLastReasons] = useState<string[] | null>(null)
  const [lastModel, setLastModel] = useState<string | null>(null)
  // const [countdown, setCountdown] = useState<number | null>(null) // disabled; kept for future use

  const scoreCategory = (
    score: number | null
  ): { label: string; color: string } => {
    if (score === null) return { label: '—', color: 'text-gray-500' }
    if (score >= 0.85) return { label: 'Excellent', color: 'text-emerald-500' }
    if (score >= 0.7) return { label: 'Good', color: 'text-lime-500' }
    if (score >= 0.6) return { label: 'Pass', color: 'text-yellow-500' }
    if (score >= 0.4) return { label: 'Low', color: 'text-orange-500' }
    return { label: 'Poor', color: 'text-red-500' }
  }

  const scoreStroke = (score: number | null): string => {
    if (score === null) return '#9ca3af' // gray-400
    if (score >= 0.85) return '#10b981' // emerald-500
    if (score >= 0.7) return '#84cc16' // lime-500
    if (score >= 0.6) return '#f59e0b' // amber-500
    if (score >= 0.4) return '#f97316' // orange-500
    return '#ef4444' // red-500
  }

  const scoreFill = (score: number | null): string => scoreStroke(score)

  // const labelStyle = 'text-sm text-neutral-600 dark:text-neutral-300' // not used; keep for future tweaks

  const pickNewChallenge = useCallback(() => {
    const remaining = CHALLENGES.filter((c) => c.id !== activeChallenge.id)
    const next = remaining[Math.floor(Math.random() * remaining.length)]
    setActiveChallenge(next)
    setVerified(false)
    setPhotoUrl(null)
    setLastConfidence(null)
    setLastReasons(null)
    setLastModel(null)
  }, [activeChallenge.id])

  // After mount, pick a random challenge to avoid SSR/client mismatch from Math.random on first paint
  useEffect(() => {
    setActiveChallenge(
      CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)]
    )
  }, [])

  // Filter noisy INFO logs from MediaPipe WASM in dev so Next's overlay doesn't treat them as errors
  useEffect(() => {
    const originalError = console.error
    const filtered = (...args: unknown[]) => {
      const first = args[0]
      if (
        typeof first === 'string' &&
        (first.startsWith('INFO: Created TensorFlow Lite') ||
          first.startsWith('INFO: Successfully resolved delegate'))
      ) {
        return // ignore benign info
      }
      // pass-through
      originalError.apply(console, args as [])
    }
    console.error = filtered as typeof console.error
    return () => {
      console.error = originalError
    }
  }, [])

  const setup = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Prepare webcam
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      })
      if (!videoRef.current) return
      videoRef.current.srcObject = stream
      await videoRef.current.play()

      // Prepare MediaPipe (IMAGE mode only)
      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      )
      // Create an instance for IMAGE mode (for photo analysis)
      let landmarkerImage: FaceLandmarker | null = null
      try {
        landmarkerImage = await FaceLandmarker.createFromOptions(
          filesetResolver,
          {
            baseOptions: {
              delegate: 'GPU',
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
            },
            runningMode: 'IMAGE',
            numFaces: 1,
            outputFaceBlendshapes: true,
            outputFacialTransformationMatrixes: false,
          }
        )
      } catch {
        landmarkerImage = await FaceLandmarker.createFromOptions(
          filesetResolver,
          {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
            },
            runningMode: 'IMAGE',
            numFaces: 1,
            outputFaceBlendshapes: true,
            outputFacialTransformationMatrixes: false,
          }
        )
      }
      landmarkerImageRef.current = landmarkerImage
      setLoading(false)
    } catch (e: unknown) {
      console.error(e)
      const message =
        e instanceof Error
          ? e.message
          : 'Failed to access camera or initialize face landmarker.'
      setError(message)
      setLoading(false)
    }
  }, [])

  const cleanup = useCallback(() => {
    const video = videoRef.current
    if (video?.srcObject) {
      ;(video.srcObject as MediaStream).getTracks().forEach((t) => t.stop())
      video.srcObject = null
    }
    landmarkerImageRef.current?.close()
    landmarkerImageRef.current = null
  }, [])

  // (deprecated helper kept removed)

  // Force a full camera restart (stop existing tracks and reacquire)
  const restartCamera = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    try {
      const old = (video.srcObject as MediaStream) || null
      if (old) {
        old.getTracks().forEach((t) => t.stop())
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      })
      video.srcObject = stream
      await video.play()
    } catch (e: unknown) {
      console.error('Failed to restart camera:', e)
      setError('Failed to access camera. Please check permissions.')
    }
  }, [])

  useEffect(() => {
    setup()
    return () => cleanup()
  }, [setup, cleanup])

  // No continuous drawing; analysis happens only on captured still image

  const evaluateChallenge = useCallback(
    (result: FaceLandmarkerResult) =>
      evaluateChallengeLib(activeChallenge, result),
    [activeChallenge]
  )

  // Removed continuous loop logic

  // Single-mode flow; no mode toggling needed

  const doCapture = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    const w = video.videoWidth || 640
    const h = video.videoHeight || 480
    const temp = document.createElement('canvas')
    temp.width = w
    temp.height = h
    const ctx = temp.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, w, h)
    const url = temp.toDataURL('image/jpeg', 0.9)
    setPhotoUrl(url)

    setAnalyzing(true)
    try {
      if (engine === 'mediapipe') {
        const landmarker = landmarkerImageRef.current
        if (!landmarker) return
        const result = landmarker.detect(temp)
        const { matched, confidence } = evaluateChallenge(result)
        setLastConfidence(Math.round(confidence * 100) / 100)
        setLastReasons(null)
        if (confidence >= THRESHOLDS.instantPass || matched) {
          setVerified(true)
          onVerified?.()
          setTimeout(() => {
            confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } })
          }, 0)
        } else {
          setVerified(false)
        }
      } else {
        try {
          const res = await fetch('/api/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageDataUrl: url,
              challenge: activeChallenge,
            }),
          })
          if (!res.ok) throw new Error(`API error ${res.status}`)
          const data = await res.json()
          console.log('[OpenAI score client]', data)
          const matched = Boolean(data?.matched)
          const confidence = Number(data?.confidence) || 0
          setLastConfidence(Math.round(confidence * 100) / 100)
          const reasons = Array.isArray(data?.reasons) ? data.reasons : null
          setLastReasons(reasons)
          setLastModel(typeof data?.model === 'string' ? data.model : null)
          if (matched || confidence >= THRESHOLDS.instantPass) {
            setVerified(true)
            onVerified?.()
            setTimeout(() => {
              confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } })
            }, 0)
          } else {
            setVerified(false)
          }
        } catch (err) {
          console.warn('Falling back to on-device engine due to API error:', err)
          setEngine('mediapipe')
          const landmarker = landmarkerImageRef.current
          if (landmarker) {
            const result = landmarker.detect(temp)
            const { matched, confidence } = evaluateChallenge(result)
            setLastConfidence(Math.round(confidence * 100) / 100)
            setLastReasons(null)
            if (confidence >= THRESHOLDS.instantPass || matched) {
              setVerified(true)
              onVerified?.()
              setTimeout(() => {
                confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } })
              }, 0)
            } else {
              setVerified(false)
            }
          }
        }
      }
    } finally {
      setAnalyzing(false)
      setShowResultModal(true)
    }
  }, [engine, activeChallenge, evaluateChallenge, onVerified])

  const capturePhoto = useCallback(async () => {
    if (analyzing) return
    await doCapture()
    // Countdown logic kept for future use; currently disabled
  }, [analyzing, doCapture])

  return (
    <div className={'mx-auto w-full max-w-5xl'.concat(className ?? '')}>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="relative aspect-video">
            <div className="absolute inset-0 flex flex-col p-6">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-neutral-500">
                    Challenge
                  </div>
                  <div className="text-lg font-semibold">Match the emoji</div>
                </div>
              </div>
              {/* Engine selection UI removed; default uses OpenAI with automatic on-device fallback */}

              <div className="flex flex-1 items-center gap-4">
                <div
                  className="animate-float select-none text-7xl"
                  aria-hidden
                  suppressHydrationWarning
                >
                  {activeChallenge.emoji}
                </div>
                <div>
                  <div className="text-2xl font-semibold">
                    {activeChallenge.label}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Tap capture to verify
                  </div>
                </div>
              </div>
              <div className="mt-3 flex w-full items-center gap-4">
                {!photoUrl && (
                  <Button
                    variant="outline"
                    onClick={pickNewChallenge}
                    className="h-12 basis-1/2 gap-2 rounded-full bg-white text-base text-black shadow-sm hover:bg-gray-100"
                  >
                    <Shuffle className="h-5 w-5" /> Shuffle Emoji
                  </Button>
                )}
                {!photoUrl && (
                  <Button
                    onClick={capturePhoto}
                    disabled={analyzing}
                    className="h-12 basis-1/2 gap-2 rounded-full bg-blue-600 text-base text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Camera className="h-5 w-5" /> Capture & Verify
                  </Button>
                )}
                {photoUrl && !analyzing && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      window.location.reload()
                    }}
                    className="h-12 w-full gap-2 rounded-full bg-black text-base text-white shadow-sm hover:bg-black/80"
                  >
                    <RefreshCcw className="h-5 w-5" /> Retake Photo
                  </Button>
                )}
              </div>
              {/* Inline analyzing indicator removed; replaced with overlay on camera */}
              {error && (
                <div className="mt-2 text-sm text-red-600">{error}</div>
              )}
            </div>
          </div>
        </div>

        <div className="conic-border overflow-hidden rounded-2xl bg-black">
          <div className="relative aspect-video overflow-hidden rounded-2xl">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt="Captured"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <video
                ref={videoRef}
                className="absolute inset-0 h-full w-full object-cover"
                playsInline
                muted
                autoPlay
              />
            )}
            {/* Countdown overlay (disabled, kept for future use)
            {countdown !== null && photoUrl === null && (
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-6xl font-semibold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
                  {countdown === 0 ? 'Capture' : countdown}
                </div>
              </div>
            )}
            */}
            {/* No inline overlay; modal handles result */}
            {loading && (
              <>
                <div className="absolute inset-0 grid place-items-center text-sm text-white/90 backdrop-blur-sm">
                  Initializing camera and model…
                </div>
                <div className="animate-scan absolute left-0 right-0 top-0 h-24 bg-gradient-to-b from-emerald-400/30 to-transparent" />
              </>
            )}
            {analyzing && (
              <div className="absolute inset-0 z-10 grid place-items-center bg-black/40 backdrop-blur-sm" role="status" aria-live="polite">
                <div className="flex flex-col items-center gap-3 rounded-xl bg-white/90 px-6 py-4 text-gray-800 shadow-lg">
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                  <div className="text-sm font-medium">Analyzing…</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={showResultModal}
        onOpenChange={(open) => {
          setShowResultModal(open)
          if (!open) {
            void restartCamera()
          }
        }}
      >
        <DialogContent className='p-10'>
          <DialogHeader className='gap-1 mb-4'>
            <DialogTitle className="text-2xl mb-0">
              {verified ? 'emoCAPTCHA passed' : 'Wait... are you really human?'}
            </DialogTitle>
            <DialogDescription className='text-base mt-0'>
              {verified
                ? 'Awesome! You are human.'
                : 'Retake and prove you are human.'}
            </DialogDescription>
          </DialogHeader>
          {(lastConfidence !== null ||
            (lastReasons && lastReasons.length > 0)) && (
            <div className="flex items-start justify-center gap-6 text-left">
              {lastConfidence !== null && (
                <div className="flex flex-col items-center">
                  <div className="relative size-24">
                    <svg viewBox="0 0 120 120" className="absolute inset-0">
                      {/* Soft background fill inside the ring */}
                      <circle
                        cx="60"
                        cy="60"
                        r="48"
                        fill={scoreFill(lastConfidence)}
                        fillOpacity="0.12"
                      />
                      {/* Track in same hue (subtle) */}
                      <circle
                        cx="60"
                        cy="60"
                        r="54"
                        stroke={scoreStroke(lastConfidence)}
                        strokeOpacity="0.25"
                        fill="none"
                        strokeWidth="12"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r="54"
                        stroke={scoreStroke(lastConfidence)}
                        strokeWidth="12"
                        fill="none"
                        strokeDasharray={`${Math.round(lastConfidence * 339)} 339`}
                        strokeLinecap="round"
                        transform="rotate(-90 60 60)"
                      />
                    </svg>
                    <div className="absolute inset-0 grid place-items-center">
                      <div
                        className="text-3xl font-semibold"
                        style={{ color: scoreStroke(lastConfidence) }}
                      >
                        {Math.round(lastConfidence * 100)}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`mt-1 text-sm font-semibold ${scoreCategory(lastConfidence).color}`}
                  >
                    {scoreCategory(lastConfidence).label}
                  </div>
                </div>
              )}
              {lastReasons && lastReasons.length > 0 && (
                <div className="max-w-sm text-sm text-gray-700 dark:text-gray-300">
                  <div className="mb-1 font-medium">Reasons:</div>
                  <ul className="list-inside list-disc space-y-0.5 text-left">
                    {lastReasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="sm:justify-center mt-4">
            {verified ? (
              <Button
                variant="outline"
                onClick={() => setShowResultModal(false)}
                className="h-12 w-full gap-2 rounded-full bg-black text-base text-white shadow-sm hover:bg-black/80"
              >
                <CheckCircle className="h-5 w-5" /> Continue
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  window.location.reload()
                }}
                className="h-12 w-full gap-2 rounded-full bg-black text-base text-white shadow-sm hover:bg-black/80"
              >
                <RefreshCcw className="h-5 w-5" /> Retake & Prove You Are Human
              </Button>
            )}
          </DialogFooter>
          {lastModel && (
            <div className="text-center text-xs text-gray-500 dark:text-gray-400">
              Powered by {lastModel}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
