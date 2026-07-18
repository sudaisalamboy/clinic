#!/bin/bash
# Seed comprehensive test data for clinic management system
set -e

cd /home/z/my-project

# Start dev server
node ./node_modules/.bin/next dev -p 3000 > /dev/null 2>&1 &
DEV_PID=$!
sleep 8

# Trigger auto-setup (creates admin + defaults)
curl -sS http://localhost:3000/api/auth/status > /dev/null
sleep 2

# Login
curl -sS -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@clinic.com","password":"Cl!n1c@dm1n2026"}' \
  -c /tmp/cookies.txt -b /tmp/cookies.txt > /dev/null

# Update clinic settings
curl -sS -X PUT http://localhost:3000/api/settings \
  -H 'Content-Type: application/json' \
  -d '{
    "clinicName": "Aarogya Health Clinic",
    "doctorName": "Dr. Rajesh Kumar",
    "mobile": "+91-9876543210",
    "email": "aarogya@clinic.com",
    "address": "123 MG Road, Bengaluru, Karnataka 560001",
    "gstNumber": "29ABCDE1234F1Z5",
    "currency": "₹",
    "timezone": "Asia/Kolkata"
  }' -b /tmp/cookies.txt > /dev/null

echo "=== Settings updated ==="

# ===== STAFF =====
echo "=== Seeding Staff ==="

# Doctors
curl -sS -X POST http://localhost:3000/api/staff -H 'Content-Type: application/json' -b /tmp/cookies.txt -d '{
  "name":"Dr. Rajesh Kumar","role":"Doctor","gender":"Male","mobile":"+91-9876543210","email":"rajesh@aarogya.com",
  "department":"General Medicine","salary":85000,"joiningDate":"2020-01-15","status":"Active",
  "photo":"https://ui-avatars.com/api/?name=Rajesh+Kumar&background=10b981&color=fff",
  "address":"101 Brigade Road, Bengaluru"
}' > /dev/null

curl -sS -X POST http://localhost:3000/api/staff -H 'Content-Type: application/json' -b /tmp/cookies.txt -d '{
  "name":"Dr. Priya Sharma","role":"Doctor","gender":"Female","mobile":"+91-9876543211","email":"priya@aarogya.com",
  "department":"Cardiology","salary":95000,"joiningDate":"2021-03-20","status":"Active",
  "photo":"https://ui-avatars.com/api/?name=Priya+Sharma&background=ec4899&color=fff",
  "address":"205 Indiranagar, Bengaluru"
}' > /dev/null

curl -sS -X POST http://localhost:3000/api/staff -H 'Content-Type: application/json' -b /tmp/cookies.txt -d '{
  "name":"Dr. Amit Patel","role":"Doctor","gender":"Male","mobile":"+91-9876543212","email":"amit@aarogya.com",
  "department":"Pediatrics","salary":78000,"joiningDate":"2022-07-01","status":"Active",
  "photo":"https://ui-avatars.com/api/?name=Amit+Patel&background=3b82f6&color=fff",
  "address":"78 Jayanagar, Bengaluru"
}' > /dev/null

curl -sS -X POST http://localhost:3000/api/staff -H 'Content-Type: application/json' -b /tmp/cookies.txt -d '{
  "name":"Dr. Sneha Reddy","role":"Doctor","gender":"Female","mobile":"+91-9876543213","email":"sneha@aarogya.com",
  "department":"Dermatology","salary":72000,"joiningDate":"2023-01-10","status":"Inactive",
  "photo":"https://ui-avatars.com/api/?name=Sneha+Reddy&background=8b5cf6&color=fff",
  "address":"45 Koramangala, Bengaluru"
}' > /dev/null

# Nurses
curl -sS -X POST http://localhost:3000/api/staff -H 'Content-Type: application/json' -b /tmp/cookies.txt -d '{
  "name":"Nurse Lakshmi Nair","role":"Nurse","gender":"Female","mobile":"+91-9876543214","email":"lakshmi@aarogya.com",
  "department":"General Ward","salary":35000,"joiningDate":"2021-06-15","status":"Active",
  "photo":"https://ui-avatars.com/api/?name=Lakshmi+Nair&background=14b8a6&color=fff"
}' > /dev/null

curl -sS -X POST http://localhost:3000/api/staff -H 'Content-Type: application/json' -b /tmp/cookies.txt -d '{
  "name":"Nurse Fatima Khan","role":"Nurse","gender":"Female","mobile":"+91-9876543215","email":"fatima@aarogya.com",
  "department":"ICU","salary":38000,"joiningDate":"2022-09-05","status":"Active",
  "photo":"https://ui-avatars.com/api/?name=Fatima+Khan&background=f59e0b&color=fff"
}' > /dev/null

