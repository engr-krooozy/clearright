#!/bin/bash
# ClearRight — Local Development Runner
set -e

echo "🔵 Starting ClearRight locally..."

# Check for .env
if [ ! -f "server/.env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example server/.env
    echo "⚠️  Created server/.env from template. Please add your GOOGLE_API_KEY."
    exit 1
  fi
fi

# Start backend
echo "🐍 Starting backend (FastAPI)..."
cd server
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# Give backend a moment to start
sleep 2

# Start frontend
echo "⚡ Starting frontend (Next.js)..."
cd client
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ ClearRight running!"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
