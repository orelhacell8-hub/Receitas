import { randomUUID } from "node:crypto"
import QRCode from "qrcode"
import { NextRequest, NextResponse } from "next/server"
import { nxgatePost } from "@/lib/nxgate-api"
import { createSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-admin"

type NxgateCharge = {
  status?: string
  message?: string
  error?: string
  idTransaction?: string
  paymentCode?: string
  paymentCodeBase64?: string
}

function failure(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return failure("Confira os dados do checkout e tente novamente.", 400)
  }

  const productId = typeof body.productId === "string" ? body.productId : ""
  const name = typeof body.name === "string" ? body.name.trim() : ""
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const document =
    typeof body.document === "string" ? body.document.replace(/\D/g, "") : ""
  const checkoutKey =
    typeof body.checkoutKey === "string" ? body.checkoutKey : ""

  if (
    !productId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      checkoutKey,
    ) ||
    name.length < 2 ||
    name.length > 120 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    ![11, 14].includes(document.length)
  ) {
    return failure("Confira seu nome, e-mail e CPF/CNPJ.", 400)
  }
  if (!isSupabaseConfigured()) {
    return failure("A loja ainda precisa ser conectada ao Supabase para receber pedidos.", 503)
  }

  if (!process.env.NXGATE_API_KEY) {
    return failure(
      "A integração de pagamentos ainda não está configurada no servidor.",
      503,
    )
  }

  const supabase = createSupabaseAdmin()
  try {
    const [productResult, settingsResult] = await Promise.all([
      supabase
        .from("products")
        .select("id,name,price,active,file_path")
        .eq("id", productId)
        .eq("active", true)
        .single(),
      supabase
        .from("site_settings")
        .select("value")
        .eq("key", "store")
        .maybeSingle(),
    ])
    if (productResult.error || !productResult.data) {
      return failure("Esta receita não está disponível para compra.", 404)
    }
    if (!productResult.data.file_path) {
      return failure(
        "O PDF desta receita ainda não foi adicionado pela loja.",
        409,
      )
    }
    if (settingsResult.error) throw settingsResult.error
    if (settingsResult.data?.value?.gateway_enabled !== true) {
      return failure("O pagamento por PIX está temporariamente indisponível.", 503)
    }

    const amount = Number(productResult.data.price)
    const { data: insertedOrder, error: insertError } = await supabase
      .from("orders")
      .upsert(
        {
        access_token: randomUUID(),
        checkout_key: checkoutKey,
        product_id: productResult.data.id,
        amount,
        customer_name: name,
        customer_email: email,
        status: "creating",
        },
        { onConflict: "checkout_key", ignoreDuplicates: true },
      )
      .select("id,access_token,amount,status,transaction_id,pix_code,pix_qr")
      .maybeSingle()
    if (insertError) throw insertError
    const { data: existingOrder, error: existingOrderError } = insertedOrder
      ? { data: insertedOrder, error: null }
      : await supabase
          .from("orders")
          .select("id,access_token,amount,status,transaction_id,pix_code,pix_qr")
          .eq("checkout_key", checkoutKey)
          .single()
    if (existingOrderError) throw existingOrderError
    if (!existingOrder) throw new Error("Não foi possível registrar o pedido.")
    if (existingOrder.status === "pending") {
      return NextResponse.json({
        id: existingOrder.access_token,
        pixCode: existingOrder.pix_code,
        qrCode: existingOrder.pix_qr,
        status: "pending",
      })
    }
    if (existingOrder.status === "paid") {
      return NextResponse.json({
        id: existingOrder.access_token,
        pixCode: existingOrder.pix_code,
        qrCode: existingOrder.pix_qr,
        status: "paid",
      })
    }
    if (existingOrder.status === "failed") {
      return failure("Essa tentativa falhou. Inicie um novo checkout para tentar novamente.", 409)
    }

    const charge = await nxgatePost<NxgateCharge>(
      "/v2/cobranca",
      {
        valor: amount,
        nome_pagador: name,
        documento_pagador: document,
        email_pagador: email,
        descricao: `Doce Ritual - ${productResult.data.name}`,
        magic_id: existingOrder.id,
      },
      existingOrder.id,
    )
    if (
      charge.status !== "success" ||
      !charge.idTransaction ||
      !charge.paymentCode
    ) {
      throw new Error("A NXGATE retornou uma cobrança sem os dados PIX necessários.")
    }
    const qrCode =
      charge.paymentCodeBase64 ||
      (await QRCode.toDataURL(charge.paymentCode, { margin: 1, width: 240 }))

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        transaction_id: charge.idTransaction,
        pix_code: charge.paymentCode,
        pix_qr: qrCode,
        status: "pending",
      })
      .eq("id", existingOrder.id)
    if (updateError) {
      console.error(
        "PIX gerado, mas não foi possível salvar o pedido:",
        charge.idTransaction,
        updateError,
      )
      throw updateError
    }

    return NextResponse.json({
      id: existingOrder.access_token,
      pixCode: charge.paymentCode,
      qrCode,
      status: "pending",
    })
  } catch (error) {
    console.error("Falha ao criar cobrança PIX:", error)
    return failure("Não foi possível gerar o PIX agora. Tente novamente em instantes.", 502)
  }
}
