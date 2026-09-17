import { mountLab } from "~/state/circuit/actions";
import { analysisLabel } from "~/state/circuit/formulas";
import Playback from "./playback";
import Library from "./library";
import Editor from "./editor";
import Inspector from "./inspector";

const CircuitLab = () => {
  mountLab();

  return (
    <main class="app-shell" tabIndex={-1}>
      <header>
        <div class="brand">
          <span class="brand-mark">ϟ</span> Circuit Sketch
          <span class="brand-divider" />{" "}
          <span class="brand-description">Electricity playground</span>
        </div>
        <Playback />
      </header>
      <div class="workspace">
        <Library />
        <Editor />
        <Inspector />
      </div>
      <footer>
        <span>
          <span class="status-dot" /> {analysisLabel()}
        </span>
        <span>
          Click or drag terminals to wire <i>·</i> Drag to move <i>·</i>{" "}
          Backspace to delete <i>·</i> Esc to cancel
        </span>
        <span>IDEAL CIRCUIT MODELS</span>
      </footer>
    </main>
  );
};

export default CircuitLab;
