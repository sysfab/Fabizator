import { useState } from "react";

const welcomeStorageKey = "fabizator-welcome-popup-shown";

export function shouldShowWelcomePopup() {
  try {
    return localStorage.getItem(welcomeStorageKey) !== "true";
  } catch {
    return true;
  }
}

export function WelcomePopup({ onClose }) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  function closePopup() {
    if (dontShowAgain) {
      try {
        localStorage.setItem(welcomeStorageKey, "true");
      } catch {
        // Ignore storage failures; closing should still work for this session.
      }
    }

    onClose();
  }

  return (
    <div className="welcome-backdrop" role="presentation">
      <section
        className="welcome-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
      >
        <img
          src="https://1.gravatar.com/avatar/201af21f7f48b7bd230c2a3396fcd15ae37ad4d8cc7c9c4f060c2813e843a007?size=256&d=initials"
          alt="sysfab avatar"
          className="welcome-avatar"
        />

        <div className="welcome-copy">
          <span>Welcome</span>
          <h2 id="welcome-title">Hi, I&apos;m sysfab.</h2>
          <p>
            I&apos;m the creator of this website. If you want to support my work,
            you can visit my Donatello page.
          </p>
        </div>

        <label className="welcome-checkbox">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(event) => setDontShowAgain(event.target.checked)}
          />
          <span>Don&apos;t show again</span>
        </label>

        <div className="welcome-actions">
          <a
            href="https://donatello.to/sysfab"
            target="_blank"
            rel="noreferrer"
            className="welcome-support-link"
          >
            Support
          </a>
          <button type="button" onClick={closePopup}>
            Continue
          </button>
        </div>
      </section>
    </div>
  );
}
