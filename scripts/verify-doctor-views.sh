#!/bin/bash
# Verify doctor views via API + browser.
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

section "1. Setup owner (seeds default departments)"
rm -f /tmp/cookies.txt
curl -sS -X POST http://localhost:3000/api/setup \
  -H 'Content-Type: application/json' \
  -d '{"name":"Dr. Alex","password":"testpass123","autoLockMinutes":60}' \
  -c /tmp/cookies.txt -b /tmp/cookies.txt | head -c 100
echo ""

section "2. Verify default departments seeded"
curl -sS http://localhost:3000/api/departments -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
for dept in d['departments']:
    print(f'  {dept[\"name\"]} ({dept[\"_count\"][\"doctors\"]} doctors)')
"

section "3. Add 3 doctors via API"
DEPT_CARDIO=$(curl -sS http://localhost:3000/api/departments -b /tmp/cookies.txt | python3 -c "import sys,json; d=json.load(sys.stdin); print([x['id'] for x in d['departments'] if x['name']=='Cardiology'][0])")
DEPT_PEDS=$(curl -sS http://localhost:3000/api/departments -b /tmp/cookies.txt | python3 -c "import sys,json; d=json.load(sys.stdin); print([x['id'] for x in d['departments'] if x['name']=='Pediatrics'][0])")
DEPT_GEN=$(curl -sS http://localhost:3000/api/departments -b /tmp/cookies.txt | python3 -c "import sys,json; d=json.load(sys.stdin); print([x['id'] for x in d['departments'] if x['name']=='General Medicine'][0])")
echo "Dept IDs: Cardio=$DEPT_CARDIO Peds=$DEPT_PEDS Gen=$DEPT_GEN"

# Doctor 1: Cardiologist, Mon-Fri 9-5
curl -sS -X POST http://localhost:3000/api/doctors \
  -H 'Content-Type: application/json' \
  -d "{
    \"name\":\"Dr. Sarah Chen\",
    \"specialization\":\"Cardiologist, MD\",
    \"phone\":\"+1-555-2001\",
    \"email\":\"sarah.chen@clinic.com\",
    \"consultationFee\":150,
    \"status\":\"Active\",
    \"departmentId\":\"$DEPT_CARDIO\",
    \"schedule\":[
      {\"dayOfWeek\":0,\"isWorking\":false,\"startTime\":\"09:00\",\"endTime\":\"17:00\"},
      {\"dayOfWeek\":1,\"isWorking\":true,\"startTime\":\"09:00\",\"endTime\":\"17:00\"},
      {\"dayOfWeek\":2,\"isWorking\":true,\"startTime\":\"09:00\",\"endTime\":\"17:00\"},
      {\"dayOfWeek\":3,\"isWorking\":true,\"startTime\":\"09:00\",\"endTime\":\"17:00\"},
      {\"dayOfWeek\":4,\"isWorking\":true,\"startTime\":\"09:00\",\"endTime\":\"17:00\"},
      {\"dayOfWeek\":5,\"isWorking\":true,\"startTime\":\"09:00\",\"endTime\":\"13:00\"},
      {\"dayOfWeek\":6,\"isWorking\":false,\"startTime\":\"09:00\",\"endTime\":\"17:00\"}
    ]
  }" -b /tmp/cookies.txt | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Created: {d[\"doctor\"][\"doctorCode\"]} - {d[\"doctor\"][\"name\"]}')"

# Doctor 2: Pediatrician, Tue-Sat
curl -sS -X POST http://localhost:3000/api/doctors \
  -H 'Content-Type: application/json' \
  -d "{
    \"name\":\"Dr. Mike Ross\",
    \"specialization\":\"Pediatrician\",
    \"phone\":\"+1-555-2002\",
    \"consultationFee\":80,
    \"departmentId\":\"$DEPT_PEDS\",
    \"schedule\":[
      {\"dayOfWeek\":0,\"isWorking\":false,\"startTime\":\"10:00\",\"endTime\":\"18:00\"},
      {\"dayOfWeek\":1,\"isWorking\":false,\"startTime\":\"10:00\",\"endTime\":\"18:00\"},
      {\"dayOfWeek\":2,\"isWorking\":true,\"startTime\":\"10:00\",\"endTime\":\"18:00\"},
      {\"dayOfWeek\":3,\"isWorking\":true,\"startTime\":\"10:00\",\"endTime\":\"18:00\"},
      {\"dayOfWeek\":4,\"isWorking\":true,\"startTime\":\"10:00\",\"endTime\":\"18:00\"},
      {\"dayOfWeek\":5,\"isWorking\":true,\"startTime\":\"10:00\",\"endTime\":\"18:00\"},
      {\"dayOfWeek\":6,\"isWorking\":true,\"startTime\":\"10:00\",\"endTime\":\"14:00\"}
    ]
  }" -b /tmp/cookies.txt | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Created: {d[\"doctor\"][\"doctorCode\"]} - {d[\"doctor\"][\"name\"]}')"

# Doctor 3: General physician, inactive
curl -sS -X POST http://localhost:3000/api/doctors \
  -H 'Content-Type: application/json' \
  -d "{
    \"name\":\"Dr. Emily Park\",
    \"specialization\":\"General Physician\",
    \"consultationFee\":50,
    \"status\":\"Inactive\",
    \"departmentId\":\"$DEPT_GEN\"
  }" -b /tmp/cookies.txt | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Created: {d[\"doctor\"][\"doctorCode\"]} - {d[\"doctor\"][\"name\"]} ({d[\"doctor\"][\"status\"]})')"

section "4. Verify doctor_code auto-generation (DOC-2026-0001/2/3)"
curl -sS 'http://localhost:3000/api/doctors?limit=10' -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
for doc in d['doctors']:
    dept = doc['department']['name'] if doc['department'] else '—'
    print(f'  {doc[\"doctorCode\"]} | {doc[\"name\"]} | {dept} | {doc[\"status\"]} | \${doc[\"consultationFee\"]}')
"

section "5. Filter by department (Cardiology only)"
curl -sS "http://localhost:3000/api/doctors?departmentId=$DEPT_CARDIO" -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Found {len(d[\"doctors\"])} doctor(s) in Cardiology:')
for doc in d['doctors']:
    print(f'  {doc[\"doctorCode\"]} - {doc[\"name\"]}')
"

section "6. Filter by status (Active only)"
curl -sS 'http://localhost:3000/api/doctors?status=Active' -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Found {len(d[\"doctors\"])} active doctor(s):')
for doc in d['doctors']:
    print(f'  {doc[\"doctorCode\"]} - {doc[\"name\"]}')
"

section "7. Add a patient + book appointment with doctor"
# Add patient
PATIENT_ID=$(curl -sS -X POST http://localhost:3000/api/patients \
  -H 'Content-Type: application/json' \
  -d '{"name":"John Doe","dateOfBirth":"1990-05-15","gender":"male","phone":"+1-555-1000"}' \
  -b /tmp/cookies.txt | python3 -c "import sys,json; print(json.load(sys.stdin)['patient']['id'])")
echo "Patient ID: $PATIENT_ID"

DOCTOR_ID=$(curl -sS 'http://localhost:3000/api/doctors?limit=1' -b /tmp/cookies.txt | python3 -c "import sys,json; print(json.load(sys.stdin)['doctors'][0]['id'])")
echo "Doctor ID: $DOCTOR_ID"

# Book appointment for today
TODAY=$(date -u +%Y-%m-%dT%H:00:00.000Z)
curl -sS -X POST http://localhost:3000/api/appointments \
  -H 'Content-Type: application/json' \
  -d "{\"patientId\":\"$PATIENT_ID\",\"doctorId\":\"$DOCTOR_ID\",\"scheduledAt\":\"$TODAY\",\"reason\":\"Heart checkup\",\"fee\":150}" \
  -b /tmp/cookies.txt | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Appt booked: {d[\"appointment\"][\"patient\"][\"name\"]} with {d[\"appointment\"][\"doctor\"][\"name\"]}')"

# Book a past appointment (for recent history)
YESTERDAY=$(date -u -d 'yesterday' +%Y-%m-%dT14:00:00.000Z 2>/dev/null || date -u -v-1d +%Y-%m-%dT14:00:00.000Z)
curl -sS -X POST http://localhost:3000/api/appointments \
  -H 'Content-Type: application/json' \
  -d "{\"patientId\":\"$PATIENT_ID\",\"doctorId\":\"$DOCTOR_ID\",\"scheduledAt\":\"$YESTERDAY\",\"reason\":\"Follow-up\",\"fee\":150,\"status\":\"completed\"}" \
  -b /tmp/cookies.txt > /dev/null
echo "  Added a past completed appointment too"

section "8. GET single doctor — schedule + today's + recent appointments"
curl -sS "http://localhost:3000/api/doctors/$DOCTOR_ID" -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
doc = d['doctor']
print(f'Doctor: {doc[\"name\"]} ({doc[\"doctorCode\"]})')
print(f'  Department: {doc[\"department\"][\"name\"] if doc[\"department\"] else \"—\"}')
print(f'  Specialization: {doc[\"specialization\"] or \"—\"}')
print(f'  Fee: \${doc[\"consultationFee\"]}')
print(f'  Status: {doc[\"status\"]}')
print(f'  Schedule:')
for s in doc['schedule']:
    days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    if s['isWorking']:
        print(f'    {days[s[\"dayOfWeek\"]]}: {s[\"startTime\"]} - {s[\"endTime\"]}')
    else:
        print(f'    {days[s[\"dayOfWeek\"]]}: Off')
print(f'  Today\\'s appointments: {len(d[\"todaysAppointments\"])}')
for a in d['todaysAppointments']:
    print(f'    - {a[\"scheduledAt\"][:16]} | {a[\"patient\"][\"name\"]} | {a[\"status\"]}')
print(f'  Recent appointments: {len(d[\"recentAppointments\"])}')
for a in d['recentAppointments']:
    print(f'    - {a[\"scheduledAt\"][:16]} | {a[\"patient\"][\"name\"]} | {a[\"status\"]}')
"

section "9. Toggle status (Active → Inactive → Active)"
curl -sS -X PUT "http://localhost:3000/api/doctors/$DOCTOR_ID" \
  -H 'Content-Type: application/json' \
  -d '{"status":"Inactive"}' \
  -b /tmp/cookies.txt | python3 -c "import sys,json; print(f'  After toggle 1: {json.load(sys.stdin)[\"doctor\"][\"status\"]}')"
curl -sS -X PUT "http://localhost:3000/api/doctors/$DOCTOR_ID" \
  -H 'Content-Type: application/json' \
  -d '{"status":"Active"}' \
  -b /tmp/cookies.txt | python3 -c "import sys,json; print(f'  After toggle 2: {json.load(sys.stdin)[\"doctor\"][\"status\"]}')"

section "10. Soft delete (DELETE → Inactive)"
curl -sS -X DELETE "http://localhost:3000/api/doctors/$DOCTOR_ID" -b /tmp/cookies.txt | python3 -c "import sys,json; print(f'  After DELETE: {json.load(sys.stdin)[\"doctor\"][\"status\"]}')"
# Restore
curl -sS -X PUT "http://localhost:3000/api/doctors/$DOCTOR_ID" \
  -H 'Content-Type: application/json' \
  -d '{"status":"Active"}' -b /tmp/cookies.txt > /dev/null
echo "  Restored"

# === Browser verification ===
section "11. Open browser and login"
agent-browser open http://localhost:3000/ 2>&1 | tail -2
sleep 3
agent-browser find label "Password" fill "testpass123" 2>&1 | tail -1
agent-browser find role button click --name "Unlock" 2>&1 | tail -1
sleep 4

section "12. Go to Doctors tab"
agent-browser find role tab click --name "Doctors" 2>&1 | tail -1
sleep 3
agent-browser screenshot /home/z/my-project/scripts/doctor-list-view.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -60

section "13. Click first doctor row to view profile"
# Get the first row ref
FIRST_ROW=$(agent-browser snapshot -i 2>&1 | grep -oE 'ref=e[0-9]+' | head -1 | sed 's/ref=//')
echo "Clicking row: $FIRST_ROW"
agent-browser click @$FIRST_ROW 2>&1 | tail -1
sleep 3
agent-browser screenshot /home/z/my-project/scripts/doctor-profile-view.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -60

section "14. Click Edit"
agent-browser find role button click --name "Edit" 2>&1 | tail -1
sleep 3
agent-browser screenshot /home/z/my-project/scripts/doctor-edit-view.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -60

section "15. Cancel back to profile, then back to list, then Add doctor"
agent-browser find role button click --name "Cancel" 2>&1 | tail -1
sleep 1
agent-browser find role button click --name "Add doctor" 2>&1 | tail -1 || true
# The "Add doctor" button is on the list view, need to go back first
agent-browser find role button click --name "Back" 2>&1 | tail -1 || true
# Use the back arrow (ghost icon button)
sleep 2
# Find and click the Add doctor button
agent-browser snapshot -i 2>&1 | grep -i "add doctor" | head -5
agent-browser find role button click --name "Add doctor" 2>&1 | tail -1
sleep 2
agent-browser screenshot /home/z/my-project/scripts/doctor-add-view.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -60

section "16. Test department filter on list"
agent-browser find role button click --name "Cancel" 2>&1 | tail -1
sleep 1
# Click the department dropdown
agent-browser snapshot -i 2>&1 | grep -i "department\|combobox" | head -5

section "17. Dev log tail"
tail -15 /home/z/my-project/dev.log

section "18. Console errors"
agent-browser errors 2>&1 | head -20 || true

# Cleanup
echo ""
echo "=== Cleanup ==="
agent-browser close 2>&1 | tail -1 || true
kill $DEV_PID 2>/dev/null || true
wait $DEV_PID 2>/dev/null || true
echo "Done"
