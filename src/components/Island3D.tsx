import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CoinBurst } from '../lib/coinEffect'
import {
  BUILDING_ORDER,
  getBuildingVisibility,
  getSkyGradient,
  type BuildingId,
} from '../lib/island3d'

interface Island3DProps {
  progress: number
  dayNight: number
  hp: number
  coinSignal: number
  onReady?: () => void
  onUnavailable?: () => void
}

interface SceneState {
  progress: number
  dayNight: number
  hp: number
}

interface SceneApi {
  update: (next: SceneState) => void
  spawnCoins: () => void
  dispose: () => void
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function mesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
): THREE.Mesh {
  const item = new THREE.Mesh(geometry, material)
  item.position.set(...position)
  item.castShadow = true
  item.receiveShadow = true
  parent.add(item)
  return item
}

function box(
  parent: THREE.Object3D,
  material: THREE.Material,
  size: [number, number, number],
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
): THREE.Mesh {
  const item = mesh(parent, new THREE.BoxGeometry(...size), material, position)
  item.rotation.set(...rotation)
  return item
}

function cylinder(
  parent: THREE.Object3D,
  material: THREE.Material,
  radii: [number, number, number],
  position: [number, number, number],
  segments = 8,
): THREE.Mesh {
  return mesh(
    parent,
    new THREE.CylinderGeometry(radii[0], radii[1], radii[2], segments),
    material,
    position,
  )
}

function createTree(
  parent: THREE.Object3D,
  leafMaterial: THREE.Material,
  darkLeafMaterial: THREE.Material,
  woodMaterial: THREE.Material,
  position: [number, number, number],
  scale = 1,
): THREE.Group {
  const tree = new THREE.Group()
  tree.position.set(...position)
  tree.scale.setScalar(scale)
  parent.add(tree)
  cylinder(tree, woodMaterial, [0.09, 0.13, 0.7], [0, 0.35, 0], 5)
  mesh(tree, new THREE.ConeGeometry(0.52, 1.05, 7), leafMaterial, [0, 1.0, 0])
  mesh(tree, new THREE.ConeGeometry(0.4, 0.8, 7), darkLeafMaterial, [0, 1.48, 0])
  return tree
}

