'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { ShopifyProduct, ShopifyVariant, ShopifyImage } from '@/lib/shopify'
import { useCart } from '@/hooks/useCart'

interface ProductCardProps {
  product: ShopifyProduct
}

export function ProductCard({ product }: ProductCardProps) {
  const available = product.variants.filter(v => v.availableForSale)
  const [selected, setSelected] = useState<ShopifyVariant>(available[0] ?? product.variants[0])
  const { addItem, adding } = useCart()

  // Determine the displayed image: selected variant's image → featured image
  const displayImage = selected?.image ?? product.featuredImage
  const galleryImages = product.images?.length > 1 ? product.images : []

  const price = selected
    ? parseFloat(selected.priceV2.amount).toLocaleString('en-US', {
        style: 'currency',
        currency: selected.priceV2.currencyCode,
      })
    : null

  const hasVariants = product.variants.length > 1

  const handleAddToCart = async () => {
    if (!selected?.availableForSale) return
    try {
      await addItem(selected.id)
      toast.success(`${product.title} added to cart`)
    } catch {
      toast.error('Failed to add to cart')
    }
  }

  // When user picks a variant, update selection (image swaps automatically)
  const handleVariantChange = (variantId: string) => {
    const variant = product.variants.find(v => v.id === variantId)
    if (variant) setSelected(variant)
  }

  // When user clicks a thumbnail, find the variant that uses that image
  const handleThumbnailClick = (image: ShopifyImage) => {
    const matchingVariant = product.variants.find(
      v => v.image?.url === image.url && v.availableForSale
    )
    if (matchingVariant) {
      setSelected(matchingVariant)
    }
  }

  return (
    <div className="bg-[#111118] border border-[#1e1e2a] rounded-xl overflow-hidden flex flex-col hover:border-[#3a3a44] transition-colors">
      {displayImage && (
        <div className="relative aspect-square overflow-hidden bg-[#0a0a0f]">
          <Image
            src={displayImage.url}
            alt={displayImage.altText ?? product.title}
            fill
            className="object-cover transition-opacity duration-200"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
      )}

      {/* Thumbnail gallery */}
      {galleryImages.length > 0 && (
        <div className="flex gap-1.5 px-3 py-2 overflow-x-auto bg-[#0a0a0f]">
          {galleryImages.map((img, idx) => (
            <button
              key={idx}
              onClick={() => handleThumbnailClick(img)}
              className={`relative w-12 h-12 flex-shrink-0 rounded-md overflow-hidden border transition-colors ${
                displayImage?.url === img.url
                  ? 'border-[#fbbf24]'
                  : 'border-[#1e1e2a] hover:border-[#3a3a44]'
              }`}
            >
              <Image
                src={img.url}
                alt={img.altText ?? `${product.title} ${idx + 1}`}
                fill
                className="object-cover"
                sizes="48px"
              />
            </button>
          ))}
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
          <div className="relative mb-4">
            <select
              value={selected?.id ?? ''}
              onChange={(e) => handleVariantChange(e.target.value)}
              className="w-full appearance-none bg-[#0a0a0f] border border-[#1e1e2a] text-[#e8e6e3] text-sm font-mono rounded-lg px-3 py-2 pr-8 focus:outline-none focus:border-[#fbbf24] transition-colors cursor-pointer"
            >
              {product.variants.map(variant => (
                <option
                  key={variant.id}
                  value={variant.id}
                  disabled={!variant.availableForSale}
                >
                  {variant.title}{!variant.availableForSale ? ' (Sold Out)' : ''}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a8a94]"
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        )}

        <button
          onClick={handleAddToCart}
          disabled={!selected?.availableForSale || adding}
          className={`mt-auto block w-full text-center py-2.5 px-4 font-mono text-sm font-bold rounded-lg transition-colors ${
            selected?.availableForSale
              ? adding
                ? 'bg-[#fbbf24]/70 text-[#0a0a0f] cursor-wait'
                : 'bg-[#fbbf24] text-[#0a0a0f] hover:bg-[#f59e0b]'
              : 'bg-[#1e1e2a] text-[#5a5a64] cursor-not-allowed'
          }`}
        >
          {!selected?.availableForSale ? 'Sold Out' : adding ? 'Adding...' : 'Add to Cart'}
        </button>
      </div>
    </div>
  )
}
