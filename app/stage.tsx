import { MirisStream } from '@miris-inc/three'
import { extend, type ThreeElement } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import {
    Fn,
    float,
    hash,
    step,
    texture,
    time,
    uv,
    vec2,
    vec3,
    vec4,
} from 'three/tsl'
import {
    Controls,
    Door,
    Platform,
    Readout,
    Room,
    Scene,
    Screen,
    ScreenFx,
    screenTexture,
    Specimen,
    Walkway,
} from '../miris'
import specimens from './specimens.json' with { type: 'json' }

extend({ MirisStream })

declare module '@react-three/fiber' {
    interface ThreeElements {
        mirisStream: ThreeElement<typeof MirisStream>
    }
}

// The viewer key you scoped to your six assets. Every stream reads through it.
const viewerKey = '3ZyQgAqdgKIkBmDYPKJPxtToTuD5J90Ff9byHu0TC9Q'

// The file is HTML. The browser lays it out with the lab's own CSS; the next
// step draws it into a canvas, and that canvas becomes a texture on a plane.
const fileMarkup = (dossier: any) => `
  <div class="mw-dossier mw-screen">
    <header class="mw-d-terminal">MIRIS BIOLOGY DIVISION <span>M-06 / RECORD ACCESS</span></header>
    <div>
      <p class="mw-d-code">${dossier.designation} / ${dossier.series}</p>
      <h3>${dossier.name}</h3>
      <p class="mw-d-class">${dossier.classification}</p>
      <ol class="mw-d-series">
        ${dossier.stages
            .map(
                (stageName: string, stageIndex: number) => `
          <li class="${stageIndex === dossier.index ? 'on' : ''}"><b>${String(stageIndex + 1).padStart(2, '0')}</b><span>${stageName}</span></li>`
            )
            .join('')}
      </ol>
      <p class="mw-d-stage">Stage ${dossier.index + 1} of ${dossier.stages.length}: ${dossier.stage}</p>
      <ul class="mw-d-stats">
        ${(dossier.stats || [])
            .map(
                (stat: any) => `
          <li><span>${stat.label}</span><i><b style="width:${stat.value}%"></b></i><span>${stat.value}</span></li>`
            )
            .join('')}
      </ul>
    </div>
    <div>
      <p class="mw-d-head">Field observations</p>
      <p class="mw-d-notes">${dossier.notes}</p>
    </div>
    <footer class="mw-d-terminal">BIOLOGICAL RECORD / READ ONLY <span>TERMINAL ${String(dossier.index + 1).padStart(2, '0')} / 06</span></footer>
  </div>`

// Lay the file out as real HTML inside a canvas, draw it in whenever it
// paints, and wear that canvas as the texture of a plane.
function File({ dossier }: any) {
    const [texture, setTexture] = useState<CanvasTexture | null>(null)

    useEffect(() => {
        const canvas = document.createElement('canvas')
        canvas.setAttribute('layoutsubtree', '')
        canvas.width = 1280
        canvas.height = 800
        // On the page but under the room: only what the browser paints can be drawn.
        canvas.style.cssText =
            'position: fixed; top: 0; left: 0; z-index: -1; pointer-events: none'
        canvas.innerHTML = fileMarkup(dossier)
        document.body.append(canvas)

        const painted = new CanvasTexture(canvas)
        painted.colorSpace = SRGBColorSpace
        canvas.onpaint = () => {
            const context = canvas.getContext('2d')!
            context.setTransform(2, 0, 0, 2, 0, 0)
            context.drawElementImage(canvas.firstElementChild!, 0, 0)
            painted.needsUpdate = true
        }
        canvas.requestPaint?.()
        setTexture(painted)

        return () => {
            canvas.remove()
            painted.dispose()
        }
    }, [dossier])

    if (!texture) return null
    return (
        <mesh>
            <planeGeometry args={[1.6, 1]} />
            <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
    )
}

// Your file. Each step adds a few lines to it.
export default function Stage() {
    const glitch = useMemo(
        () =>
            Fn(() => {
                const point = uv()
                const tick = time.mul(2).floor()
                const live = step(float(0.55), hash(tick.add(3)))
                const band = step(
                    point.y.sub(hash(tick)).abs(),
                    hash(tick.add(5)).mul(0.05).add(0.015)
                )
                const shift = band
                    .mul(live)
                    .mul(hash(tick.add(9)).sub(0.5))
                    .mul(0.06)
                const shifted = vec2(point.x.add(shift), point.y)
                const split = vec2(0.004, 0)
                const red = texture(screenTexture, shifted.sub(split)).g
                const green = texture(screenTexture, shifted).g
                const blue = texture(screenTexture, shifted.add(split)).g
                const phase = point.y.mul(6).add(time.mul(0.6))
                const sheen = vec3(
                    phase.sin(),
                    phase.add(2.09).sin(),
                    phase.add(4.19).sin()
                )
                    .mul(0.12)
                    .add(0.88)
                const picture = vec3(
                    red.mul(0.7),
                    green.mul(0.95),
                    blue.mul(1.2)
                )
                    .mul(sheen)
                    .add(vec3(0.03, 0.08, 0.14))
                const scan = point.y.mul(500).sin().mul(0.1).add(0.9)
                const roll = point.y
                    .sub(time.mul(0.25))
                    .fract()
                    .sub(0.5)
                    .abs()
                    .mul(2)
                    .oneMinus()
                    .pow(4)
                    .mul(0.25)
                    .add(1)
                const cell = point.mul(vec2(640, 400)).floor()
                const grain = hash(
                    cell.x
                        .add(cell.y.mul(640))
                        .add(time.mul(24).floor().mul(97))
                )
                    .mul(0.12)
                    .add(0.93)
                const edge = point.x
                    .mul(point.x.oneMinus())
                    .mul(point.y)
                    .mul(point.y.oneMinus())
                    .mul(16)
                    .pow(0.2)
                return vec4(
                    picture.mul(scan).mul(roll).mul(grain).mul(edge),
                    float(1)
                )
            })(),
        []
    )

    return (
        <>
            <Scene>
                <Room />
                <Platform />
                <Walkway />
                <Door />
                {specimens.map((specimen, index) => (
                    <Specimen key={index}>
                        <mirisStream
                            args={[{ uuid: specimen.uuid, viewerKey }]}
                            scale={specimen.scale}
                        />
                        <Screen>
                            <File />
                        </Screen>
                    </Specimen>
                ))}
            </Scene>
            <Readout />
            <ScreenFx node={glitch} />
            <Controls />
        </>
    )
}
