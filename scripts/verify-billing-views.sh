#!/bin/bash
# Verify the 5 billing views via API + browser.
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

section "1. Setup owner"
rm -f /tmp/cookies.txt
curl -sS -X POST http://localhost:3000/api/setup \
  -H 'Content-Type: application/json' \
  -d '{"name":"Dr. Alex","password":"testpass123","autoLockMinutes":60}' \
  -c /tmp/cookies.txt -b /tmp/cookies.txt > /dev/null
echo "Owner set up"

section "2. Add patient + doctor + medicine"
PATIENT_ID=$(curl -sS -X POST http://localhost:3000/api/patients \
  -H 'Content-Type: application/json' \
  -d '{"name":"John Doe","dateOfBirth":"1990-05-15","gender":"male","phone":"+1-555-1000"}' \
  -b /tmp/cookies.txt | python3 -c "import sys,json; print(json.load(sys.stdin)['patient']['id'])")

DEPT_ID=$(curl -sS http://localhost:3000/api/departments -b /tmp/cookies.txt | python3 -c "import sys,json; print(json.load(sys.stdin)['departments'][0]['id'])")
DOCTOR_ID=$(curl -sS -X POST http://localhost:3000/api/doctors \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Dr. Sarah Chen\",\"specialization\":\"Cardiologist\",\"consultationFee\":150,\"departmentId\":\"$DEPT_ID\"}" \
  -b /tmp/cookies.txt | python3 -c "import sys,json; print(json.load(sys.stdin)['doctor']['id'])")

MED_ID=$(curl -sS -X POST http://localhost:3000/api/medicines \
  -H 'Content-Type: application/json' \
  -d '{"name":"Paracetamol","sku":"MED-001","quantity":50,"price":2.50}' \
  -b /tmp/cookies.txt | python3 -c "import sys,json; print(json.load(sys.stdin)['medicine']['id'])")
echo "Patient: $PATIENT_ID, Doctor: $DOCTOR_ID, Medicine: $MED_ID"

section "3. Generate bill — verify billNumber auto-gen + charge breakdown"
BILL1=$(curl -sS -X POST http://localhost:3000/api/bills \
  -H 'Content-Type: application/json' \
  -d "{
    \"patientId\":\"$PATIENT_ID\",
    \"doctorId\":\"$DOCTOR_ID\",
    \"items\":[
      {\"category\":\"medicine\",\"name\":\"Paracetamol\",\"qty\":2,\"price\":2.50},
      {\"category\":\"lab\",\"name\":\"Blood Test\",\"qty\":1,\"price\":80},
      {\"category\":\"other\",\"name\":\"Service Charge\",\"qty\":1,\"price\":10}
    ],
    \"discountType\":\"percent\",
    \"discountValue\":10,
    \"taxRate\":8,
    \"paymentMethod\":\"Cash\",
    \"initialPayment\":{\"amount\":100,\"method\":\"Cash\"}
  }" -b /tmp/cookies.txt)
BILL1_ID=$(echo "$BILL1" | python3 -c "import sys,json; print(json.load(sys.stdin)['bill']['id'])")
echo "$BILL1" | python3 -c "
import sys, json
d = json.load(sys.stdin)['bill']
print(f'  Bill #: {d[\"billNumber\"]}')
print(f'  Consultation: \${d[\"consultationFee\"]}')
print(f'  Medicine charges: \${d[\"medicineCharges\"]}')
print(f'  Lab charges: \${d[\"labCharges\"]}')
print(f'  Other charges: \${d[\"otherCharges\"]}')
print(f'  Subtotal: \${d[\"subtotal\"]}')
print(f'  Discount (10%): \${d[\"discountAmount\"]}')
print(f'  Tax (8%): \${d[\"taxAmount\"]}')
print(f'  Total: \${d[\"total\"]}')
print(f'  Paid: \${d[\"amountPaid\"]}')
print(f'  Status: {d[\"status\"]}')
"

section "4. Generate second bill — verify billNumber increments"
BILL2=$(curl -sS -X POST http://localhost:3000/api/bills \
  -H 'Content-Type: application/json' \
  -d "{\"patientId\":\"$PATIENT_ID\",\"doctorId\":\"$DOCTOR_ID\",\"items\":[{\"category\":\"lab\",\"name\":\"X-Ray\",\"qty\":1,\"price\":120}],\"taxRate\":8}" \
  -b /tmp/cookies.txt)
echo "$BILL2" | python3 -c "import sys,json; d=json.load(sys.stdin)['bill']; print(f'  Bill #: {d[\"billNumber\"]} · Total: \${d[\"total\"]} · Status: {d[\"status\"]}')"

section "5. Record partial payment on BILL1"
curl -sS -X PUT "http://localhost:3000/api/bills/$BILL1_ID" \
  -H 'Content-Type: application/json' \
  -d '{"action":"record-payment","amount":50,"method":"Card","note":"Partial payment"}' \
  -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)['bill']
print(f'  Paid: \${d[\"amountPaid\"]} · Status: {d[\"status\"]} · Balance: \${d[\"total\"] - d[\"amountPaid\"]}')
print(f'  Payments: {len(d[\"payments\"])}')
"

section "6. Get bill details — verify full breakdown + payment history"
curl -sS "http://localhost:3000/api/bills/$BILL1_ID" -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
b = d['bill']
print(f'  Bill #: {b[\"billNumber\"]}')
print(f'  Patient: {b[\"patient\"][\"name\"]} ({b[\"patient\"][\"patientCode\"]})')
print(f'  Doctor: {b[\"doctor\"][\"name\"] if b.get(\"doctor\") else \"—\"}')
print(f'  Items: {len(b[\"items\"])}')
for it in b['items']:
    print(f'    - [{it[\"category\"]}] {it[\"name\"]} x{it[\"qty\"]} @ \${it[\"price\"]}')
print(f'  Payments: {len(b[\"payments\"])}')
for p in b['payments']:
    print(f'    - {p[\"createdAt\"][:16]} | {p[\"type\"]} | \${p[\"amount\"]} | {p[\"method\"]}')
print(f'  Balance due: \${d[\"balanceDue\"]}')
"

section "7. Revenue report — daily"
curl -sS 'http://localhost:3000/api/bills/revenue?groupby=day' -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  Group by: {d[\"groupBy\"]}')
print(f'  Buckets: {len(d[\"buckets\"])}')
print(f'  Summary:')
for k, v in d['summary'].items():
    print(f'    {k}: {v}')
if d['buckets']:
    b = d['buckets'][-1]
    print(f'  Latest bucket: {b[\"label\"]}')
    print(f'    Billed: \${b[\"totalBilled\"]} · Collected: \${b[\"totalCollected\"]} · Bills: {b[\"count\"]}')
"

section "8. Revenue report — monthly"
curl -sS 'http://localhost:3000/api/bills/revenue?groupby=month' -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  Buckets: {len(d[\"buckets\"])}')
if d['buckets']:
    b = d['buckets'][-1]
    print(f'  Latest month: {b[\"label\"]} · Billed: \${b[\"totalBilled\"]} · Collected: \${b[\"totalCollected\"]}')
"

section "9. Payment history"
curl -sS 'http://localhost:3000/api/payments?limit=20' -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  Total payments: {d[\"summary\"][\"count\"]}')
print(f'  Total collected: \${d[\"summary\"][\"totalCollected\"]}')
print(f'  By method: {d[\"summary\"][\"byMethod\"]}')
for p in d['payments'][:5]:
    print(f'    - {p[\"createdAt\"][:16]} | {p[\"type\"]} | \${p[\"amount\"]} | {p[\"method\"]} | {p[\"bill\"][\"billNumber\"]} | {p[\"bill\"][\"patient\"][\"name\"]}')
"

section "10. Refund a payment"
curl -sS -X PUT "http://localhost:3000/api/bills/$BILL1_ID" \
  -H 'Content-Type: application/json' \
  -d '{"action":"record-refund","amount":50,"method":"Cash","note":"Patient refund"}' \
  -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)['bill']
print(f'  After refund: Status={d[\"status\"]} · Paid=\${d[\"amountPaid\"]}')
"

# === Browser verification ===
section "11. Open browser and login"
agent-browser open http://localhost:3000/ 2>&1 | tail -2
sleep 3
agent-browser find label "Password" fill "testpass123" 2>&1 | tail -1
agent-browser find role button click --name "Unlock" 2>&1 | tail -1
sleep 4

section "12. Go to Bills tab"
agent-browser find role tab click --name "Bills" 2>&1 | tail -1
sleep 3
agent-browser screenshot /home/z/my-project/scripts/bills-list-view.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -40

section "13. Click Generate bill"
GEN_BTN=$(agent-browser snapshot -i 2>&1 | grep -i 'Generate' | grep -oE 'ref=e[0-9]+' | head -1 | sed 's/ref=//')
echo "Generate btn: $GEN_BTN"
agent-browser click @$GEN_BTN 2>&1 | tail -1
sleep 3
agent-browser screenshot /home/z/my-project/scripts/bills-generate-view.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -40

section "14. VLM check on Generate Bill form"
z-ai vision -p "This is a Generate Bill form. Describe in 4-5 sentences: 1) Is there a patient search input? 2) Is there a doctor dropdown with consultation fee? 3) Are there line items for medicine/lab/other charges? 4) Is there a discount section (fixed/percent) and tax rate? 5) Is there a live total summary showing subtotal, discount, tax, and total?" -i "/home/z/my-project/scripts/bills-generate-view.png" 2>&1 | grep -A2 '"content":' | head -3

section "15. Cancel back to list, click a bill to view details"
agent-browser find role button click --name "Cancel" 2>&1 | tail -1
sleep 2
# Click the first bill row
BILL_ROW=$(agent-browser snapshot -i 2>&1 | grep 'row ' | head -1 | grep -oE 'ref=e[0-9]+' | head -1 | sed 's/ref=//')
echo "Bill row: $BILL_ROW"
agent-browser click @$BILL_ROW 2>&1 | tail -1
sleep 2
# Or click View / Pay button
VIEW_BTN=$(agent-browser snapshot -i 2>&1 | grep -i 'View' | grep -oE 'ref=e[0-9]+' | head -1 | sed 's/ref=//')
if [ -n "$VIEW_BTN" ]; then
  agent-browser click @$VIEW_BTN 2>&1 | tail -1
  sleep 3
fi
agent-browser screenshot /home/z/my-project/scripts/bills-details-view.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -40

section "16. VLM check on Bill Details"
z-ai vision -p "This is a bill details/invoice view. Describe in 4-5 sentences: 1) Is there a bill number and date? 2) Are there patient and doctor details? 3) Is there an itemized charge table with qty, price, amount? 4) Is there a totals section showing subtotal, discount, tax, total, paid, balance due? 5) Is there a Print button?" -i "/home/z/my-project/scripts/bills-details-view.png" 2>&1 | grep -A2 '"content":' | head -3

section "17. Go back, test Payments sub-tab"
agent-browser find role button click --name "Back" 2>&1 | tail -1 || true
sleep 2
# Find and click Payments sub-tab
PAYMENTS_BTN=$(agent-browser snapshot -i 2>&1 | grep -i 'Payments' | grep -oE 'ref=e[0-9]+' | head -1 | sed 's/ref=//')
if [ -n "$PAYMENTS_BTN" ]; then
  agent-browser click @$PAYMENTS_BTN 2>&1 | tail -1
  sleep 3
fi
agent-browser screenshot /home/z/my-project/scripts/bills-payments-view.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -40

section "18. Test Revenue sub-tab"
REVENUE_BTN=$(agent-browser snapshot -i 2>&1 | grep -i 'Revenue' | grep -oE 'ref=e[0-9]+' | head -1 | sed 's/ref=//')
if [ -n "$REVENUE_BTN" ]; then
  agent-browser click @$REVENUE_BTN 2>&1 | tail -1
  sleep 3
fi
agent-browser screenshot /home/z/my-project/scripts/bills-revenue-view.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -40

section "19. VLM check on Revenue report"
z-ai vision -p "This is a revenue report view. Describe in 4-5 sentences: 1) Are there summary stat cards (total billed, collected, outstanding, collection rate)? 2) Is there a bar chart comparing billed vs collected? 3) Is there a daily/monthly toggle? 4) Is there a breakdown table?" -i "/home/z/my-project/scripts/bills-revenue-view.png" 2>&1 | grep -A2 '"content":' | head -3

section "20. Console errors"
agent-browser errors 2>&1 | head -20 || true

# Cleanup
echo ""
echo "=== Cleanup ==="
agent-browser close 2>&1 | tail -1 || true
kill $DEV_PID 2>/dev/null || true
wait $DEV_PID 2>/dev/null || true
echo "Done"
