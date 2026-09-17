import { Show } from "solid-js";
import { playback } from "~/state/circuit/data";
import { changeSpeed, seekTime, togglePlayback } from "~/state/circuit/actions";

const Playback = () => (
  <div class="playback" role="group" aria-label="Playback">
    <button
      class="icon-button"
      aria-label={playback().running ? "Pause" : "Play"}
      title={playback().running ? "Pause" : "Play"}
      onClick={togglePlayback}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <Show
          when={playback().running}
          fallback={<path d="M4.5 2.5v11l9-5.5z" />}
        >
          <path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" />
        </Show>
      </svg>
    </button>
    <button
      class="icon-button"
      aria-label="Reset to t = 0"
      title="Reset to t = 0"
      onClick={() => seekTime(0)}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 2.5h2v11H3zM13.5 2.5v11L6 8z" />
      </svg>
    </button>
    <label class="speed" title="Simulated seconds per real second">
      ×
      <input
        aria-label="Playback speed"
        type="number"
        min="0.000001"
        step="any"
        value={playback().speed}
        onChange={(e) => changeSpeed(e.currentTarget.valueAsNumber)}
      />
    </label>
  </div>
);

export default Playback;
