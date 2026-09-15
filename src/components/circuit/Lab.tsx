import { createLab } from "~/state/circuit/actions";
import Library from "./Library";
import Editor from "./Editor";
import Inspector from "./Inspector";
import HoverCard from "./HoverCard";

const CircuitLab = () => {
  const lab = createLab();

  return (
    <main class="app-shell" tabIndex={-1} onKeyDown={lab.key}>
      <header>
        <div class="brand">
          <span class="brand-mark">ϟ</span> current
          <span class="brand-divider" />{" "}
          <span class="brand-description">An electricity playground</span>
        </div>
        <div class="header-right">
          <span class="live">
            <span class="status-dot" /> LIVE SOLVER
          </span>
          <span class="version">DC LAB / 01</span>
        </div>
      </header>
      <div class="workspace">
        <Library lab={lab} />
        <Editor lab={lab} />
        <Inspector lab={lab} />
      </div>
      <footer>
        <span>
          <span class="status-dot" /> All changes solve instantly
        </span>
        <span>
          Click terminals to wire <i>·</i> Drag to move <i>·</i> Double-click
          switches to toggle <i>·</i> Esc to cancel
        </span>
        <span>IDEAL COMPONENTS / DC</span>
      </footer>
      <HoverCard lab={lab} />
    </main>
  );
};

export default CircuitLab;
