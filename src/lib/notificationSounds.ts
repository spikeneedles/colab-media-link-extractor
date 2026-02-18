export type NotificationTone = 'chime' | 'bell' | 'success' | 'alert' | 'complete' | 'none'

export interface NotificationSound {
  name: string
  tone: NotificationTone
  description: string
  audioData: string
}

const createAudioContext = () => {
  if (typeof window === 'undefined') return null
  return new (window.AudioContext || (window as any).webkitAudioContext)()
}

const playTone = async (frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3) => {
  const context = createAudioContext()
  if (!context) return

  const oscillator = context.createOscillator()
  const gainNode = context.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(context.destination)

  oscillator.frequency.value = frequency
  oscillator.type = type

  gainNode.gain.setValueAtTime(0, context.currentTime)
  gainNode.gain.linearRampToValueAtTime(volume, context.currentTime + 0.01)
  gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + duration)

  oscillator.start(context.currentTime)
  oscillator.stop(context.currentTime + duration)

  return new Promise<void>((resolve) => {
    setTimeout(() => {
      context.close()
      resolve()
    }, duration * 1000 + 100)
  })
}

const playChord = async (frequencies: number[], duration: number, type: OscillatorType = 'sine', volume: number = 0.2) => {
  const context = createAudioContext()
  if (!context) return

  const oscillators = frequencies.map(() => context.createOscillator())
  const gainNode = context.createGain()

  oscillators.forEach((osc, i) => {
    osc.connect(gainNode)
    osc.frequency.value = frequencies[i]
    osc.type = type
  })

  gainNode.connect(context.destination)
  gainNode.gain.setValueAtTime(0, context.currentTime)
  gainNode.gain.linearRampToValueAtTime(volume, context.currentTime + 0.01)
  gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + duration)

  oscillators.forEach(osc => {
    osc.start(context.currentTime)
    osc.stop(context.currentTime + duration)
  })

  return new Promise<void>((resolve) => {
    setTimeout(() => {
      context.close()
      resolve()
    }, duration * 1000 + 100)
  })
}

export const notificationSounds: Record<NotificationTone, NotificationSound> = {
  chime: {
    name: 'Chime',
    tone: 'chime',
    description: 'Gentle ascending chime',
    audioData: 'generated'
  },
  bell: {
    name: 'Bell',
    tone: 'bell',
    description: 'Clear bell ring',
    audioData: 'generated'
  },
  success: {
    name: 'Success',
    tone: 'success',
    description: 'Triumphant success sound',
    audioData: 'generated'
  },
  alert: {
    name: 'Alert',
    tone: 'alert',
    description: 'Attention-grabbing alert',
    audioData: 'generated'
  },
  complete: {
    name: 'Complete',
    tone: 'complete',
    description: 'Task completion fanfare',
    audioData: 'generated'
  },
  none: {
    name: 'None',
    tone: 'none',
    description: 'No sound',
    audioData: ''
  }
}

export const playNotificationSound = async (tone: NotificationTone): Promise<void> => {
  if (tone === 'none') return

  try {
    switch (tone) {
      case 'chime':
        await playTone(523.25, 0.15, 'sine', 0.3)
        await new Promise(resolve => setTimeout(resolve, 50))
        await playTone(659.25, 0.15, 'sine', 0.3)
        await new Promise(resolve => setTimeout(resolve, 50))
        await playTone(783.99, 0.2, 'sine', 0.3)
        break

      case 'bell':
        await playChord([659.25, 783.99, 987.77], 0.4, 'sine', 0.25)
        await new Promise(resolve => setTimeout(resolve, 100))
        await playChord([659.25, 783.99, 987.77], 0.3, 'sine', 0.15)
        break

      case 'success':
        await playTone(523.25, 0.1, 'sine', 0.3)
        await new Promise(resolve => setTimeout(resolve, 50))
        await playTone(659.25, 0.1, 'sine', 0.3)
        await new Promise(resolve => setTimeout(resolve, 50))
        await playTone(783.99, 0.15, 'sine', 0.35)
        await new Promise(resolve => setTimeout(resolve, 50))
        await playChord([523.25, 659.25, 783.99], 0.4, 'sine', 0.3)
        break

      case 'alert':
        await playTone(880, 0.15, 'square', 0.3)
        await new Promise(resolve => setTimeout(resolve, 100))
        await playTone(880, 0.15, 'square', 0.3)
        await new Promise(resolve => setTimeout(resolve, 100))
        await playTone(880, 0.2, 'square', 0.3)
        break

      case 'complete':
        await playTone(392, 0.12, 'sine', 0.3)
        await new Promise(resolve => setTimeout(resolve, 40))
        await playTone(523.25, 0.12, 'sine', 0.3)
        await new Promise(resolve => setTimeout(resolve, 40))
        await playTone(659.25, 0.12, 'sine', 0.3)
        await new Promise(resolve => setTimeout(resolve, 40))
        await playTone(783.99, 0.15, 'sine', 0.35)
        await new Promise(resolve => setTimeout(resolve, 50))
        await playChord([392, 523.25, 659.25, 783.99], 0.5, 'sine', 0.25)
        break
    }
  } catch (error) {
    console.error('Failed to play notification sound:', error)
  }
}

export const previewNotificationSound = (tone: NotificationTone): void => {
  playNotificationSound(tone).catch(error => {
    console.error('Failed to preview sound:', error)
  })
}

export const getNotificationToneName = (tone: NotificationTone): string => {
  return notificationSounds[tone]?.name || 'Unknown'
}

export const getNotificationToneDescription = (tone: NotificationTone): string => {
  return notificationSounds[tone]?.description || ''
}

export const getAllNotificationTones = (): NotificationTone[] => {
  return Object.keys(notificationSounds) as NotificationTone[]
}
