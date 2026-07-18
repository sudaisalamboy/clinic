#!/bin/bash
# Verify the 4 patient views: list, add, profile, edit.
set -e

cd /home/z/my-project

echo "=== Starting dev server ==="
node ./node_modules/.bin/next dev -p 3000 > /home/z/my-project/dev.log 2>&1 &
DEV_PID=$!
echo "Dev PID: $DEV_PID"

for i in $(seq 1 60); do
  CODE=$(curl -sS -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null || true)
  if [ "$CODE" = "200" ] || [ "$CODE" = "500" ]; then
    echo "Server ready after $i seconds"
    break
  fi
  sleep 1
done

section() { echo ""; echo "===== $1 ====="; }

section "1. Setup owner via API"
rm -f /tmp/cookies.txt
curl -sS -X POST http://localhost:3000/api/setup \
  -H 'Content-Type: application/json' \
  -d '{"name":"Dr. Alex","password":"testpass123","autoLockMinutes":60}' \
  -c /tmp/cookies.txt -b /tmp/cookies.txt | head -c 100
echo ""

section "2. Add 12 patients via API (to test pagination — 10 per page)"
for i in $(seq 1 12); do
  YEAR=$((1990 + (i % 15)))
  MONTH=$((1 + (i % 12)))
  DAY=$((1 + (i % 28)))
  DOB="${YEAR}-$(printf '%02d' $MONTH)-$(printf '%02d' $DAY)"
  NAMES=("John" "Jane" "Bob" "Alice" "Charlie" "Diana" "Eve" "Frank" "Grace" "Henry" "Ivy" "Jack")
  LASTS=("Doe" "Smith" "Wilson" "Brown" "Davis" "Miller" "Wilson" "Taylor" "Anderson" "Thomas" "Jackson" "Lee")
  NAME="${NAMES[$((i-1))]} ${LASTS[$((i-1))]}"
  curl -sS -X POST http://localhost:3000/api/patients \
    -H 'Content-Type: application/json' \
    -d "{\"name\":\"$NAME\",\"dateOfBirth\":\"$DOB\",\"gender\":\"$([ $((i%2)) -eq 0 ] && echo 'female' || echo 'male')\",\"phone\":\"+1-555-$(printf '%04d' $i)\",\"email\":\"patient$i@example.com\",\"bloodGroup\":\"$([ $((i%4)) -eq 0 ] && echo 'A+' || echo 'O+')\",\"address\":\"${i} Main St\"}" \
    -b /tmp/cookies.txt > /dev/null
done
echo "Created 12 patients"

