import { useCallback, useRef, useState } from 'react'
import { readCsvContent } from '../lib/diffgraft'
import type { CsvReadResult } from '../types/diffgraft'

interface DropZoneProps {
  side: 'A' | 'B'
  onFileLoaded: (
    result: CsvReadResult,
    content: string,
    name: string
  ) => void
}

export function DropZone({ side, onFileLoaded }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      setError('Please select a CSV file')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const content = await readFileAsText(file)
      const result = await readCsvContent(content)
      onFileLoaded(result, content, file.name)
    } catch (e) {
      setError(String(e))
    } finally {
      setIsLoading(false)
    }
  }

  function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = e => resolve(e.target?.result as string)
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })
  }

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) await handleFile(file)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) await handleFile(file)
    },
    []
  )

  return (
    <div
      className={`dropzone ${isDragOver ? 'dropzone-over' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={handleInputChange}
      />
      {isLoading ? (
        <p className="dropzone-text">Loading...</p>
      ) : (
        <>
          <div className="dropzone-icon">
            <svg width="48" height="48" viewBox="0 0 24 24"
              fill="none" stroke="#475569" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10,9 9,9 8,9"/>
            </svg>
          </div>
          <p className="dropzone-text">
            Drop File {side} here
          </p>
          <p className="dropzone-subtext">or click to open</p>
          {error && (
            <p className="dropzone-error">{error}</p>
          )}
        </>
      )}
    </div>
  )
}
