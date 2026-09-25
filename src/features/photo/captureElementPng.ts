function waitForVideoFrame(video: HTMLVideoElement) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('화면 캡처 영상 준비 시간이 초과되었습니다.')), 5000)
    const done = () => {
      window.clearTimeout(timeout)
      resolve()
    }
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
      done()
      return
    }
    video.addEventListener('loadeddata', done, { once: true })
    video.addEventListener('error', () => reject(new Error('화면 캡처 영상을 읽지 못했습니다.')), { once: true })
  })
}

function canvasToPng(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('PNG 인코딩에 실패했습니다.'))
    }, 'image/png')
  })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

/**
 * Captures the already-rendered browser tab instead of serialising the room DOM
 * through SVG foreignObject. This is deliberately browser-native: DEARLY's room
 * contains SVG/CSS that browsers may refuse to re-decode from a foreignObject,
 * while tab capture records exactly what the player can see.
 *
 * The browser will ask which surface to share. Choosing the current DEARLY tab
 * gives the cleanest result. Only the photo stage rectangle is cropped into the
 * PNG and the temporary capture stream is stopped immediately afterwards.
 */
export async function captureElementPng(element: HTMLElement, filename: string) {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error('이 브라우저는 화면 캡처 저장을 지원하지 않습니다. Chrome 또는 Edge 최신 버전을 사용해 주세요.')
  }

  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) throw new Error('촬영 영역의 크기를 확인할 수 없습니다.')

  let stream: MediaStream | null = null
  let video: HTMLVideoElement | null = null
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: 'browser',
        frameRate: { ideal: 1, max: 5 },
        // Screen Capture API hint: keep the OS mouse pointer out of the
        // captured tab. Chromium supports this for display capture; browsers
        // that do not recognise it simply ignore the hint.
        cursor: 'never',
      } as MediaTrackConstraints,
      audio: false,
      // Chromium understands this hint and ignores it elsewhere.
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
    } as DisplayMediaStreamOptions)

    const track = stream.getVideoTracks()[0]
    if (!track) throw new Error('선택한 화면에서 영상을 가져오지 못했습니다.')

    video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.srcObject = stream
    await video.play()
    await waitForVideoFrame(video)

    // Tab capture is the viewport rendered at the captured stream's pixel size.
    // Scale CSS viewport coordinates to those pixels before cropping the stage.
    const scaleX = video.videoWidth / Math.max(1, window.innerWidth)
    const scaleY = video.videoHeight / Math.max(1, window.innerHeight)
    const sx = Math.max(0, Math.round(rect.left * scaleX))
    const sy = Math.max(0, Math.round(rect.top * scaleY))
    const sw = Math.max(1, Math.min(video.videoWidth - sx, Math.round(rect.width * scaleX)))
    const sh = Math.max(1, Math.min(video.videoHeight - sy, Math.round(rect.height * scaleY)))

    const canvas = document.createElement('canvas')
    canvas.width = sw
    canvas.height = sh
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D context를 사용할 수 없습니다.')
    context.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh)

    downloadBlob(await canvasToPng(canvas), filename)
  } catch (error) {
    if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'AbortError')) {
      throw new Error('화면 선택이 취소되었습니다. PNG 저장 시 현재 DEARLY 탭을 선택해 주세요.')
    }
    throw error
  } finally {
    if (video) {
      video.pause()
      video.srcObject = null
    }
    stream?.getTracks().forEach((track) => track.stop())
  }
}

export function makePhotoFilename(now = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `dearly-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.png`
}
