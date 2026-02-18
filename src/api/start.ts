#!/usr/bin/env node

/**
 * Startup script for the Media Link Scanner API
 * 
 * This script starts the Express API server that provides REST endpoints
 * for external applications to trigger scans and retrieve results.
 */

import { startServer } from './server'

console.log('🚀 Starting Media Link Scanner API...')
console.log('📍 Press Ctrl+C to stop the server\n')

startServer()

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down gracefully...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n\n👋 Shutting down gracefully...')
  process.exit(0)
})
