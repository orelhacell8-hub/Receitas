import { NextRequest, NextResponse } from "next/server"
import { nxgatePost } from "@/lib/nxgate-api"
import { createSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-admin"

type RouteContext = { params: Promise<{ id: string }> }
type NxgateTransaction = {
  status?: string
  idTransaction?: string
  transaction_id?: string
  amount?: number | string
  valor?: number | string
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id: accessToken } = await context.params
  if (!/^[0-9a-f-]{36}$/i.test(accessToken)) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Loja indisponível." }, { status: 503 })
  }

  try {
    const supabase = createSupabaseAdmin()
    const { data: order, error } = await supabase
      .from("orders")
      .select("id,access_token,amount,status,transaction_id,product_id,pix_code,pix_qr")
      .eq("access_token", accessToken)
      .maybeSingle()
    if (error) throw error
    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
    }

    let paid = order.status === "paid"
    if (!paid && order.status === "pending" && order.transaction_id) {
      if (!process.env.NXGATE_API_KEY) {
        return NextResponse.json(
          { error: "NXGATE_API_KEY não está configurada." },
          { status: 503 },
        )
      }

      const transaction = await nxgatePost<NxgateTransaction>(
        "/v2/consultar",
        { transaction_id: order.transaction_id },
      )
      const returnedId = transaction.idTransaction ?? transaction.transaction_id
      const reportedAmount = transaction.amount ?? transaction.valor
      const transactionMatches =
        !returnedId || returnedId === order.transaction_id
      const amountMatches =
        reportedAmount === undefined ||
        (Number.isFinite(Number(reportedAmount)) &&
          Math.abs(Number(reportedAmount) - Number(order.amount)) < 0.01)
      const isConfirmed = transaction.status?.toLowerCase() === "paid"

      if (isConfirmed && transactionMatches && amountMatches) {
        const { error: updateError } = await supabase
          .from("orders")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("id", order.id)
          .eq("status", "pending")
        if (updateError) throw updateError
        paid = true
      } else if (isConfirmed && (!amountMatches || !transactionMatches)) {
        console.error("Transação NXGATE não corresponde ao pedido:", {
          orderId: order.id,
          transactionId: order.transaction_id,
          returnedTransactionId: returnedId,
          amountMatches,
          transactionMatches,
        })
      }
    }

    let downloadUrl: string | undefined
    if (paid) {
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("file_path")
        .eq("id", order.product_id)
        .single()
      if (productError) throw productError
      if (product.file_path) {
        const { data, error: urlError } = await supabase.storage
          .from("course-pdfs")
          .createSignedUrl(product.file_path, 60 * 60)
        if (urlError) throw urlError
        downloadUrl = data.signedUrl
      }
    }

    return NextResponse.json({
      id: accessToken,
      status: paid ? "paid" : "pending",
      pixCode: order.pix_code,
      qrCode: order.pix_qr,
      ...(downloadUrl ? { downloadUrl } : {}),
    })
  } catch (error) {
    console.error("Falha ao consultar confirmação do pagamento:", error)
    return NextResponse.json(
      { error: "Não foi possível confirmar o pagamento agora." },
      { status: 503 },
    )
  }
}
