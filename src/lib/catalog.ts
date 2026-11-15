export type Product = {
  id: string
  name: string
  category: string
  description: string
  price: number
  image_url: string
  featured: boolean
  file_path?: string | null
}

export type StoreSettings = {
  background_color: string
  hero_image: string
  announcement: string
  gateway_enabled: boolean
}

export const defaultSettings: StoreSettings = {
  background_color: "#fffaf7",
  hero_image:
    "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=1400&q=85",
  announcement: "Receitas que transformam sua cozinha em um ateliê",
  gateway_enabled: false,
}

export const defaultProducts: Product[] = [
  {
    id: "doces-finos",
    name: "Doces Finos para Encantar",
    category: "Doces finos",
    description:
      "Um guia completo para criar doces delicados, vender com confiança e conquistar clientes desde a primeira encomenda.",
    price: 47,
    image_url:
      "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=85",
    featured: true,
  },
  {
    id: "brigadeiros-gourmet",
    name: "Brigadeiros de Vitrine",
    category: "Brigadeiros",
    description:
      "Massas no ponto perfeito, combinações irresistíveis e acabamento profissional para valorizar cada caixinha.",
    price: 37,
    image_url:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=85",
    featured: false,
  },
  {
    id: "bolos-afetivos",
    name: "Bolos Afetivos & Recheios",
    category: "Bolos",
    description:
      "Receitas testadas, recheios equilibrados e montagem sem mistério para bolos que viram memória boa.",
    price: 57,
    image_url:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=85",
    featured: false,
  },
]

export const defaultCategories = [
  "Todos",
  "Doces finos",
  "Brigadeiros",
  "Bolos",
]
