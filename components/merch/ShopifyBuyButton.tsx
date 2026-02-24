'use client'

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ShopifyBuy?: any
  }
}

interface ShopifyBuyButtonProps {
  domain: string
  storefrontAccessToken: string
  collectionId: string
}

export function ShopifyBuyButton({
  domain,
  storefrontAccessToken,
  collectionId,
}: ShopifyBuyButtonProps) {
  const initialized = useRef(false)
  const nodeId = `shopify-collection-${collectionId}`

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const node = document.getElementById(nodeId)
    if (!node) return

    // Clear any existing children
    while (node.firstChild) node.removeChild(node.firstChild)

    const scriptURL =
      'https://sdks.shopifycdn.com/buy-button/latest/buy-button-storefront.min.js'

    function ShopifyBuyInit() {
      const client = window.ShopifyBuy.buildClient({ domain, storefrontAccessToken })
      window.ShopifyBuy.UI.onReady(client).then((ui: Window['ShopifyBuy']) => {
        ui.createComponent('collection', {
          id: collectionId,
          node,
          moneyFormat: '%24%7B%7Bamount%7D%7D',
          options: {
            product: {
              styles: {
                product: {
                  '@media (min-width: 601px)': {
                    'max-width': 'calc(25% - 20px)',
                    'margin-left': '20px',
                    'margin-bottom': '50px',
                    width: 'calc(25% - 20px)',
                  },
                  img: {
                    height: 'calc(100% - 15px)',
                    position: 'absolute',
                    left: '0',
                    right: '0',
                    top: '0',
                  },
                  imgWrapper: {
                    'padding-top': 'calc(75% + 15px)',
                    position: 'relative',
                    height: '0',
                  },
                },
                title: {
                  'font-family': 'Space Mono, monospace',
                  color: '#e8e6e3',
                },
                price: {
                  'font-family': 'Space Mono, monospace',
                  color: '#fbbf24',
                  'font-weight': 'bold',
                },
                button: {
                  'font-family': 'Space Mono, monospace',
                  'font-size': '12px',
                  'font-weight': 'bold',
                  'letter-spacing': '0.1em',
                  'text-transform': 'uppercase',
                  'padding-top': '12px',
                  'padding-bottom': '12px',
                  color: '#0a0a0f',
                  'background-color': '#fbbf24',
                  ':hover': {
                    color: '#0a0a0f',
                    'background-color': '#f59e0b',
                  },
                  ':focus': {
                    'background-color': '#f59e0b',
                  },
                  'border-radius': '6px',
                },
              },
              text: { button: 'Add to Cart' },
            },
            productSet: {
              styles: {
                products: {
                  '@media (min-width: 601px)': { 'margin-left': '-20px' },
                },
              },
            },
            modalProduct: {
              contents: {
                img: false,
                imgWithCarousel: true,
                button: false,
                buttonWithQuantity: true,
              },
              styles: {
                product: {
                  '@media (min-width: 601px)': {
                    'max-width': '100%',
                    'margin-left': '0px',
                    'margin-bottom': '0px',
                  },
                  background: '#111118',
                },
                button: {
                  'font-family': 'Space Mono, monospace',
                  'font-size': '12px',
                  'font-weight': 'bold',
                  color: '#0a0a0f',
                  'background-color': '#fbbf24',
                  ':hover': {
                    color: '#0a0a0f',
                    'background-color': '#f59e0b',
                  },
                  ':focus': { 'background-color': '#f59e0b' },
                  'border-radius': '6px',
                },
              },
              text: { button: 'Add to Cart' },
            },
            option: {},
            cart: {
              styles: {
                button: {
                  'font-family': 'Space Mono, monospace',
                  'font-size': '12px',
                  'font-weight': 'bold',
                  color: '#0a0a0f',
                  'background-color': '#fbbf24',
                  ':hover': {
                    color: '#0a0a0f',
                    'background-color': '#f59e0b',
                  },
                  ':focus': { 'background-color': '#f59e0b' },
                  'border-radius': '6px',
                },
              },
              text: { total: 'Subtotal', button: 'Checkout' },
            },
            toggle: {
              styles: {
                toggle: {
                  'font-family': 'Space Mono, monospace',
                  'background-color': '#fbbf24',
                  ':hover': { 'background-color': '#f59e0b' },
                  ':focus': { 'background-color': '#f59e0b' },
                },
                count: {
                  'font-size': '13px',
                  color: '#0a0a0f',
                  ':hover': { color: '#0a0a0f' },
                },
                iconPath: { fill: '#0a0a0f' },
              },
            },
          },
        })
      })
    }

    if (window.ShopifyBuy) {
      if (window.ShopifyBuy.UI) {
        ShopifyBuyInit()
      } else {
        loadScript()
      }
    } else {
      loadScript()
    }

    function loadScript() {
      const script = document.createElement('script')
      script.async = true
      script.src = scriptURL
      ;(document.head || document.body).appendChild(script)
      script.onload = ShopifyBuyInit
    }
  }, [domain, storefrontAccessToken, collectionId, nodeId])

  return <div id={nodeId} />
}
