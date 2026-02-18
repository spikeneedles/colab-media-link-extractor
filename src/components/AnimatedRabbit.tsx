import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { RabbitIcon } from './RabbitIcon'

interface AnimatedRabbitProps {
  size?: number
  className?: string
  variant?: 'idle' | 'scanning' | 'success' | 'thinking' | 'sleeping'
}

export function AnimatedRabbit({ size = 48, className = '', variant = 'idle' }: AnimatedRabbitProps) {
  const [isBlinking, setIsBlinking] = useState(false)
  const [twitchEar, setTwitchEar] = useState<'left' | 'right' | 'none'>('none')
  const [isStanding, setIsStanding] = useState(false)

  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true)
      setTimeout(() => setIsBlinking(false), 150)
    }, 3000 + Math.random() * 2000)

    const earInterval = setInterval(() => {
      const shouldTwitch = Math.random() > 0.5
      if (shouldTwitch) {
        setTwitchEar(Math.random() > 0.5 ? 'left' : 'right')
        setTimeout(() => setTwitchEar('none'), 300)
      }
    }, 2000 + Math.random() * 3000)

    const standInterval = setInterval(() => {
      setIsStanding(true)
      setTimeout(() => setIsStanding(false), 1500)
    }, 8000 + Math.random() * 4000)

    return () => {
      clearInterval(blinkInterval)
      clearInterval(earInterval)
      clearInterval(standInterval)
    }
  }, [])

  const hopAnimation = {
    x: [-30, 30, -30],
    y: [0, -15, 0, -12, 0, -10, 0],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: "easeInOut" as const
    }
  }

  const standingAnimation = {
    y: isStanding ? -20 : 0,
    scaleY: isStanding ? 1.3 : 1,
    transition: {
      duration: 0.5,
      ease: "easeOut" as const
    }
  }

  const containerVariants = {
    idle: hopAnimation,
    scanning: {
      ...hopAnimation,
      rotate: [0, -5, 5, -5, 5, 0],
      transition: {
        ...hopAnimation.transition,
        rotate: {
          duration: 0.5,
          repeat: Infinity,
          repeatDelay: 0.5
        }
      }
    },
    success: {
      scale: [1, 1.2, 1],
      y: [0, -30, 0],
      rotate: [0, 360, 0],
      transition: {
        duration: 0.8,
        times: [0, 0.5, 1]
      }
    },
    thinking: hopAnimation,
    sleeping: {
      y: [0, 2, 0],
      transition: {
        duration: 2.5,
        repeat: Infinity,
        repeatType: "loop" as const
      }
    }
  }

  return (
    <motion.div
      className={`inline-block ${className}`}
      style={{ width: size, height: size }}
      variants={containerVariants}
      animate={variant}
    >
      <RabbitIcon 
        className="w-full h-full text-accent"
        style={{ width: size, height: size }}
      />
    </motion.div>
  )
}

export function RabbitSleeping({ size = 64, message }: { size?: number; message?: string }) {
  return (
    <motion.div
      className="flex flex-col items-center gap-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <AnimatedRabbit size={size} variant="sleeping" />
      {message && (
        <motion.p
          className="text-sm text-muted-foreground font-medium text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          {message}
        </motion.p>
      )}
    </motion.div>
  )
}

export function RabbitLoader({ size = 64 }: { size?: number }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <AnimatedRabbit size={size} variant="scanning" />
      <motion.div
        className="flex gap-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-accent"
            animate={{
              y: [0, -10, 0],
              opacity: [0.3, 1, 0.3]
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: i * 0.2
            }}
          />
        ))}
      </motion.div>
    </div>
  )
}

export function RabbitSuccess({ size = 64, message }: { size?: number; message?: string }) {
  return (
    <motion.div
      className="flex flex-col items-center gap-3"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", duration: 0.6 }}
    >
      <AnimatedRabbit size={size} variant="success" />
      {message && (
        <motion.p
          className="text-sm text-accent font-medium"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {message}
        </motion.p>
      )}
    </motion.div>
  )
}

export function RabbitThinking({ size = 48 }: { size?: number }) {
  return (
    <div className="flex items-center gap-3">
      <AnimatedRabbit size={size} variant="thinking" />
      <span className="text-sm text-muted-foreground">Thinking...</span>
    </div>
  )
}
