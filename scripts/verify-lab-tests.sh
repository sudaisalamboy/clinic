#!/bin/bash
# Verify the 4 lab test views via API + browser.
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

section "1. Setup owner + patient + doctor"
rm -f /tmp/cookies.txt
curl -sS -X POST http://localhost:3000/api/setup \
  -H 'Content-Type: application/json' \
  -d '{"name":"Dr. Alex","password":"testpass123","autoLockMinutes":60}' \
  -c /tmp/cookies.txt -b /tmp/cookies.txt > /dev/null

PATIENT_ID=$(curl -sS -X POST http://localhost:3000/api/patients \
  -H 'Content-Type: application/json' \
  -d '{"name":"John Doe","dateOfBirth":"1990-05-15","gender":"male","phone":"+1-555-1000"}' \
  -b /tmp/cookies.txt | python3 -c "import sys,json; print(json.load(sys.stdin)['patient']['id'])")

DEPT_ID=$(curl -sS http://localhost:3000/api/departments -b /tmp/cookies.txt | python3 -c "import sys,json; print(json.load(sys.stdin)['departments'][0]['id'])")
DOCTOR_ID=$(curl -sS -X POST http://localhost:3000/api/doctors \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Dr. Sarah Chen\",\"specialization\":\"Cardiologist\",\"consultationFee\":150,\"departmentId\":\"$DEPT_ID\"}" \
  -b /tmp/cookies.txt | python3 -c "import sys,json; print(json.load(sys.stdin)['doctor']['id'])")
echo "Patient: $PATIENT_ID, Doctor: $DOCTOR_ID"

section "2. Add lab tests to catalog"
curl -sS -X POST http://localhost:3000/api/lab-tests \
  -H 'Content-Type: application/json' \
  -d '{"name":"Complete Blood Count","category":"Hematology","price":25.00,"referenceRange":"4.5-11.0 x10^9/L","sampleType":"Blood","turnaroundHours":24}' \
  -b /tmp/cookies.txt > /dev/null

curl -sS -X POST http://localhost:3000/api/lab-tests \
  -H 'Content-Type: application/json' \
  -d '{"name":"Lipid Panel","category":"Biochemistry","price":45.00,"referenceRange":"< 200 mg/dL","sampleType":"Blood","turnaroundHours":48}' \
  -b /tmp/cookies.txt > /dev/null

curl -sS -X POST http://localhost:3000/api/lab-tests \
  -H 'Content-Type: application/json' \
  -d '{"name":"Urine Analysis","category":"Microbiology","price":15.00,"sampleType":"Urine","turnaroundHours":12}' \
  -b /tmp/cookies.txt > /dev/null
echo "Added 3 lab tests"

section "3. Verify lab test catalog search"
curl -sS 'http://localhost:3000/api/lab-tests?q=Blood' -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Found {len(d[\"labTests\"])} test(s) matching Blood:')
for t in d['labTests']:
    print(f'  {t[\"name\"]} ({t[\"category\"]}) — \${t[\"price\"]}')
"

section "4. Assign test to patient — verify auto-generated test number"
CBC_ID=$(curl -sS 'http://localhost:3000/api/lab-tests?q=Complete' -b /tmp/cookies.txt | python3 -c "import sys,json; print(json.load(sys.stdin)['labTests'][0]['id'])")
echo "CBC test ID: $CBC_ID"

PT1=$(curl -sS -X POST http://localhost:3000/api/patient-tests \
  -H 'Content-Type: application/json' \
  -d "{\"patientId\":\"$PATIENT_ID\",\"labTestId\":\"$CBC_ID\",\"doctorId\":\"$DOCTOR_ID\"}" \
  -b /tmp/cookies.txt)
PT1_ID=$(echo "$PT1" | python3 -c "import sys,json; print(json.load(sys.stdin)['patientTest']['id'])")
echo "$PT1" | python3 -c "
import sys, json
d = json.load(sys.stdin)['patientTest']
print(f'  Test #: {d[\"testNumber\"]}')
print(f'  Patient: {d[\"patient\"][\"name\"]}')
print(f'  Test: {d[\"labTest\"][\"name\"]}')
print(f'  Status: {d[\"status\"]}')
"

section "5. Assign second test — verify number increments"
LIPID_ID=$(curl -sS 'http://localhost:3000/api/lab-tests?q=Lipid' -b /tmp/cookies.txt | python3 -c "import sys,json; print(json.load(sys.stdin)['labTests'][0]['id'])}")
PT2=$(curl -sS -X POST http://localhost:3000/api/patient-tests \
  -H 'Content-Type: application/json' \
  -d "{\"patientId\":\"$PATIENT_ID\",\"labTestId\":\"$LIPID_ID\"}" \
  -b /tmp/cookies.txt)
echo "$PT2" | python3 -c "import sys,json; d=json.load(sys.stdin)['patientTest']; print(f'  Test #: {d[\"testNumber\"]} · {d[\"labTest\"][\"name\"]}')"

section "6. List patient tests"
curl -sS "http://localhost:3000/api/patient-tests?patientId=$PATIENT_ID" -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  Total: {len(d[\"patientTests\"])}')
for t in d['patientTests']:
    print(f'  {t[\"testNumber\"]} | {t[\"labTest\"][\"name\"]} | {t[\"status\"]}')
"

section "7. Status transitions: Pending → In Progress → Completed"
for STATUS in "In Progress" "Completed"; do
  curl -sS -X PUT "http://localhost:3000/api/patient-tests/$PT1_ID" \
    -H 'Content-Type: application/json' \
    -d "{\"status\":\"$STATUS\"}" \
    -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)['patientTest']
print(f'  → {d[\"status\"]}' + (f' · completed at {d[\"completedAt\"][:19]}' if d.get('completedAt') else ''))
"
done

section "8. Save result values"
curl -sS -X PUT "http://localhost:3000/api/patient-tests/$PT1_ID" \
  -H 'Content-Type: application/json' \
  -d '{
    "resultValues": [
      {"parameter":"Hemoglobin","value":"14.5","unit":"g/dL","flag":"Normal"},
      {"parameter":"WBC","value":"12.3","unit":"x10^9/L","flag":"High"},
      {"parameter":"Platelets","value":"250","unit":"x10^9/L","flag":"Normal"}
    ],
    "resultNotes": "WBC slightly elevated. Recommend follow-up in 1 week."
  }' -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)['patientTest']
print(f'  Result values: {len(d[\"resultValues\"])} entries')
for rv in d['resultValues']:
    print(f'    {rv[\"parameter\"]}: {rv[\"value\"]} {rv[\"unit\"] or \"\"} [{rv[\"flag\"]}]')
print(f'  Notes: {d[\"resultNotes\"]}')
"

section "9. Get test details with patient history"
curl -sS "http://localhost:3000/api/patient-tests/$PT1_ID" -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
pt = d['patientTest']
print(f'  Test: {pt[\"labTest\"][\"name\"]} ({pt[\"testNumber\"]})')
print(f'  Patient: {pt[\"patient\"][\"name\"]} ({pt[\"patient\"][\"patientCode\"]})')
print(f'  Reference range: {pt[\"labTest\"][\"referenceRange\"]}')
print(f'  History: {len(d[\"history\"])} other test(s)')
for h in d['history']:
    print(f'    - {h[\"testNumber\"]} | {h[\"labTest\"][\"name\"]} | {h[\"status\"]}')
"

section "10. Test history in patient profile"
curl -sS "http://localhost:3000/api/patients/$PATIENT_ID" -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)['patient']
print(f'  Patient: {d[\"name\"]}')
print(f'  Lab tests: {d[\"_count\"][\"labTests\"]}')
for t in d.get('labTests', []):
    print(f'    - {t[\"testNumber\"]} | {t[\"labTest\"][\"name\"]} | {t[\"status\"]} | {len(t[\"resultValues\"])} results')
"

# === Browser verification ===
section "11. Open browser and login"
agent-browser open http://localhost:3000/ 2>&1 | tail -2
sleep 3
agent-browser find label "Password" fill "testpass123" 2>&1 | tail -1
agent-browser find role button click --name "Unlock" 2>&1 | tail -1
sleep 4

section "12. Go to Labs tab"
agent-browser find role tab click --name "Labs" 2>&1 | tail -1 || agent-browser find role tab click --name "Lab" 2>&1 | tail -1
sleep 3
agent-browser screenshot /home/z/my-project/scripts/lab-tests-catalog.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -40

section "13. VLM check on catalog"
z-ai vision -p "This is a lab test catalog. Describe in 3-4 sentences: 1) Are there test entries with names and prices? 2) Are they grouped by category? 3) Is there a search input and Add test button? 4) Are status badges visible?" -i "/home/z/my-project/scripts/lab-tests-catalog.png" 2>&1 | grep -A2 '"content":' | head -3

section "14. Console errors"
agent-browser errors 2>&1 | head -20 || true

# Cleanup
echo ""
echo "=== Cleanup ==="
agent-browser close 2>&1 | tail -1 || true
kill $DEV_PID 2>/dev/null || true
wait $DEV_PID 2>/dev/null || true
echo "Done"
