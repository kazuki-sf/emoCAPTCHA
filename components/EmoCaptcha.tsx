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
  const [engine] = useState<'mediapipe' | 'openai'>('openai')
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
    (result: FaceLandmarkerResult) => {
      const blend = result.faceBlendshapes?.[0]?.categories ?? []
      const toMap = new Map<string, number>()
      for (const c of blend) toMap.set(c.categoryName, c.score)

      const get = (name: string) => toMap.get(name) ?? 0
      const smileScore = (get('mouthSmileLeft') + get('mouthSmileRight')) / 2
      const jawOpen = get('jawOpen')
      const pucker = get('mouthPucker')
      const browDown = (get('browDownLeft') + get('browDownRight')) / 2
      const mouthPress = (get('mouthPressLeft') + get('mouthPressRight')) / 2
      const eyeBlinkLeft = get('eyeBlinkLeft')
      const eyeBlinkRight = get('eyeBlinkRight')
      const browInnerUp = get('browInnerUp')
      const browOuterUpL = get('browOuterUpLeft')
      const browOuterUpR = get('browOuterUpRight')
      const mouthStretch =
        (get('mouthStretchLeft') + get('mouthStretchRight')) / 2
      const cheekPuff = get('cheekPuff')
      const eyeWide = (get('eyeWideLeft') + get('eyeWideRight')) / 2
      const eyeSquint = (get('eyeSquintLeft') + get('eyeSquintRight')) / 2
      const tongueOut = get('tongueOut')
      const mouthFunnel = get('mouthFunnel')
      const noseSneer = (get('noseSneerLeft') + get('noseSneerRight')) / 2
      const upperLipRaise =
        (get('mouthUpperUpLeft') + get('mouthUpperUpRight')) / 2
      const frownMouth = (get('mouthFrownLeft') + get('mouthFrownRight')) / 2
      const mouthShrugUpper = get('mouthShrugUpper')
      const mouthRoll = (get('mouthRollUpper') + get('mouthRollLower')) / 2
      const eyeLookOutLeft = get('eyeLookOutLeft')
      const eyeLookInLeft = get('eyeLookInLeft')
      const eyeLookOutRight = get('eyeLookOutRight')
      const eyeLookInRight = get('eyeLookInRight')

      // Metrics are computed locally for evaluation only; not shown to users

      let matched = false
      let confidence = 0
      switch (activeChallenge.id) {
        case 'smile': {
          matched = smileScore >= THRESHOLDS.smile && jawOpen < 0.45
          confidence = smileScore
          break
        }
        case 'open_mouth': {
          matched = jawOpen >= THRESHOLDS.openMouth
          confidence = jawOpen
          break
        }
        case 'pucker': {
          matched = pucker >= THRESHOLDS.pucker && jawOpen < 0.35
          confidence = pucker
          break
        }
        case 'angry': {
          matched =
            browDown >= THRESHOLDS.browDown &&
            mouthPress > THRESHOLDS.mouthPress
          confidence = Math.min(browDown, Math.max(mouthPress, 0.4))
          break
        }
        case 'wink_left': {
          matched =
            eyeBlinkLeft >= THRESHOLDS.winkHigh &&
            eyeBlinkRight <= THRESHOLDS.winkLow
          confidence = eyeBlinkLeft
          break
        }
        case 'wink_right': {
          matched =
            eyeBlinkRight >= THRESHOLDS.winkHigh &&
            eyeBlinkLeft <= THRESHOLDS.winkLow
          confidence = eyeBlinkRight
          break
        }
        case 'cheek_puff': {
          matched = cheekPuff >= THRESHOLDS.cheekPuff && jawOpen < 0.4
          confidence = cheekPuff
          break
        }
        case 'eyebrow_raise': {
          const raise = Math.max(browInnerUp, (browOuterUpL + browOuterUpR) / 2)
          matched = raise >= THRESHOLDS.browRaise
          confidence = raise
          break
        }
        case 'mouth_stretch': {
          matched = mouthStretch >= THRESHOLDS.mouthStretch && jawOpen < 0.5
          confidence = mouthStretch
          break
        }
        case 'surprised': {
          const raise = Math.max(browInnerUp, (browOuterUpL + browOuterUpR) / 2)
          matched =
            jawOpen >= THRESHOLDS.surprisedJaw &&
            raise >= THRESHOLDS.surprisedBrow
          confidence = Math.min(jawOpen, raise)
          break
        }
        case 'eye_wide': {
          matched = eyeWide >= THRESHOLDS.eyeWide
          confidence = eyeWide
          break
        }
        case 'squint': {
          matched = eyeSquint >= THRESHOLDS.squint && jawOpen < 0.4
          confidence = eyeSquint
          break
        }
        case 'tongue_out': {
          matched = tongueOut >= THRESHOLDS.tongueOut
          confidence = tongueOut
          break
        }
        case 'sneer': {
          matched = noseSneer >= THRESHOLDS.sneer
          confidence = noseSneer
          break
        }
        case 'raise_upper_lip': {
          matched = upperLipRaise >= THRESHOLDS.upperLip
          confidence = upperLipRaise
          break
        }
        case 'smirk_left': {
          const delta = Math.max(
            0,
            get('mouthSmileLeft') - get('mouthSmileRight')
          )
          matched = delta >= THRESHOLDS.smirkDelta && jawOpen < 0.45
          confidence = delta
          break
        }
        case 'smirk_right': {
          const delta = Math.max(
            0,
            get('mouthSmileRight') - get('mouthSmileLeft')
          )
          matched = delta >= THRESHOLDS.smirkDelta && jawOpen < 0.45
          confidence = delta
          break
        }
        case 'frown': {
          matched =
            frownMouth >= THRESHOLDS.frown &&
            browDown >= THRESHOLDS.frownBrowAssist
          confidence = Math.min(frownMouth, Math.max(browDown, 0.3))
          break
        }
        case 'mouth_shrug': {
          matched = mouthShrugUpper >= THRESHOLDS.mouthShrug && jawOpen < 0.5
          confidence = mouthShrugUpper
          break
        }
        case 'lip_roll': {
          matched = mouthRoll >= THRESHOLDS.lipRoll && jawOpen < 0.5
          confidence = mouthRoll
          break
        }
        case 'wink_tongue': {
          const winkEither =
            (eyeBlinkLeft >= THRESHOLDS.winkHigh &&
              eyeBlinkRight <= THRESHOLDS.winkLow) ||
            (eyeBlinkRight >= THRESHOLDS.winkHigh &&
              eyeBlinkLeft <= THRESHOLDS.winkLow)
          matched = winkEither && tongueOut >= THRESHOLDS.tongueOut
          confidence = winkEither
            ? Math.min(Math.max(eyeBlinkLeft, eyeBlinkRight), tongueOut)
            : 0
          break
        }
        case 'kiss': {
          const winkEither =
            eyeBlinkLeft >= THRESHOLDS.winkAssist ||
            eyeBlinkRight >= THRESHOLDS.winkAssist
          matched = pucker >= THRESHOLDS.pucker && winkEither && jawOpen < 0.45
          confidence = Math.min(pucker, Math.max(eyeBlinkLeft, eyeBlinkRight))
          break
        }
        case 'brows_open_mouth': {
          const raise = Math.max(browInnerUp, (browOuterUpL + browOuterUpR) / 2)
          matched =
            jawOpen >= THRESHOLDS.openMouth && raise >= THRESHOLDS.browRaise
          confidence = Math.min(jawOpen, raise)
          break
        }
        case 'eyes_closed': {
          const both =
            eyeBlinkLeft >= THRESHOLDS.blinkBoth &&
            eyeBlinkRight >= THRESHOLDS.blinkBoth
          matched = both
          confidence = Math.min(eyeBlinkLeft, eyeBlinkRight)
          break
        }
        case 'glance_left': {
          const leftward =
            eyeLookOutLeft >= THRESHOLDS.eyeLook &&
            eyeLookInRight >= THRESHOLDS.eyeLook
          matched = leftward && jawOpen < 0.5
          confidence = Math.min(eyeLookOutLeft, eyeLookInRight)
          break
        }
        case 'glance_right': {
          const rightward =
            eyeLookOutRight >= THRESHOLDS.eyeLook &&
            eyeLookInLeft >= THRESHOLDS.eyeLook
          matched = rightward && jawOpen < 0.5
          confidence = Math.min(eyeLookOutRight, eyeLookInLeft)
          break
        }
        case 'brow_furrow': {
          const furrow =
            browDown >= THRESHOLDS.browFurrow &&
            browInnerUp <= THRESHOLDS.browInnerLow
          matched = furrow
          confidence = Math.min(browDown, 1 - Math.max(0, browInnerUp - 0.2))
          break
        }
        case 'lips_press': {
          matched = mouthPress >= THRESHOLDS.lipsPressBoth && jawOpen < 0.35
          confidence = mouthPress
          break
        }
        case 'weary': {
          matched =
            eyeSquint >= THRESHOLDS.wearySquint &&
            frownMouth >= THRESHOLDS.wearyFrown
          confidence = Math.min(eyeSquint, frownMouth)
          break
        }
        case 'thinking': {
          const browDelta = Math.abs(browOuterUpL - browOuterUpR)
          matched =
            browDelta >= THRESHOLDS.thinkingBrowDelta &&
            mouthPress >= THRESHOLDS.thinkingPress
          confidence = Math.min(browDelta, mouthPress)
          break
        }
        case 'hug': {
          matched =
            smileScore >= THRESHOLDS.hugSmile && eyeSquint >= THRESHOLDS.squint
          confidence = Math.min(smileScore, eyeSquint)
          break
        }
        case 'salute': {
          const winkR =
            eyeBlinkRight >= THRESHOLDS.saluteWink &&
            eyeBlinkLeft <= THRESHOLDS.winkLow
          const winkL =
            eyeBlinkLeft >= THRESHOLDS.saluteWink &&
            eyeBlinkRight <= THRESHOLDS.winkLow
          const raise = Math.max(browOuterUpL, browOuterUpR)
          matched = (winkL || winkR) && raise >= THRESHOLDS.browRaise
          confidence = matched
            ? Math.min(raise, Math.max(eyeBlinkLeft, eyeBlinkRight))
            : 0
          break
        }
        case 'vomit': {
          matched =
            jawOpen >= THRESHOLDS.vomitJaw && tongueOut >= THRESHOLDS.tongueOut
          confidence = Math.min(jawOpen, tongueOut)
          break
        }
        case 'scream': {
          const raise = Math.max(browInnerUp, (browOuterUpL + browOuterUpR) / 2)
          matched =
            jawOpen >= THRESHOLDS.screamJaw &&
            eyeWide >= THRESHOLDS.eyeWide &&
            raise >= THRESHOLDS.browRaise
          confidence = Math.min(jawOpen, eyeWide, raise)
          break
        }
        case 'plead': {
          matched =
            eyeWide >= THRESHOLDS.pleadEye &&
            browInnerUp >= THRESHOLDS.pleadBrow &&
            mouthPress >= 0.2
          confidence = Math.min(eyeWide, browInnerUp, Math.max(mouthPress, 0.2))
          break
        }
        case 'mind_blown': {
          const raise = Math.max(browInnerUp, (browOuterUpL + browOuterUpR) / 2)
          matched =
            eyeWide >= THRESHOLDS.eyeWide &&
            raise >= THRESHOLDS.browRaise &&
            (mouthFunnel >= THRESHOLDS.funnel ||
              jawOpen >= THRESHOLDS.openMouth)
          confidence = Math.min(eyeWide, raise, Math.max(mouthFunnel, jawOpen))
          break
        }
        case 'sleep': {
          const both =
            eyeBlinkLeft >= THRESHOLDS.blinkBoth &&
            eyeBlinkRight >= THRESHOLDS.blinkBoth
          matched = both && mouthPress < 0.5
          confidence = Math.min(eyeBlinkLeft, eyeBlinkRight)
          break
        }
        case 'laugh': {
          matched =
            smileScore >= THRESHOLDS.laughSmile &&
            jawOpen >= THRESHOLDS.laughJaw &&
            eyeSquint >= THRESHOLDS.squint
          confidence = Math.min(smileScore, jawOpen, eyeSquint)
          break
        }
        case 'smirk': {
          const delta = Math.abs(get('mouthSmileLeft') - get('mouthSmileRight'))
          matched = delta >= THRESHOLDS.smirkDelta && jawOpen < 0.45
          confidence = delta
          break
        }
        case 'drool': {
          matched = tongueOut >= THRESHOLDS.droolTongue && jawOpen >= 0.4
          confidence = Math.min(tongueOut, Math.max(jawOpen, 0.4))
          break
        }
        case 'shush': {
          matched = mouthPress >= THRESHOLDS.shushPress && eyeSquint >= 0.3
          confidence = Math.min(mouthPress, Math.max(eyeSquint, 0.3))
          break
        }
      }
      return { matched, confidence } as const
    },
    [activeChallenge.id]
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
        const res = await fetch('/api/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageDataUrl: url,
            challenge: activeChallenge,
          }),
        })
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
              {/* Engine selection hidden by default. OpenAI is the default engine. */}

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
