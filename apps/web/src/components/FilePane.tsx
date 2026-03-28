import type { MutableRefObject, RefObject } from 'react'
import type { CsvReadResult, CsvSchema } from '../types/diffgraft'
import type { UnifiedRow } from '../lib/unifiedRows'
import { DropZone } from './DropZone'
import { DiffPaneTable } from './DiffPaneTable'

interface FilePaneProps {
  side: 'A' | 'B'
  file: CsvReadResult | null
  schema: CsvSchema | null
  unifiedRows: UnifiedRow[] | null
  currentChangeIndex: number
  changeIndex: number[]
  scrollRef: RefObject<HTMLDivElement>
  firstRowRef?: MutableRefObject<HTMLTableRowElement | null>
  onFileLoaded: (result: CsvReadResult, content: string, name: string) => void
  highlightCells: boolean
}

export function FilePane({
  side,
  file,
  schema,
  unifiedRows,
  currentChangeIndex,
  changeIndex,
  scrollRef,
  firstRowRef,
  onFileLoaded,
  highlightCells,
}: FilePaneProps) {
  if (!file || !schema) {
    return (
      <div style={{ width: '100%', height: '100%', padding: 24 }}>
        <DropZone side={side} onFileLoaded={onFileLoaded} />
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      className="pane-scroll-container"
    >
      <DiffPaneTable
        side={side}
        schema={schema}
        unifiedRows={unifiedRows}
        rawRows={file.rows}
        currentChangeIndex={currentChangeIndex}
        changeIndex={changeIndex}
        firstRowRef={firstRowRef}
        highlightCells={highlightCells}
      />
    </div>
  )
}