# Receptionists
curl -sS -X POST http://localhost:3000/api/staff -H 'Content-Type: application/json' -b /tmp/cookies.txt -d '{
  "name":"Reena Gupta","role":"Receptionist","gender":"Female","mobile":"+91-9876543216","email":"reena@aarogya.com",
  "department":"Front Desk","salary":25000,"joiningDate":"2023-04-01","status":"Active",
  "photo":"https://ui-avatars.com/api/?name=Reena+Gupta&background=ec4899&color=fff"
}' > /dev/null

curl -sS -X POST http://localhost:3000/api/staff -H 'Content-Type: application/json' -b /tmp/cookies.txt -d '{
  "name":"Vikram Singh","role":"Receptionist","gender":"Male","mobile":"+91-9876543217","email":"vikram@aarogya.com",
  "department":"Front Desk","salary":22000,"joiningDate":"2023-08-20","status":"Active",
  "photo":"https://ui-avatars.com/api/?name=Vikram+Singh&background=6366f1&color=fff"
}' > /dev/null

# Lab tech + Pharmacist
curl -sS -X POST http://localhost:3000/api/staff -H 'Content-Type: application/json' -b /tmp/cookies.txt -d '{
  "name":"Arjun Mehta","role":"Staff","gender":"Male","mobile":"+91-9876543218","email":"arjun@aarogya.com",
  "department":"Pharmacy","salary":30000,"joiningDate":"2022-02-14","status":"Active",
  "photo":"https://ui-avatars.com/api/?name=Arjun+Mehta&background=84cc16&color=fff"
}' > /dev/null

curl -sS -X POST http://localhost:3000/api/staff -H 'Content-Type: application/json' -b /tmp/cookies.txt -d '{
  "name":"Deepa Iyer","role":"Staff","gender":"Female","mobile":"+91-9876543219","email":"deepa@aarogya.com",
  "department":"Laboratory","salary":28000,"joiningDate":"2023-11-01","status":"Active",
  "photo":"https://ui-avatars.com/api/?name=Deepa+Iyer&background=f97316&color=fff"
}' > /dev/null

echo "  10 staff members added (4 doctors, 2 nurses, 2 receptionists, 2 staff)"

# ===== SUPPLIERS =====
echo "=== Seeding Suppliers ==="

curl -sS -X POST http://localhost:3000/api/suppliers -H 'Content-Type: application/json' -b /tmp/cookies.txt -d '{
  "name":"Cipla Pharma Distributors","mobile":"+91-8012345600","email":"sales@cipladist.com",
  "address":"Phase 2, Peenya Industrial Area, Bengaluru","supplies":"Medicines, Injections, IV Fluids",
  "photo":"https://ui-avatars.com/api/?name=Cipla&background=10b981&color=fff",
  "notes":"Primary supplier since 2020. 15-day credit."
}' > /dev/null

curl -sS -X POST http://localhost:3000/api/suppliers -H 'Content-Type: application/json' -b /tmp/cookies.txt -d '{
  "name":"Sun Pharma Supplies","mobile":"+91-8012345601","email":"orders@sunpharma.com",
  "address":"Whitefield, Bengaluru","supplies":"Tablets, Capsules, Syrups",
  "photo":"https://ui-avatars.com/api/?name=Sun+Pharma&background=3b82f6&color=fff"
}' > /dev/null

curl -sS -X POST http://localhost:3000/api/suppliers -H 'Content-Type: application/json' -b /tmp/cookies.txt -d '{
  "name":"MedSurg Equipments","mobile":"+91-8012345602","email":"info@medsurg.com",
  "address":"Electronics City, Bengaluru","supplies":"Surgical Items, Gloves, Syringes",
  "photo":"https://ui-avatars.com/api/?name=MedSurg&background=8b5cf6&color=fff",
  "notes":"Quality surgical supplies. COD available."
}' > /dev/null

curl -sS -X POST http://localhost:3000/api/suppliers -H 'Content-Type: application/json' -b /tmp/cookies.txt -d '{
  "name":"HealWell Distributors","mobile":"+91-8012345603","email":"contact@healwell.com",
  "address":"Yeshwanthpur, Bengaluru","supplies":"Bandages, Cotton, IV Fluids",
  "photo":"https://ui-avatars.com/api/?name=HealWell&background=f59e0b&color=fff"
}' > /dev/null

curl -sS -X POST http://localhost:3000/api/suppliers -H 'Content-Type: application/json' -b /tmp/cookies.txt -d '{
  "name":"BioGen Labs","mobile":"+91-8012345604","email":"supply@biogen.com",
  "address":"Manyata Tech Park, Bengaluru","supplies":"Injections, Vaccines",
  "photo":"https://ui-avatars.com/api/?name=BioGen&background=ef4444&color=fff",
  "notes":"Cold chain supplied. Minimum order 5000."
}' > /dev/null

echo "  5 suppliers added"

# ===== INVENTORY =====
echo "=== Seeding Inventory ==="