function createIslandScene(
  container: HTMLDivElement,
  initial: SceneState,
  onReady: () => void,
  onUnavailable: () => void,
): SceneApi {
  const reducedMotion = prefersReducedMotion()
  const width = container.clientWidth || window.innerWidth
  const height = container.clientHeight || window.innerHeight
  const compact = width < 768

  const renderer = new THREE.WebGLRenderer({
    antialias: !compact,
    alpha: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.5 : 2))
  renderer.setSize(width, height)
  renderer.setClearColor(0x000000, 0)
  renderer.shadowMap.enabled = !compact
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.domElement.className = 'block h-full w-full'
  renderer.domElement.style.touchAction = 'none'
  renderer.domElement.setAttribute('aria-hidden', 'true')
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0xdfeee8, 21, 54)

  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 90)
  // 竖屏手机需要退得更远，才能把码头到城堡的整座岛框进画面。
  camera.position.set(compact ? 14.2 : 9.4, compact ? 9.8 : 7.2, compact ? 22.2 : 12.6)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, compact ? 0.55 : 1.3, 0)
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.enablePan = false
  controls.minDistance = compact ? 12 : 7.5
  controls.maxDistance = compact ? 36 : 24
  controls.minPolarAngle = 0.7
  controls.maxPolarAngle = Math.PI / 2.12
  controls.update()

  const daySky = new THREE.Color('#c9eef4')
  const nightSky = new THREE.Color('#0b2230')
  const dayGround = new THREE.Color('#7d8b63')
  const nightGround = new THREE.Color('#15242a')
  const dayOcean = new THREE.Color('#2f9fb4')
  const nightOcean = new THREE.Color('#123847')
  const dayFog = new THREE.Color('#dff0ea')
  const nightFog = new THREE.Color('#183b4c')
  const daySun = new THREE.Color('#fff1cf')
  const nightSun = new THREE.Color('#7ba2b4')

  const hemisphere = new THREE.HemisphereLight(daySky, dayGround, 1.15)
  scene.add(hemisphere)

  const sun = new THREE.DirectionalLight(daySun, 2.25)
  sun.position.set(8, 13, 6)
  sun.castShadow = !compact
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.left = -8
  sun.shadow.camera.right = 8
  sun.shadow.camera.top = 9
  sun.shadow.camera.bottom = -7
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 40
  sun.shadow.bias = -0.0007
  scene.add(sun)

  const fillLight = new THREE.DirectionalLight('#9fd9e4', 0.55)
  fillLight.position.set(-8, 5, -5)
  scene.add(fillLight)

  const fireLight = new THREE.PointLight('#ffb15c', 0, 4, 2)
  fireLight.position.set(-1.2, 1.65, 0.3)
  scene.add(fireLight)

  const cabinLight = new THREE.PointLight('#ffd98c', 0, 3.8, 2)
  cabinLight.position.set(-1.2, 1.9, 0.1)
  scene.add(cabinLight)

  const lighthouseLight = new THREE.PointLight('#ffe2a1', 0, 7, 2)
  lighthouseLight.position.set(2.25, 3.05, -0.5)
  scene.add(lighthouseLight)

  const materials = {
    rock: new THREE.MeshStandardMaterial({ color: '#53696a', roughness: 0.96, flatShading: true }),
    rockDark: new THREE.MeshStandardMaterial({ color: '#405658', roughness: 0.95, flatShading: true }),
    sand: new THREE.MeshStandardMaterial({ color: '#efd49a', roughness: 0.92, flatShading: true }),
    grass: new THREE.MeshStandardMaterial({ color: '#8ac47d', roughness: 0.88, flatShading: true }),
    grassLight: new THREE.MeshStandardMaterial({ color: '#a9d795', roughness: 0.9, flatShading: true }),
    wood: new THREE.MeshStandardMaterial({ color: '#b47a4b', roughness: 0.82, flatShading: true }),
    woodDark: new THREE.MeshStandardMaterial({ color: '#7d5237', roughness: 0.85, flatShading: true }),
    leaf: new THREE.MeshStandardMaterial({ color: '#5da96b', roughness: 0.9, flatShading: true }),
    leafDark: new THREE.MeshStandardMaterial({ color: '#478b59', roughness: 0.92, flatShading: true }),
    roof: new THREE.MeshStandardMaterial({ color: '#dd7e64', roughness: 0.8, flatShading: true }),
    cream: new THREE.MeshStandardMaterial({ color: '#fff2d7', roughness: 0.8, flatShading: true }),
    stone: new THREE.MeshStandardMaterial({ color: '#ddd3b9', roughness: 0.9, flatShading: true }),
    white: new THREE.MeshStandardMaterial({ color: '#f8f4e6', roughness: 0.8, flatShading: true }),
    red: new THREE.MeshStandardMaterial({ color: '#c95d4f', roughness: 0.8, flatShading: true }),
    gold: new THREE.MeshStandardMaterial({ color: '#f3c14f', roughness: 0.5, metalness: 0.25, flatShading: true }),
    dark: new THREE.MeshStandardMaterial({ color: '#4b4f48', roughness: 0.9, flatShading: true }),
    window: new THREE.MeshStandardMaterial({
      color: '#ffe3a0',
      emissive: '#ffb84d',
      emissiveIntensity: 0.2,
      roughness: 0.35,
      flatShading: true,
    }),
    lantern: new THREE.MeshStandardMaterial({
      color: '#fff1be',
      emissive: '#ffd36e',
      emissiveIntensity: 0.4,
      roughness: 0.3,
      flatShading: true,
    }),
  }

  const world = new THREE.Group()
  scene.add(world)

  const waterGeometry = new THREE.PlaneGeometry(90, 90, compact ? 30 : 46, compact ? 30 : 46)
  waterGeometry.rotateX(-Math.PI / 2)
  const waterPosition = waterGeometry.getAttribute('position') as THREE.BufferAttribute
  const waterBase = Float32Array.from(waterPosition.array)
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: '#2f9fb4',
    roughness: 0.28,
    metalness: 0.06,
    transparent: true,
    opacity: 0.93,
    flatShading: true,
  })
  const water = new THREE.Mesh(waterGeometry, waterMaterial)
  water.position.y = -0.2
  water.receiveShadow = false
  world.add(water)

  const island = new THREE.Group()
  world.add(island)

  mesh(
    island,
    new THREE.CylinderGeometry(3.2, 3.8, 1.5, 9),
    materials.rock,
    [0, -0.35, 0],
  )
  mesh(
    island,
    new THREE.CylinderGeometry(3.36, 3.52, 0.46, 9),
    materials.sand,
    [0, 0.57, 0],
  )
  mesh(
    island,
    new THREE.CylinderGeometry(2.94, 3.16, 0.4, 9),
    materials.grass,
    [0, 0.88, 0],
  )
  mesh(
    island,
    new THREE.CylinderGeometry(2.16, 2.3, 0.12, 9),
    materials.grassLight,
    [0, 1.08, 0.08],
  )

  const foam = new THREE.Mesh(
    new THREE.RingGeometry(3.28, 3.62, 48),
    new THREE.MeshBasicMaterial({
      color: '#f8ffff',
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  )
  foam.rotation.x = -Math.PI / 2
  foam.position.y = 0.03
  world.add(foam)

  const shoreRocks: Array<[number, number, number, number]> = [
    [-3.08, 0.15, 0.9, 0.34],
    [-2.5, 0.28, -2.1, 0.26],
    [2.9, 0.18, -1.5, 0.3],
    [3.1, 0.2, 0.4, 0.24],
    [0.4, 0.15, 3.15, 0.28],
    [-1.2, 0.2, 3.0, 0.22],
  ]
  shoreRocks.forEach(([x, y, z, scale], index) => {
    const rock = mesh(
      island,
      new THREE.DodecahedronGeometry(scale, 0),
      index % 2 === 0 ? materials.rock : materials.rockDark,
      [x, y, z],
    )
    rock.rotation.set(index * 0.4, index * 0.8, index * 0.2)
  })

  for (let index = 0; index < 7; index += 1) {
    const angle = -0.4 + index * 0.31
    box(
      island,
      materials.cream,
      [0.42, 0.035, 0.25],
      [0.55 + Math.cos(angle) * index * 0.27, 1.075, 0.36 + Math.sin(angle) * 0.22],
      [0, -angle * 1.4, 0],
    )
  }

  const camp = new THREE.Group()
  const dock = new THREE.Group()
  const cabinStage = new THREE.Group()
  const lighthouseStage = new THREE.Group()
  const castleStage = new THREE.Group()
  const stageGroups: Record<BuildingId, THREE.Group> = {
    camp,
    dock,
    cabin: cabinStage,
    lighthouse: lighthouseStage,
    castle: castleStage,
  }
  BUILDING_ORDER.forEach((id) => island.add(stageGroups[id]))

  // 营地：石圈篝火、帐篷和一棵棕榈树。
  const firePosition: [number, number, number] = [-1.2, 1.12, 0.4]
  for (let index = 0; index < 7; index += 1) {
    const angle = (index / 7) * Math.PI * 2
    const stone = mesh(
      camp,
      new THREE.DodecahedronGeometry(0.11, 0),
      index % 2 ? materials.rock : materials.rockDark,
      [firePosition[0] + Math.cos(angle) * 0.32, 1.08, firePosition[2] + Math.sin(angle) * 0.32],
    )
    stone.rotation.set(index, index * 0.5, 0)
  }
  box(camp, materials.woodDark, [0.52, 0.1, 0.12], [firePosition[0], 1.13, firePosition[2]], [0, 0.6, 0])
  box(camp, materials.woodDark, [0.52, 0.1, 0.12], [firePosition[0], 1.13, firePosition[2]], [0, -0.7, 0])

  const flameOuterMaterial = new THREE.MeshBasicMaterial({ color: '#f28b4f' })
  const flameInnerMaterial = new THREE.MeshBasicMaterial({ color: '#ffe08a' })
  const flameOuter = mesh(
    camp,
    new THREE.ConeGeometry(0.2, 0.55, 6),
    flameOuterMaterial,
    [firePosition[0], 1.4, firePosition[2]],
  )
  const flameInner = mesh(
    camp,
    new THREE.ConeGeometry(0.11, 0.34, 6),
    flameInnerMaterial,
    [firePosition[0], 1.28, firePosition[2]],
  )
  flameOuter.castShadow = false
  flameInner.castShadow = false

  mesh(camp, new THREE.ConeGeometry(0.74, 0.85, 3), materials.sand, [-2.15, 1.42, 0.85])
  const palm = new THREE.Group()
  palm.position.set(1.5, 1.05, -0.35)
  palm.rotation.z = -0.08
  camp.add(palm)
  cylinder(palm, materials.wood, [0.11, 0.16, 1.35], [0, 0.68, 0], 6)
  for (let index = 0; index < 6; index += 1) {
    const leaf = box(
      palm,
      index % 2 ? materials.leaf : materials.leafDark,
      [0.92, 0.055, 0.22],
      [Math.cos(index * 1.05) * 0.36, 1.34, Math.sin(index * 1.05) * 0.36],
      [0.15, -index * 1.05, -0.22],
    )
    leaf.castShadow = true
  }

  // 码头：木板栈桥和一艘会随波起伏的小帆船。
  for (let index = 0; index < 5; index += 1) {
    box(
      dock,
      index % 2 ? materials.wood : materials.woodDark,
      [0.72, 0.08, 1.0],
      [2.35 + index * 0.62, 0.77, 1.44],
      [0, -0.08, 0],
    )
    if (index < 4) {
      cylinder(dock, materials.woodDark, [0.06, 0.075, 0.9], [2.6 + index * 0.62, 0.36, 1.0], 5)
      cylinder(dock, materials.woodDark, [0.06, 0.075, 0.9], [2.6 + index * 0.62, 0.36, 1.9], 5)
    }
  }

  const boat = new THREE.Group()
  boat.position.set(4.55, 0.38, 1.42)
  boat.rotation.y = -0.3
  dock.add(boat)
  box(boat, materials.woodDark, [1.25, 0.28, 0.58], [0, 0, 0])
  const bow = mesh(boat, new THREE.ConeGeometry(0.3, 0.55, 4), materials.woodDark, [0.82, 0.03, 0])
  bow.rotation.z = -Math.PI / 2
  bow.rotation.y = Math.PI / 4
  cylinder(boat, materials.wood, [0.035, 0.04, 1.15], [0.05, 0.6, 0], 5)
  const sailGeometry = new THREE.BufferGeometry()
  sailGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 0, 1.02, 0, 0.62, 0, 0], 3),
  )
  sailGeometry.computeVertexNormals()
  const sail = mesh(
    boat,
    sailGeometry,
    new THREE.MeshStandardMaterial({
      color: '#fff6dd',
      roughness: 0.8,
      side: THREE.DoubleSide,
      flatShading: true,
    }),
    [0.08, 0.12, 0.02],
  )
  sail.castShadow = true

  // 小屋：奶油色墙体、红色尖顶、会亮起的窗，以及一座转动的风车。
  box(cabinStage, materials.cream, [1.35, 1.05, 1.15], [-1.2, 1.62, -0.72])
  const cabinRoof = mesh(
    cabinStage,
    new THREE.ConeGeometry(0.98, 0.68, 4),
    materials.roof,
    [-1.2, 2.47, -0.72],
  )
  cabinRoof.rotation.y = Math.PI / 4
  box(cabinStage, materials.woodDark, [0.3, 0.56, 0.06], [-1.2, 1.38, -0.13])
  box(cabinStage, materials.window, [0.22, 0.22, 0.055], [-1.58, 1.78, -0.13])
  box(cabinStage, materials.window, [0.22, 0.22, 0.055], [-0.82, 1.78, -0.13])
  box(cabinStage, materials.red, [0.18, 0.5, 0.18], [-1.62, 2.4, -0.98])
  box(cabinStage, materials.cream, [0.24, 0.06, 0.24], [-1.62, 2.67, -0.98])

  const windmill = new THREE.Group()
  windmill.position.set(1.38, 1.05, -1.35)
  cabinStage.add(windmill)
  cylinder(windmill, materials.cream, [0.3, 0.52, 1.7], [0, 0.85, 0], 6)
  const windmillRoof = mesh(
    windmill,
    new THREE.ConeGeometry(0.44, 0.42, 6),
    materials.roof,
    [0, 1.86, 0],
  )
  windmillRoof.rotation.y = Math.PI / 6
  const windmillBlades = new THREE.Group()
  windmillBlades.position.set(0, 1.05, 0.59)
  windmill.add(windmillBlades)
  cylinder(windmillBlades, materials.woodDark, [0.09, 0.09, 0.18], [0, 0, 0], 6).rotation.x =
    Math.PI / 2
  for (let index = 0; index < 4; index += 1) {
    const blade = box(
      windmillBlades,
      materials.cream,
      [0.16, 0.92, 0.06],
      [0, 0, 0],
      [0, 0, index * (Math.PI / 2)],
    )
    blade.geometry.translate(0, 0.48, 0)
  }

  // 灯塔：红白塔身、夜间光束和一条伸向海面的石桥。
  const lighthouse = new THREE.Group()
  lighthouse.position.set(2.25, 1.05, -0.5)
  lighthouseStage.add(lighthouse)
  cylinder(lighthouse, materials.white, [0.56, 0.7, 0.34], [0, 0.17, 0], 8)
  cylinder(lighthouse, materials.white, [0.43, 0.55, 0.72], [0, 0.61, 0], 8)
  cylinder(lighthouse, materials.red, [0.41, 0.43, 0.32], [0, 1.11, 0], 8)
  cylinder(lighthouse, materials.white, [0.37, 0.41, 0.52], [0, 1.52, 0], 8)
  cylinder(lighthouse, materials.red, [0.34, 0.37, 0.26], [0, 1.9, 0], 8)
  cylinder(lighthouse, materials.lantern, [0.31, 0.34, 0.34], [0, 2.18, 0], 8)
  const lighthouseRoof = mesh(
    lighthouse,
    new THREE.ConeGeometry(0.45, 0.34, 8),
    materials.red,
    [0, 2.52, 0],
  )
  lighthouseRoof.rotation.y = Math.PI / 8
  cylinder(lighthouse, materials.dark, [0.04, 0.04, 0.22], [0, 2.81, 0], 5)

  const beamGroup = new THREE.Group()
  beamGroup.position.set(0, 2.18, 0)
  lighthouse.add(beamGroup)
  const beamGeometry = new THREE.ConeGeometry(1.8, 5.6, 16, 1, true)
  beamGeometry.translate(0, -2.8, 0)
  beamGeometry.rotateZ(Math.PI / 2)
  const beamMaterial = new THREE.MeshBasicMaterial({
    color: '#ffe5a8',
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const beam = new THREE.Mesh(beamGeometry, beamMaterial)
  beam.castShadow = false
  beamGroup.add(beam)

  const bridgeMaterial = materials.stone
  const bridgeBlocks: Array<[number, number, number, number]> = [
    [-3.18, 0.5, 0.82, 0.5],
    [-3.72, 0.58, 0.7, 0.46],
    [-4.26, 0.66, 0.58, 0.42],
    [-4.78, 0.74, 0.46, 0.38],
  ]
  bridgeBlocks.forEach(([x, y, z, size], index) => {
    const block = box(
      lighthouseStage,
      bridgeMaterial,
      [size, 0.18, 0.74],
      [x, y, z],
      [0, index * 0.08, 0],
    )
    block.receiveShadow = true
  })

  const treePositions: Array<[number, number, number, number]> = [
    [-2.28, 1.04, 1.28, 1.02],
    [-2.35, 1.04, -0.35, 0.9],
    [0.98, 1.04, 1.58, 0.82],
    [1.92, 1.04, 1.02, 0.95],
    [-0.55, 1.04, -2.05, 0.8],
    [2.0, 1.04, -1.7, 0.72],
  ]
  treePositions.forEach(([x, y, z, scale]) => {
    createTree(
      lighthouseStage,
      materials.leaf,
      materials.leafDark,
      materials.wood,
      [x, y, z],
      scale,
    )
  })
  for (let index = 0; index < 12; index += 1) {
    const angle = index * 1.9
    const radius = 1.7 + (index % 4) * 0.23
    mesh(
      lighthouseStage,
      new THREE.SphereGeometry(0.055, 5, 4),
      index % 3 === 0 ? materials.gold : materials.cream,
      [Math.cos(angle) * radius, 1.12, Math.sin(angle) * radius],
    )
  }

  // 城堡：建在小山丘上，两侧尖塔，夜里窗和旗帜都清晰可见。
  const castleHill = cylinder(
    castleStage,
    materials.grassLight,
    [1.25, 1.52, 0.55],
    [-0.3, 1.33, -1.85],
    7,
  )
  castleHill.receiveShadow = true
  const castle = new THREE.Group()
  castle.position.set(-0.3, 1.6, -1.85)
  castleStage.add(castle)
  box(castle, materials.stone, [1.3, 1.08, 1.0], [0, 0.54, 0])
  for (const x of [-0.48, 0.48]) {
    for (const z of [-0.33, 0.33]) {
      box(castle, materials.stone, [0.22, 0.24, 0.22], [x, 1.18, z])
    }
  }
  box(castle, materials.dark, [0.36, 0.56, 0.06], [0, 0.32, 0.51])
  box(castle, materials.window, [0.16, 0.18, 0.05], [-0.34, 0.76, 0.515])
  box(castle, materials.window, [0.16, 0.18, 0.05], [0.34, 0.76, 0.515])
  for (const x of [-0.82, 0.82]) {
    cylinder(castle, materials.stone, [0.3, 0.4, 1.45], [x, 0.72, -0.04], 7)
    const towerRoof = mesh(
      castle,
      new THREE.ConeGeometry(0.46, 0.52, 7),
      materials.roof,
      [x, 1.68, -0.04],
    )
    towerRoof.rotation.y = Math.PI / 7
  }
  cylinder(castle, materials.stone, [0.34, 0.44, 1.85], [0, 1.45, -0.12], 7)
  const keepRoof = mesh(
    castle,
    new THREE.ConeGeometry(0.52, 0.68, 7),
    materials.roof,
    [0, 2.7, -0.12],
  )
  keepRoof.rotation.y = Math.PI / 7
  cylinder(castle, materials.dark, [0.025, 0.025, 0.65], [0, 3.32, -0.12], 5)
  box(castle, materials.red, [0.38, 0.22, 0.025], [0.2, 3.48, -0.12])

  const balloon = new THREE.Group()
  balloon.position.set(2.25, 4.9, -1.4)
  castleStage.add(balloon)
  const balloonShell = mesh(
    balloon,
    new THREE.SphereGeometry(0.56, 10, 8),
    materials.roof,
    [0, 0.55, 0],
  )
  balloonShell.scale.set(1, 1.16, 1)
  const balloonBand = mesh(
    balloon,
    new THREE.SphereGeometry(0.565, 10, 3, 0, Math.PI * 2, 0.8, 0.45),
    materials.gold,
    [0, 0.54, 0],
  )
  balloonBand.scale.set(1, 1.16, 1)
  box(balloon, materials.woodDark, [0.32, 0.24, 0.28], [0, -0.12, 0])
  for (const x of [-0.12, 0.12]) {
    box(balloon, materials.woodDark, [0.02, 0.52, 0.02], [x, 0.14, 0.09], [0.2, 0, 0])
  }

  // 天空：星星、月亮和两团低多边形云。
  const starGeometry = new THREE.BufferGeometry()
  const starPositions = new Float32Array(300 * 3)
  for (let index = 0; index < 300; index += 1) {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.random() * Math.PI * 0.42
    const radius = 25 + Math.random() * 9
    starPositions[index * 3] = Math.cos(theta) * Math.sin(phi) * radius
    starPositions[index * 3 + 1] = 5 + Math.cos(phi) * radius
    starPositions[index * 3 + 2] = Math.sin(theta) * Math.sin(phi) * radius - 6
  }
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
  const starMaterial = new THREE.PointsMaterial({
    color: '#fff7dc',
    size: 0.12,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: true,
  })
  const stars = new THREE.Points(starGeometry, starMaterial)
  stars.frustumCulled = false
  scene.add(stars)

  const moonMaterial = new THREE.MeshBasicMaterial({
    color: '#fff1c7',
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1.15, 16, 12), moonMaterial)
  moon.position.set(-7.5, 9.5, -13)
  scene.add(moon)

  const cloudMaterial = new THREE.MeshStandardMaterial({
    color: '#fffdf5',
    roughness: 1,
    transparent: true,
    opacity: 0.72,
    flatShading: true,
  })
  const cloudPuffs = [
    [-6.5, 6.2, -8, 1.1],
    [6.8, 7.1, -9, 0.9],
  ]
  const clouds: THREE.Group[] = []
  cloudPuffs.forEach(([x, y, z, scale]) => {
    const cloud = new THREE.Group()
    cloud.position.set(x, y, z)
    cloud.scale.setScalar(scale)
    scene.add(cloud)
    for (const [px, py, pz, size] of [
      [-0.8, 0, 0, 0.62],
      [0, 0.25, 0, 0.8],
      [0.8, 0, 0, 0.56],
      [0.2, -0.12, 0.22, 0.62],
    ]) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(size, 7, 5), cloudMaterial)
      puff.position.set(px, py, pz)
      cloud.add(puff)
    }
    clouds.push(cloud)
  })

  const revealStates = new Map<
    BuildingId,
    { visible: boolean; current: number; appearAt: number }
  >()
  BUILDING_ORDER.forEach((id) => {
    revealStates.set(id, { visible: false, current: 0, appearAt: 0 })
    stageGroups[id].scale.setScalar(0.001)
    stageGroups[id].visible = false
  })

  const target: SceneState = { ...initial }
  let renderedDayNight = initial.dayNight
  let elapsed = 0
  let frameCount = 0
  let frame = 0
  let running = true
  let lastTime = performance.now()
  let readySent = false
  const bursts = new Set<CoinBurst>()

  function easeOutBack(value: number): number {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * (value - 1) ** 3 + c1 * (value - 1) ** 2
  }

  function updateReveal(id: BuildingId, visible: boolean, delta: number): void {
    const state = revealStates.get(id)
    const group = stageGroups[id]
    if (!state) return

    if (visible) {
      if (!state.visible) {
        state.visible = true
        state.current = 0.001
        state.appearAt = elapsed
      }
      const progress = Math.min(1, (elapsed - state.appearAt) / 0.72)
      state.current = Math.max(0.001, easeOutBack(progress))
    } else {
      state.visible = false
      state.current = Math.max(0, state.current - delta * 4.4)
    }

    group.scale.setScalar(state.current)
    group.visible = state.current > 0.004
  }

  function updateEnvironment(delta: number): void {
    const blend = 1 - Math.exp(-delta * 2.6)
    renderedDayNight += (target.dayNight - renderedDayNight) * blend
    const night = 1 - renderedDayNight
    const hpFactor = 0.78 + Math.min(100, Math.max(0, target.hp)) / 100 * 0.22

    hemisphere.color.copy(nightSky).lerp(daySky, renderedDayNight)
    hemisphere.groundColor.copy(nightGround).lerp(dayGround, renderedDayNight)
    hemisphere.intensity = 0.42 + renderedDayNight * 0.82
    sun.color.copy(nightSun).lerp(daySun, renderedDayNight)
    sun.intensity = (0.14 + renderedDayNight * 2.1) * hpFactor
    fillLight.intensity = 0.12 + renderedDayNight * 0.38
    waterMaterial.color.copy(nightOcean).lerp(dayOcean, renderedDayNight)
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(nightFog).lerp(dayFog, renderedDayNight)
    }
    starMaterial.opacity = night * 0.95
    moonMaterial.opacity = night * 0.92
    materials.window.emissiveIntensity = 0.25 + night * 1.5
    materials.lantern.emissiveIntensity = 0.45 + night * 1.9
    cloudMaterial.color.set(night > 0.5 ? '#b9ced2' : '#fffdf5')
    cloudMaterial.opacity = 0.42 + renderedDayNight * 0.3
    fireLight.intensity = night * (1.9 + Math.sin(elapsed * 8.5) * 0.25)
    cabinLight.intensity = night * 1.2
    lighthouseLight.intensity = night * 2.8
    beamMaterial.opacity = night * 0.14
    renderer.toneMappingExposure = 0.9 + renderedDayNight * 0.18
  }

  function animateWaves(): void {
    for (let index = 0; index < waterPosition.count; index += 1) {
      const x = waterBase[index * 3]
      const z = waterBase[index * 3 + 2]
      waterPosition.setY(
        index,
        Math.sin(x * 0.42 + elapsed * 0.9) * 0.075 +
          Math.cos(z * 0.34 + elapsed * 0.7) * 0.06,
      )
    }
    waterPosition.needsUpdate = true
    if (frameCount % 3 === 0) waterGeometry.computeVertexNormals()
  }

  function spawnCoins(): void {
    if (reducedMotion) return
    const burst = new CoinBurst(new THREE.Vector3(0, 7.2, 0), compact ? 6 : 8, 2.8)
    bursts.add(burst)
    scene.add(burst.group)
  }

  function tick(now: number): void {
    if (!running) return
    const delta = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000))
    lastTime = now
    elapsed += delta
    frameCount += 1

    updateEnvironment(delta)

    if (!reducedMotion) {
      animateWaves()
      windmillBlades.rotation.z += delta * 0.9
      boat.position.y = 0.38 + Math.sin(elapsed * 1.6) * 0.055
      boat.rotation.z = Math.sin(elapsed * 1.1) * 0.035
      flameOuter.scale.setScalar(0.92 + Math.sin(elapsed * 11) * 0.08)
      flameInner.scale.setScalar(0.9 + Math.sin(elapsed * 14 + 1) * 0.1)
      balloon.position.y = 4.9 + Math.sin(elapsed * 0.9) * 0.16
      balloon.rotation.y = Math.sin(elapsed * 0.55) * 0.08
      beamGroup.rotation.y += delta * 0.42
      clouds.forEach((cloud, index) => {
        cloud.position.x += Math.sin(elapsed * 0.12 + index * 2.4) * delta * 0.03
      })
    }

    const visibility = getBuildingVisibility(target.progress)
    BUILDING_ORDER.forEach((id) => updateReveal(id, visibility[id], delta))

    bursts.forEach((burst) => {
      if (!burst.update(delta)) {
        scene.remove(burst.group)
        burst.dispose()
        bursts.delete(burst)
      }
    })

    controls.update()
    renderer.render(scene, camera)

    if (!readySent) {
      readySent = true
      onReady()
    }
    frame = window.requestAnimationFrame(tick)
  }

  function handleVisibilityChange(): void {
    if (document.hidden) {
      running = false
      window.cancelAnimationFrame(frame)
    } else if (!running) {
      running = true
      lastTime = performance.now()
      frame = window.requestAnimationFrame(tick)
    }
  }

  function handleContextLost(event: Event): void {
    event.preventDefault()
    onUnavailable()
  }

  const resizeObserver = new ResizeObserver(() => {
    const nextWidth = container.clientWidth || window.innerWidth
    const nextHeight = container.clientHeight || window.innerHeight
    camera.aspect = nextWidth / nextHeight
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, nextWidth < 768 ? 1.5 : 2),
    )
    renderer.setSize(nextWidth, nextHeight)
  })
  resizeObserver.observe(container)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  renderer.domElement.addEventListener('webglcontextlost', handleContextLost)

  frame = window.requestAnimationFrame(tick)

  return {
    update(next) {
      target.progress = next.progress
      target.dayNight = next.dayNight
      target.hp = next.hp
    },
    spawnCoins,
    dispose() {
      running = false
      window.cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost)
      resizeObserver.disconnect()
      controls.dispose()
      bursts.forEach((burst) => {
        scene.remove(burst.group)
        burst.dispose()
      })
      bursts.clear()

      const geometries = new Set<THREE.BufferGeometry>()
      const sceneMaterials = new Set<THREE.Material>()
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          if (!geometries.has(object.geometry)) {
            object.geometry.dispose()
            geometries.add(object.geometry)
          }
          const objectMaterials = Array.isArray(object.material)
            ? object.material
            : [object.material]
          objectMaterials.forEach((material) => {
            if (!sceneMaterials.has(material)) {
              material.dispose()
              sceneMaterials.add(material)
            }
          })
        }
      })
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}

