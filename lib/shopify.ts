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
}

export interface ShopifyProduct {
  id: string
  title: string
  handle: string
  description: string
  featuredImage: ShopifyImage | null
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
  variants(first: 10) {
    edges {
      node {
        id
        title
        availableForSale
        priceV2 { amount currencyCode }
      }
    }
  }
`

function mapProducts(edges: { node: Record<string, unknown> }[]): ShopifyProduct[] {
  return edges.map(edge => ({
    ...edge.node,
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
