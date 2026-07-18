#!/bin/bash
# Faster verification using API calls to seed data, then browser screenshots.
set -e

cd /home/z/my-project

echo "=== Starting dev server ==="
node ./node_modules/.bin/next dev -p 3000 > /home/z/my-project/dev.log 2>&1 &
DEV_PID=$!
echo "Dev PID: $DEV_PID"

for i in $(seq 1 60); do
  CODE=$(curl -sS -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null || true)
  if [ "$CODE" = "200" ] || [ "$CODE" = "500" ]; then
    echo "Server ready after $i seconds (HTTP $CODE)"
    break
  fi
  sleep 1
done

section() {
  echo ""
  echo "=========================================="
  echo "  $1"
  echo "=========================================="
}

section "STEP 1: Setup owner via API"
curl -sS -X POST http://localhost:3000/api/setup \
  -H 'Content-Type: application/json' \
  -d '{"name":"Dr. Alex","password":"testpass123","autoLockMinutes":60}' \
  -c /tmp/cookies.txt -b /tmp/cookies.txt | head -c 200
echo ""

section "STEP 2: Add 3 patients via API"
for p in '{"name":"John Doe","age":35,"gender":"male","phone":"+1-555-0100","email":"john@example.com"}' \
         '{"name":"Jane Smith","age":28,"gender":"female","phone":"+1-555-0101"}' \
         '{"name":"Bob Wilson","age":52,"gender":"male","phone":"+1-555-0102","address":"123 Main St"}'; do
  curl -sS -X POST http://localhost:3000/api/patients \
    -H 'Content-Type: application/json' \
    -d "$p" -b /tmp/cookies.txt | head -c 150
  echo ""
done

section "STEP 3: Book 4 appointments (today and recent days) via API"
NOW_MS=$(date +%s)000
# Today
H1=$((NOW_MS + 3600000))
H2=$((NOW_MS + 7200000))
# 2 days ago
D2=$((NOW_MS - 86400000 * 2))
# 4 days ago
D4=$((NOW_MS - 86400000 * 4))

PATIENT_IDS=$(curl -sS http://localhost:3000/api/patients -b /tmp/cookies.txt | python3 -c "import sys,json; d=json.load(sys.stdin); print('\n'.join([p['id'] for p in d['patients']]))")
P1=$(echo "$PATIENT_IDS" | sed -n '1p')
P2=$(echo "$PATIENT_IDS" | sed -n '2p')
P3=$(echo "$PATIENT_IDS" | sed -n '3p')

for appt in "{\"patientId\":\"$P1\",\"scheduledAt\":\"2026-07-11T10:00:00.000Z\",\"reason\":\"Annual checkup\",\"fee\":75}" \
            "{\"patientId\":\"$P2\",\"scheduledAt\":\"2026-07-11T14:00:00.000Z\",\"reason\":\"Follow-up\",\"fee\":50}" \
            "{\"patientId\":\"$P3\",\"scheduledAt\":\"2026-07-09T11:00:00.000Z\",\"reason\":\"Consultation\",\"fee\":60}" \
            "{\"patientId\":\"$P1\",\"scheduledAt\":\"2026-07-07T09:00:00.000Z\",\"reason\":\"Lab review\",\"fee\":40}"; do
  curl -sS -X POST http://localhost:3000/api/appointments \
    -H 'Content-Type: application/json' \
    -d "$appt" -b /tmp/cookies.txt | head -c 150
  echo ""
done

section "STEP 4: Add 3 medicines via API (one low-stock)"
for m in '{"name":"Paracetamol","sku":"MED-001","quantity":5,"price":2.50,"reorderLevel":10}' \
         '{"name":"Amoxicillin","sku":"MED-002","quantity":30,"price":8.00,"reorderLevel":15}' \
         '{"name":"Cough Syrup","sku":"MED-003","quantity":2,"price":6.75,"reorderLevel":10}'; do
  curl -sS -X POST http://localhost:3000/api/medicines \
    -H 'Content-Type: application/json' \
    -d "$m" -b /tmp/cookies.txt | head -c 150
  echo ""
done

section "STEP 5: Generate 2 bills via API (one paid, one pending)"
for b in "{\"patientId\":\"$P1\",\"items\":[{\"name\":\"Consultation\",\"qty\":1,\"price\":75},{\"name\":\"Paracetamol\",\"qty\":2,\"price\":2.50}],\"status\":\"paid\"}" \
         "{\"patientId\":\"$P2\",\"items\":[{\"name\":\"Consultation\",\"qty\":1,\"price\":50}],\"status\":\"pending\"}" \
         "{\"patientId\":\"$P3\",\"items\":[{\"name\":\"Lab Test\",\"qty\":1,\"price\":120},{\"name\":\"Amoxicillin\",\"qty\":1,\"price\":8.00}],\"status\":\"pending\"}"; do
  curl -sS -X POST http://localhost:3000/api/bills \
    -H 'Content-Type: application/json' \
    -d "$b" -b /tmp/cookies.txt | head -c 150
  echo ""
done

section "STEP 6: Verify dashboard API stats"
curl -sS http://localhost:3000/api/dashboard -b /tmp/cookies.txt | python3 -m json.tool | head -60

section "STEP 7: Open dashboard in browser and screenshot"
agent-browser open http://localhost:3000/ 2>&1 | tail -3
sleep 4
# Should already be authenticated because the cookie is set on localhost
agent-browser screenshot /home/z/my-project/scripts/clinic-final.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -80

section "STEP 8: Check each tab"
for tab in patients appointments bills inventory; do
  echo ""
  echo "--- $tab tab ---"
  agent-browser find role tab click --name "$tab" 2>&1 | tail -1 || agent-browser find role tab click --name "Appts" 2>&1 | tail -1
  sleep 2
  agent-browser screenshot /home/z/my-project/scripts/clinic-tab-$tab.png 2>&1 | tail -1
done

section "STEP 9: Dev log tail"
tail -20 /home/z/my-project/dev.log

section "STEP 10: Console errors"
agent-browser errors 2>&1 | head -20 || true

# Cleanup
echo ""
echo "=== Cleanup ==="
agent-browser close 2>&1 | tail -1 || true
kill $DEV_PID 2>/dev/null || true
wait $DEV_PID 2>/dev/null || true
echo "Done"
