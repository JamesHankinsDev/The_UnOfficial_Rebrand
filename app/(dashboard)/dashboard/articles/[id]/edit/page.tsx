'use client'

import { useParams } from 'next/navigation'
import { ArticleEditor } from '@/components/editor/ArticleEditor'

export default function EditArticlePage() {
  const { id } = useParams<{ id: string }>()
  return <ArticleEditor editId={id} />
}
