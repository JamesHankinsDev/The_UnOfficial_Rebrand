'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  ShopifyCart,
  createCart,
  getCart,
  addToCart as shopifyAddToCart,
  updateCartLine,
  removeCartLine,
} from '@/lib/shopify'

const CART_STORAGE_KEY = 'shopify-cart-id'

interface CartContextValue {
  cart: ShopifyCart | null
  loading: boolean
  adding: boolean
  isOpen: boolean
  totalQuantity: number
  openCart: () => void
  closeCart: () => void
  addItem: (variantId: string, quantity?: number) => Promise<void>
  updateItem: (lineId: string, quantity: number) => Promise<void>
  removeItem: (lineId: string) => Promise<void>
}

const CartContext = createContext<CartContextValue>({
  cart: null,
  loading: true,
  adding: false,
  isOpen: false,
  totalQuantity: 0,
  openCart: () => {},
  closeCart: () => {},
  addItem: async () => {},
  updateItem: async () => {},
  removeItem: async () => {},
})

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<ShopifyCart | null>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  // Hydrate cart from localStorage on mount
  useEffect(() => {
    async function hydrateCart() {
      try {
        const storedCartId = localStorage.getItem(CART_STORAGE_KEY)
        if (storedCartId) {
          const existingCart = await getCart(storedCartId)
          if (existingCart && existingCart.lines.length > 0) {
            setCart(existingCart)
          } else {
            localStorage.removeItem(CART_STORAGE_KEY)
          }
        }
      } catch (error) {
        console.error('Failed to hydrate cart:', error)
        localStorage.removeItem(CART_STORAGE_KEY)
      } finally {
        setLoading(false)
      }
    }
    hydrateCart()
  }, [])

  // Persist cart ID when it changes
  useEffect(() => {
    if (cart?.id) {
      localStorage.setItem(CART_STORAGE_KEY, cart.id)
    }
  }, [cart?.id])

  const openCart = useCallback(() => setIsOpen(true), [])
  const closeCart = useCallback(() => setIsOpen(false), [])

  const addItem = useCallback(async (variantId: string, quantity: number = 1) => {
    setAdding(true)
    try {
      let updatedCart: ShopifyCart | null
      if (cart?.id) {
        updatedCart = await shopifyAddToCart(cart.id, variantId, quantity)
      } else {
        updatedCart = await createCart(variantId, quantity)
      }
      if (updatedCart) {
        setCart(updatedCart)
        setIsOpen(true)
      }
    } finally {
      setAdding(false)
    }
  }, [cart?.id])

  const updateItem = useCallback(async (lineId: string, quantity: number) => {
    if (!cart?.id) return
    if (quantity <= 0) {
      const updatedCart = await removeCartLine(cart.id, lineId)
      setCart(updatedCart)
    } else {
      const updatedCart = await updateCartLine(cart.id, lineId, quantity)
      setCart(updatedCart)
    }
  }, [cart?.id])

  const removeItem = useCallback(async (lineId: string) => {
    if (!cart?.id) return
    const updatedCart = await removeCartLine(cart.id, lineId)
    setCart(updatedCart)
  }, [cart?.id])

  const totalQuantity = cart?.totalQuantity ?? 0

  return (
    <CartContext.Provider
      value={{
        cart, loading, adding, isOpen, totalQuantity,
        openCart, closeCart, addItem, updateItem, removeItem,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  return useContext(CartContext)
}
