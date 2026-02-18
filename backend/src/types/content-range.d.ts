declare module 'content-range' {
  export interface ContentRange {
    start?: number
    end?: number
    size?: number
  }

  export function parse(header: string): ContentRange | undefined
  export function format(range: ContentRange): string
}
