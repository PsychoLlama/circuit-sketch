import { mountLab } from "~/state/circuit/actions";
import { analysisLabel } from "~/state/circuit/formulas";
import Timeline from "./timeline";
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
        <div class="header-right">
          <span class="live">
            <span class="status-dot" /> LIVE SOLVER
          </span>
          <span class="version">RC</span>
        </div>
      </header>
      <Timeline />
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
