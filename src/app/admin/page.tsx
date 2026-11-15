"use client"

import {
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleDollarSign,
  FileUp,
  Heart,
  LayoutDashboard,
  LogOut,
  PackageOpen,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react"
import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react"
import Link from "next/link"

type AdminProduct = {
  id: string
  name: string
  category: string
  description: string
  price: number
  image_url: string
  featured: boolean
  active: boolean
  file_path: string | null
}

type AdminCategory = { id: string; name: string }
type AdminOrder = {
  id: string
  product_id: string
  amount: number
  customer_name: string
  customer_email: string
  status: string
  created_at: string
  paid_at: string | null
}
type AdminSettings = {
  background_color?: string
  hero_image?: string
  announcement?: string
  gateway_enabled?: boolean
}
type AdminData = {
  products: AdminProduct[]
  categories: AdminCategory[]
  settings: AdminSettings
  orders: AdminOrder[]
}

const emptyData: AdminData = {
  products: [],
  categories: [],
  settings: {},
  orders: [],
}

const blankProduct = {
  id: "",
  name: "",
  category: "",
  description: "",
  price: "",
  image_url: "",
  featured: false,
  file_path: "",
}

const navItems = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "products", label: "Receitas", icon: PackageOpen },
  { id: "categories", label: "Categorias", icon: Tag },
  { id: "orders", label: "Pedidos", icon: CircleDollarSign },
  { id: "settings", label: "Personalizar loja", icon: Settings2 },
] as const

type Section = (typeof navItems)[number]["id"]

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function date(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}

