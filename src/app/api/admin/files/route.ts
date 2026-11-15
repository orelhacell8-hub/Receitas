import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { isAdminRequest } from "@/lib/admin-auth"
import { createSupabaseAdmin } from "@/lib/supabase-admin"

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 })
  }

  const file = formData.get("file")
  if (!(file instanceof File) || file.type !== "application/pdf" || file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Envie um arquivo PDF de até 10 MB." },
      { status: 400 },
    )
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
    return NextResponse.json({ error: "O arquivo enviado não é um PDF válido." }, { status: 400 })
  }

  try {
    const supabase = createSupabaseAdmin()
    const path = `${randomUUID()}.pdf`
    const { error } = await supabase.storage
      .from("course-pdfs")
      .upload(path, bytes, { contentType: "application/pdf", upsert: false })
    if (error) throw error
    return NextResponse.json({ file_path: path })
  } catch (error) {
    console.error("Falha ao armazenar PDF do produto:", error)
    return NextResponse.json(
      { error: "Não foi possível guardar o PDF. Confira o bucket privado course-pdfs." },
      { status: 503 },
    )
  }
}
