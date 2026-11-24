import { config } from 'dotenv'
import { app, BrowserWindow, Menu, nativeImage, session } from 'electron'
import { join } from 'node:path'
import { registerAppHandlers } from './ipc/app-handlers'

app.setName('PetShop Cotil')
app.setAppUserModelId('br.cotil.petshop')
const icon = join(app.getAppPath(), 'resources/icon.png')
config(process.env.PORTABLE_EXECUTABLE_DIR ? { path: join(process.env.PORTABLE_EXECUTABLE_DIR, '.env') } : {})
const rendererUrl = app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL

function installContentSecurityPolicy(): void {
  const connectSource = rendererUrl
    ? "connect-src 'self' ws://localhost:* http://localhost:*"
    : "connect-src 'self'"
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    connectSource,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'"
  ].join('; ')

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = Object.fromEntries(
      Object.entries(details.responseHeaders ?? {}).filter(
        ([name]) => name.toLowerCase() !== 'content-security-policy'
      )
    )
    responseHeaders['Content-Security-Policy'] = [policy]
    callback({ responseHeaders })
  })
}

function createWindow(): void {
  const window = new BrowserWindow({
    title: 'PetShop Cotil',
    icon,
    backgroundColor: '#f6f8f5',
    width: 1100,
    height: 760,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== window.webContents.getURL()) event.preventDefault()
  })
  if (rendererUrl) {
    void window.loadURL(rendererUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock?.setIcon(nativeImage.createFromPath(icon))
  Menu.setApplicationMenu(null)
  installContentSecurityPolicy()
  registerAppHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
