import { NextRequest, NextResponse } from "next/server"
import { isAdminRequest } from "@/lib/admin-auth"
import { createSupabaseAdmin } from "@/lib/supabase-admin"

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function isHttpUrl(value: string) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return errorResponse("Acesso não autorizado.", 401)

  try {
    const supabase = createSupabaseAdmin()
    const [products, categories, settings, orders] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("name"),
      supabase.from("site_settings").select("value").eq("key", "store").maybeSingle(),
      supabase
        .from("orders")
        .select("id,product_id,amount,customer_name,customer_email,status,created_at,paid_at")
        .order("created_at", { ascending: false })
        .limit(25),
    ])
    for (const result of [products, categories, settings, orders]) {
      if (result.error) throw result.error
    }
    return NextResponse.json({
      products: products.data,
      categories: categories.data,
      settings: settings.data?.value ?? {},
      orders: orders.data,
    })
  } catch (error) {
    console.error("Falha ao carregar painel administrativo:", error)
    return errorResponse("Não foi possível carregar os dados. Confira o banco e o schema.", 503)
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return errorResponse("Acesso não autorizado.", 401)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return errorResponse("Solicitação inválida.")
  }

  try {
    const supabase = createSupabaseAdmin()

    if (body.action === "save-product") {
      const name = typeof body.name === "string" ? body.name.trim() : ""
      const category = typeof body.category === "string" ? body.category.trim() : ""
      const description =
        typeof body.description === "string" ? body.description.trim() : ""
      const imageUrl = typeof body.image_url === "string" ? body.image_url.trim() : ""
      const price = Number(body.price)

      if (
        name.length < 2 ||
        name.length > 120 ||
        category.length < 2 ||
        category.length > 80 ||
        description.length < 10 ||
        description.length > 2000 ||
        !Number.isFinite(price) ||
        price <= 0 ||
        price > 10000 ||
        !isHttpUrl(imageUrl)
      ) {
        return errorResponse("Confira nome, categoria, descrição, preço e imagem.")
      }

      const product = {
        name,
        category,
        description,
        price,
        image_url: imageUrl,
        featured: body.featured === true,
        file_path: typeof body.file_path === "string" ? body.file_path : null,
        active: body.active !== false,
        updated_at: new Date().toISOString(),
      }
      const query =
        typeof body.id === "string" && body.id
          ? supabase.from("products").update(product).eq("id", body.id).select().single()
          : supabase.from("products").insert(product).select().single()
      const { data, error } = await query
      if (error) throw error
      return NextResponse.json({ product: data })
    }

    if (body.action === "delete-product") {
      if (typeof body.id !== "string") return errorResponse("Produto inválido.")
      const { error } = await supabase
        .from("products")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("id", body.id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (body.action === "save-category") {
      const name = typeof body.name === "string" ? body.name.trim() : ""
      if (name.length < 2 || name.length > 80) {
        return errorResponse("A categoria precisa ter entre 2 e 80 caracteres.")
      }
      const { data, error } = await supabase
        .from("categories")
        .insert({ name })
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ category: data })
    }

    if (body.action === "delete-category") {
      if (typeof body.id !== "string") return errorResponse("Categoria inválida.")
      const { data: category, error: categoryError } = await supabase
        .from("categories")
        .select("name")
        .eq("id", body.id)
        .single()
      if (categoryError) throw categoryError

      const { count, error: productError } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("category", category.name)
        .eq("active", true)
      if (productError) throw productError
      if (count) return errorResponse("Mova os produtos desta categoria antes de removê-la.")

      const { error } = await supabase.from("categories").delete().eq("id", body.id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (body.action === "save-settings") {
      const backgroundColor =
        typeof body.background_color === "string" ? body.background_color : ""
      const heroImage = typeof body.hero_image === "string" ? body.hero_image.trim() : ""
      const announcement =
        typeof body.announcement === "string" ? body.announcement.trim() : ""
      if (
        !/^#[0-9a-f]{6}$/i.test(backgroundColor) ||
        !isHttpUrl(heroImage) ||
        announcement.length < 3 ||
        announcement.length > 120
      ) {
        return errorResponse("Confira a cor, a imagem da capa e o aviso da loja.")
      }

      const { data: previous, error: readError } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "store")
        .maybeSingle()
      if (readError) throw readError
      const value = {
        ...(previous?.value ?? {}),
        background_color: backgroundColor,
        hero_image: heroImage,
        announcement,
        gateway_enabled: body.gateway_enabled === true,
      }
      const { error } = await supabase
        .from("site_settings")
        .upsert({ key: "store", value, updated_at: new Date().toISOString() })
      if (error) throw error
      return NextResponse.json({ settings: value })
    }

    return errorResponse("Ação administrativa desconhecida.")
  } catch (error) {
    console.error("Falha ao salvar dados administrativos:", error)
    return errorResponse("Não foi possível salvar. Verifique os dados e tente novamente.", 503)
  }
}