export default function AdminPage() {
  const [data, setData] = useState(emptyData)
  const [authenticated, setAuthenticated] = useState(false)
  const [checking, setChecking] = useState(true)
  const [section, setSection] = useState<Section>("overview")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")
  const [editing, setEditing] = useState<typeof blankProduct | null>(null)
  const [newCategory, setNewCategory] = useState("")

  const loadData = useCallback(async () => {
    const response = await fetch("/api/admin", { cache: "no-store" })
    if (response.status === 401) {
      setAuthenticated(false)
      return
    }
    const result = await response.json()
    if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar o painel.")
    setData(result as AdminData)
    setAuthenticated(true)
  }, [])

  useEffect(() => {
    void Promise.resolve()
      .then(loadData)
      .catch((error: unknown) => {
        setNotice(error instanceof Error ? error.message : "Erro ao conectar ao painel.")
      })
      .finally(() => setChecking(false))
  }, [loadData])

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setNotice("")
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Não foi possível entrar.")
      setPassword("")
      await loadData()
      setNotice("")
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível entrar.")
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" })
    setAuthenticated(false)
    setSection("overview")
  }

  async function sendAction(payload: Record<string, unknown>) {
    setBusy(true)
    setNotice("")
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Não foi possível salvar.")
      await loadData()
      setNotice("Alterações salvas com sucesso.")
      return result
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível salvar.")
      return null
    } finally {
      setBusy(false)
    }
  }

  function editProduct(product?: AdminProduct) {
    setEditing(
      product
        ? {
            id: product.id,
            name: product.name,
            category: product.category,
            description: product.description,
            price: String(product.price),
            image_url: product.image_url,
            featured: product.featured,
            file_path: product.file_path ?? "",
          }
        : { ...blankProduct, category: data.categories[0]?.name ?? "" },
    )
    setNotice("")
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    const result = await sendAction({
      action: "save-product",
      ...editing,
      price: Number(editing.price),
    })
    if (result) setEditing(null)
  }

  async function uploadPdf(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !editing) return
    setBusy(true)
    setNotice("")
    const formData = new FormData()
    formData.set("file", file)
    try {
      const response = await fetch("/api/admin/files", { method: "POST", body: formData })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Não foi possível enviar o PDF.")
      setEditing({ ...editing, file_path: result.file_path as string })
      setNotice("PDF enviado e vinculado à receita.")
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível enviar o PDF.")
    } finally {
      setBusy(false)
      event.target.value = ""
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await sendAction({
      action: "save-settings",
      ...data.settings,
      gateway_enabled: data.settings.gateway_enabled === true,
    })
  }

  if (checking) {
    return <main className="admin-loading"><span className="admin-spinner" /> Preparando seu ateliê...</main>
  }

  if (!authenticated) {
    return (
      <main className="admin-login-page">
        <Link className="admin-back-link" href="/">← Voltar à loja</Link>
        <section className="admin-login-card">
          <div className="admin-login-mark"><span>d.</span></div>
          <span className="admin-overline">ÁREA EXCLUSIVA</span>
          <h1>Seu ateliê,<br /><em>suas regras.</em></h1>
          <p>Entre para cuidar da sua loja Doce Ritual.</p>
          <form onSubmit={login}>
            <label htmlFor="admin-password">Senha de acesso</label>
            <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Digite sua senha" required />
            {notice && <p className="admin-error" role="alert">{notice}</p>}
            <button type="submit" className="admin-primary-button" disabled={busy}>{busy ? "Verificando..." : <>Entrar no painel <ArrowUpRight size={16} /></>}</button>
          </form>
          <div className="admin-login-foot"><ShieldCheck size={14} /> Acesso protegido</div>
        </section>
      </main>
    )
  }

  const activeProducts = data.products.filter((product) => product.active)
  const paidOrders = data.orders.filter((order) => order.status === "paid")
  const totalPaid = paidOrders.reduce((sum, order) => sum + Number(order.amount), 0)

  return (
    <main className="admin-layout">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/"><span className="admin-brand-mark">d.</span><span><strong>doce ritual</strong><small>painel do ateliê</small></span></Link>
        <div className="admin-sidebar-label">GERENCIAR</div>
        <nav className="admin-nav">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={section === id ? "admin-nav-item active" : "admin-nav-item"} onClick={() => { setSection(id); setNotice("") }}>
              <Icon size={17} /> {label} {section === id && <ChevronRight className="nav-chevron" size={14} />}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <div className="admin-help-card"><Heart size={16} /><strong>Vai ficar tudo bem.</strong><span>Seu negócio cresce um doce de cada vez.</span></div>
          <button className="admin-logout" onClick={logout}><LogOut size={15} /> Sair do painel</button>
        </div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar"><div><span className="admin-breadcrumb">DOCE RITUAL</span><ChevronRight size={13} /><span>{navItems.find((item) => item.id === section)?.label}</span></div><Link href="/" className="admin-store-link">Ver minha loja <ArrowUpRight size={14} /></Link></header>
        <div className="admin-content">
          {notice && <div className={notice.includes("sucesso") || notice.includes("vinculado") ? "admin-notice success" : "admin-notice"} role="status">{notice}<button onClick={() => setNotice("")}><X size={14} /></button></div>}

          {section === "overview" && (
            <>
              <div className="admin-page-heading"><div><span className="admin-overline">BOM TER VOCÊ DE VOLTA</span><h1>Seu ateliê está <em>florescendo.</em></h1><p>Aqui está um resuminho carinhoso da sua loja.</p></div><div className="admin-heading-flower">✳</div></div>
              <div className="admin-stat-grid">
                <article className="admin-stat-card"><span>Receitas ativas</span><strong>{activeProducts.length}</strong><small><PackageOpen size={13} /> produtos na vitrine</small><span className="stat-decoration">♡</span></article>
                <article className="admin-stat-card"><span>Pedidos recebidos</span><strong>{data.orders.length}</strong><small><Sparkles size={13} /> últimos 25 pedidos</small><span className="stat-decoration">✳</span></article>
                <article className="admin-stat-card"><span>Vendas confirmadas</span><strong>{money(totalPaid)}</strong><small><CircleDollarSign size={13} /> {paidOrders.length} pagamentos aprovados</small><span className="stat-decoration">♡</span></article>
              </div>
              <div className="admin-overview-grid">
                <section className="admin-panel-card"><div className="admin-panel-heading"><div><h2>Últimos pedidos</h2><p>Um pouquinho do que está acontecendo.</p></div><button onClick={() => setSection("orders")}>Ver todos <ChevronRight size={14} /></button></div>
                  {data.orders.length === 0 ? <div className="admin-empty"><PackageOpen size={25} /><span>Seus primeiros pedidos vão aparecer aqui.</span></div> : <div className="admin-mini-orders">{data.orders.slice(0, 5).map((order) => <div key={order.id}><span className="order-mini-icon"><Heart size={14} /></span><span className="order-mini-name"><strong>{order.customer_name}</strong><small>{date(order.created_at)}</small></span><strong className="order-mini-price">{money(Number(order.amount))}</strong><span className={`order-status ${order.status}`}>{order.status === "paid" ? "Pago" : order.status === "pending" ? "Aguardando" : order.status}</span></div>)}</div>}
                </section>
                <section className="admin-panel-card admin-shortcuts"><div className="admin-panel-heading"><div><h2>Atalhos doces</h2><p>O que vamos fazer hoje?</p></div><Sparkles size={18} /></div><button onClick={() => { editProduct(); setSection("products") }}><span><Plus size={15} /></span><strong>Adicionar receita</strong><ChevronRight size={15} /></button><button onClick={() => setSection("settings")}><span><Settings2 size={15} /></span><strong>Personalizar minha loja</strong><ChevronRight size={15} /></button><button onClick={() => setSection("categories")}><span><Tag size={15} /></span><strong>Criar uma categoria</strong><ChevronRight size={15} /></button></section>
              </div>
              <div className="admin-footer-note"><Heart size={13} /> Um lembrete: você está construindo algo muito especial.</div>
            </>
          )}

          {section === "products" && (
            <>
              <div className="admin-page-heading"><div><span className="admin-overline">SUA VITRINE DIGITAL</span><h1>Receitas que <em>encantam.</em></h1><p>Crie, edite e escolha o PDF que será entregue após a compra.</p></div><button className="admin-primary-button heading-action" onClick={() => editProduct()}><Plus size={16} /> Nova receita</button></div>
              <div className="admin-product-list">{data.products.map((product) => <article className={`admin-product-row ${!product.active ? "inactive" : ""}`} key={product.id}><div className="admin-product-thumb" style={{ backgroundImage: `url("${product.image_url}")` }} /><div className="admin-product-details"><div className="admin-product-meta"><span>{product.category}</span><span className={product.active ? "product-active" : "product-inactive"}>{product.active ? "Na vitrine" : "Oculto"}</span></div><h2>{product.name}</h2><p>{product.description}</p><small>{product.file_path ? <><Check size={12} /> PDF vinculado</> : <><FileUp size={12} /> PDF ainda não enviado</>}</small></div><strong className="admin-product-price">{money(Number(product.price))}</strong><div className="admin-product-actions"><button onClick={() => editProduct(product)}>Editar</button>{product.active && <button className="delete-action" onClick={() => void sendAction({ action: "delete-product", id: product.id })} aria-label={`Ocultar ${product.name}`}><Trash2 size={15} /></button>}</div></article>)}</div>
            </>
          )}

          {section === "categories" && (
            <>
              <div className="admin-page-heading"><div><span className="admin-overline">ORGANIZE SEU CATÁLOGO</span><h1>Cada doce no seu <em>cantinho.</em></h1><p>Categorias ajudam suas clientes a encontrar a receita perfeita.</p></div></div>
              <section className="admin-panel-card category-manager"><h2>Suas categorias</h2><p>Uma categoria só pode ser removida quando não tiver receitas ativas.</p><div className="admin-category-list">{data.categories.map((item) => <div className="admin-category-row" key={item.id}><span><Tag size={15} />{item.name}</span><button onClick={() => void sendAction({ action: "delete-category", id: item.id })} aria-label={`Remover categoria ${item.name}`}><Trash2 size={15} /></button></div>)}</div><form className="new-category-form" onSubmit={(event) => { event.preventDefault(); void sendAction({ action: "save-category", name: newCategory }).then((result) => { if (result) setNewCategory("") }) }}><input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="Ex.: Pães de mel" minLength={2} maxLength={80} required /><button className="admin-primary-button" disabled={busy}><Plus size={15} /> Adicionar categoria</button></form></section>
            </>
          )}

          {section === "orders" && (
            <>
              <div className="admin-page-heading"><div><span className="admin-overline">SEU NEGÓCIO ACONTECENDO</span><h1>Pedidos com <em>carinho.</em></h1><p>Acompanhe os pedidos mais recentes da sua loja.</p></div></div>
              <section className="admin-panel-card orders-table-wrap"><div className="admin-table-heading"><h2>Últimos pedidos</h2><span>até 25 registros recentes</span></div>{data.orders.length === 0 ? <div className="admin-empty"><PackageOpen size={25} /><span>Nenhum pedido por aqui ainda.</span></div> : <div className="admin-orders-table"><div className="orders-table-head"><span>CLIENTE</span><span>VALOR</span><span>DATA</span><span>STATUS</span></div>{data.orders.map((order) => <div className="orders-table-row" key={order.id}><span><strong>{order.customer_name}</strong><small>{order.customer_email}</small></span><strong>{money(Number(order.amount))}</strong><span>{date(order.created_at)}</span><span className={`order-status ${order.status}`}>{order.status === "paid" ? "Confirmado" : order.status === "pending" ? "Aguardando" : order.status}</span></div>)}</div>}</section>
            </>
          )}

          {section === "settings" && (
            <>
              <div className="admin-page-heading"><div><span className="admin-overline">SUA MARCA, SEU JEITO</span><h1>Deixe a loja com a <em>sua cara.</em></h1><p>Pequenos detalhes que tornam a experiência única.</p></div></div>
              <form className="admin-panel-card settings-form" onSubmit={saveSettings}>
                <div className="settings-title"><span><Sparkles size={17} /></span><div><h2>Identidade da loja</h2><p>Personalize a capa e o tom de fundo da vitrine.</p></div></div>
                <label>Mensagem no topo<input value={data.settings.announcement ?? ""} onChange={(event) => setData({ ...data, settings: { ...data.settings, announcement: event.target.value } })} placeholder="Uma frase curta para receber suas clientes" maxLength={120} required /></label>
                <label>Imagem principal (URL)<input type="url" value={data.settings.hero_image ?? ""} onChange={(event) => setData({ ...data, settings: { ...data.settings, hero_image: event.target.value } })} placeholder="https://..." required /></label>
                <label className="color-control">Cor de fundo <span className="color-control-input"><input type="color" value={data.settings.background_color ?? "#fffaf7"} onChange={(event) => setData({ ...data, settings: { ...data.settings, background_color: event.target.value } })} /><code>{data.settings.background_color ?? "#fffaf7"}</code></span></label>
                <div className="settings-divider" />
                <div className="settings-title"><span><CircleDollarSign size={17} /></span><div><h2>Pagamento PIX</h2><p>O checkout só funciona quando a integração também estiver configurada no Railway.</p></div></div>
                <label className="gateway-toggle"><span><strong>Ativar pagamentos PIX</strong><small>O status é confirmado consultando a API NXGATE.</small></span><input type="checkbox" checked={data.settings.gateway_enabled === true} onChange={(event) => setData({ ...data, settings: { ...data.settings, gateway_enabled: event.target.checked } })} /><span className="toggle-track" /></label>
                <div className="gateway-warning"><ShieldCheck size={16} /><span>Sem webhook: a loja consulta o status diretamente na NXGATE e só libera o PDF após validar valor e transação.</span></div>
                <button className="admin-primary-button settings-save" disabled={busy}>{busy ? "Salvando..." : <><Check size={16} /> Salvar personalização</>}</button>
              </form>
            </>
          )}
        </div>
      </section>

      {editing && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null) }}><section className="admin-edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-title"><header><div><span className="admin-overline">NO CAPRICHO</span><h2 id="edit-title">{editing.id ? "Editar receita" : "Nova receita"}</h2></div><button onClick={() => setEditing(null)} aria-label="Fechar"><X size={19} /></button></header><form onSubmit={saveProduct}><label>Nome da receita<input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} required minLength={2} maxLength={120} /></label><div className="edit-form-split"><label>Categoria<select value={editing.category} onChange={(event) => setEditing({ ...editing, category: event.target.value })} required><option value="" disabled>Escolha uma categoria</option>{data.categories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label><label>Preço (R$)<input type="number" min="0.01" max="10000" step="0.01" value={editing.price} onChange={(event) => setEditing({ ...editing, price: event.target.value })} required /></label></div><label>Descrição<textarea value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} minLength={10} maxLength={2000} rows={4} required /></label><label>Imagem de capa (URL)<input type="url" value={editing.image_url} onChange={(event) => setEditing({ ...editing, image_url: event.target.value })} placeholder="https://..." required /></label><div className="pdf-upload-box"><div><FileUp size={17} /><span><strong>PDF da receita</strong><small>{editing.file_path ? "Arquivo pronto para entrega" : "Até 10 MB · acesso privado"}</small></span></div><label className="upload-button">{busy ? "Enviando..." : editing.file_path ? "Trocar PDF" : "Enviar PDF"}<input type="file" accept="application/pdf,.pdf" onChange={uploadPdf} disabled={busy} /></label></div><label className="featured-checkbox"><input type="checkbox" checked={editing.featured} onChange={(event) => setEditing({ ...editing, featured: event.target.checked })} /><span>Destacar como queridinho na vitrine</span></label>{notice && <p className={notice.includes("vinculado") ? "admin-form-success" : "admin-error"} role="status">{notice}</p>}<footer><button type="button" className="admin-cancel-button" onClick={() => setEditing(null)}>Cancelar</button><button className="admin-primary-button" disabled={busy}>{busy ? "Salvando..." : <><Check size={15} /> Salvar receita</>}</button></footer></form></section></div>}
    </main>
  )
}