# Get categories
CATS=$(curl -sS http://localhost:3000/api/inventory/categories -b /tmp/cookies.txt)
MED_CAT=$(echo "$CATS" | python3 -c "import sys,json; cats=json.load(sys.stdin); print([c['id'] for c in cats if c['name']=='Medicines'][0])")
INJ_CAT=$(echo "$CATS" | python3 -c "import sys,json; cats=json.load(sys.stdin); print([c['id'] for c in cats if c['name']=='Injections'][0])")
SYR_CAT=$(echo "$CATS" | python3 -c "import sys,json; cats=json.load(sys.stdin); print([c['id'] for c in cats if c['name']=='Syrup'][0])")
GLO_CAT=$(echo "$CATS" | python3 -c "import sys,json; cats=json.load(sys.stdin); print([c['id'] for c in cats if c['name']=='Gloves'][0])")
SYRinge_CAT=$(echo "$CATS" | python3 -c "import sys,json; cats=json.load(sys.stdin); print([c['id'] for c in cats if c['name']=='Syringe'][0])")
IV_CAT=$(echo "$CATS" | python3 -c "import sys,json; cats=json.load(sys.stdin); print([c['id'] for c in cats if c['name']=='IV Fluids'][0])")
COT_CAT=$(echo "$CATS" | python3 -c "import sys,json; cats=json.load(sys.stdin); print([c['id'] for c in cats if c['name']=='Cotton'][0])")
BAN_CAT=$(echo "$CATS" | python3 -c "import sys,json; cats=json.load(sys.stdin); print([c['id'] for c in cats if c['name']=='Bandage'][0])")
SUR_CAT=$(echo "$CATS" | python3 -c "import sys,json; cats=json.load(sys.stdin); print([c['id'] for c in cats if c['name']=='Surgical Items'][0])")
OTH_CAT=$(echo "$CATS" | python3 -c "import sys,json; cats=json.load(sys.stdin); print([c['id'] for c in cats if c['name']=='Other'][0])")

# Get supplier IDs
SUPS=$(curl -sS http://localhost:3000/api/suppliers -b /tmp/cookies.txt)
SUP1=$(echo "$SUPS" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")
SUP2=$(echo "$SUPS" | python3 -c "import sys,json; print(json.load(sys.stdin)[1]['id'])")
SUP3=$(echo "$SUPS" | python3 -c "import sys,json; print(json.load(sys.stdin)[2]['id'])")
SUP4=$(echo "$SUPS" | python3 -c "import sys,json; print(json.load(sys.stdin)[3]['id'])")
SUP5=$(echo "$SUPS" | python3 -c "import sys,json; print(json.load(sys.stdin)[4]['id'])")

# Calculate dates
EXP_SOON=$(date -u -d '+15 days' +%Y-%m-%d 2>/dev/null || date -u -v+15d +%Y-%m-%d)
EXP_VERY_SOON=$(date -u -d '+5 days' +%Y-%m-%d 2>/dev/null || date -u -v+5d +%Y-%m-%d)
EXP_EXPIRED=$(date -u -d '-10 days' +%Y-%m-%d 2>/dev/null || date -u -v-10d +%Y-%m-%d)
EXP_EXPIRED2=$(date -u -d '-30 days' +%Y-%m-%d 2>/dev/null || date -u -v-30d +%Y-%m-%d)
EXP_GOOD=$(date -u -d '+365 days' +%Y-%m-%d 2>/dev/null || date -u -v+365d +%Y-%m-%d)
EXP_GOOD2=$(date -u -d '+180 days' +%Y-%m-%d 2>/dev/null || date -u -v+180d +%Y-%m-%d)

# Item 1: Paracetamol — LOW STOCK
curl -sS -X POST http://localhost:3000/api/inventory/items -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"name\":\"Paracetamol 500mg\",\"categoryId\":\"$MED_CAT\",\"supplierId\":\"$SUP1\",
  \"batchNumber\":\"PCM2026A\",\"expiryDate\":\"$EXP_GOOD\",\"unit\":\"strip\",\"quantity\":5,\"minStock\":50,
  \"purchasePrice\":12,\"sellingPrice\":25,\"mrp\":30,\"gst\":12,\"status\":\"Active\"
}" > /dev/null

# Item 2: Amoxicillin — FULL STOCK
curl -sS -X POST http://localhost:3000/api/inventory/items -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"name\":\"Amoxicillin 250mg\",\"categoryId\":\"$MED_CAT\",\"supplierId\":\"$SUP1\",
  \"batchNumber\":\"AMX2026B\",\"expiryDate\":\"$EXP_GOOD2\",\"unit\":\"strip\",\"quantity\":200,\"minStock\":30,
  \"purchasePrice\":45,\"sellingPrice\":80,\"mrp\":95,\"gst\":12,\"status\":\"Active\"
}" > /dev/null

# Item 3: Cough Syrup — EXPIRING SOON (5 days)
curl -sS -X POST http://localhost:3000/api/inventory/items -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"name\":\"Benadryl Cough Syrup\",\"categoryId\":\"$SYR_CAT\",\"supplierId\":\"$SUP2\",
  \"batchNumber\":\"BN2025C\",\"expiryDate\":\"$EXP_VERY_SOON\",\"unit\":\"bottle\",\"quantity\":15,\"minStock\":10,
  \"purchasePrice\":55,\"sellingPrice\":110,\"mrp\":125,\"gst\":18,\"status\":\"Active\"
}" > /dev/null

