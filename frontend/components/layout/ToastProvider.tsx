'use client'
import { useEffect, useState } from 'react'
import { Toaster } from 'react-hot-toast'

export default function ToastProvider() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: '#1E293B',
          color: '#F1F5F9',
          border: '1px solid #334155',
          borderRadius: '8px',
        },
        success: { iconTheme: { primary: '#10B981', secondary: '#0F172A' } },
        error: { iconTheme: { primary: '#F43F5E', secondary: '#0F172A' } },
      }}
    />
  )
}
