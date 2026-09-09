import { MirisStream } from '@miris-inc/three'
import { extend, type ThreeElement } from '@react-three/fiber'
import { Door, Platform, Room, Scene, Specimen, Walkway } from '../miris'
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

function File({ dossier }: any) {
    return null
}

// Your file. Each step adds a few lines to it.
export default function Stage() {
    const glitch = null

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
                    </Specimen>
                ))}
            </Scene>
        </>
    )
}
