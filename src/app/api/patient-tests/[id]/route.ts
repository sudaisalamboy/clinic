import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { getCurrentOwner } from '@/lib/auth'

const ResultValueSchema = z.object({
  parameter: z.string().min(1).max(200),
  value: z.string().max(200),
  unit: z.string().max(50).optional().nullable(),
  flag: z.enum(['Normal', 'High', 'Low', 'Abnormal', '']).optional().nullable(),
})

const UpdateSchema = z.object({
  status: z.enum(['Pending', 'In Progress', 'Completed']).optional(),
  resultValues: z.array(ResultValueSchema).optional(),
  resultNotes: z.string().max(5000).optional().nullable(),
  /// When status is set to Completed, completedAt is auto-set
})

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'lab-results')
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/tiff',
]

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const { id } = await params
  const patientTest = await db.patientLabTest.findUnique({
    where: { id },
    include: {
      patient: {
        select: {
          id: true, name: true, patientCode: true, phone: true, email: true,
          dateOfBirth: true, gender: true, bloodGroup: true,
        },
      },
      labTest: true,
      doctor: { select: { id: true, name: true, specialization: true, department: { select: { name: true } } } },
    },
  })
  if (!patientTest) {
    return NextResponse.json({ error: 'Patient test not found' }, { status: 404 })
  }

  // Also fetch patient's test history (other tests)
  const history = await db.patientLabTest.findMany({
    where: { patientId: patientTest.patientId, id: { not: patientTest.id } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      labTest: { select: { id: true, name: true, category: true, referenceRange: true } },
      doctor: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({
    patientTest: {
      ...patientTest,
      resultValues: JSON.parse(patientTest.resultValues),
      // Include the public URL for the result file
      resultFileUrl: patientTest.resultFile
        ? `/uploads/lab-results/${patientTest.resultFile}`
        : null,
    },
    history: history.map((h) => ({
      ...h,
      resultValues: JSON.parse(h.resultValues),
    })),
  })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const { id } = await params

  // Check if this is a multipart upload (file upload)
  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('multipart/form-data')) {
    return await handleFileUpload(req, id)
  }

  // Otherwise, JSON body for status + result values update
  const body = await req.json().catch(() => null)
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const d = parsed.data

  const data: Record<string, unknown> = {}
  if (d.resultValues !== undefined) {
    data.resultValues = JSON.stringify(d.resultValues)
  }
  if (d.resultNotes !== undefined) {
    data.resultNotes = d.resultNotes?.trim() || null
  }
  if (d.status !== undefined) {
    data.status = d.status
    if (d.status === 'Completed') {
      data.completedAt = new Date()
    }
  }

  const patientTest = await db.patientLabTest.update({
    where: { id },
    data,
    include: {
      patient: { select: { id: true, name: true, patientCode: true, phone: true, dateOfBirth: true, gender: true } },
      labTest: { select: { id: true, name: true, category: true, price: true, referenceRange: true, sampleType: true } },
      doctor: { select: { id: true, name: true, specialization: true } },
    },
  })

  return NextResponse.json({
    patientTest: { ...patientTest, resultValues: JSON.parse(patientTest.resultValues) },
  })
}

async function handleFileUpload(req: NextRequest, id: string) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}. Allowed: PDF, JPEG, PNG, GIF, WebP, TIFF` },
      { status: 400 },
    )
  }

  // Ensure upload dir exists
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true })
  }

  // Generate a unique filename preserving the extension
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const filename = `${id}-${randomUUID()}.${ext}`
  const filepath = path.join(UPLOAD_DIR, filename)

  // Write the file
  const bytes = await file.arrayBuffer()
  await writeFile(filepath, Buffer.from(bytes))

  // Update the patient test record
  const patientTest = await db.patientLabTest.update({
    where: { id },
    data: {
      resultFile: filename,
      resultFileName: file.name,
      resultFileType: file.type,
    },
    include: {
      patient: { select: { id: true, name: true, patientCode: true, phone: true, dateOfBirth: true, gender: true } },
      labTest: { select: { id: true, name: true, category: true, price: true, referenceRange: true, sampleType: true } },
      doctor: { select: { id: true, name: true, specialization: true } },
    },
  })

  return NextResponse.json({
    patientTest: { ...patientTest, resultValues: JSON.parse(patientTest.resultValues) },
    resultFileUrl: `/uploads/lab-results/${filename}`,
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await getCurrentOwner()
  if (!owner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const { id } = await params
  await db.patientLabTest.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
