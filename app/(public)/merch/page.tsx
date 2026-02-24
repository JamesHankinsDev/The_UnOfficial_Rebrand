import type { Metadata } from 'next'
import { getProducts } from '@/lib/shopify'
import { ProductCard } from '@/components/merch/ProductCard'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Merch | The UnOfficial',
  description: 'Rep The UnOfficial. Gear for people who actually watched the tape.',
}

export default async function MerchPage() {
  const products = await getProducts()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <div className="font-mono text-xs tracking-widest text-[#5a5a64] uppercase mb-2">
          The Store
        </div>
        <h1 className="font-mono font-bold text-4xl text-[#e8e6e3] mb-2">Rep the Brand</h1>
        <p className="text-[#8a8a94]">Gear for people who actually watched the tape.</p>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-24">
          <div className="font-mono text-[#5a5a64] text-sm mb-2">Restocking the shelves.</div>
          <p className="text-[#3a3a44] text-xs font-mono">Check back soon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}
