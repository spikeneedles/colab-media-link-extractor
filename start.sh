#!/bin/bash
# Launch Media Link Extractor backend and frontend services

set -e

echo "🚀 Starting Media Link Extractor..."
echo ""

BACKEND_PORT=3002
FRONTEND_PORT=5001

# Check if ports are already in use
if lsof -Pi :$BACKEND_PORT -sTCP:LISTEN -t >/dev/null 2>&1 || netstat -an 2>/dev/null | grep -q ":$BACKEND_PORT.*LISTEN"; then
    echo "⚠️  Port $BACKEND_PORT is already in use (backend may already be running)"
else
    echo "📦 Starting backend on port $BACKEND_PORT..."
    cd backend
    npm run dev > ../backend.log 2>&1 &
    echo $! > ../backend.pid
    cd ..
    sleep 2
fi

if lsof -Pi :$FRONTEND_PORT -sTCP:LISTEN -t >/dev/null 2>&1 || netstat -an 2>/dev/null | grep -q ":$FRONTEND_PORT.*LISTEN"; then
    echo "⚠️  Port $FRONTEND_PORT is already in use (frontend may already be running)"
else
    echo "🎨 Starting frontend on port $FRONTEND_PORT..."
    npm run dev > frontend.log 2>&1 &
    echo $! > frontend.pid
    sleep 2
fi

echo ""
echo "⏳ Waiting for services to start..."
sleep 3

# Verify services are running
echo ""
echo "🔍 Checking service status..."

BACKEND_RUNNING=false
FRONTEND_RUNNING=false

if curl -s -o /dev/null -w "%{http_code}" http://localhost:$BACKEND_PORT/api/ | grep -q "200"; then
    echo "✅ Backend API: http://localhost:$BACKEND_PORT"
    BACKEND_RUNNING=true
else
    echo "❌ Backend: Not responding on port $BACKEND_PORT"
fi

if curl -s -o /dev/null -w "%{http_code}" http://localhost:$FRONTEND_PORT | grep -q "200"; then
    echo "✅ Frontend UI: http://localhost:$FRONTEND_PORT"
    FRONTEND_RUNNING=true
else
    echo "❌ Frontend: Not responding on port $FRONTEND_PORT"
fi

echo ""
if [ "$BACKEND_RUNNING" = true ] && [ "$FRONTEND_RUNNING" = true ]; then
    echo "🎉 All services started successfully!"
    echo ""
    echo "📖 Open your browser to: http://localhost:$FRONTEND_PORT"
    echo "📚 API Documentation: http://localhost:$BACKEND_PORT/api/"
else
    echo "⚠️  Some services failed to start. Check the logs:"
    echo "   Backend: backend.log"
    echo "   Frontend: frontend.log"
fi

echo ""
echo "💡 Tip: Services are running in the background"
echo "💡 To stop services, run: ./stop.sh"
