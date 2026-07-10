#!/bin/bash
# Start dev server, run clinic dashboard verifications, then shut down.
set -e

cd /home/z/my-project

echo "=== Starting dev server ==="
node ./node_modules/.bin/next dev -p 3000 > /home/z/my-project/dev.log 2>&1 &
DEV_PID=$!
echo "Dev PID: $DEV_PID"

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

section() {
  echo ""
  echo "=========================================="
  echo "  $1"
  echo "=========================================="
}

section "STEP 1: Open homepage (setup screen)"
agent-browser open http://localhost:3000/ 2>&1 | tail -3
sleep 3

# Setup the owner
section "STEP 2: Setup owner"
agent-browser find label "Owner name" fill "Dr. Alex" 2>&1 | tail -1
agent-browser find label "Password" fill "testpass123" 2>&1 | tail -1
agent-browser find label "Confirm password" fill "testpass123" 2>&1 | tail -1
agent-browser find role button click --name "Lock it down" 2>&1 | tail -1
sleep 4

section "STEP 3: Verify dashboard loaded (should show clinic dashboard)"
agent-browser snapshot -i 2>&1 | head -80

section "STEP 4: Screenshot - empty clinic dashboard"
agent-browser screenshot /home/z/my-project/scripts/clinic-empty.png 2>&1 | tail -1

section "STEP 5: Click 'Add patient' quick action"
agent-browser find role button click --name "Add patient" 2>&1 | tail -1
sleep 2
agent-browser snapshot -i 2>&1 | head -60

section "STEP 6: Fill patient form in the dialog"
agent-browser find label "Name" fill "John Doe" 2>&1 | tail -1
agent-browser find label "Age" fill "35" 2>&1 | tail -1
agent-browser find label "Phone" fill "+1-555-0100" 2>&1 | tail -1
agent-browser find label "Email" fill "john@example.com" 2>&1 | tail -1
agent-browser find role button click --name "Add patient" 2>&1 | tail -1
sleep 2

section "STEP 7: Add 2 more patients for chart testing"
agent-browser find role button click --name "Add patient" 2>&1 | tail -1
sleep 1
agent-browser find label "Name" fill "Jane Smith" 2>&1 | tail -1
agent-browser find label "Age" fill "28" 2>&1 | tail -1
agent-browser find role button click --name "Add patient" 2>&1 | tail -1
sleep 1
agent-browser find role button click --name "Add patient" 2>&1 | tail -1
sleep 1
agent-browser find label "Name" fill "Bob Wilson" 2>&1 | tail -1
agent-browser find role button click --name "Add patient" 2>&1 | tail -1
sleep 2

section "STEP 8: Book appointment for John Doe"
agent-browser find role button click --name "Book appointment" 2>&1 | tail -1
sleep 2
# Default patient is the first one
agent-browser find label "Reason" fill "Annual checkup" 2>&1 | tail -1
agent-browser find label "Consultation fee" fill "75" 2>&1 | tail -1
agent-browser find role button click --name "Book appointment" 2>&1 | tail -1
sleep 2

section "STEP 9: Add a medicine via Inventory tab"
agent-browser find role tab click --name "Inventory" 2>&1 | tail -1 || agent-browser find role tab click --name "Stock" 2>&1 | tail -1
sleep 2
agent-browser find role button click --name "Add medicine" 2>&1 | tail -1
sleep 1
# Fill medicine form — try label-based
agent-browser snapshot -i 2>&1 | head -40
# Use refs from the snapshot — find the inputs

section "STEP 10: Generate a bill"
agent-browser find role tab click --name "Dashboard" 2>&1 | tail -1 || agent-browser find role tab click --name "Home" 2>&1 | tail -1
sleep 2
agent-browser find role button click --name "Generate bill" 2>&1 | tail -1
sleep 2
agent-browser snapshot -i 2>&1 | head -40

section "STEP 11: Submit the bill (default patient + default consultation item)"
agent-browser find role button click --name "Generate bill" 2>&1 | tail -1
sleep 2

section "STEP 12: Back to dashboard — verify stats updated"
agent-browser snapshot -i 2>&1 | head -80

section "STEP 13: Screenshot — populated dashboard"
agent-browser screenshot /home/z/my-project/scripts/clinic-populated.png 2>&1 | tail -1

section "STEP 14: Visit patients tab"
agent-browser find role tab click --name "Patients" 2>&1 | tail -1
sleep 2
agent-browser screenshot /home/z/my-project/scripts/clinic-patients.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -40

section "STEP 15: Visit appointments tab"
agent-browser find role tab click --name "Appts" 2>&1 | tail -1
sleep 2
agent-browser screenshot /home/z/my-project/scripts/clinic-appointments.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -40

section "STEP 16: Visit bills tab"
agent-browser find role tab click --name "Bills" 2>&1 | tail -1
sleep 2
agent-browser screenshot /home/z/my-project/scripts/clinic-bills.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -40

section "STEP 17: Dev log tail"
tail -20 /home/z/my-project/dev.log

section "STEP 18: Console errors"
agent-browser errors 2>&1 | head -30 || true

# Cleanup
echo ""
echo "=== Cleanup ==="
agent-browser close 2>&1 | tail -1 || true
kill $DEV_PID 2>/dev/null || true
wait $DEV_PID 2>/dev/null || true
echo "Done"
