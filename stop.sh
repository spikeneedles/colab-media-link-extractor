#!/bin/bash
# Stop Media Link Extractor backend and frontend services

echo "🛑 Stopping Media Link Extractor services..."
echo ""

STOPPED=0

# Stop backend
if [ -f backend.pid ]; then
    PID=$(cat backend.pid)
    if kill -0 $PID 2>/dev/null; then
        echo "🔴 Stopping backend (PID: $PID)..."
        kill $PID 2>/dev/null || kill -9 $PID 2>/dev/null
        rm backend.pid
        STOPPED=$((STOPPED + 1))
    else
        echo "ℹ️  Backend process not found"
        rm backend.pid
    fi
else
    echo "ℹ️  Backend PID file not found"
fi

# Stop frontend
if [ -f frontend.pid ]; then
    PID=$(cat frontend.pid)
    if kill -0 $PID 2>/dev/null; then
        echo "🔴 Stopping frontend (PID: $PID)..."
        kill $PID 2>/dev/null || kill -9 $PID 2>/dev/null
        rm frontend.pid
        STOPPED=$((STOPPED + 1))
    else
        echo "ℹ️  Frontend process not found"
        rm frontend.pid
    fi
else
    echo "ℹ️  Frontend PID file not found"
fi

# Also try to kill by port (fallback)
if command -v lsof >/dev/null 2>&1; then
    BACKEND_PID=$(lsof -ti:3002 2>/dev/null)
    if [ -n "$BACKEND_PID" ]; then
        echo "🔴 Found backend process on port 3002 (PID: $BACKEND_PID)..."
        kill $BACKEND_PID 2>/dev/null || kill -9 $BACKEND_PID 2>/dev/null
        STOPPED=$((STOPPED + 1))
    fi
    
    FRONTEND_PID=$(lsof -ti:5001 2>/dev/null)
    if [ -n "$FRONTEND_PID" ]; then
        echo "🔴 Found frontend process on port 5001 (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID 2>/dev/null || kill -9 $FRONTEND_PID 2>/dev/null
        STOPPED=$((STOPPED + 1))
    fi
fi

echo ""
if [ $STOPPED -gt 0 ]; then
    echo "✅ Stopped $STOPPED service(s)"
else
    echo "ℹ️  No services were running"
fi