export default function Island3D({
  progress,
  dayNight,
  hp,
  coinSignal,
  onReady,
  onUnavailable,
}: Island3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<SceneApi | null>(null)
  const onReadyRef = useRef(onReady)
  const onUnavailableRef = useRef(onUnavailable)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    onReadyRef.current = onReady
    onUnavailableRef.current = onUnavailable
  }, [onReady, onUnavailable])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    if (!supportsWebGL()) {
      onUnavailableRef.current?.()
      return
    }

    let api: SceneApi | null = null
    try {
      api = createIslandScene(
        container,
        { progress, dayNight, hp },
        () => {
          setReady(true)
          onReadyRef.current?.()
        },
        () => onUnavailableRef.current?.(),
      )
      apiRef.current = api
    } catch {
      onUnavailableRef.current?.()
      return
    }

    return () => {
      api?.dispose()
      apiRef.current = null
    }
    // 场景只创建一次，之后通过 update 接口更新数值。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    apiRef.current?.update({ progress, dayNight, hp })
  }, [progress, dayNight, hp])

  useEffect(() => {
    if (coinSignal > 0) apiRef.current?.spawnCoins()
  }, [coinSignal])

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-0 overflow-hidden"
      style={{ background: getSkyGradient(dayNight) }}
      data-island-3d={ready ? 'ready' : 'loading'}
      aria-hidden="true"
    >
      <div ref={containerRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_43%,transparent_35%,rgba(9,35,46,0.12)_100%)]" />
    </div>
  )
}
