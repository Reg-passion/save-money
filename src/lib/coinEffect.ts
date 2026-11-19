import * as THREE from 'three'

interface CoinState {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  spin: THREE.Vector3
  delay: number
}

/**
 * 一小把从空中落到岛上的金币。几何体和材质由每次爆发各自持有，
 * 动画结束后统一释放，避免多次记账累积 GPU 资源。
 */
export class CoinBurst {
  readonly group = new THREE.Group()

  private readonly coins: CoinState[] = []
  private readonly geometry: THREE.CylinderGeometry
  private readonly material: THREE.MeshStandardMaterial
  private elapsed = 0
  private readonly lifetime = 2.4

  constructor(origin: THREE.Vector3, count = 6, spread = 1.8) {
    this.geometry = new THREE.CylinderGeometry(0.22, 0.22, 0.06, 14)
    this.material = new THREE.MeshStandardMaterial({
      color: '#f6c453',
      emissive: '#8a5b08',
      emissiveIntensity: 0.5,
      metalness: 0.7,
      roughness: 0.24,
      flatShading: true,
    })

    for (let index = 0; index < count; index += 1) {
      const mesh = new THREE.Mesh(this.geometry, this.material)
      mesh.rotation.set(Math.PI / 2, Math.random() * Math.PI, 0)
      mesh.position.set(
        origin.x + (Math.random() - 0.5) * spread,
        origin.y + Math.random() * 0.8,
        origin.z + (Math.random() - 0.5) * spread,
      )
      mesh.visible = false
      this.group.add(mesh)
      this.coins.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 1.3,
          -3.8 - Math.random() * 1.8,
          (Math.random() - 0.5) * 1.3,
        ),
        spin: new THREE.Vector3(
          2 + Math.random() * 3,
          1 + Math.random() * 4,
          Math.random() * 2,
        ),
        delay: Math.random() * 0.28,
      })
    }
  }

  update(delta: number): boolean {
    this.elapsed += delta

    for (const coin of this.coins) {
      if (coin.delay > 0) {
        coin.delay -= delta
        continue
      }

      coin.mesh.visible = true
      coin.velocity.y -= 7.4 * delta
      coin.mesh.position.addScaledVector(coin.velocity, delta)
      coin.mesh.rotation.x += coin.spin.x * delta
      coin.mesh.rotation.y += coin.spin.y * delta
      coin.mesh.rotation.z += coin.spin.z * delta

      if (coin.mesh.position.y < 0.9) {
        coin.mesh.position.y = 0.9
        coin.velocity.y *= -0.38
        coin.velocity.x *= 0.7
        coin.velocity.z *= 0.7
      }
    }

    if (this.elapsed >= this.lifetime) {
      this.group.visible = false
    }
    return this.elapsed < this.lifetime
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}

let audioContext: AudioContext | null = null

/** 用两枚合成音代替 mp3：短促的上行三角波，音量很低。 */
export function playCoinSound(): void {
  if (typeof window === 'undefined') return

  try {
    const AudioCtor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtor) return

    audioContext ??= new AudioCtor()
    const context = audioContext
    if (context.state === 'suspended') void context.resume()

    const start = context.currentTime
    const notes = [880, 1174, 1568]
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const noteStart = start + index * 0.055
      oscillator.type = 'triangle'
      oscillator.frequency.setValueAtTime(frequency, noteStart)
      gain.gain.setValueAtTime(0.0001, noteStart)
      gain.gain.exponentialRampToValueAtTime(0.045, noteStart + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.18)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(noteStart)
      oscillator.stop(noteStart + 0.2)
    })
  } catch {
    // 音频被浏览器策略阻止时静默降级，不影响记账。
  }
}
