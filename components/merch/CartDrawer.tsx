'use client'

import React, { useEffect } from 'react'
import Image from 'next/image'
import { useCart } from '@/hooks/useCart'
import type { CartLineItem } from '@/lib/shopify'
import toast from 'react-hot-toast'

function CartLineItemRow({
  item,
  onUpdateQuantity,
  onRemove,
}: {
  item: CartLineItem
  onUpdateQuantity: (qty: number) => void
  onRemove: () => void
}) {
  const price = parseFloat(item.merchandise.priceV2.amount)
  const lineTotal = (price * item.quantity).toLocaleString('en-US', {
    style: 'currency',
    currency: item.merchandise.priceV2.currencyCode,
  })

  return (
    <div className="flex gap-3 py-3 border-b border-[#1e1e2a] last:border-0">
      {/* Thumbnail */}
      {item.merchandise.product.featuredImage && (
        <div className="relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-[#111118]">
          <Image
            src={item.merchandise.product.featuredImage.url}
            alt={item.merchandise.product.featuredImage.altText ?? item.merchandise.product.title}
            fill
            className="object-cover"
            sizes="64px"
          />
        </div>
      )}

      {/* Details */}
      <div className="flex-1 min-w-0">
        <h4 className="font-mono text-sm font-bold text-[#e8e6e3] truncate">
          {item.merchandise.product.title}
        </h4>
        {item.merchandise.title !== 'Default Title' && (
          <p className="text-xs text-[#8a8a94] mt-0.5">{item.merchandise.title}</p>
        )}
        <div className="flex items-center justify-between mt-2">
          {/* Quantity controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onUpdateQuantity(item.quantity - 1)}
              className="w-6 h-6 flex items-center justify-center rounded border border-[#1e1e2a] text-[#8a8a94] hover:border-[#fbbf24] hover:text-[#fbbf24] transition-colors text-xs"
              aria-label="Decrease quantity"
            >
              -
            </button>
            <span className="font-mono text-sm text-[#e8e6e3] w-5 text-center">
              {item.quantity}
            </span>
            <button
              onClick={() => onUpdateQuantity(item.quantity + 1)}
              className="w-6 h-6 flex items-center justify-center rounded border border-[#1e1e2a] text-[#8a8a94] hover:border-[#fbbf24] hover:text-[#fbbf24] transition-colors text-xs"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
          <span className="font-mono text-sm font-bold text-[#fbbf24]">{lineTotal}</span>
        </div>
      </div>

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="text-[#5a5a64] hover:text-[#ef4444] transition-colors self-start mt-0.5"
        aria-label="Remove item"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  )
}

export function CartDrawer() {
  const { cart, isOpen, closeCart, updateItem, removeItem, loading } = useCart()

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeCart()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, closeCart])

  const subtotal = cart?.cost?.subtotalAmount
    ? parseFloat(cart.cost.subtotalAmount.amount).toLocaleString('en-US', {
        style: 'currency',
        currency: cart.cost.subtotalAmount.currencyCode,
      })
    : '$0.00'

  const handleUpdateQuantity = async (lineId: string, qty: number) => {
    try {
      await updateItem(lineId, qty)
    } catch {
      toast.error('Failed to update item')
    }
  }

  const handleRemove = async (lineId: string) => {
    try {
      await removeItem(lineId)
    } catch {
      toast.error('Failed to remove item')
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/60 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeCart}
      />

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-96 bg-[#0a0a0f] border-l border-[#1e1e2a] flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e2a]">
          <h2 className="font-mono font-bold text-[#e8e6e3] text-lg">Your Cart</h2>
          <button
            onClick={closeCart}
            className="text-[#8a8a94] hover:text-[#e8e6e3] transition-colors p-1"
            aria-label="Close cart"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Line items */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="font-mono text-sm text-[#5a5a64]">Loading cart...</div>
            </div>
          ) : !cart || cart.lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <svg className="w-12 h-12 text-[#3a3a44] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <p className="font-mono text-sm text-[#5a5a64]">Your cart is empty</p>
            </div>
          ) : (
            <div className="space-y-1">
              {cart.lines.map((item) => (
                <CartLineItemRow
                  key={item.id}
                  item={item}
                  onUpdateQuantity={(qty) => handleUpdateQuantity(item.id, qty)}
                  onRemove={() => handleRemove(item.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer with subtotal + checkout */}
        {cart && cart.lines.length > 0 && (
          <div className="border-t border-[#1e1e2a] px-5 py-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-mono text-sm text-[#8a8a94]">Subtotal</span>
              <span className="font-mono font-bold text-[#fbbf24]">{subtotal}</span>
            </div>
            <p className="text-xs text-[#5a5a64]">Shipping and taxes calculated at checkout.</p>
            <a
              href={cart.checkoutUrl}
              className="block w-full text-center py-3 px-4 font-mono text-sm font-bold rounded-lg bg-[#fbbf24] text-[#0a0a0f] hover:bg-[#f59e0b] transition-colors"
            >
              Checkout
            </a>
          </div>
        )}
      </div>
    </>
  )
}
