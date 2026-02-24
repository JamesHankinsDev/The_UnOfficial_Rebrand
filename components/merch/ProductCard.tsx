'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { ShopifyProduct, ShopifyVariant, buildCheckoutUrl } from '@/lib/shopify'

interface ProductCardProps {
  product: ShopifyProduct
}

export function ProductCard({ product }: ProductCardProps) {
  const available = product.variants.filter(v => v.availableForSale)
  const [selected, setSelected] = useState<ShopifyVariant>(available[0] ?? product.variants[0])

  const price = selected
    ? parseFloat(selected.priceV2.amount).toLocaleString('en-US', {
        style: 'currency',
        currency: selected.priceV2.currencyCode,
      })
    : null

  const checkoutUrl = selected?.availableForSale ? buildCheckoutUrl(selected.id) : '#'
  const hasVariants = product.variants.length > 1

  return (
    <div className="bg-[#111118] border border-[#1e1e2a] rounded-xl overflow-hidden flex flex-col hover:border-[#3a3a44] transition-colors">
      {product.featuredImage && (
        <div className="relative aspect-square overflow-hidden bg-[#0a0a0f]">
          <Image
            src={product.featuredImage.url}
            alt={product.featuredImage.altText ?? product.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
      )}

      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-mono font-bold text-[#e8e6e3] leading-snug">{product.title}</h3>
          {price && (
            <span className="font-mono font-bold text-[#fbbf24] text-sm whitespace-nowrap">
              {price}
            </span>
          )}
        </div>

        {product.description && (
          <p className="text-sm text-[#8a8a94] leading-relaxed mb-4 line-clamp-3">
            {product.description}
          </p>
        )}

        {/* Variant selector */}
        {hasVariants && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {product.variants.map(variant => (
              <button
                key={variant.id}
                onClick={() => variant.availableForSale && setSelected(variant)}
                disabled={!variant.availableForSale}
                className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors ${
                  selected?.id === variant.id
                    ? 'border-[#fbbf24] text-[#fbbf24] bg-[#fbbf24]/10'
                    : variant.availableForSale
                    ? 'border-[#1e1e2a] text-[#8a8a94] hover:border-[#3a3a44] hover:text-[#e8e6e3]'
                    : 'border-[#1e1e2a] text-[#3a3a44] line-through cursor-not-allowed'
                }`}
              >
                {variant.title}
              </button>
            ))}
          </div>
        )}

        <a
          href={checkoutUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-auto block w-full text-center py-2.5 px-4 font-mono text-sm font-bold rounded-lg transition-colors ${
            selected?.availableForSale
              ? 'bg-[#fbbf24] text-[#0a0a0f] hover:bg-[#f59e0b]'
              : 'bg-[#1e1e2a] text-[#5a5a64] pointer-events-none cursor-not-allowed'
          }`}
        >
          {selected?.availableForSale ? 'Buy Now →' : 'Sold Out'}
        </a>
      </div>
    </div>
  )
}
