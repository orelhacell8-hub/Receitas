"use client"

import { createBrowserClient } from "@supabase/ssr"
import Image from "next/image"
import {
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Heart,
  LockKeyhole,
  Menu,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from "lucide-react"
import { FormEvent, useEffect, useMemo, useState } from "react"
import {
  defaultCategories,
  defaultProducts,
  defaultSettings,
  Product,
  StoreSettings,
} from "@/lib/catalog"

type StoreData = {
  products: Product[]
  categories: string[]
  settings: StoreSettings
  configured: boolean
}

type CheckoutOrder = {
  id: string
  pixCode: string
  qrCode: string
  status: "pending" | "paid"
  downloadUrl?: string
}

type Dialog = "checkout" | "account" | null

const initialStore: StoreData = {
  products: defaultProducts,
  categories: defaultCategories,
  settings: defaultSettings,
  configured: false,
}

function currency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export default function Storefront() {
  const [store, setStore] = useState(initialStore)
  const [category, setCategory] = useState("Todos")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [order, setOrder] = useState<CheckoutOrder | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")
  const [authMode, setAuthMode] = useState<"login" | "register">("login")
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch("/api/store")
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar a loja.")
        return response.json() as Promise<StoreData>
      })
      .then(setStore)
      .catch((error: unknown) => {
        console.error(error)
        setNotice("Não foi possível atualizar o catálogo. Tente novamente.")
      })
  }, [])

  useEffect(() => {
    const savedOrderId = window.localStorage.getItem("doce-ritual-order")
    if (!savedOrderId) return

    fetch(`/api/orders/${savedOrderId}/status`, { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 404) {
          window.localStorage.removeItem("doce-ritual-order")
          return null
        }
        if (!response.ok) throw new Error("Não foi possível recuperar seu pedido.")
        return (await response.json()) as CheckoutOrder
      })
      .then((savedOrder) => {
        if (savedOrder) {
          setOrder(savedOrder)
          setDialog("checkout")
        }
      })
      .catch((error: unknown) => console.error("Falha ao recuperar pedido:", error))
  }, [])

  useEffect(() => {
    if (!order || order.status === "paid") return

    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/orders/${order.id}/status`, {
          cache: "no-store",
        })
        if (!response.ok) return
        const updated = (await response.json()) as CheckoutOrder
        setOrder(updated)
      } catch (error) {
        console.error("Falha ao consultar pagamento:", error)
      }
    }, 5000)

    return () => window.clearInterval(timer)
  }, [order])

  const visibleProducts = useMemo(
    () =>
      category === "Todos"
        ? store.products
        : store.products.filter((product) => product.category === category),
    [category, store.products],
  )

  function openCheckout(product: Product) {
    setSelectedProduct(product)
    setOrder(null)
    setNotice("")
    setDialog("checkout")
  }

  async function submitCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedProduct) return

    setBusy(true)
    setNotice("")
    const formData = new FormData(event.currentTarget)
    const checkoutKeyName = `doce-ritual-checkout:${selectedProduct.id}`
    const checkoutKey =
      window.localStorage.getItem(checkoutKeyName) ?? window.crypto.randomUUID()
    window.localStorage.setItem(checkoutKeyName, checkoutKey)

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProduct.id,
          name: formData.get("name"),
          email: formData.get("email"),
          document: formData.get("document"),
          checkoutKey,
        }),
      })
      const result = (await response.json()) as CheckoutOrder & {
        error?: string
      }
      if (!response.ok) throw new Error(result.error ?? "Não foi possível iniciar o pagamento.")
      window.localStorage.removeItem(checkoutKeyName)
      setOrder(result)
      window.localStorage.setItem("doce-ritual-order", result.id)
      if (result.status === "paid") {
        const statusResponse = await fetch(`/api/orders/${result.id}/status`, {
          cache: "no-store",
        })
        if (statusResponse.ok) {
          setOrder((await statusResponse.json()) as CheckoutOrder)
        }
      }
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Não foi possível iniciar o pagamento.",
      )
    } finally {
      setBusy(false)
    }
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setNotice("")
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) {
      setNotice("O acesso à conta será ativado quando o Supabase estiver configurado.")
      setBusy(false)
      return
    }

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get("email") ?? "")
    const password = String(formData.get("password") ?? "")
    const supabase = createBrowserClient(url, anonKey)
    try {
      const result =
        authMode === "login"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({
              email,
              password,
              options: {
                data: { full_name: String(formData.get("name") ?? "") },
              },
            })

      if (result.error) {
        setNotice(result.error.message)
      } else {
        setNotice(
          authMode === "login"
            ? "Você entrou na sua conta."
            : "Conta criada! Confira seu e-mail para confirmar o cadastro.",
        )
        if (authMode === "login") window.setTimeout(() => setDialog(null), 900)
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível acessar sua conta.")
    } finally {
      setBusy(false)
    }
  }

  async function copyPixCode() {
    if (!order?.pixCode) return
    try {
      await navigator.clipboard.writeText(order.pixCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch (error) {
      console.error("Não foi possível copiar o código PIX:", error)
      setNotice("Não foi possível copiar automaticamente. Selecione o código PIX.")
    }
  }

  return (
    <main
      className="store-shell"
      style={{ backgroundColor: store.settings.background_color }}
    >
      <div className="announcement">
        <Sparkles size={14} />
        <span>{store.settings.announcement}</span>
        <ArrowRight size={14} />
      </div>

      <header className="site-header">
        <a className="brand" href="#" aria-label="Doce Ritual, início">
          <span className="brand-mark">d.</span>
          <span className="brand-copy">
            <strong>doce ritual</strong>
            <small>receitas com afeto</small>
          </span>
        </a>
        <button
          className="mobile-menu-button"
          aria-label="Abrir menu"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        <nav className={menuOpen ? "main-nav is-open" : "main-nav"}>
          <a href="#colecao" onClick={() => setMenuOpen(false)}>
            Receitas
          </a>
          <a href="#sobre" onClick={() => setMenuOpen(false)}>
            Nossa história
          </a>
          <a href="#depoimentos" onClick={() => setMenuOpen(false)}>
            Depoimentos
          </a>
        </nav>
        <button
          className="account-button"
          onClick={() => {
            setNotice("")
            setDialog("account")
          }}
        >
          Minha conta <ArrowRight size={15} />
        </button>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-line" />
            UM DOCE COMEÇO PARA VOCÊ
          </div>
          <h1>
            Seu talento merece
            <br />
            <em>ser saboreado.</em>
          </h1>
          <p>
            Receitas testadas, ensinadas com carinho e pensadas para transformar
            sua cozinha em um negócio cheio de possibilidades.
          </p>
          <div className="hero-actions">
            <a className="button-primary" href="#colecao">
              Encontrar minha receita <ArrowRight size={17} />
            </a>
            <div className="hero-rating">
              <div className="rating-stars" aria-label="5 de 5 estrelas">
                <Star /><Star /><Star /><Star /><Star />
              </div>
              <span>mais de 2 mil alunas felizes</span>
            </div>
          </div>
          <div className="hero-note">
            <span className="note-heart"><Heart size={16} fill="currentColor" /></span>
            <span>Feito para quem acredita que toda grande história começa na cozinha.</span>
          </div>
        </div>

        <div className="hero-art">
          <div
            className="hero-photo"
            role="img"
            aria-label="Sobremesa artesanal com frutas vermelhas"
            style={{ backgroundImage: `url("${store.settings.hero_image}")` }}
          />
          <div className="photo-stamp">
            <span>feito</span>
            <strong>com<br />afeto</strong>
          </div>
          <div className="floating-card">
            <span className="floating-icon"><Sparkles size={17} /></span>
            <span><strong>Receitas de verdade</strong><small>Testadas na nossa cozinha</small></span>
            <Check size={17} className="floating-check" />
          </div>
          <div className="hero-art-caption">Pequenos detalhes. Grandes momentos.</div>
        </div>
      </section>

      <section className="promise-strip" aria-label="Vantagens">
        <div><ShieldCheck /><span><strong>Compra segura</strong><small>Seus dados protegidos</small></span></div>
        <div><Sparkles /><span><strong>Acesso imediato</strong><small>Receba após a confirmação</small></span></div>
        <div><Heart /><span><strong>Feito com carinho</strong><small>Receitas testadas de verdade</small></span></div>
      </section>

      <section className="collection-section" id="colecao">
        <div className="section-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" /> A COLEÇÃO</div>
            <h2>Um universo de <em>delícias</em></h2>
            <p>Escolha sua próxima descoberta — o primeiro passo é o mais gostoso.</p>
          </div>
          <a className="text-link" href="#sobre">Conheça nosso jeito <ArrowRight size={16} /></a>
        </div>

        <div className="category-row" role="tablist" aria-label="Categorias">
          {store.categories.map((item) => (
            <button
              key={item}
              className={category === item ? "category-chip active" : "category-chip"}
              onClick={() => setCategory(item)}
              role="tab"
              aria-selected={category === item}
            >
              {item}
            </button>
          ))}
          <span className="collection-count">{visibleProducts.length} receitas</span>
        </div>

        <div className="product-grid">
          {visibleProducts.map((product, index) => (
            <article className="product-card" key={product.id}>
              <div
                className={`product-image product-image-${index % 3}`}
                style={{ backgroundImage: `url("${product.image_url}")` }}
                role="img"
                aria-label={product.name}
              >
                {product.featured && <span className="product-ribbon"><Sparkles size={12} /> QUERIDINHO</span>}
                <button className="favorite-button" aria-label={`Favoritar ${product.name}`}>
                  <Heart size={17} />
                </button>
              </div>
              <div className="product-info">
                <div className="product-meta">
                  <span>{product.category}</span>
                  <span className="product-rating"><Star size={12} fill="currentColor" /> 4,9</span>
                </div>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <div className="product-bottom">
                  <div className="price-block"><small>a partir de</small><strong>{currency(product.price)}</strong></div>
                  <button className="product-buy" onClick={() => openCheckout(product)} aria-label={`Comprar ${product.name}`}>
                    <ArrowRight size={19} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        {visibleProducts.length === 0 && (
          <div className="empty-products">Novas receitas dessa categoria estão chegando. 💗</div>
        )}
      </section>

      <section className="story-section" id="sobre">
        <div className="story-mark">d.</div>
        <div className="story-content">
          <div className="eyebrow"><span className="eyebrow-line" /> MAIS QUE UMA RECEITA</div>
          <h2>O segredo nunca foi só o <em>açúcar.</em></h2>
          <p>
            É sobre acreditar no que suas mãos podem criar. Cada receita do Doce
            Ritual nasceu de muitos testes, mesas compartilhadas e vontade de
            ensinar sem complicar.
          </p>
          <a href="#colecao" className="text-link">Descobrir as receitas <ArrowRight size={16} /></a>
        </div>
        <div className="story-quote">
          <span className="quote-mark">“</span>
          <p>Comecei vendendo para as amigas. Hoje, minha cozinha é meu lugar favorito.</p>
          <small>— Camila, aluna desde 2024</small>
        </div>
      </section>

      <section className="testimonial-section" id="depoimentos">
        <div className="eyebrow"><span className="eyebrow-line" /> QUEM JÁ COMEÇOU</div>
        <h2>Histórias que dão <em>água na boca.</em></h2>
        <div className="testimonial-grid">
          <blockquote><div className="rating-stars"><Star /><Star /><Star /><Star /><Star /></div><p>“Eu tinha medo de cobrar. Com as receitas e as dicas, fiz minhas primeiras encomendas em uma semana!”</p><footer><span className="avatar avatar-one">M</span><span><strong>Marina Lopes</strong><small>Aluna de Doces Finos</small></span></footer></blockquote>
          <blockquote><div className="rating-stars"><Star /><Star /><Star /><Star /><Star /></div><p>“Tudo explicado com muito carinho. Finalmente achei um brigadeiro que fica perfeito toda vez.”</p><footer><span className="avatar avatar-two">J</span><span><strong>Juliana Santos</strong><small>Aluna de Brigadeiros</small></span></footer></blockquote>
          <blockquote><div className="rating-stars"><Star /><Star /><Star /><Star /><Star /></div><p>“O material é lindo e prático. Já recuperei o valor do curso com a primeira encomenda de bolos.”</p><footer><span className="avatar avatar-three">A</span><span><strong>Ana Clara</strong><small>Aluna de Bolos</small></span></footer></blockquote>
        </div>
      </section>

      <section className="closing-banner">
        <div><span className="closing-flower">✳</span><h2>Seu próximo capítulo<br />pode ser <em>bem docinho.</em></h2></div>
        <a className="button-light" href="#colecao">Escolher minha receita <ArrowRight size={17} /></a>
        <span className="closing-scribble">com carinho, sempre ♡</span>
      </section>

      <footer className="site-footer">
        <a className="brand" href="#" aria-label="Doce Ritual, início">
          <span className="brand-mark">d.</span><span className="brand-copy"><strong>doce ritual</strong><small>receitas com afeto</small></span>
        </a>
        <p>Feito com afeto, para adoçar seus planos.</p>
        <div className="footer-links"><a href="#colecao">Receitas</a><a href="/admin">Painel</a><a href="mailto:oi@doceritual.com.br">Contato</a></div>
        <small className="copyright">© Doce Ritual. Feito com carinho.</small>
      </footer>

      {notice && !dialog && <div className="toast-message" role="status">{notice}<button onClick={() => setNotice("")}><X size={15} /></button></div>}

      {dialog && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            setDialog(null)
            setNotice("")
          }
        }}>
          <section className="checkout-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <button className="modal-close" onClick={() => { setDialog(null); setNotice("") }} aria-label="Fechar">
              <X size={20} />
            </button>
            {dialog === "checkout" ? (
              order ? (
                <div className="payment-state">
                  {order.status === "paid" ? (
                    <>
                      <div className="success-icon"><Check size={29} /></div>
                      <span className="modal-kicker">PAGAMENTO CONFIRMADO</span>
                      <h2 id="modal-title">Sua receita já é <em>sua!</em></h2>
                      <p>Que alegria ter você por aqui. Seu material está pronto para baixar.</p>
                      {order.downloadUrl ? <a className="button-primary full-button" href={order.downloadUrl} target="_blank" rel="noreferrer">Baixar meu PDF <ArrowRight size={17} /></a> : <p className="notice-box">O PDF ainda não foi adicionado pelo painel da loja.</p>}
                    </>
                  ) : (
                    <>
                      <span className="modal-kicker">SÓ FALTA UM PASSINHO</span>
                      <h2 id="modal-title">Pague com <em>PIX.</em></h2>
                      <p>Escaneie o QR Code ou copie o código abaixo. Esta tela confirma o pagamento automaticamente.</p>
                      {order.qrCode && <Image className="pix-qr" width={180} height={180} unoptimized src={order.qrCode.startsWith("data:") ? order.qrCode : `data:image/png;base64,${order.qrCode}`} alt="QR Code PIX para pagamento" />}
                      <div className="pix-code-row"><span>{order.pixCode}</span><button onClick={copyPixCode} aria-label="Copiar código PIX">{copied ? <Check size={17} /> : <Copy size={17} />}</button></div>
                      <div className="waiting-indicator"><span className="pulse-dot" /> Aguardando a confirmação do pagamento</div>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div className="modal-topline"><span className="modal-kicker">CHECKOUT SEGURO</span><span className="secure-label"><LockKeyhole size={13} /> ambiente protegido</span></div>
                  <h2 id="modal-title">Quase sentindo o <em>cheirinho.</em></h2>
                  {selectedProduct && <div className="order-summary"><span className="summary-thumb" style={{ backgroundImage: `url("${selectedProduct.image_url}")` }} /><span className="summary-copy"><strong>{selectedProduct.name}</strong><small>Material digital · acesso após confirmação</small></span><strong className="summary-price">{currency(selectedProduct.price)}</strong></div>}
                  <form className="checkout-form" onSubmit={submitCheckout}>
                    <label>Seu nome<input name="name" autoComplete="name" placeholder="Como podemos te chamar?" required minLength={2} /></label>
                    <label>Seu melhor e-mail<input name="email" type="email" autoComplete="email" placeholder="voce@email.com" required /></label>
                    <label>CPF do pagador<input name="document" inputMode="numeric" placeholder="Somente números" required minLength={11} maxLength={14} /></label>
                    {notice && <div className="form-error" role="alert">{notice}<button className="reset-checkout" type="button" onClick={() => { window.localStorage.removeItem(`doce-ritual-checkout:${selectedProduct?.id}`); setNotice("") }}>Iniciar uma nova tentativa</button></div>}
                    <button className="button-primary full-button" disabled={busy}>{busy ? "Preparando pagamento..." : <>Gerar PIX e garantir minha receita <ArrowRight size={17} /></>}</button>
                    <p className="checkout-reassurance"><ShieldCheck size={14} /> Pagamento processado com segurança. PDF liberado após confirmação.</p>
                  </form>
                </>
              )
            ) : (
              <>
                <div className="modal-topline"><span className="modal-kicker">BEM-VINDA À MESA</span><span className="secure-label"><Heart size={13} /> que bom ter você</span></div>
                <h2 id="modal-title">{authMode === "login" ? <>Que bom te <em>ver.</em></> : <>Vamos começar essa <em>história?</em></>}</h2>
                <p className="account-intro">Entre para acompanhar suas compras ou crie sua conta em instantes.</p>
                <form className="checkout-form" onSubmit={submitAuth}>
                  {authMode === "register" && <label>Seu nome<input name="name" autoComplete="name" placeholder="Seu nome" required minLength={2} /></label>}
                  <label>E-mail<input name="email" type="email" autoComplete="email" placeholder="voce@email.com" required /></label>
                  <label>Senha<input name="password" type="password" autoComplete={authMode === "login" ? "current-password" : "new-password"} placeholder="Mínimo de 6 caracteres" required minLength={6} /></label>
                  {notice && <p className={notice.includes("criada") || notice.includes("entrou") ? "form-success" : "form-error"} role="status">{notice}</p>}
                  <button className="button-primary full-button" disabled={busy}>{busy ? "Só um instante..." : authMode === "login" ? "Entrar na minha conta" : "Criar minha conta"} <ArrowRight size={17} /></button>
                </form>
                <button className="switch-auth" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setNotice("") }}>
                  {authMode === "login" ? "Ainda não tem conta? Criar agora" : "Já tem conta? Entrar"}
                </button>
                <div className="auth-benefits"><Check size={14} /> Acesso aos materiais <Check size={14} /> Histórico de compras</div>
              </>
            )}
          </section>
        </div>
      )}
      <a className="back-to-top" href="#" aria-label="Voltar ao início"><ChevronDown size={18} /></a>
    </main>
  )
}