# Item 4: Vitamin C — EXPIRING SOON (15 days)
curl -sS -X POST http://localhost:3000/api/inventory/items -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"name\":\"Vitamin C Tablets\",\"categoryId\":\"$MED_CAT\",\"supplierId\":\"$SUP2\",
  \"batchNumber\":\"VTC2025D\",\"expiryDate\":\"$EXP_SOON\",\"unit\":\"strip\",\"quantity\":40,\"minStock\":20,
  \"purchasePrice\":20,\"sellingPrice\":45,\"mrp\":50,\"gst\":12,\"status\":\"Active\"
}" > /dev/null

# Item 5: Insulin Injection — EXPIRED
curl -sS -X POST http://localhost:3000/api/inventory/items -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"name\":\"Insulin Novomix 30\",\"categoryId\":\"$INJ_CAT\",\"supplierId\":\"$SUP5\",
  \"batchNumber\":\"INS2025E\",\"expiryDate\":\"$EXP_EXPIRED\",\"unit\":\"vial\",\"quantity\":8,\"minStock\":15,
  \"purchasePrice\":180,\"sellingPrice\":350,\"mrp\":400,\"gst\":5,\"status\":\"Active\"
}" > /dev/null

# Item 6: Disposable Syringes — GOOD STOCK
curl -sS -X POST http://localhost:3000/api/inventory/items -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"name\":\"Disposable Syringe 5ml\",\"categoryId\":\"$SYRinge_CAT\",\"supplierId\":\"$SUP3\",
  \"batchNumber\":\"SYR2026F\",\"expiryDate\":\"$EXP_GOOD\",\"unit\":\"box\",\"quantity\":150,\"minStock\":50,
  \"purchasePrice\":8,\"sellingPrice\":15,\"mrp\":20,\"gst\":18,\"status\":\"Active\"
}" > /dev/null

# Item 7: Surgical Gloves — OUT OF STOCK
curl -sS -X POST http://localhost:3000/api/inventory/items -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"name\":\"Surgical Gloves (M)\",\"categoryId\":\"$GLO_CAT\",\"supplierId\":\"$SUP3\",
  \"batchNumber\":\"GLV2026G\",\"expiryDate\":\"$EXP_GOOD2\",\"unit\":\"box\",\"quantity\":0,\"minStock\":20,
  \"purchasePrice\":120,\"sellingPrice\":250,\"mrp\":280,\"gst\":18,\"status\":\"Active\"
}" > /dev/null

# Item 8: IV Fluids — FULL STOCK
curl -sS -X POST http://localhost:3000/api/inventory/items -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"name\":\"Normal Saline 500ml\",\"categoryId\":\"$IV_CAT\",\"supplierId\":\"$SUP4\",
  \"batchNumber\":\"IV2026H\",\"expiryDate\":\"$EXP_GOOD\",\"unit\":\"bottle\",\"quantity\":80,\"minStock\":25,
  \"purchasePrice\":35,\"sellingPrice\":65,\"mrp\":75,\"gst\":5,\"status\":\"Active\"
}" > /dev/null

# Item 9: Cotton Roll — LOW STOCK
curl -sS -X POST http://localhost:3000/api/inventory/items -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"name\":\"Absorbent Cotton Roll\",\"categoryId\":\"$COT_CAT\",\"supplierId\":\"$SUP4\",
  \"batchNumber\":\"COT2026I\",\"expiryDate\":\"$EXP_GOOD2\",\"unit\":\"roll\",\"quantity\":3,\"minStock\":15,
  \"purchasePrice\":25,\"sellingPrice\":50,\"mrp\":60,\"gst\":12,\"status\":\"Active\"
}" > /dev/null

# Item 10: Bandage — EXPIRED
curl -sS -X POST http://localhost:3000/api/inventory/items -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"name\":\"Crepe Bandage 4 inch\",\"categoryId\":\"$BAN_CAT\",\"supplierId\":\"$SUP3\",
  \"batchNumber\":\"BND2025J\",\"expiryDate\":\"$EXP_EXPIRED2\",\"unit\":\"roll\",\"quantity\":25,\"minStock\":15,
  \"purchasePrice\":30,\"sellingPrice\":60,\"mrp\":70,\"gst\":12,\"status\":\"Active\"
}" > /dev/null

