import { connection, NextResponse } from "next/server"
import {
  defaultCategories,
  defaultProducts,
  defaultSettings,
} from "@/lib/catalog"
import {
  createSupabaseAdmin,
  isSupabaseConfigured,
} from "@/lib/supabase-admin"

export async function GET() {
  await connection()

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      products: defaultProducts,
      categories: defaultCategories,
      settings: defaultSettings,
      configured: false,
    })
  }

  try {
    const supabase = createSupabaseAdmin()
    const [productsResult, categoriesResult, settingsResult] =
      await Promise.all([
        supabase
          .from("products")
          .select("id,name,category,description,price,image_url,featured")
          .eq("active", true)
          .order("created_at", { ascending: false }),
        supabase.from("categories").select("name").order("name"),
        supabase
          .from("site_settings")
          .select("value")
          .eq("key", "store")
          .maybeSingle(),
      ])

    if (productsResult.error) throw productsResult.error
    if (categoriesResult.error) throw categoriesResult.error
    if (settingsResult.error) throw settingsResult.error

    return NextResponse.json({
      products: productsResult.data,
      categories: [
        "Todos",
        ...(categoriesResult.data?.map((category) => category.name) ?? []),
      ],
      settings: { ...defaultSettings, ...(settingsResult.data?.value ?? {}) },
      configured: true,
    })
  } catch (error) {
    console.error("Falha ao carregar catálogo:", error)
    return NextResponse.json(
      { error: "Não foi possível carregar a loja agora." },
      { status: 500 },
    )
  }
}
