import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

/** Live camera barcode reader. Calls onCode for each ISBN-looking barcode it sees. */
export function CameraScanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const cb = useRef(onCode);
  cb.current = onCode;

  useEffect(() => {
    let controls: IScannerControls | undefined;
    let cancelled = false;
    const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A]]]);
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });

    reader
      .decodeFromConstraints({ video: { facingMode: "environment" } }, video.current!, (result) => {
        if (result) cb.current(result.getText());
      })
      .then((c) => {
        if (cancelled) c.stop();
        else controls = c;
      })
      .catch((e: Error) => {
        setError(
          e.name === "NotAllowedError"
            ? "Camera access was blocked. Allow it in your browser settings, or type the ISBN below."
            : "No camera is available on this device. Use a handheld scanner or type the ISBN below.",
        );
      });

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, []);

  if (error) return <p className="form-error">{error}</p>;
  return (
    <div className="scan-video">
      <video ref={video} muted playsInline aria-label="Camera preview" />
      <div className="scan-frame" aria-hidden="true" />
    </div>
  );
}
