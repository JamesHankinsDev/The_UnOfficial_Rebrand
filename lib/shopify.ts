const SHOPIFY_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN
const SHOPIFY_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN
const SHOPIFY_COLLECTION_ID = process.env.NEXT_PUBLIC_SHOPIFY_COLLECTION_ID

export interface ShopifyImage {
  url: string
  altText: string | null
}

export interface ShopifyVariant {
  id: string
  title: string
  availableForSale: boolean
  priceV2: { amount: string; currencyCode: string }
  image: ShopifyImage | null
}

export interface ShopifyProduct {
  id: string
  title: string
  handle: string
  description: string
  featuredImage: ShopifyImage | null
  images: ShopifyImage[]
  variants: ShopifyVariant[]
  onlineStoreUrl: string | null
}

async function shopifyFetch(queryStr: string, variables?: Record<string, unknown>) {
  if (!SHOPIFY_DOMAIN || !SHOPIFY_TOKEN) return null

  const response = await fetch(`https://${SHOPIFY_DOMAIN}/api/2024-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': SHOPIFY_TOKEN,
    },
    body: JSON.stringify({ query: queryStr, variables }),
    next: { revalidate: 300 },
  })

  const json = await response.json()
  return json.data
}

const PRODUCT_FIELDS = `
  id
  title
  handle
  description
  onlineStoreUrl
  featuredImage { url altText }
  images(first: 20) {
    edges {
      node { url altText }
    }
  }
  variants(first: 50) {
    edges {
      node {
        id
        title
        availableForSale
        priceV2 { amount currencyCode }
        image { url altText }
      }
    }
  }
`

function mapProducts(edges: { node: Record<string, unknown> }[]): ShopifyProduct[] {
  return edges.map(edge => ({
    ...edge.node,
    images: (edge.node.images as { edges: { node: ShopifyImage }[] }).edges.map(
      (img: { node: ShopifyImage }) => img.node
    ),
    variants: (edge.node.variants as { edges: { node: unknown }[] }).edges.map(
      (v: { node: unknown }) => v.node as ShopifyVariant
    ),
  } as ShopifyProduct))
}

export async function getProducts(): Promise<ShopifyProduct[]> {
  // Fetch from the configured collection if an ID is set, otherwise all products
  if (SHOPIFY_COLLECTION_ID) {
    const gid = `gid://shopify/Collection/${SHOPIFY_COLLECTION_ID}`
    const q = `
      query GetCollection($id: ID!) {
        collection(id: $id) {
          products(first: 20) {
            edges { node { ${PRODUCT_FIELDS} } }
          }
        }
      }
    `
    try {
      const data = await shopifyFetch(q, { id: gid })
      if (!data?.collection?.products?.edges) return []
      return mapProducts(data.collection.products.edges)
    } catch {
      return []
    }
  }

  const q = `
    query GetProducts {
      products(first: 20) {
        edges { node { ${PRODUCT_FIELDS} } }
      }
    }
  `
  try {
    const data = await shopifyFetch(q)
    if (!data?.products?.edges) return []
    return mapProducts(data.products.edges)
  } catch {
    return []
  }
}

export function buildCheckoutUrl(variantId: string): string {
  if (!SHOPIFY_DOMAIN) return '#'
  const cleanId = variantId.replace('gid://shopify/ProductVariant/', '')
  return `https://${SHOPIFY_DOMAIN}/cart/${cleanId}:1`
}

// ---------------------------------------------------------------------------
// Cart API (Storefront API Cart mutations – client-side)
// ---------------------------------------------------------------------------

export interface CartLineItem {
  id: string
  quantity: number
  merchandise: {
    id: string
    title: string
    product: {
      title: string
      featuredImage: ShopifyImage | null
    }
    priceV2: { amount: string; currencyCode: string }
  }
}

export interface ShopifyCart {
  id: string
  checkoutUrl: string
  totalQuantity: number
  cost: {
    subtotalAmount: { amount: string; currencyCode: string }
    totalAmount: { amount: string; currencyCode: string }
  }
  lines: CartLineItem[]
}

/** Client-side fetch (no ISR cache) for cart mutations */
async function shopifyCartFetch(queryStr: string, variables?: Record<string, unknown>) {
  if (!SHOPIFY_DOMAIN || !SHOPIFY_TOKEN) return null

  const response = await fetch(`https://${SHOPIFY_DOMAIN}/api/2024-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': SHOPIFY_TOKEN,
    },
    body: JSON.stringify({ query: queryStr, variables }),
  })

  const json = await response.json()
  if (json.errors) {
    console.error('Shopify cart error:', json.errors)
    throw new Error(json.errors[0]?.message || 'Shopify cart operation failed')
  }
  return json.data
}

const CART_FIELDS = `
  id
  checkoutUrl
  totalQuantity
  cost {
    subtotalAmount { amount currencyCode }
    totalAmount { amount currencyCode }
  }
  lines(first: 50) {
    edges {
      node {
        id
        quantity
        merchandise {
          ... on ProductVariant {
            id
            title
            product {
              title
              featuredImage { url altText }
            }
            priceV2 { amount currencyCode }
          }
        }
      }
    }
  }
`

function mapCart(cartData: Record<string, unknown>): ShopifyCart {
  const lines = (cartData.lines as { edges: { node: CartLineItem }[] }).edges.map(
    (edge) => edge.node
  )
  return { ...cartData, lines } as unknown as ShopifyCart
}

export async function createCart(variantId: string, quantity: number = 1): Promise<ShopifyCart | null> {
  const mutation = `
    mutation CartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart { ${CART_FIELDS} }
        userErrors { field message }
      }
    }
  `
  const data = await shopifyCartFetch(mutation, {
    input: { lines: [{ merchandiseId: variantId, quantity }] },
  })
  if (!data?.cartCreate?.cart) return null
  return mapCart(data.cartCreate.cart)
}

export async function getCart(cartId: string): Promise<ShopifyCart | null> {
  const query = `
    query GetCart($cartId: ID!) {
      cart(id: $cartId) { ${CART_FIELDS} }
    }
  `
  const data = await shopifyCartFetch(query, { cartId })
  if (!data?.cart) return null
  return mapCart(data.cart)
}

export async function addToCart(cartId: string, variantId: string, quantity: number = 1): Promise<ShopifyCart | null> {
  const mutation = `
    mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart { ${CART_FIELDS} }
        userErrors { field message }
      }
    }
  `
  const data = await shopifyCartFetch(mutation, {
    cartId,
    lines: [{ merchandiseId: variantId, quantity }],
  })
  if (!data?.cartLinesAdd?.cart) return null
  return mapCart(data.cartLinesAdd.cart)
}

export async function updateCartLine(cartId: string, lineId: string, quantity: number): Promise<ShopifyCart | null> {
  const mutation = `
    mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) {
        cart { ${CART_FIELDS} }
        userErrors { field message }
      }
    }
  `
  const data = await shopifyCartFetch(mutation, {
    cartId,
    lines: [{ id: lineId, quantity }],
  })
  if (!data?.cartLinesUpdate?.cart) return null
  return mapCart(data.cartLinesUpdate.cart)
}

export async function removeCartLine(cartId: string, lineId: string): Promise<ShopifyCart | null> {
  const mutation = `
    mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart { ${CART_FIELDS} }
        userErrors { field message }
      }
    }
  `
  const data = await shopifyCartFetch(mutation, {
    cartId,
    lineIds: [lineId],
  })
  if (!data?.cartLinesRemove?.cart) return null
  return mapCart(data.cartLinesRemove.cart)
}