# Item 11: Surgical Blade — GOOD STOCK
curl -sS -X POST http://localhost:3000/api/inventory/items -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"name\":\"Surgical Blade No.11\",\"categoryId\":\"$SUR_CAT\",\"supplierId\":\"$SUP3\",
  \"batchNumber\":\"SBL2026K\",\"expiryDate\":\"$EXP_GOOD\",\"unit\":\"pack\",\"quantity\":60,\"minStock\":20,
  \"purchasePrice\":15,\"sellingPrice\":35,\"mrp\":40,\"gst\":18,\"status\":\"Active\"
}" > /dev/null

# Item 12: Omeprazole — MODERATE STOCK
curl -sS -X POST http://localhost:3000/api/inventory/items -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"name\":\"Omeprazole 20mg\",\"categoryId\":\"$MED_CAT\",\"supplierId\":\"$SUP1\",
  \"batchNumber\":\"OMP2026L\",\"expiryDate\":\"$EXP_GOOD2\",\"unit\":\"strip\",\"quantity\":35,\"minStock\":25,
  \"purchasePrice\":18,\"sellingPrice\":40,\"mrp\":48,\"gst\":12,\"status\":\"Active\"
}" > /dev/null

# Item 13: Aspirin — CRITICAL STOCK
curl -sS -X POST http://localhost:3000/api/inventory/items -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"name\":\"Aspirin 75mg\",\"categoryId\":\"$MED_CAT\",\"supplierId\":\"$SUP2\",
  \"batchNumber\":\"ASP2026M\",\"expiryDate\":\"$EXP_GOOD\",\"unit\":\"strip\",\"quantity\":2,\"minStock\":30,
  \"purchasePrice\":8,\"sellingPrice\":20,\"mrp\":25,\"gst\":12,\"status\":\"Active\"
}" > /dev/null

# Item 14: Hand Sanitizer — FULL STOCK
curl -sS -X POST http://localhost:3000/api/inventory/items -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"name\":\"Hand Sanitizer 500ml\",\"categoryId\":\"$OTH_CAT\",\"supplierId\":\"$SUP4\",
  \"batchNumber\":\"HS2026N\",\"expiryDate\":\"$EXP_GOOD2\",\"unit\":\"bottle\",\"quantity\":100,\"minStock\":20,
  \"purchasePrice\":45,\"sellingPrice\":99,\"mrp\":120,\"gst\":18,\"status\":\"Active\"
}" > /dev/null

# Item 15: Glucose Test Strips — EXPIRING SOON
curl -sS -X POST http://localhost:3000/api/inventory/items -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"name\":\"Glucose Test Strips\",\"categoryId\":\"$OTH_CAT\",\"supplierId\":\"$SUP5\",
  \"batchNumber\":\"GTS2025O\",\"expiryDate\":\"$EXP_SOON\",\"unit\":\"box\",\"quantity\":12,\"minStock\":10,
  \"purchasePrice\":150,\"sellingPrice\":299,\"mrp\":350,\"gst\":18,\"status\":\"Active\"
}" > /dev/null

echo "  15 inventory items added (low stock, full stock, expired, expiring soon)"

# ===== APPOINTMENTS =====
echo "=== Seeding Appointments ==="

