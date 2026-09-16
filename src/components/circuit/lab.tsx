import { mountLab } from "~/state/circuit/actions";
import Library from "./library";
import Editor from "./editor";
import Inspector from "./inspector";

const CircuitLab = () => {
  mountLab();

  return (
    <main class="app-shell" tabIndex={-1}>
      <header>
        <div class="brand">
          <span class="brand-mark">ϟ</span> current
          <span class="brand-divider" />{" "}
          <span class="brand-description">Circuit editor</span>
        </div>
        <div class="header-right">
          <span class="live">
            <span class="status-dot" /> LIVE SOLVER
          </span>
          <span class="version">DC</span>
        </div>
      </header>
      <div class="workspace">
        <Library />
        <Editor />
        <Inspector />
      </div>
      <footer>
        <span>
          <span class="status-dot" /> DC steady state
        </span>
        <span>
          Click or drag terminals to wire <i>·</i> Drag to move <i>·</i>{" "}
          Backspace to delete <i>·</i> Esc to cancel
        </span>
        <span>DC COMPONENT MODELS</span>
      </footer>
    </main>
  );
};

export default CircuitLab;
