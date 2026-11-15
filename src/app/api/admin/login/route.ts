import { NextRequest, NextResponse } from "next/server"
import {
  clearAdminCookie,
  createAdminCookie,
  verifyAdminPassword,
} from "@/lib/admin-auth"

export async function POST(request: NextRequest) {
  let body: { password?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Solicitação inválida." }, { status: 400 })
  }

  if (typeof body.password !== "string" || body.password.length > 200) {
    return NextResponse.json({ error: "Informe a senha do painel." }, { status: 400 })
  }

  try {
    if (!verifyAdminPassword(body.password)) {
      return NextResponse.json({ error: "Senha incorreta." }, { status: 401 })
    }
    const response = NextResponse.json({ authenticated: true })
    createAdminCookie(response)
    return response
  } catch (error) {
    console.error("Falha na configuração do acesso administrativo:", error)
    return NextResponse.json(
      { error: "Configure ADMIN_PASSWORD e ADMIN_SESSION_SECRET no servidor." },
      { status: 503 },
    )
  }
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false })
  clearAdminCookie(response)
  return response
}