# Get staff IDs for doctors
STAFF=$(curl -sS 'http://localhost:3000/api/staff?role=Doctor' -b /tmp/cookies.txt)
DR1=$(echo "$STAFF" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")
DR2=$(echo "$STAFF" | python3 -c "import sys,json; print(json.load(sys.stdin)[1]['id'])")
DR3=$(echo "$STAFF" | python3 -c "import sys,json; print(json.load(sys.stdin)[2]['id'])")

# Get consultation fee IDs
FEES=$(curl -sS http://localhost:3000/api/consultation-fees -b /tmp/cookies.txt)
FEE1=$(echo "$FEES" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")
FEE2=$(echo "$FEES" | python3 -c "import sys,json; print(json.load(sys.stdin)[1]['id'])")
FEE3=$(echo "$FEES" | python3 -c "import sys,json; print(json.load(sys.stdin)[2]['id'])")

# Today's appointments
TODAY_09=$(date -u +%Y-%m-%dT09:00:00.000Z)
TODAY_10=$(date -u +%Y-%m-%dT10:00:00.000Z)
TODAY_11=$(date -u +%Y-%m-%dT11:00:00.000Z)
TODAY_14=$(date -u +%Y-%m-%dT14:00:00.000Z)
TODAY_15=$(date -u +%Y-%m-%dT15:00:00.000Z)
TODAY_16=$(date -u +%Y-%m-%dT16:00:00.000Z)

# Yesterday
YDAY_10=$(date -u -d 'yesterday' +%Y-%m-%dT10:00:00.000Z 2>/dev/null || date -u -v-1d +%Y-%m-%dT10:00:00.000Z)
YDAY_14=$(date -u -d 'yesterday' +%Y-%m-%dT14:00:00.000Z 2>/dev/null || date -u -v-1d +%Y-%m-%dT14:00:00.000Z)

# 2 days ago
D2_11=$(date -u -d '2 days ago' +%Y-%m-%dT11:00:00.000Z 2>/dev/null || date -u -v-2d +%Y-%m-%dT11:00:00.000Z)
D2_15=$(date -u -d '2 days ago' +%Y-%m-%dT15:00:00.000Z 2>/dev/null || date -u -v-2d +%Y-%m-%dT15:00:00.000Z)

# Tomorrow
TMR_10=$(date -u -d 'tomorrow' +%Y-%m-%dT10:00:00.000Z 2>/dev/null || date -u -v+1d +%Y-%m-%dT10:00:00.000Z)
TMR_12=$(date -u -d 'tomorrow' +%Y-%m-%dT12:00:00.000Z 2>/dev/null || date -u -v+1d +%Y-%m-%dT12:00:00.000Z)

# Appointments
curl -sS -X POST http://localhost:3000/api/appointments -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"patientName\":\"Ramesh Acharya\",\"mobile\":\"+91-9000012301\",\"staffId\":\"$DR1\",\"consultationFeeId\":\"$FEE1\",
  \"date\":\"$TODAY_09\",\"type\":\"Walk-in\",\"fee\":50,\"status\":\"Completed\",\"notes\":\"Fever and cold. Prescribed paracetamol.\"
}" > /dev/null

curl -sS -X POST http://localhost:3000/api/appointments -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"patientName\":\"Sunita Devi\",\"mobile\":\"+91-9000012302\",\"staffId\":\"$DR2\",\"consultationFeeId\":\"$FEE1\",
  \"date\":\"$TODAY_10\",\"type\":\"Walk-in\",\"fee\":50,\"status\":\"Pending\",\"notes\":\"Chest pain, needs ECG\"
}" > /dev/null

curl -sS -X POST http://localhost:3000/api/appointments -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"patientName\":\"Mohammed Ali\",\"mobile\":\"+91-9000012303\",\"staffId\":\"$DR3\",\"consultationFeeId\":\"$FEE2\",
  \"date\":\"$TODAY_11\",\"type\":\"Phone\",\"fee\":30,\"status\":\"Completed\",\"notes\":\"Follow-up for child vaccination\"
}" > /dev/null

curl -sS -X POST http://localhost:3000/api/appointments -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"patientName\":\"Geeta Joshi\",\"mobile\":\"+91-9000012304\",\"staffId\":\"$DR1\",\"consultationFeeId\":\"$FEE3\",
  \"date\":\"$TODAY_14\",\"type\":\"Walk-in\",\"fee\":100,\"status\":\"No Show\",\"notes\":\"Emergency - did not arrive\"
}" > /dev/null

curl -sS -X POST http://localhost:3000/api/appointments -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"patientName\":\"Karthik Raj\",\"mobile\":\"+91-9000012305\",\"staffId\":\"$DR2\",\"consultationFeeId\":\"$FEE1\",
  \"date\":\"$TODAY_15\",\"type\":\"Website\",\"fee\":50,\"status\":\"Pending\",\"notes\":\"Regular checkup\"
}" > /dev/null

curl -sS -X POST http://localhost:3000/api/appointments -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"patientName\":\"Anjali Verma\",\"mobile\":\"+91-9000012306\",\"staffId\":\"$DR3\",\"consultationFeeId\":\"$FEE1\",
  \"date\":\"$TODAY_16\",\"type\":\"Walk-in\",\"fee\":50,\"status\":\"Cancelled\",\"notes\":\"Patient cancelled due to personal reasons\"
}" > /dev/null

curl -sS -X POST http://localhost:3000/api/appointments -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"patientName\":\"Prakash Menon\",\"mobile\":\"+91-9000012307\",\"staffId\":\"$DR1\",\"consultationFeeId\":\"$FEE2\",
  \"date\":\"$YDAY_10\",\"type\":\"Walk-in\",\"fee\":30,\"status\":\"Completed\",\"notes\":\"Follow-up for BP medication\"
}" > /dev/null

curl -sS -X POST http://localhost:3000/api/appointments -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"patientName\":\"Lakshmi Devi\",\"mobile\":\"+91-9000012308\",\"staffId\":\"$DR2\",\"consultationFeeId\":\"$FEE1\",
  \"date\":\"$YDAY_14\",\"type\":\"Phone\",\"fee\":50,\"status\":\"Completed\",\"notes\":\"Skin allergy consultation\"
}" > /dev/null

curl -sS -X POST http://localhost:3000/api/appointments -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"patientName\":\"Rohit Saxena\",\"mobile\":\"+91-9000012309\",\"staffId\":\"$DR3\",\"consultationFeeId\":\"$FEE3\",
  \"date\":\"$D2_11\",\"type\":\"Walk-in\",\"fee\":100,\"status\":\"Completed\",\"notes\":\"Emergency - severe stomach pain\"
}" > /dev/null

