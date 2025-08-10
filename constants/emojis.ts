export type EmojiId =
  | 'smile'
  | 'open_mouth'
  | 'pucker'
  | 'angry'
  | 'wink_left'
  | 'wink_right'
  | 'cheek_puff'
  | 'eyebrow_raise'
  | 'mouth_stretch'
  | 'surprised'
  | 'eye_wide'
  | 'squint'
  | 'tongue_out'
  | 'sneer'
  | 'raise_upper_lip'
  | 'smirk_left'
  | 'smirk_right'
  | 'frown'
  | 'mouth_shrug'
  | 'lip_roll'
  | 'wink_tongue'
  | 'kiss'
  | 'brows_open_mouth'
  | 'eyes_closed'
  | 'glance_left'
  | 'glance_right'
  | 'brow_furrow'
  | 'lips_press'
  | 'weary'
  | 'thinking'
  | 'hug'
  | 'salute'
  | 'vomit'
  | 'scream'
  | 'plead'
  | 'mind_blown'
  | 'sleep'
  | 'laugh'
  | 'smirk'
  | 'drool'
  | 'shush'

export type Challenge = {
  id: EmojiId
  emoji: string
  label: string
}

export const EMOJI_CHALLENGES: Challenge[] = [
  { id: 'smile', emoji: '😀', label: 'Smile' },
  { id: 'open_mouth', emoji: '😮', label: 'Open mouth' },
  { id: 'pucker', emoji: '😗', label: 'Pucker lips' },
  { id: 'angry', emoji: '😠', label: 'Frown / brow down' },
  { id: 'wink_left', emoji: '😉', label: 'Wink left eye' },
  { id: 'wink_right', emoji: '😜', label: 'Wink right eye' },
  { id: 'cheek_puff', emoji: '😤', label: 'Puff cheeks' },
  { id: 'eyebrow_raise', emoji: '🤨', label: 'Furrow brows' },
  { id: 'mouth_stretch', emoji: '😬', label: 'Stretch mouth' },
  { id: 'surprised', emoji: '😯', label: 'Surprised' },
  { id: 'eye_wide', emoji: '😳', label: 'Open eyes wide' },
  { id: 'squint', emoji: '😑', label: 'Squint eyes' },
  { id: 'tongue_out', emoji: '😝', label: 'Stick out tongue' },
  { id: 'sneer', emoji: '😒', label: 'Nose sneer' },
  { id: 'raise_upper_lip', emoji: '🫤', label: 'Raise upper lip' },
  { id: 'smirk_left', emoji: '😏', label: 'Smirk left' },
  { id: 'smirk_right', emoji: '😏', label: 'Smirk right' },
  { id: 'frown', emoji: '☹️', label: 'Frown' },
  { id: 'mouth_shrug', emoji: '😕', label: 'Mouth shrug' },
  { id: 'lip_roll', emoji: '🤐', label: 'Lip roll' },
  { id: 'wink_tongue', emoji: '😜', label: 'Wink + tongue' },
  { id: 'kiss', emoji: '😘', label: 'Blow a kiss' },
  { id: 'brows_open_mouth', emoji: '😲', label: 'Wide eyes + brows up + round mouth' },
  { id: 'eyes_closed', emoji: '😌', label: 'Close both eyes' },
  { id: 'glance_left', emoji: '🙄', label: 'Glance left' },
  { id: 'glance_right', emoji: '🙄', label: 'Glance right' },
  { id: 'brow_furrow', emoji: '🤨', label: 'Furrow brows' },
  { id: 'lips_press', emoji: '🤐', label: 'Press lips (shush)' },
  { id: 'weary', emoji: '😩', label: 'Squint + frown' },
  { id: 'thinking', emoji: '🤔', label: 'Thinking face' },
  { id: 'hug', emoji: '🤗', label: 'Squinty smile' },
  { id: 'salute', emoji: '🫡', label: 'Wink + raise brow' },
  { id: 'vomit', emoji: '🤮', label: 'Vomit (tongue + open)' },
  { id: 'scream', emoji: '😱', label: 'Scream' },
  { id: 'plead', emoji: '🥹', label: 'Pleading' },
  { id: 'mind_blown', emoji: '🤯', label: 'Wide eyes + brows up + round mouth' },
  { id: 'sleep', emoji: '😴', label: 'Sleep (eyes closed)' },
  { id: 'laugh', emoji: '😂', label: 'Laugh' },
  { id: 'smirk', emoji: '😏', label: 'Smirk' },
  { id: 'drool', emoji: '🤤', label: 'Drool (tongue)' },
  { id: 'shush', emoji: '🤫', label: 'Press lips (shush)' },
]

export const THRESHOLDS = {
  smile: 0.45,
  openMouth: 0.5,
  pucker: 0.4,
  browDown: 0.3,
  browRaise: 0.45,
  winkHigh: 0.6,
  winkLow: 0.25,
  mouthPress: 0.25,
  mouthStretch: 0.4,
  cheekPuff: 0.45,
  surprisedJaw: 0.55,
  surprisedBrow: 0.45,
  eyeWide: 0.55,
  squint: 0.55,
  tongueOut: 0.6,
  funnel: 0.5,
  sneer: 0.5,
  upperLip: 0.35,
  smirkDelta: 0.25,
  frown: 0.5,
  frownBrowAssist: 0.25,
  cheekSuck: 0.55,
  mouthShrug: 0.45,
  lipRoll: 0.5,
  winkAssist: 0.5,
  blinkBoth: 0.75,
  eyeLook: 0.35,
  browFurrow: 0.45,
  browInnerLow: 0.3,
  lipsPressBoth: 0.5,
  wearySquint: 0.6,
  wearyFrown: 0.45,
  eyeUp: 0.45,
  thinkingBrowDelta: 0.25,
  thinkingPress: 0.35,
  hugSmile: 0.55,
  saluteWink: 0.6,
  vomitJaw: 0.75,
  screamJaw: 0.8,
  pleadEye: 0.6,
  pleadBrow: 0.55,
  blownMix: 0.6,
  laughSmile: 0.6,
  laughJaw: 0.6,
  droolTongue: 0.55,
  nerdCross: 0.4,
  shushPress: 0.6,
  holdSeconds: 0.9,
  instantPass: 0.9,
}


