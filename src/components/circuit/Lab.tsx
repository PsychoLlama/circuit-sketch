import { createLab } from "~/state/circuit/actions";
import Library from "./Library";
import Editor from "./Editor";
import Inspector from "./Inspector";

const CircuitLab = () => {
  const lab = createLab();

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
        <Library lab={lab} />
        <Editor lab={lab} />
        <Inspector lab={lab} />
      </div>
      <footer>
        <span>
          <span class="status-dot" /> DC steady state
        </span>
        <span>
          Click or drag terminals to wire <i>·</i> Drag to move <i>·</i>{" "}
          Backspace to delete <i>·</i> Esc to cancel
        </span>
        <span>IDEAL COMPONENTS / DC</span>
      </footer>
    </main>
  );
};

export default CircuitLab;