section "3. Verify patient_code auto-generation (first 3)"
curl -sS 'http://localhost:3000/api/patients?limit=3' -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
for p in d['patients']:
    print(f\"  {p['patientCode']} — {p['name']}\")
print(f\"  Total: {d['pagination']['total']}, Pages: {d['pagination']['totalPages']}\")
"

section "4. Verify pagination — page 1 vs page 2"
echo "Page 1:"
curl -sS 'http://localhost:3000/api/patients?page=1&limit=10' -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
for p in d['patients']:
    print(f\"  {p['patientCode']} — {p['name']}\")
print(f\"  Showing {len(d['patients'])} of {d['pagination']['total']}\")
"
echo "Page 2:"
curl -sS 'http://localhost:3000/api/patients?page=2&limit=10' -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
for p in d['patients']:
    print(f\"  {p['patientCode']} — {p['name']}\")
print(f\"  Showing {len(d['patients'])} of {d['pagination']['total']}\")
"

section "5. Verify search by name"
curl -sS 'http://localhost:3000/api/patients?q=John' -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Found {len(d[\"patients\"])} patients matching John:')
for p in d['patients']:
    print(f\"  {p['patientCode']} — {p['name']}\")
"

section "6. Verify search by phone"
curl -sS 'http://localhost:3000/api/patients?q=555-0100' -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Found {len(d[\"patients\"])} patients matching 555-0100:')
for p in d['patients']:
    print(f\"  {p['patientCode']} — {p['name']} — {p['phone']}\")
"

section "7. Verify search by email"
curl -sS 'http://localhost:3000/api/patients?q=patient5@' -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Found {len(d[\"patients\"])} patients matching patient5@:')
for p in d['patients']:
    print(f\"  {p['patientCode']} — {p['name']} — {p['email']}\")
"

section "8. Add appointments + bills for first patient (for medical history)"
P1_ID=$(curl -sS 'http://localhost:3000/api/patients?limit=1' -b /tmp/cookies.txt | python3 -c "import sys,json; print(json.load(sys.stdin)['patients'][0]['id'])")
echo "First patient ID: $P1_ID"

curl -sS -X POST http://localhost:3000/api/appointments \
  -H 'Content-Type: application/json' \
  -d "{\"patientId\":\"$P1_ID\",\"scheduledAt\":\"2026-07-11T10:00:00.000Z\",\"reason\":\"Annual checkup\",\"fee\":75}" \
  -b /tmp/cookies.txt > /dev/null
curl -sS -X POST http://localhost:3000/api/appointments \
  -H 'Content-Type: application/json' \
  -d "{\"patientId\":\"$P1_ID\",\"scheduledAt\":\"2026-07-05T14:00:00.000Z\",\"reason\":\"Follow-up\",\"fee\":50,\"status\":\"completed\"}" \
  -b /tmp/cookies.txt > /dev/null
curl -sS -X POST http://localhost:3000/api/bills \
  -H 'Content-Type: application/json' \
  -d "{\"patientId\":\"$P1_ID\",\"items\":[{\"name\":\"Consultation\",\"qty\":1,\"price\":75},{\"name\":\"Paracetamol\",\"qty\":2,\"price\":2.50}],\"status\":\"paid\"}" \
  -b /tmp/cookies.txt > /dev/null
curl -sS -X POST http://localhost:3000/api/bills \
  -H 'Content-Type: application/json' \
  -d "{\"patientId\":\"$P1_ID\",\"items\":[{\"name\":\"Lab Test\",\"qty\":1,\"price\":120}],\"status\":\"pending\"}" \
  -b /tmp/cookies.txt > /dev/null
echo "Added 2 appointments + 2 bills"

section "9. Verify GET single patient with medical history"
curl -sS "http://localhost:3000/api/patients/$P1_ID" -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
p = d['patient']
print(f\"Patient: {p['name']} ({p['patientCode']})\")
print(f\"  DOB: {p['dateOfBirth'][:10] if p['dateOfBirth'] else 'N/A'}\")
print(f\"  Status: {p['status']}\")
print(f\"  Blood: {p['bloodGroup']}\")
print(f\"  Appointments: {len(p['appointments'])}\")
for a in p['appointments']:
    print(f\"    - {a['scheduledAt'][:10]} | {a['status']} | {a['reason']} | \${a['fee']}\")
print(f\"  Bills: {len(p['bills'])}\")
for b in p['bills']:
    items = ', '.join([f\"{it['name']} x{it['qty']}\" for it in b['items']])
    print(f\"    - {b['createdAt'][:10]} | {b['status']} | \${b['total']} | {items}\")
"

section "10. Verify soft delete (status → Inactive)"
curl -sS -X DELETE "http://localhost:3000/api/patients/$P1_ID" -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f\"After DELETE: status={d['patient']['status']}\")
"

section "11. Verify status filter"
echo "Active patients:"
curl -sS 'http://localhost:3000/api/patients?status=Active' -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  Count: {d[\"pagination\"][\"total\"]}')
"
echo "Inactive patients:"
curl -sS 'http://localhost:3000/api/patients?status=Inactive' -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  Count: {d[\"pagination\"][\"total\"]}')
"

section "12. Restore patient via PUT"
curl -sS -X PUT "http://localhost:3000/api/patients/$P1_ID" \
  -H 'Content-Type: application/json' \
  -d '{"status":"Active"}' \
  -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f\"After restore: status={d['patient']['status']}\")
"

# === Browser verification ===
section "13. Open browser and login"
agent-browser open http://localhost:3000/ 2>&1 | tail -2
sleep 3
agent-browser find label "Password" fill "testpass123" 2>&1 | tail -1
agent-browser find role button click --name "Unlock" 2>&1 | tail -1
sleep 4

section "14. Go to Patients tab"
agent-browser find role tab click --name "Patients" 2>&1 | tail -1
sleep 3
agent-browser screenshot /home/z/my-project/scripts/patient-list-view.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -50

section "15. Click first patient row to view profile"
# Click on the first patient's view button
agent-browser find role button click --name "View profile" 2>&1 | tail -1 || agent-browser find role button click --name "Eye" 2>&1 | tail -1
sleep 3
agent-browser screenshot /home/z/my-project/scripts/patient-profile-view.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -60

section "16. Click Edit button"
agent-browser find role button click --name "Edit" 2>&1 | tail -1
sleep 2
agent-browser screenshot /home/z/my-project/scripts/patient-edit-view.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -50

section "17. Go back, click Add patient button"
agent-browser find role button click --name "Cancel" 2>&1 | tail -1
sleep 1
agent-browser find role button click --name "Cancel" 2>&1 | tail -1
sleep 1
agent-browser find role button click --name "Add patient" 2>&1 | tail -1
sleep 2
agent-browser screenshot /home/z/my-project/scripts/patient-add-view.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -50

section "18. Test pagination — click Next"
agent-browser find role button click --name "Cancel" 2>&1 | tail -1
sleep 1
agent-browser find role button click --name "Next" 2>&1 | tail -1
sleep 2
agent-browser screenshot /home/z/my-project/scripts/patient-list-page2.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -30

section "19. Test search — type 'John'"
agent-browser find role button click --name "Prev" 2>&1 | tail -1
sleep 1
agent-browser find textbox fill "Search name, phone, email, code…" "John" 2>&1 | tail -1 || true
# alternative: find by placeholder
sleep 2
agent-browser screenshot /home/z/my-project/scripts/patient-search-john.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -30

section "20. Test status filter"
# Clear search first
agent-browser find textbox fill "Search name, phone, email, code…" "" 2>&1 | tail -1 || true
sleep 1
# Click the status filter dropdown
agent-browser snapshot -i 2>&1 | head -30

section "21. Dev log tail"
tail -15 /home/z/my-project/dev.log

section "22. Console errors"
agent-browser errors 2>&1 | head -20 || true

# Cleanup
echo ""
echo "=== Cleanup ==="
agent-browser close 2>&1 | tail -1 || true
kill $DEV_PID 2>/dev/null || true
wait $DEV_PID 2>/dev/null || true
echo "Done"
