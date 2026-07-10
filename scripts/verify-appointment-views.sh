#!/bin/bash
# Verify the 3 appointment views + token gen + availability + status flow + reminders.
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

section() { echo ""; echo "===== $1 ====="; }

section "1. Setup owner (seeds departments)"
rm -f /tmp/cookies.txt
curl -sS -X POST http://localhost:3000/api/setup \
  -H 'Content-Type: application/json' \
  -d '{"name":"Dr. Alex","password":"testpass123","autoLockMinutes":60}' \
  -c /tmp/cookies.txt -b /tmp/cookies.txt | head -c 100
echo ""

section "2. Add a patient + a doctor with Mon-Fri 9-5 schedule"
PATIENT_ID=$(curl -sS -X POST http://localhost:3000/api/patients \
  -H 'Content-Type: application/json' \
  -d '{"name":"John Doe","dateOfBirth":"1990-05-15","gender":"male","phone":"+1-555-1000"}' \
  -b /tmp/cookies.txt | python3 -c "import sys,json; print(json.load(sys.stdin)['patient']['id'])")
echo "Patient: $PATIENT_ID"

DEPT_ID=$(curl -sS http://localhost:3000/api/departments -b /tmp/cookies.txt | python3 -c "import sys,json; print(json.load(sys.stdin)['departments'][0]['id'])")
DOCTOR_ID=$(curl -sS -X POST http://localhost:3000/api/doctors \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Dr. Sarah Chen\",\"specialization\":\"Cardiologist\",\"consultationFee\":150,\"departmentId\":\"$DEPT_ID\",\"schedule\":[{\"dayOfWeek\":0,\"isWorking\":false,\"startTime\":\"09:00\",\"endTime\":\"17:00\"},{\"dayOfWeek\":1,\"isWorking\":true,\"startTime\":\"09:00\",\"endTime\":\"17:00\"},{\"dayOfWeek\":2,\"isWorking\":true,\"startTime\":\"09:00\",\"endTime\":\"17:00\"},{\"dayOfWeek\":3,\"isWorking\":true,\"startTime\":\"09:00\",\"endTime\":\"17:00\"},{\"dayOfWeek\":4,\"isWorking\":true,\"startTime\":\"09:00\",\"endTime\":\"17:00\"},{\"dayOfWeek\":5,\"isWorking\":true,\"startTime\":\"09:00\",\"endTime\":\"13:00\"},{\"dayOfWeek\":6,\"isWorking\":false,\"startTime\":\"09:00\",\"endTime\":\"17:00\"}]}" \
  -b /tmp/cookies.txt | python3 -c "import sys,json; print(json.load(sys.stdin)['doctor']['id'])")
echo "Doctor: $DOCTOR_ID"

section "3. Book appointment — verify token auto-generation (A-001)"
# Book for today at 10:00
TODAY=$(date +%Y-%m-%dT10:00:00.000Z)
curl -sS -X POST http://localhost:3000/api/appointments \
  -H 'Content-Type: application/json' \
  -d "{\"patientId\":\"$PATIENT_ID\",\"doctorId\":\"$DOCTOR_ID\",\"scheduledAt\":\"$TODAY\",\"reason\":\"Heart checkup\"}" \
  -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
a = d.get('appointment', d)
print(f'  Token: {a[\"tokenNumber\"]}')
print(f'  Status: {a[\"status\"]}')
print(f'  Fee: \${a[\"fee\"]}')
print(f'  Patient: {a[\"patient\"][\"name\"]}')
print(f'  Doctor: {a[\"doctor\"][\"name\"] if a.get(\"doctor\") else \"—\"}')
"

section "4. Book second appointment — verify token increments (A-002)"
TODAY_11=$(date +%Y-%m-%dT11:00:00.000Z)
curl -sS -X POST http://localhost:3000/api/appointments \
  -H 'Content-Type: application/json' \
  -d "{\"patientId\":\"$PATIENT_ID\",\"doctorId\":\"$DOCTOR_ID\",\"scheduledAt\":\"$TODAY_11\",\"reason\":\"Follow-up\"}" \
  -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
a = d.get('appointment', d)
print(f'  Token: {a[\"tokenNumber\"]}')
"

section "5. Test availability check — try to double-book the same doctor at 10:15"
TODAY_1015=$(date +%Y-%m-%dT10:15:00.000Z)
curl -sS -X POST http://localhost:3000/api/appointments \
  -H 'Content-Type: application/json' \
  -d "{\"patientId\":\"$PATIENT_ID\",\"doctorId\":\"$DOCTOR_ID\",\"scheduledAt\":\"$TODAY_1015\"}" \
  -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
if 'error' in d:
    print(f'  ✅ Correctly rejected: {d[\"error\"][:80]}...')
else:
    print(f'  ❌ Should have been rejected! Token: {d.get(\"appointment\",{}).get(\"tokenNumber\")}')
"

section "6. Test doctor working hours — book at 8am (before 9am start)"
TODAY_8=$(date +%Y-%m-%dT08:00:00.000Z)
curl -sS -X POST http://localhost:3000/api/appointments \
  -H 'Content-Type: application/json' \
  -d "{\"patientId\":\"$PATIENT_ID\",\"doctorId\":\"$DOCTOR_ID\",\"scheduledAt\":\"$TODAY_8\"}" \
  -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
if 'error' in d:
    print(f'  ✅ Correctly rejected: {d[\"error\"][:80]}...')
else:
    print(f'  ❌ Should have been rejected!')
"

section "7. Status transitions: Scheduled → Confirmed → Checked-In → Completed"
APPT_ID=$(curl -sS 'http://localhost:3000/api/appointments?limit=1' -b /tmp/cookies.txt | python3 -c "import sys,json; print(json.load(sys.stdin)['appointments'][0]['id'])")
echo "Appt ID: $APPT_ID"

for STATUS in "Confirmed" "Checked-In" "Completed"; do
  curl -sS -X PUT "http://localhost:3000/api/appointments/$APPT_ID" \
    -H 'Content-Type: application/json' \
    -d "{\"status\":\"$STATUS\"}" \
    -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  → {d[\"appointment\"][\"status\"]}')
"
done

section "8. Test Cancelled and No Show"
# Book a new appt, then cancel it
TODAY_14=$(date +%Y-%m-%dT14:00:00.000Z)
CANCEL_ID=$(curl -sS -X POST http://localhost:3000/api/appointments \
  -H 'Content-Type: application/json' \
  -d "{\"patientId\":\"$PATIENT_ID\",\"doctorId\":\"$DOCTOR_ID\",\"scheduledAt\":\"$TODAY_14\"}" \
  -b /tmp/cookies.txt | python3 -c "import sys,json; print(json.load(sys.stdin)['appointment']['id'])")
curl -sS -X PUT "http://localhost:3000/api/appointments/$CANCEL_ID" \
  -H 'Content-Type: application/json' \
  -d '{"status":"Cancelled"}' \
  -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  Cancelled appt: {d[\"appointment\"][\"status\"]}')
"

# No Show
TODAY_15=$(date +%Y-%m-%dT15:00:00.000Z)
NOSHOW_ID=$(curl -sS -X POST http://localhost:3000/api/appointments \
  -H 'Content-Type: application/json' \
  -d "{\"patientId\":\"$PATIENT_ID\",\"doctorId\":\"$DOCTOR_ID\",\"scheduledAt\":\"$TODAY_15\"}" \
  -b /tmp/cookies.txt | python3 -c "import sys,json; print(json.load(sys.stdin)['appointment']['id'])")
curl -sS -X PUT "http://localhost:3000/api/appointments/$NOSHOW_ID" \
  -H 'Content-Type: application/json' \
  -d '{"status":"No Show"}' \
  -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  No Show appt: {d[\"appointment\"][\"status\"]}')
"

section "9. GET single appointment with patient history"
curl -sS "http://localhost:3000/api/appointments/$APPT_ID" -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
a = d['appointment']
print(f'  Appointment: {a[\"tokenNumber\"]} | {a[\"status\"]}')
print(f'  Patient: {a[\"patient\"][\"name\"]}')
print(f'  Patient history: {len(d[\"history\"])} previous appt(s)')
for h in d['history'][:5]:
    print(f'    - {h[\"scheduledAt\"][:16]} | {h[\"status\"]} | Dr. {h[\"doctor\"][\"name\"] if h.get(\"doctor\") else \"—\"}')
"

section "10. Reminders endpoint"
curl -sS http://localhost:3000/api/appointments/reminders -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  Today total: {d[\"stats\"][\"total\"]}')
print(f'  By status: {d[\"stats\"][\"byStatus\"]}')
print(f'  Upcoming (next 2h): {len(d[\"upcoming\"])}')
print(f'  Waiting (Checked-In): {len(d[\"waiting\"])}')
"

section "11. Calendar range query — today"
FROM=$(date -u +%Y-%m-%dT00:00:00.000Z)
TO=$(date -u +%Y-%m-%dT23:59:59.000Z)
curl -sS "http://localhost:3000/api/appointments?from=$FROM&to=$TO" -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  Appointments today: {len(d[\"appointments\"])}')
for a in d['appointments']:
    print(f'    - {a[\"scheduledAt\"][11:16]} | {a[\"tokenNumber\"]} | {a[\"status\"]} | {a[\"patient\"][\"name\"]}')
"

# === Browser verification ===
section "12. Open browser and login"
agent-browser open http://localhost:3000/ 2>&1 | tail -2
sleep 3
agent-browser find label "Password" fill "testpass123" 2>&1 | tail -1
agent-browser find role button click --name "Unlock" 2>&1 | tail -1
sleep 4

section "13. Check reminder banner on dashboard"
agent-browser screenshot /home/z/my-project/scripts/appt-reminder-banner.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -30

section "14. Go to Appointments tab (should show Today view)"
agent-browser find role tab click --name "Appts" 2>&1 | tail -1
sleep 3
agent-browser screenshot /home/z/my-project/scripts/appt-today-view.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -50

section "15. Switch to Calendar view"
# Find and click the Calendar button in the sub-switcher
CALENDAR_BTN=$(agent-browser snapshot -i 2>&1 | grep -i 'Calendar' | grep -oE 'ref=e[0-9]+' | head -1 | sed 's/ref=//')
echo "Calendar btn: $CALENDAR_BTN"
agent-browser click @$CALENDAR_BTN 2>&1 | tail -1
sleep 3
agent-browser screenshot /home/z/my-project/scripts/appt-calendar-view.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -40

section "16. Switch to Month view"
MONTH_BTN=$(agent-browser snapshot -i 2>&1 | grep -i 'Month' | grep -oE 'ref=e[0-9]+' | head -1 | sed 's/ref=//')
if [ -n "$MONTH_BTN" ]; then
  agent-browser click @$MONTH_BTN 2>&1 | tail -1
  sleep 2
fi
agent-browser screenshot /home/z/my-project/scripts/appt-calendar-month.png 2>&1 | tail -1

section "17. Click Book appointment button"
BOOK_BTN=$(agent-browser snapshot -i 2>&1 | grep -i 'Book appointment' | grep -oE 'ref=e[0-9]+' | head -1 | sed 's/ref=//')
echo "Book btn: $BOOK_BTN"
agent-browser click @$BOOK_BTN 2>&1 | tail -1
sleep 3
agent-browser screenshot /home/z/my-project/scripts/appt-book-view.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -40

section "18. Click on an appointment to open detail dialog"
# Go back to today view
agent-browser find role button click --name "Cancel" 2>&1 | tail -1 || true
sleep 1
# Click Today button in sub-switcher
TODAY_BTN=$(agent-browser snapshot -i 2>&1 | grep -i 'Today' | grep -oE 'ref=e[0-9]+' | head -1 | sed 's/ref=//')
if [ -n "$TODAY_BTN" ]; then
  agent-browser click @$TODAY_BTN 2>&1 | tail -1
  sleep 2
fi
# Click the first appointment's view button
VIEW_BTN=$(agent-browser snapshot -i 2>&1 | grep -i 'View details' | grep -oE 'ref=e[0-9]+' | head -1 | sed 's/ref=//')
if [ -n "$VIEW_BTN" ]; then
  agent-browser click @$VIEW_BTN 2>&1 | tail -1
  sleep 3
fi
agent-browser screenshot /home/z/my-project/scripts/appt-detail-dialog.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -50

section "19. Dev log tail"
tail -10 /home/z/my-project/dev.log

section "20. Console errors"
agent-browser errors 2>&1 | head -20 || true

# Cleanup
echo ""
echo "=== Cleanup ==="
agent-browser close 2>&1 | tail -1 || true
kill $DEV_PID 2>/dev/null || true
wait $DEV_PID 2>/dev/null || true
echo "Done"