curl -sS -X POST http://localhost:3000/api/appointments -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"patientName\":\"Meena Kapoor\",\"mobile\":\"+91-9000012310\",\"staffId\":\"$DR1\",\"consultationFeeId\":\"$FEE1\",
  \"date\":\"$D2_15\",\"type\":\"Website\",\"fee\":50,\"status\":\"No Show\",\"notes\":\"Did not show up for diabetes check\"
}" > /dev/null

curl -sS -X POST http://localhost:3000/api/appointments -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"patientName\":\"Sanjay Gupta\",\"mobile\":\"+91-9000012311\",\"staffId\":\"$DR2\",\"consultationFeeId\":\"$FEE1\",
  \"date\":\"$TMR_10\",\"type\":\"Walk-in\",\"fee\":50,\"status\":\"Pending\",\"notes\":\"Routine cardiac check\"
}" > /dev/null

curl -sS -X POST http://localhost:3000/api/appointments -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"patientName\":\"Pooja Nair\",\"mobile\":\"+91-9000012312\",\"staffId\":\"$DR3\",\"consultationFeeId\":\"$FEE2\",
  \"date\":\"$TMR_12\",\"type\":\"Phone\",\"fee\":30,\"status\":\"Pending\",\"notes\":\"Follow-up pediatric\"
}" > /dev/null

echo "  12 appointments added (completed, pending, cancelled, no-show, today + past + future)"

# ===== BILLS =====
echo "=== Seeding Bills ==="

# Get inventory item IDs for bill items
ITEMS=$(curl -sS http://localhost:3000/api/inventory/items -b /tmp/cookies.txt)
ITEM1=$(echo "$ITEMS" | python3 -c "import sys,json; items=json.load(sys.stdin).get('items',json.load(sys.stdin)); print([i['id'] for i in items if 'Paracetamol' in i['name']][0])")
ITEM2=$(echo "$ITEMS" | python3 -c "import sys,json; items=json.load(sys.stdin).get('items',json.load(sys.stdin)); print([i['id'] for i in items if 'Amoxicillin' in i['name']][0])")
ITEM3=$(echo "$ITEMS" | python3 -c "import sys,json; items=json.load(sys.stdin).get('items',json.load(sys.stdin)); print([i['id'] for i in items if 'Cough' in i['name']][0])")

# Bill 1 — Paid, Cash, today
curl -sS -X POST http://localhost:3000/api/bills -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"patientName\":\"Ramesh Acharya\",\"mobile\":\"+91-9000012301\",
  \"consultationCharge\":50,\"discount\":5,\"discountType\":\"fixed\",\"gst\":0,
  \"paymentMethod\":\"Cash\",\"paymentStatus\":\"Paid\",
  \"items\":[{\"name\":\"Paracetamol 500mg\",\"qty\":2,\"price\":25}]
}" > /dev/null

# Bill 2 — Paid, UPI, today
curl -sS -X POST http://localhost:3000/api/bills -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"patientName\":\"Mohammed Ali\",\"mobile\":\"+91-9000012303\",
  \"consultationCharge\":30,\"discount\":0,\"discountType\":\"fixed\",\"gst\":0,
  \"paymentMethod\":\"UPI\",\"paymentStatus\":\"Paid\",
  \"items\":[]
}" > /dev/null

# Bill 3 — Pending, Cash, today
curl -sS -X POST http://localhost:3000/api/bills -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"patientName\":\"Karthik Raj\",\"mobile\":\"+91-9000012305\",
  \"consultationCharge\":50,\"discount\":10,\"discountType\":\"percent\",\"gst\":5,
  \"paymentMethod\":\"Cash\",\"paymentStatus\":\"Pending\",
  \"items\":[{\"name\":\"Amoxicillin 250mg\",\"qty\":1,\"price\":80},{\"name\":\"Vitamin C Tablets\",\"qty\":2,\"price\":45}]
}" > /dev/null

# Bill 4 — Paid, Card, yesterday
curl -sS -X POST http://localhost:3000/api/bills -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"patientName\":\"Prakash Menon\",\"mobile\":\"+91-9000012307\",
  \"consultationCharge\":30,\"discount\":0,\"discountType\":\"fixed\",\"gst\":0,
  \"paymentMethod\":\"Card\",\"paymentStatus\":\"Paid\",
  \"items\":[{\"name\":\"Omeprazole 20mg\",\"qty\":2,\"price\":40}]
}" > /dev/null

# Bill 5 — Paid, UPI, yesterday
curl -sS -X POST http://localhost:3000/api/bills -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"patientName\":\"Lakshmi Devi\",\"mobile\":\"+91-9000012308\",
  \"consultationCharge\":50,\"discount\":0,\"discountType\":\"fixed\",\"gst\":0,
  \"paymentMethod\":\"UPI\",\"paymentStatus\":\"Paid\",
  \"items\":[{\"name\":\"Benadryl Cough Syrup\",\"qty\":1,\"price\":110}]
}" > /dev/null

