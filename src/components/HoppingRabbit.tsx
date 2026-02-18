import { motion } from 'framer-motion'

export function HoppingRabbit() {
  // 1. Configuration for the vertical hop (The Bounce)
  const hopTransition = {
    duration: 0.8, // How long one full jump takes
    repeat: Infinity, // Hop forever
    repeatType: 'loop' as const,
    // This ease array simulates gravity: fast jump up, slower at apex, fast fall down.
    ease: ['easeOut', 'easeIn', 'easeOut', 'easeIn'],
    times: [0, 0.5, 1] // Keyframe timing
  }

  // 2. Configuration for horizontal movement (Moving across screen)
  const moveAcrossTransition = {
    duration: 15, // Takes 15 seconds to cross the screen
    repeat: Infinity,
    ease: 'linear', // Constant forward speed
  }

  return (
    // Outer container: Handles moving Left to Right across the screen
    <motion.div
      className="absolute bottom-10 left-0 w-full overflow-hidden pointer-events-none"
      initial={{ x: '-20%' }} // Start slightly off-screen left
      animate={{ x: '120%' }}  // End off-screen right
      transition={moveAcrossTransition}
    >
       {/* Inner container: Handles the Up and Down bouncing */}
       {/* We use keyframes [0, -120, 0] to start on ground, go up 120px, land back on ground */}
      <motion.div
        animate={{ y: [0, -120, 0] }}
        transition={hopTransition}
        className="w-fit" // Ensure it doesn't stretch full width
      >
        {/* The Rabbit PNG Image */}
        {/* You can adjust w-32 h-32 to change the rabbit size */}
        <img 
          src="/images/rabbit.png" 
          alt="Hopping rabbit"
          className="w-32 h-32 drop-shadow-sm select-none"
        />
      </motion.div>
    </motion.div>
  )
}
