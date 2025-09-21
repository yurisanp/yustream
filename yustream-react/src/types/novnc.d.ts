// Tipos para noVNC
interface RFBOptions {
  shared?: boolean
  credentials?: {
    username?: string
    password?: string
    target?: string
  }
  repeaterID?: string
  wsProtocols?: string[]
}

interface RFBConstructor {
  new (target: HTMLElement, url: string, options?: RFBOptions): RFBInstance
}

interface RFBInstance {
  addEventListener(type: string, listener: (event: any) => void): void
  removeEventListener(type: string, listener: (event: any) => void): void
  disconnect(): void
  sendCredentials(credentials: { username?: string; password?: string; target?: string }): void
  sendKey(keysym: number, code?: string, down?: boolean): void
  sendCtrlAltDel(): void
  focus(): void
  blur(): void
  machineShutdown(): void
  machineReboot(): void
  machineReset(): void
  clipboardPasteFrom(text: string): void
  get_display(): any
  get_keyboard(): any
  get_mouse(): any
}

declare global {
  interface Window {
    RFB: RFBConstructor
  }
}

export { RFBConstructor, RFBInstance, RFBOptions }
