import { createPortal } from "@react-three/fiber";
import { Component, cloneElement, isValidElement, type ReactNode, useContext } from "react";
import { canDrawHtml } from "./renderPath";
import ScreenPicture from "./ScreenPicture";
import { SpecimenContext } from "./specimenContext";

/** The pedestal's screen. Put it inside a Specimen with your File inside it:
 *  Screen hands that component this specimen's dossier as its `dossier` prop
 *  and draws it on the pedestal, however deep inside the Specimen it was written.
 *
 *  A browser that cannot draw HTML into a canvas, every phone among them, gets
 *  the picture of this screen the workshop captured instead of the File. */
export default function Screen({ children }: { children?: ReactNode }) {
  const slot = useContext(SpecimenContext);
  if (!slot || !slot.dossier) return null;
  if (!canDrawHtml()) return createPortal(<ScreenPicture index={slot.index} />, slot.screenTarget);
  const painted = isValidElement(children) ? cloneElement(children as any, { dossier: slot.dossier }) : children;
  return createPortal(<Quietly>{painted}</Quietly>, slot.screenTarget);
}

/* The child is the attendee's code mid-edit. A throw there should cost the
   screen, not the room. */
class Quietly extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("The file's markup or paint threw; showing no screen until it is fixed.", error);
  }
  componentDidUpdate(previous: { children: ReactNode }) {
    if (this.state.failed && previous.children !== this.props.children) this.setState({ failed: false });
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
