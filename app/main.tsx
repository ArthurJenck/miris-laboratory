import { createRoot } from "react-dom/client";
import { Workshop } from "../miris";
import Stage from "./stage";

createRoot(document.getElementById("root")!).render(<Workshop stage={Stage} />);
