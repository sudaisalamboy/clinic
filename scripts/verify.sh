#!/bin/bash
# Start the dev server, run agent-browser verifications, then shut down.
set -e

cd /home/z/my-project

# 1. Start dev server in background
echo "=== Starting dev server ==="
node ./node_modules/.bin/next dev -p 3000 > /home/z/my-project/dev.log 2>&1 &
DEV_PID=$!
echo "Dev PID: $DEV_PID"

# 2. Wait for ready
echo "=== Waiting for server ready ==="
for i in $(seq 1 60); do
  CODE=$(curl -sS -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null || true)
  if [ "$CODE" = "200" ] || [ "$CODE" = "500" ]; then
    echo "Server ready after $i seconds (HTTP $CODE)"
    break
  fi
  sleep 1
done

if [ "$CODE" != "200" ] && [ "$CODE" != "500" ]; then
  echo "Server failed to start"
  kill $DEV_PID 2>/dev/null || true
  exit 1
fi

# 3. Helper to capture section headers
section() {
  echo ""
  echo "=========================================="
  echo "  $1"
  echo "=========================================="
}

# 4. Run verifications
section "STEP 1: Open homepage (should show setup screen since no owner yet)"
agent-browser open http://localhost:3000/ 2>&1 | tail -3
sleep 3

section "STEP 2: Snapshot interactive elements"
agent-browser snapshot -i 2>&1 | head -60

section "STEP 3: Fill setup form via labels"
agent-browser find label "Owner name" fill "Alex" 2>&1 | tail -2 || true
agent-browser find label "Password" fill "testpass123" 2>&1 | tail -2 || true
agent-browser find label "Confirm password" fill "testpass123" 2>&1 | tail -2 || true

section "STEP 4: Click setup button"
agent-browser find role button click --name "Lock it down" 2>&1 | tail -2 || true

sleep 4

section "STEP 5: Snapshot after setup"
agent-browser snapshot -i 2>&1 | head -80

section "STEP 6: Take screenshot"
agent-browser screenshot /home/z/my-project/scripts/after-setup.png 2>&1 | tail -3 || true

section "STEP 7: Test logout (lock the app)"
agent-browser find role button click --name "Sign out" 2>&1 | tail -2 || true
sleep 2
agent-browser snapshot -i 2>&1 | head -40

section "STEP 8: Test login with wrong password"
agent-browser find label "Password" fill "wrongpass" 2>&1 | tail -2 || true
agent-browser find role button click --name "Unlock" 2>&1 | tail -2 || true
sleep 2
agent-browser snapshot 2>&1 | head -30

section "STEP 9: Login with correct password"
agent-browser find label "Password" fill "testpass123" 2>&1 | tail -2 || true
agent-browser find role button click --name "Unlock" 2>&1 | tail -2 || true
sleep 3
agent-browser snapshot -i 2>&1 | head -40

section "STEP 10: Test notes panel"
agent-browser find role tab click --name "Notes" 2>&1 | tail -2 || true
sleep 2
agent-browser snapshot -i 2>&1 | head -40

section "STEP 11: Final screenshot"
agent-browser screenshot /home/z/my-project/scripts/final-state.png 2>&1 | tail -3 || true

section "STEP 12: Dev log tail"
tail -30 /home/z/my-project/dev.log

section "STEP 13: Console errors"
agent-browser errors 2>&1 | head -30 || true

# Cleanup
echo ""
echo "=== Cleanup ==="
agent-browser close 2>&1 | tail -2 || true
kill $DEV_PID 2>/dev/null || true
wait $DEV_PID 2>/dev/null || true
echo "Done"
