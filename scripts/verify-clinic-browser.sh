#!/bin/bash
# Login via browser, then take screenshots of each tab.
set -e

cd /home/z/my-project

echo "=== Starting dev server ==="
node ./node_modules/.bin/next dev -p 3000 > /home/z/my-project/dev.log 2>&1 &
DEV_PID=$!

for i in $(seq 1 60); do
  CODE=$(curl -sS -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null || true)
  if [ "$CODE" = "200" ] || [ "$CODE" = "500" ]; then
    echo "Server ready after $i seconds"
    break
  fi
  sleep 1
done

section() {
  echo ""
  echo "===== $1 ====="
}

section "Open & login"
agent-browser open http://localhost:3000/ 2>&1 | tail -2
sleep 3
agent-browser find label "Password" fill "testpass123" 2>&1 | tail -1
agent-browser find role button click --name "Unlock" 2>&1 | tail -1
sleep 4

section "Dashboard snapshot"
agent-browser snapshot -i 2>&1 | head -60
agent-browser screenshot /home/z/my-project/scripts/clinic-logged-in.png 2>&1 | tail -1

section "Patients tab"
agent-browser find role tab click --name "Patients" 2>&1 | tail -1
sleep 2
agent-browser screenshot /home/z/my-project/scripts/clinic-tab-patients.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -40

section "Appointments tab"
agent-browser find role tab click --name "Appts" 2>&1 | tail -1
sleep 2
agent-browser screenshot /home/z/my-project/scripts/clinic-tab-appointments.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -40

section "Bills tab"
agent-browser find role tab click --name "Bills" 2>&1 | tail -1
sleep 2
agent-browser screenshot /home/z/my-project/scripts/clinic-tab-bills.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -40

section "Inventory tab"
agent-browser find role tab click --name "Inventory" 2>&1 | tail -1 || agent-browser find role tab click --name "Stock" 2>&1 | tail -1
sleep 2
agent-browser screenshot /home/z/my-project/scripts/clinic-tab-inventory.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -40

section "Test Add Patient dialog"
agent-browser find role tab click --name "Dashboard" 2>&1 | tail -1 || agent-browser find role tab click --name "Home" 2>&1 | tail -1
sleep 2
agent-browser find role button click --name "Add patient Register a new patient" 2>&1 | tail -1
sleep 2
agent-browser screenshot /home/z/my-project/scripts/clinic-add-patient-dialog.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -30

section "Close dialog and test Book Appointment"
agent-browser find role button click --name "Cancel" 2>&1 | tail -1
sleep 1
agent-browser find role button click --name "Book appointment Schedule a visit" 2>&1 | tail -1
sleep 2
agent-browser screenshot /home/z/my-project/scripts/clinic-book-appointment-dialog.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -30

section "Close and test Generate Bill"
agent-browser find role button click --name "Cancel" 2>&1 | tail -1
sleep 1
agent-browser find role button click --name "Generate bill Create an itemized bill" 2>&1 | tail -1
sleep 2
agent-browser screenshot /home/z/my-project/scripts/clinic-generate-bill-dialog.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -30

section "Console errors"
agent-browser errors 2>&1 | head -20 || true

agent-browser close 2>&1 | tail -1 || true
kill $DEV_PID 2>/dev/null || true
wait $DEV_PID 2>/dev/null || true
echo "Done"
