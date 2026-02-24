'use client'

import React, { useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { uploadArticleImage } from '@/lib/storage'
import toast from 'react-hot-toast'

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  articleId: string
  placeholder?: string
}

const ToolbarButton = ({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) => (
  <button
    type="button"
    onMouseDown={e => { e.preventDefault(); onClick() }}
    title={title}
    className={`px-2 py-1 text-xs font-mono rounded transition-colors ${
      active
        ? 'bg-[#fbbf24]/20 text-[#fbbf24]'
        : 'text-[#8a8a94] hover:text-[#e8e6e3] hover:bg-[#1e1e2a]'
    }`}
  >
    {children}
  </button>
)

export function RichTextEditor({
  content,
  onChange,
  articleId,
  placeholder = 'Start writing. Make it count.',
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'min-h-[400px] text-[#e8e6e3] text-base leading-relaxed focus:outline-none',
      },
    },
  })

  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !editor) return
      try {
        const url = await uploadArticleImage(articleId, file)
        editor.chain().focus().setImage({ src: url }).run()
      } catch {
        toast.error('Image upload failed.')
      }
    },
    [editor, articleId]
  )

  const setLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href
    const url = window.prompt('URL', prev)
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
  }, [editor])

  if (!editor) return null

  return (
    <div className="flex flex-col gap-0 border border-[#1e1e2a] rounded-xl overflow-hidden bg-[#111118]">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-2 border-b border-[#1e1e2a] flex-wrap">
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
          <em>I</em>
        </ToolbarButton>
        <div className="w-px h-4 bg-[#1e1e2a] mx-1" />
        {([1, 2, 3, 4] as const).map(level => (
          <ToolbarButton
            key={level}
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
            active={editor.isActive('heading', { level })}
            title={`Heading ${level}`}
          >
            H{level}
          </ToolbarButton>
        ))}
        <div className="w-px h-4 bg-[#1e1e2a] mx-1" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
          •—
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Ordered list">
          1.
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
          &ldquo;
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline code">
          `
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code block">
          {'</>'}
        </ToolbarButton>
        <div className="w-px h-4 bg-[#1e1e2a] mx-1" />
        <ToolbarButton onClick={setLink} active={editor.isActive('link')} title="Add link">
          🔗
        </ToolbarButton>
        <label className="cursor-pointer px-2 py-1 text-xs font-mono text-[#8a8a94] hover:text-[#e8e6e3] hover:bg-[#1e1e2a] rounded transition-colors" title="Insert image">
          🖼
          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        </label>
      </div>

      {/* Editor content */}
      <div className="p-6 flex-1">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
