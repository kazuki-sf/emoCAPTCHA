import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision'
import { THRESHOLDS, type EmojiId } from '@/constants/emojis'

export type Challenge = {
  id: EmojiId
  emoji: string
  label: string
}

export function evaluateChallenge(
  activeChallenge: Challenge,
  result: FaceLandmarkerResult
): { matched: boolean; confidence: number } {
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
  const mouthStretch = (get('mouthStretchLeft') + get('mouthStretchRight')) / 2
  const cheekPuff = get('cheekPuff')
  const eyeWide = (get('eyeWideLeft') + get('eyeWideRight')) / 2
  const eyeSquint = (get('eyeSquintLeft') + get('eyeSquintRight')) / 2
  const tongueOut = get('tongueOut')
  const mouthFunnel = get('mouthFunnel')
  const noseSneer = (get('noseSneerLeft') + get('noseSneerRight')) / 2
  const upperLipRaise = (get('mouthUpperUpLeft') + get('mouthUpperUpRight')) / 2
  const frownMouth = (get('mouthFrownLeft') + get('mouthFrownRight')) / 2
  const mouthShrugUpper = get('mouthShrugUpper')
  const mouthRoll = (get('mouthRollUpper') + get('mouthRollLower')) / 2
  const eyeLookOutLeft = get('eyeLookOutLeft')
  const eyeLookInLeft = get('eyeLookInLeft')
  const eyeLookOutRight = get('eyeLookOutRight')
  const eyeLookInRight = get('eyeLookInRight')

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
      matched = browDown >= THRESHOLDS.browDown && mouthPress > THRESHOLDS.mouthPress
      confidence = Math.min(browDown, Math.max(mouthPress, 0.4))
      break
    }
    case 'wink_left': {
      matched = eyeBlinkLeft >= THRESHOLDS.winkHigh && eyeBlinkRight <= THRESHOLDS.winkLow
      confidence = eyeBlinkLeft
      break
    }
    case 'wink_right': {
      matched = eyeBlinkRight >= THRESHOLDS.winkHigh && eyeBlinkLeft <= THRESHOLDS.winkLow
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
      matched = jawOpen >= THRESHOLDS.surprisedJaw && raise >= THRESHOLDS.surprisedBrow
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
      const delta = Math.max(0, get('mouthSmileLeft') - get('mouthSmileRight'))
      matched = delta >= THRESHOLDS.smirkDelta && jawOpen < 0.45
      confidence = delta
      break
    }
    case 'smirk_right': {
      const delta = Math.max(0, get('mouthSmileRight') - get('mouthSmileLeft'))
      matched = delta >= THRESHOLDS.smirkDelta && jawOpen < 0.45
      confidence = delta
      break
    }
    case 'frown': {
      matched = frownMouth >= THRESHOLDS.frown && browDown >= THRESHOLDS.frownBrowAssist
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
        (eyeBlinkLeft >= THRESHOLDS.winkHigh && eyeBlinkRight <= THRESHOLDS.winkLow) ||
        (eyeBlinkRight >= THRESHOLDS.winkHigh && eyeBlinkLeft <= THRESHOLDS.winkLow)
      matched = winkEither && tongueOut >= THRESHOLDS.tongueOut
      confidence = winkEither ? Math.min(Math.max(eyeBlinkLeft, eyeBlinkRight), tongueOut) : 0
      break
    }
    case 'kiss': {
      const winkEither = eyeBlinkLeft >= THRESHOLDS.winkAssist || eyeBlinkRight >= THRESHOLDS.winkAssist
      matched = pucker >= THRESHOLDS.pucker && winkEither && jawOpen < 0.45
      confidence = Math.min(pucker, Math.max(eyeBlinkLeft, eyeBlinkRight))
      break
    }
    case 'brows_open_mouth': {
      const raise = Math.max(browInnerUp, (browOuterUpL + browOuterUpR) / 2)
      matched = jawOpen >= THRESHOLDS.openMouth && raise >= THRESHOLDS.browRaise
      confidence = Math.min(jawOpen, raise)
      break
    }
    case 'eyes_closed': {
      const both = eyeBlinkLeft >= THRESHOLDS.blinkBoth && eyeBlinkRight >= THRESHOLDS.blinkBoth
      matched = both
      confidence = Math.min(eyeBlinkLeft, eyeBlinkRight)
      break
    }
    case 'glance_left': {
      const leftward = eyeLookOutLeft >= THRESHOLDS.eyeLook && eyeLookInRight >= THRESHOLDS.eyeLook
      matched = leftward && jawOpen < 0.5
      confidence = Math.min(eyeLookOutLeft, eyeLookInRight)
      break
    }
    case 'glance_right': {
      const rightward = eyeLookOutRight >= THRESHOLDS.eyeLook && eyeLookInLeft >= THRESHOLDS.eyeLook
      matched = rightward && jawOpen < 0.5
      confidence = Math.min(eyeLookOutRight, eyeLookInLeft)
      break
    }
    case 'brow_furrow': {
      const furrow = browDown >= THRESHOLDS.browFurrow && browInnerUp <= THRESHOLDS.browInnerLow
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
      matched = eyeSquint >= THRESHOLDS.wearySquint && frownMouth >= THRESHOLDS.wearyFrown
      confidence = Math.min(eyeSquint, frownMouth)
      break
    }
    case 'thinking': {
      const browDelta = Math.abs(browOuterUpL - browOuterUpR)
      matched = browDelta >= THRESHOLDS.thinkingBrowDelta && mouthPress >= THRESHOLDS.thinkingPress
      confidence = Math.min(browDelta, mouthPress)
      break
    }
    case 'hug': {
      matched = smileScore >= THRESHOLDS.hugSmile && eyeSquint >= THRESHOLDS.squint
      confidence = Math.min(smileScore, eyeSquint)
      break
    }
    case 'salute': {
      const winkR = eyeBlinkRight >= THRESHOLDS.saluteWink && eyeBlinkLeft <= THRESHOLDS.winkLow
      const winkL = eyeBlinkLeft >= THRESHOLDS.saluteWink && eyeBlinkRight <= THRESHOLDS.winkLow
      const raise = Math.max(browOuterUpL, browOuterUpR)
      matched = (winkL || winkR) && raise >= THRESHOLDS.browRaise
      confidence = matched ? Math.min(raise, Math.max(eyeBlinkLeft, eyeBlinkRight)) : 0
      break
    }
    case 'vomit': {
      matched = jawOpen >= THRESHOLDS.vomitJaw && tongueOut >= THRESHOLDS.tongueOut
      confidence = Math.min(jawOpen, tongueOut)
      break
    }
    case 'scream': {
      const raise = Math.max(browInnerUp, (browOuterUpL + browOuterUpR) / 2)
      matched = jawOpen >= THRESHOLDS.screamJaw && eyeWide >= THRESHOLDS.eyeWide && raise >= THRESHOLDS.browRaise
      confidence = Math.min(jawOpen, eyeWide, raise)
      break
    }
    case 'plead': {
      matched = eyeWide >= THRESHOLDS.pleadEye && browInnerUp >= THRESHOLDS.pleadBrow && mouthPress >= 0.2
      confidence = Math.min(eyeWide, browInnerUp, Math.max(mouthPress, 0.2))
      break
    }
    case 'mind_blown': {
      const raise = Math.max(browInnerUp, (browOuterUpL + browOuterUpR) / 2)
      matched = eyeWide >= THRESHOLDS.eyeWide && raise >= THRESHOLDS.browRaise && (mouthFunnel >= THRESHOLDS.funnel || jawOpen >= THRESHOLDS.openMouth)
      confidence = Math.min(eyeWide, raise, Math.max(mouthFunnel, jawOpen))
      break
    }
    case 'sleep': {
      const both = eyeBlinkLeft >= THRESHOLDS.blinkBoth && eyeBlinkRight >= THRESHOLDS.blinkBoth
      matched = both && mouthPress < 0.5
      confidence = Math.min(eyeBlinkLeft, eyeBlinkRight)
      break
    }
    case 'laugh': {
      matched = smileScore >= THRESHOLDS.laughSmile && jawOpen >= THRESHOLDS.laughJaw && eyeSquint >= THRESHOLDS.squint
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
}
