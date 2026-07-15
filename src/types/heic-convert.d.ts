declare module 'heic-convert' {
  export interface HeicConvertOptions {
    buffer: Buffer | Uint8Array
    format: 'JPEG' | 'PNG'
    quality?: number
  }

  export default function heicConvert(options: HeicConvertOptions): Promise<Buffer | Uint8Array>
}
