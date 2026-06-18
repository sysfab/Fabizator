import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHeart } from "@fortawesome/free-solid-svg-icons";

export function ExportPopup({ onClose }) {
  return (
    <div className="welcome-backdrop" role="presentation">
      <section
        className="welcome-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
      >
        <div className="welcome-copy">
          <span>Export complete</span>
          <h2 id="export-title">Your JAR was exported.</h2>
          <p>
            Thanks for using Fabizator! If it helped you with your mod, you can support my work on
            Donatello.
          </p>
        </div>

        <div className="welcome-actions">
          <a
            href="https://donatello.to/sysfab"
            target="_blank"
            rel="noreferrer"
            className="welcome-support-link"
          >
            <span>Support</span> <FontAwesomeIcon icon={faHeart}/>
          </a>
          <button type="button" onClick={onClose}>
            Continue
          </button>
        </div>
      </section>
    </div>
  );
}