# Bill 6 — Pending, Cash, 2 days ago
curl -sS -X POST http://localhost:3000/api/bills -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"patientName\":\"Rohit Saxena\",\"mobile\":\"+91-9000012309\",
  \"consultationCharge\":100,\"discount\":0,\"discountType\":\"fixed\",\"gst\":18,
  \"paymentMethod\":\"Cash\",\"paymentStatus\":\"Pending\",
  \"items\":[{\"name\":\"Normal Saline 500ml\",\"qty\":2,\"price\":65},{\"name\":\"Disposable Syringe 5ml\",\"qty\":3,\"price\":15}]
}" > /dev/null

# Bill 7 — Paid, Bank Transfer, 2 days ago
curl -sS -X POST http://localhost:3000/api/bills -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"patientName\":\"Meena Kapoor\",\"mobile\":\"+91-9000012310\",
  \"consultationCharge\":50,\"discount\":5,\"discountType\":\"fixed\",\"gst\":0,
  \"paymentMethod\":\"Bank Transfer\",\"paymentStatus\":\"Paid\",
  \"items\":[]
}" > /dev/null

# Bill 8 — Pending, Cash, today (large bill with multiple items)
curl -sS -X POST http://localhost:3000/api/bills -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"patientName\":\"Sanjay Gupta\",\"mobile\":\"+91-9000012311\",
  \"consultationCharge\":50,\"discount\":15,\"discountType\":\"percent\",\"gst\":12,
  \"paymentMethod\":\"Cash\",\"paymentStatus\":\"Pending\",
  \"items\":[{\"name\":\"Amoxicillin 250mg\",\"qty\":2,\"price\":80},{\"name\":\"Paracetamol 500mg\",\"qty\":3,\"price\":25},{\"name\":\"Omeprazole 20mg\",\"qty\":1,\"price\":40}]
}" > /dev/null

# Bill 9 — Paid, UPI, today
curl -sS -X POST http://localhost:3000/api/bills -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"patientName\":\"Pooja Nair\",\"mobile\":\"+91-9000012312\",
  \"consultationCharge\":30,\"discount\":0,\"discountType\":\"fixed\",\"gst\":0,
  \"paymentMethod\":\"UPI\",\"paymentStatus\":\"Paid\",
  \"items\":[{\"name\":\"Hand Sanitizer 500ml\",\"qty\":1,\"price\":99}]
}" > /dev/null

# Bill 10 — Pending, Card, today
curl -sS -X POST http://localhost:3000/api/bills -H 'Content-Type: application/json' -b /tmp/cookies.txt -d "{
  \"patientName\":\"Geeta Joshi\",\"mobile\":\"+91-9000012304\",
  \"consultationCharge\":100,\"discount\":0,\"discountType\":\"fixed\",\"gst\":18,
  \"paymentMethod\":\"Card\",\"paymentStatus\":\"Pending\",
  \"items\":[{\"name\":\"Glucose Test Strips\",\"qty\":1,\"price\":299}]
}" > /dev/null

echo "  10 bills added (paid + pending, Cash/UPI/Card/Bank Transfer)"

# ===== SUMMARY =====
echo ""
echo "================================================================"
echo "TEST DATA SEED COMPLETE"
echo "================================================================"
echo "Staff:      10 (4 doctors, 2 nurses, 2 receptionists, 2 staff)"
echo "Suppliers:  5"
echo "Inventory:  15 items (3 low stock, 1 out of stock, 2 expired, 3 expiring soon, 6 good stock)"
echo "Appts:      12 (6 today, 2 yesterday, 2 day before, 2 tomorrow)"
echo "            Statuses: 6 completed, 4 pending, 1 cancelled, 2 no-show"
echo "Bills:      10 (6 paid, 4 pending)"
echo "            Methods: Cash, UPI, Card, Bank Transfer"
echo "Clinic:     Aarogya Health Clinic, Dr. Rajesh Kumar"
echo "================================================================"

# Verify data
echo ""
echo "=== Dashboard Stats ==="
curl -sS http://localhost:3000/api/reports -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
s = d['dashboard']
print(f\"  Today's Appointments: {s['todaysAppointments']}\")
print(f\"  Today's Revenue: ₹{s['todaysRevenue']:.2f}\")
print(f\"  Total Bills: {s['totalBills']}\")
print(f\"  Low Stock Alerts: {s['lowStockCount']}\")
print(f\"  Expiring Medicines: {s['expiringCount']}\")
print(f\"  Total Staff: {s['totalStaff']}\")
print(f\"  Inventory Items: {s['totalInventoryItems']}\")
"

kill $DEV_PID 2>/dev/null; wait $DEV_PID 2>/dev/null