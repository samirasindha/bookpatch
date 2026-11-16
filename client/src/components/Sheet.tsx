import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Hide the title visually but keep it for screen readers */
  hideTitle?: boolean;
  wide?: boolean;
  footer?: ReactNode;
  children: ReactNode;
};

/**
 * Accessible modal built on the native <dialog> element: focus is trapped and restored,
 * Escape closes it, and the page behind is inert. Becomes a bottom sheet on phones (CSS).
 */
export function Sheet({ open, onClose, title, hideTitle, wide, footer, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`sheet ${wide ? "sheet-wide" : ""}`}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // click on the backdrop
      }}
    >
      <div className="sheet-head">
        <h2 id={titleId} className={hideTitle ? "visually-hidden" : "section-title"}>
          {title}
        </h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close" style={{ marginLeft: "auto" }}>
          <Icon name="close" />
        </button>
      </div>
      <div className="sheet-body">{open && children}</div>
      {footer && <div className="sheet-foot">{footer}</div>}
    </dialog>
  );
}
